import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { HttpError, kirimError } from "../utils/error";
import { kirimKodeOtp, cekKodeOtp } from "../services/otp";
import {
  bacaLupaPasswordDto,
  bacaResetPasswordDto,
  bacaProfilDto,
  bacaGantiPasswordDto,
} from "../dto/auth";
import * as userRepo from "../repositories/users";
import * as kodeRepo from "../repositories/kodeVerifikasi";

const PUTARAN_HASH = 10;

// Lupa password langkah 1: kirim kode OTP ke email (manager dan staf)
export async function lupaPassword(req: Request, res: Response) {
  try {
    const { email } = bacaLupaPasswordDto(req.body);

    const akun = await userRepo.cariUntukLupaPassword(email);
    if (akun) {
      await kirimKodeOtp(email, "reset", akun.nama);
    }

    // jawaban sama untuk email terdaftar maupun tidak
    res.json({ message: "Jika email terdaftar, kode reset sudah dikirim" });
  } catch (err) {
    kirimError(res, err);
  }
}

// Lupa password langkah 2: cek kode OTP, lalu ganti password
export async function resetPassword(req: Request, res: Response) {
  try {
    const { email, kode, passwordBaru } = bacaResetPasswordDto(req.body);

    const akun = await userRepo.cariId(email);
    if (!akun) {
      throw new HttpError(400, "Kode salah atau sudah tidak berlaku");
    }

    const hasil = await cekKodeOtp(email, "reset", kode);
    if (!hasil.ok) {
      res.status(400).json({ error: hasil.error });
      return;
    }

    const passwordHash = await bcrypt.hash(passwordBaru, PUTARAN_HASH);
    await userRepo.ubahPasswordDanVerifikasi(akun.id, passwordHash);
    await kodeRepo.hapusKode(email, "reset");

    res.json({ message: "Password berhasil diubah" });
  } catch (err) {
    kirimError(res, err);
  }
}

// Ambil data profil user yang sedang login
export async function lihatProfil(req: Request, res: Response) {
  try {
    const profil = await userRepo.ambilProfil(req.user!.id);
    if (!profil) throw new HttpError(404, "Akun tidak ditemukan");
    res.json(profil);
  } catch (err) {
    kirimError(res, err);
  }
}

// Update nama dan telepon (email dikunci)
export async function simpanProfil(req: Request, res: Response) {
  try {
    const { nama, telepon } = bacaProfilDto(req.body);
    await userRepo.ubahProfil(req.user!.id, nama, telepon);
    res.json({ message: "Profil berhasil diperbarui", nama });
  } catch (err) {
    kirimError(res, err);
  }
}

// Ganti password (wajib verifikasi password lama)
export async function gantiPassword(req: Request, res: Response) {
  try {
    const { passwordLama, passwordBaru } = bacaGantiPasswordDto(req.body);

    const hashLama = await userRepo.ambilHashPassword(req.user!.id);
    if (!hashLama) throw new HttpError(404, "Akun tidak ditemukan");

    const cocok = await bcrypt.compare(passwordLama, hashLama);
    if (!cocok) throw new HttpError(401, "Password lama salah");

    const hashBaru = await bcrypt.hash(passwordBaru, PUTARAN_HASH);
    await userRepo.ubahPassword(req.user!.id, hashBaru);

    res.json({ message: "Password berhasil diubah" });
  } catch (err) {
    kirimError(res, err);
  }
}