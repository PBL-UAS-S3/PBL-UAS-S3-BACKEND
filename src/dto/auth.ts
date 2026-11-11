import { HttpError } from "../utils/error";
import { MIN_PASSWORD, POLA_EMAIL } from "../services/otp";

export function bersihkanEmail(email: unknown): string {
  return String(email).trim().toLowerCase();
}

export type RegisterDto = {
  nama: string;
  email: string;
  password: string;
  telepon: string | null;
};

// Dipakai untuk daftar manager dan daftar staf
export function bacaRegisterDto(body: any): RegisterDto {
  const { nama, email, password, telepon } = body;

  if (!nama || !email || !password) {
    throw new HttpError(400, "Nama, email, dan password wajib diisi");
  }

  const emailBersih = bersihkanEmail(email);
  if (!POLA_EMAIL.test(emailBersih)) {
    throw new HttpError(400, "Format email tidak valid");
  }
  if (password.length < MIN_PASSWORD) {
    throw new HttpError(400, `Password minimal ${MIN_PASSWORD} karakter`);
  }

  return { nama, email: emailBersih, password, telepon: telepon || null };
}

export function bacaLoginDto(body: any) {
  const { email, password } = body;
  if (!email || !password) {
    throw new HttpError(400, "Email dan password wajib diisi");
  }
  return { email: String(email), password: String(password) };
}

export function bacaVerifikasiDto(body: any) {
  const { email, kode } = body;
  if (!email || !kode) {
    throw new HttpError(400, "Email dan kode wajib diisi");
  }
  return { email: bersihkanEmail(email), kode: String(kode).trim() };
}

export function bacaKirimUlangDto(body: any) {
  if (!body.email) {
    throw new HttpError(400, "Email wajib diisi");
  }
  return { email: bersihkanEmail(body.email) };
}

export function bacaLupaPasswordDto(body: any) {
  const { email } = body;
  if (!email || !POLA_EMAIL.test(String(email).trim())) {
    throw new HttpError(400, "Format email tidak valid");
  }
  return { email: bersihkanEmail(email) };
}

export function bacaResetPasswordDto(body: any) {
  const { email, kode, password_baru } = body;

  if (!email || !kode || !password_baru) {
    throw new HttpError(400, "Email, kode, dan password baru wajib diisi");
  }
  if (password_baru.length < MIN_PASSWORD) {
    throw new HttpError(400, `Password minimal ${MIN_PASSWORD} karakter`);
  }

  return {
    email: bersihkanEmail(email),
    kode: String(kode).trim(),
    passwordBaru: String(password_baru),
  };
}

export function bacaProfilDto(body: any) {
  if (!body.nama) {
    throw new HttpError(400, "Nama wajib diisi");
  }
  return { nama: String(body.nama), telepon: body.telepon || null };
}

export function bacaGantiPasswordDto(body: any) {
  const { password_lama, password_baru } = body;

  if (!password_lama || !password_baru) {
    throw new HttpError(400, "Password lama dan password baru wajib diisi");
  }
  if (password_baru.length < MIN_PASSWORD) {
    throw new HttpError(400, `Password baru minimal ${MIN_PASSWORD} karakter`);
  }

  return { passwordLama: String(password_lama), passwordBaru: String(password_baru) };
}