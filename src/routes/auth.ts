import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../config/db";
import { JWT_SECRET } from "../config/env";
import { verifyToken } from "../middleware/auth";

import {
  MIN_PASSWORD,
  POLA_EMAIL,
  domainEmailValid,
  kirimKodeOtp,
  cekKodeOtp,
} from "../services/otp";
import { pastikanGudangManager } from "../services/gudang";
import { kirimError } from "../utils/error";

const router = Router();

router.post("/register", async (req, res) => {
  const { nama, email, password, telepon } = req.body;

  if (!nama || !email || !password) {
    return res.status(400).json({ error: "Nama, email, dan password wajib diisi" });
  }

  const emailBersih = String(email).trim().toLowerCase();

  if (!POLA_EMAIL.test(emailBersih)) {
    return res.status(400).json({ error: "Format email tidak valid" });
  }
  if (password.length < MIN_PASSWORD) {
    return res.status(400).json({ error: `Password minimal ${MIN_PASSWORD} karakter` });
  }
  if (!(await domainEmailValid(emailBersih))) {
    return res.status(400).json({
      error: "Domain email tidak ditemukan. Gunakan email aktif, contoh: nama@gmail.com",
    });
  }

  try {
    const [existing] = await db.query<any[]>(
      "select id, email_terverifikasi from users where email = ?",
      [emailBersih],
    );

    const passwordHash = await bcrypt.hash(password, 10);

    if (existing.length > 0) {
      if (Number(existing[0].email_terverifikasi) === 1) {
        return res.status(400).json({ error: "Email sudah terdaftar" });
      }
      // akun yang belum sempat diverifikasi: perbarui data, kirim kode baru
      await db.query(
        "update users set nama = ?, password = ?, telepon = ? where id = ?",
        [nama, passwordHash, telepon || null, existing[0].id],
      );
    } else {
      await db.query(
        "insert into users (nama, email, password, role, telepon, email_terverifikasi) values (?, ?, ?, ?, ?, 0)",
        [nama, emailBersih, passwordHash, "manager", telepon || null],
      );
    }

    await kirimKodeOtp(emailBersih, "verifikasi", nama);

    res.status(201).json({
      message: "Akun dibuat. Kode verifikasi sudah dikirim ke email kamu.",
      perlu_verifikasi: true,
      email: emailBersih,
    });
  } catch (err) {
    kirimError(res, err);
  }
});

router.post("/verifikasi-email", async (req, res) => {
  const { email, kode } = req.body;

  if (!email || !kode) {
    return res.status(400).json({ error: "Email dan kode wajib diisi" });
  }

  const emailBersih = String(email).trim().toLowerCase();

  try {
    const hasil = await cekKodeOtp(emailBersih, "verifikasi", String(kode).trim());
    if (!hasil.ok) {
      return res.status(400).json({ error: hasil.error });
    }

    await db.query("update users set email_terverifikasi = 1 where email = ?", [
      emailBersih,
    ]);
    await db.query("delete from kode_verifikasi where email = ? and tujuan = ?", [
      emailBersih,
      "verifikasi",
    ]);

    // Manager yang baru terverifikasi langsung dibuatkan gudang miliknya
    const [akun] = await db.query<any[]>(
      "select id, nama, role, gudang_id from users where email = ?",
      [emailBersih],
    );
    if (akun.length > 0 && akun[0].role === "manager") {
      await pastikanGudangManager(akun[0]);
    }

    res.json({ message: "Email berhasil diverifikasi, silakan login" });
  } catch (err) {
    kirimError(res, err);
  }
});

router.post("/kirim-ulang-kode", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email wajib diisi" });
  }

  const emailBersih = String(email).trim().toLowerCase();

  try {
    const [rows] = await db.query<any[]>(
      "select nama, email_terverifikasi from users where email = ?",
      [emailBersih],
    );
    if (rows.length === 0 || Number(rows[0].email_terverifikasi) === 1) {
      return res
        .status(400)
        .json({ error: "Akun tidak ditemukan atau sudah terverifikasi" });
    }

    await kirimKodeOtp(emailBersih, "verifikasi", rows[0].nama);
    res.json({ message: "Kode baru sudah dikirim ke email kamu" });
  } catch (err) {
    kirimError(res, err);
  }
});

