import { db } from "../config/db";

export type RoleUser = "manager" | "staff";

// Untuk daftar: cek apakah email sudah dipakai
export async function cariUntukDaftar(email: string): Promise<any> {
  const [rows] = await db.query<any[]>(
    "select id, role, email_terverifikasi from users where email = ?",
    [email],
  );
  return rows[0];
}

export async function buat(data: {
  nama: string;
  email: string;
  passwordHash: string;
  role: RoleUser;
  telepon: string | null;
}) {
  await db.query(
    "insert into users (nama, email, password, role, telepon, email_terverifikasi) values (?, ?, ?, ?, ?, 0)",
    [data.nama, data.email, data.passwordHash, data.role, data.telepon],
  );
}

// Akun yang belum sempat diverifikasi: data diperbarui, kode baru dikirim
export async function perbaruiBelumVerifikasi(
  id: number,
  nama: string,
  passwordHash: string,
  telepon: string | null,
) {
  await db.query("update users set nama = ?, password = ?, telepon = ? where id = ?", [
    nama,
    passwordHash,
    telepon,
    id,
  ]);
}

export async function cariAkunUntukVerifikasi(email: string): Promise<any> {
  const [rows] = await db.query<any[]>(
    "select id, nama, role, gudang_id from users where email = ?",
    [email],
  );
  return rows[0];
}

export async function tandaiTerverifikasi(email: string) {
  await db.query("update users set email_terverifikasi = 1 where email = ?", [email]);
}

export async function cariUntukKirimUlang(email: string): Promise<any> {
  const [rows] = await db.query<any[]>(
    "select nama, email_terverifikasi from users where email = ?",
    [email],
  );
  return rows[0];
}

export async function cariUntukLogin(email: string): Promise<any> {
  const [rows] = await db.query<any[]>(
    "select id, nama, email, password, role, email_terverifikasi, gudang_id from users where email = ?",
    [email],
  );
  return rows[0];
}

export async function cariUntukLupaPassword(email: string): Promise<any> {
  const [rows] = await db.query<any[]>("select id, nama, role from users where email = ?", [
    email,
  ]);
  return rows[0];
}

export async function cariId(email: string): Promise<any> {
  const [rows] = await db.query<any[]>("select id from users where email = ?", [email]);
  return rows[0];
}

export async function ubahPassword(id: number, passwordHash: string) {
  await db.query("update users set password = ? where id = ?", [passwordHash, id]);
}

// Reset lewat OTP sekaligus membuktikan email milik user, jadi ikut ditandai terverifikasi
export async function ubahPasswordDanVerifikasi(id: number, passwordHash: string) {
  await db.query("update users set password = ?, email_terverifikasi = 1 where id = ?", [
    passwordHash,
    id,
  ]);
}

export async function ambilProfil(id: number): Promise<any> {
  const [rows] = await db.query<any[]>(
    "select id, nama, email, telepon, role from users where id = ?",
    [id],
  );
  return rows[0];
}

export async function ubahProfil(id: number, nama: string, telepon: string | null) {
  await db.query("update users set nama = ?, telepon = ? where id = ?", [nama, telepon, id]);
}

export async function ambilHashPassword(id: number): Promise<string | undefined> {
  const [rows] = await db.query<any[]>("select password from users where id = ?", [id]);
  return rows[0]?.password;
}