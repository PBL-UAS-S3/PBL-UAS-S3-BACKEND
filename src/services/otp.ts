import crypto from "crypto";
import { promises as dns } from "dns";
import bcrypt from "bcrypt";
import { db } from "../config/db";
import { kirimEmail } from "./email";
import { emailTidakTerkirim } from "./bounce";
import { HttpError } from "../utils/error";

export const MIN_PASSWORD = 8;
export const POLA_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const KODE_BERLAKU_MENIT = 10;
const JEDA_KIRIM_DETIK = 60;
const MAKS_PERCOBAAN = 5;

function escapeHtml(teks: string): string {
  return String(teks)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Cek apakah domain email benar-benar punya server email (MX record)
export async function domainEmailValid(email: string): Promise<boolean> {
  const domain = email.split("@")[1];
  try {
    const mx = await dns.resolveMx(domain);
    return mx.length > 0;
  } catch (err: any) {
    if (err.code === "ENOTFOUND" || err.code === "ENODATA") return false;
    // masalah DNS sementara, jangan blokir pendaftar
    return true;
  }
}

function buatKode(): string {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function templateEmailKode(nama: string, kode: string, tujuan: string): string {
  const keterangan =
    tujuan === "verifikasi"
      ? "Gunakan kode berikut untuk memverifikasi email akun Stockin kamu."
      : "Gunakan kode berikut untuk mengatur ulang password akun Stockin kamu.";
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
<h2 style="color:#1E3A8A;margin:0 0 12px">Stockin</h2>
<p>Halo ${escapeHtml(nama)},</p>
<p>${keterangan}</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#E8EEFC;color:#1E3A8A;padding:16px;text-align:center;border-radius:12px;margin:20px 0">${kode}</p>
<p>Kode berlaku ${KODE_BERLAKU_MENIT} menit. Jangan bagikan kode ini ke siapa pun.</p>
<p style="color:#64748b;font-size:13px">Jika kamu tidak merasa memintanya, abaikan email ini.</p>
</div>`;
}

// Buat kode baru, simpan hash-nya, lalu kirim ke email.
// cekAlamat: setelah terkirim, pastikan alamat tidak ditolak (dipakai saat daftar).
export async function kirimKodeOtp(
  email: string,
  tujuan: string,
  nama: string,
  opsi: { cekAlamat?: boolean } = {},
) {
  const [terakhir] = await db.query<any[]>(
    "select timestampdiff(second, created_at, now()) as detik from kode_verifikasi where email = ? and tujuan = ? order by id desc limit 1",
    [email, tujuan],
  );
  if (terakhir.length > 0 && terakhir[0].detik < JEDA_KIRIM_DETIK) {
    const sisa = JEDA_KIRIM_DETIK - terakhir[0].detik;
    throw new HttpError(429, `Tunggu ${sisa} detik sebelum meminta kode baru`);
  }

  const kode = buatKode();
  const kodeHash = await bcrypt.hash(kode, 10);

  await db.query("delete from kode_verifikasi where email = ? and tujuan = ?", [
    email,
    tujuan,
  ]);
  await db.query(
    "insert into kode_verifikasi (email, tujuan, kode_hash, kadaluarsa) values (?, ?, ?, date_add(now(), interval ? minute))",
    [email, tujuan, kodeHash, KODE_BERLAKU_MENIT],
  );

  const judul =
    tujuan === "verifikasi"
      ? "Kode verifikasi email Stockin"
      : "Kode reset password Stockin";

  const mulai = Date.now();

  try {
    await kirimEmail(email, judul, templateEmailKode(nama, kode, tujuan));
  } catch (err: any) {
    console.error("Gagal kirim email OTP:", err.message);
    await db.query("delete from kode_verifikasi where email = ? and tujuan = ?", [
      email,
      tujuan,
    ]);
    throw new HttpError(502, "Gagal mengirim email. Coba lagi beberapa saat.");
  }

  if (opsi.cekAlamat) {
    const ditolak = await emailTidakTerkirim(email, mulai);
    if (ditolak === true) {
      await db.query("delete from kode_verifikasi where email = ? and tujuan = ?", [
        email,
        tujuan,
      ]);
      throw new HttpError(
        400,
        "Email tidak tersedia atau tidak ditemukan. Periksa kembali alamat email kamu.",
        "email_tidak_ada",
      );
    }
  }
}

// Dipakai saat daftar (manager dan staf): kirim kode lalu pastikan alamat benar-benar ada.
// Kalau alamat ditolak, akun yang belum terverifikasi dihapus supaya tidak jadi sampah.
export async function kirimKodeVerifikasiBaru(email: string, nama: string) {
  try {
    await kirimKodeOtp(email, "verifikasi", nama, { cekAlamat: true });
  } catch (err: any) {
    if (err.kode === "email_tidak_ada") {
      await db.query(
        "delete from users where email = ? and email_terverifikasi = 0",
        [email],
      );
    }
    throw err;
  }
}

// Cocokkan kode yang diketik user dengan yang tersimpan
export async function cekKodeOtp(
  email: string,
  tujuan: string,
  kode: string,
): Promise<{ ok: boolean; error?: string }> {
  const [rows] = await db.query<any[]>(
    "select id, kode_hash, percobaan, kadaluarsa > now() as masih_berlaku from kode_verifikasi where email = ? and tujuan = ? order by id desc limit 1",
    [email, tujuan],
  );
  if (rows.length === 0) {
    return { ok: false, error: "Kode tidak ditemukan. Minta kode baru." };
  }

  const data = rows[0];
  if (!Number(data.masih_berlaku)) {
    return { ok: false, error: "Kode sudah kedaluwarsa. Minta kode baru." };
  }
  if (data.percobaan >= MAKS_PERCOBAAN) {
    return { ok: false, error: "Terlalu banyak percobaan salah. Minta kode baru." };
  }

  const cocok = await bcrypt.compare(kode, data.kode_hash);
  if (!cocok) {
    await db.query(
      "update kode_verifikasi set percobaan = percobaan + 1 where id = ?",
      [data.id],
    );
    const sisa = MAKS_PERCOBAAN - data.percobaan - 1;
    return {
      ok: false,
      error:
        sisa > 0
          ? `Kode salah. Sisa percobaan: ${sisa}`
          : "Kode salah. Terlalu banyak percobaan, minta kode baru.",
    };
  }

  return { ok: true };
}