router.post("/register-staff", async (req, res) => {
  const { nama, email, password, telepon } = req.body;

  if (!nama || !email || !password) {
    return res.status(400).json({ error: "Nama, email, dan password wajib diisi" });
  }

  const emailBersih = String(email).trim().toLowerCase();

  if (!POLA_EMAIL.test(emailBersih)) {
    return res.status(400).json({ error: "Format email tidak valid" });
  }
  if (password.length < MIN_PASSWORD) {
    return res.status(400).json({ error: `Password minimal ${MIN_PASSWORD} karakter` });
  }
  if (!(await domainEmailValid(emailBersih))) {
    return res.status(400).json({
      error: "Domain email tidak ditemukan. Gunakan email aktif, contoh: nama@gmail.com",
    });
  }

  try {
    const [existing] = await db.query<any[]>(
      "select id, role, email_terverifikasi from users where email = ?",
      [emailBersih],
    );

    const passwordHash = await bcrypt.hash(password, 10);

    if (existing.length > 0) {
      if (
        Number(existing[0].email_terverifikasi) === 1 ||
        existing[0].role !== "staff"
      ) {
        return res.status(400).json({ error: "Email sudah terdaftar" });
      }
      // staf yang belum sempat verifikasi: perbarui data, kirim kode baru
      await db.query(
        "update users set nama = ?, password = ?, telepon = ? where id = ?",
        [nama, passwordHash, telepon || null, existing[0].id],
      );
    } else {
      await db.query(
        "insert into users (nama, email, password, role, telepon, email_terverifikasi) values (?, ?, ?, ?, ?, 0)",
        [nama, emailBersih, passwordHash, "staff", telepon || null],
      );
    }

    await kirimKodeOtp(emailBersih, "verifikasi", nama);

    res.status(201).json({
      message: "Akun dibuat. Kode verifikasi sudah dikirim ke email kamu.",
      perlu_verifikasi: true,
      email: emailBersih,
    });
  } catch (err) {
    kirimError(res, err);
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email dan password wajib diisi" });
  }

  try {
    const [rows] = await db.query<any[]>(
      "select id, nama, email, password, role, email_terverifikasi, gudang_id from users where email = ?",
      [email],
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Email tidak ditemukan" });
    }

    const user = rows[0];
    const cocok = await bcrypt.compare(password, user.password);

    if (!cocok) {
      return res.status(401).json({ error: "Password salah" });
    }

    if (Number(user.email_terverifikasi) !== 1) {
      return res.status(403).json({
        error: "Email belum diverifikasi",
        perlu_verifikasi: true,
        email: user.email,
      });
    }

    // Manager selalu punya gudang. Staf boleh login tanpa gudang,
    // gabung lewat halaman Gudang Saya di aplikasi.
    let gudangId = user.gudang_id;
    if (user.role === "manager") {
      gudangId = await pastikanGudangManager(user);
    }

    const token = jwt.sign(
      { id: user.id, nama: user.nama, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({ token, nama: user.nama, role: user.role, gudang_id: gudangId || null });
  } catch (err) {
    kirimError(res, err);
  }
});

// Lupa password langkah 1: kirim kode OTP ke email (manager dan staf)
router.post("/lupa-password", async (req, res) => {
  const { email } = req.body;

  if (!email || !POLA_EMAIL.test(String(email).trim())) {
    return res.status(400).json({ error: "Format email tidak valid" });
  }

  const emailBersih = String(email).trim().toLowerCase();

  try {
    const [rows] = await db.query<any[]>(
      "select id, nama, role from users where email = ?",
      [emailBersih],
    );

    if (rows.length > 0) {
      await kirimKodeOtp(emailBersih, "reset", rows[0].nama);
    }

    // jawaban sama untuk email terdaftar maupun tidak
    res.json({ message: "Jika email terdaftar, kode reset sudah dikirim" });
  } catch (err) {
    kirimError(res, err);
  }
});

// Lupa password langkah 2: cek kode OTP, lalu ganti password
router.post("/reset-password", async (req, res) => {
  const { email, kode, password_baru } = req.body;

  if (!email || !kode || !password_baru) {
    return res
      .status(400)
      .json({ error: "Email, kode, dan password baru wajib diisi" });
  }
  if (password_baru.length < MIN_PASSWORD) {
    return res.status(400).json({ error: `Password minimal ${MIN_PASSWORD} karakter` });
  }

  const emailBersih = String(email).trim().toLowerCase();

  try {
    const [rows] = await db.query<any[]>("select id from users where email = ?", [
      emailBersih,
    ]);
    if (rows.length === 0) {
      return res.status(400).json({ error: "Kode salah atau sudah tidak berlaku" });
    }

    const hasil = await cekKodeOtp(emailBersih, "reset", String(kode).trim());
    if (!hasil.ok) {
      return res.status(400).json({ error: hasil.error });
    }

    const passwordHash = await bcrypt.hash(password_baru, 10);
    await db.query(
      "update users set password = ?, email_terverifikasi = 1 where id = ?",
      [passwordHash, rows[0].id],
    );
    await db.query("delete from kode_verifikasi where email = ? and tujuan = ?", [
      emailBersih,
      "reset",
    ]);

    res.json({ message: "Password berhasil diubah" });
  } catch (err) {
    kirimError(res, err);
  }
});

// Ambil data profil user yang sedang login
router.get("/profil", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query<any[]>(
      "select id, nama, email, telepon, role from users where id = ?",
      [req.user!.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Akun tidak ditemukan" });
    }
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update nama & telepon (email dikunci)
router.put("/profil", verifyToken, async (req, res) => {
  const { nama, telepon } = req.body;

  if (!nama) {
    return res.status(400).json({ error: "Nama wajib diisi" });
  }

  try {
    await db.query("update users set nama = ?, telepon = ? where id = ?", [
      nama,
      telepon || null,
      req.user!.id,
    ]);
    res.json({ message: "Profil berhasil diperbarui", nama });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Ganti password (wajib verifikasi password lama)
router.put("/ganti-password", verifyToken, async (req, res) => {
  const { password_lama, password_baru } = req.body;

  if (!password_lama || !password_baru) {
    return res
      .status(400)
      .json({ error: "Password lama dan password baru wajib diisi" });
  }
  if (password_baru.length < MIN_PASSWORD) {
    return res
      .status(400)
      .json({ error: `Password baru minimal ${MIN_PASSWORD} karakter` });
  }

  try {
    const [rows] = await db.query<any[]>("select password from users where id = ?", [
      req.user!.id,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Akun tidak ditemukan" });
    }

    const cocok = await bcrypt.compare(password_lama, rows[0].password);
    if (!cocok) {
      return res.status(401).json({ error: "Password lama salah" });
    }

    const hashBaru = await bcrypt.hash(password_baru, 10);
    await db.query("update users set password = ? where id = ?", [
      hashBaru,
      req.user!.id,
    ]);
    res.json({ message: "Password berhasil diubah" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;