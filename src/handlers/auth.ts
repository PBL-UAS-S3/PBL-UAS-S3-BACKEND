import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env";
import { HttpError, kirimError } from "../utils/error";
import {
  domainEmailValid,
  kirimKodeOtp,
  kirimKodeVerifikasiBaru,
  cekKodeOtp,
} from "../services/otp";
import { pastikanGudangManager } from "../services/gudang";
import {
  bacaRegisterDto,
  bacaLoginDto,
  bacaVerifikasiDto,
  bacaKirimUlangDto,
} from "../dto/auth";
import * as userRepo from "../repositories/users";
import * as kodeRepo from "../repositories/kodeVerifikasi";
import * as logRepo from "../repositories/logLogin";

const PUTARAN_HASH = 10;

// Daftar manager dan daftar staf alurnya sama, hanya beda role
async function daftarAkun(req: Request, res: Response, role: userRepo.RoleUser) {
  try {
    const data = bacaRegisterDto(req.body);

    if (!(await domainEmailValid(data.email))) {
      throw new HttpError(
        400,
        "Domain email tidak ditemukan. Gunakan email aktif, contoh: nama@gmail.com",
      );
    }

    const ada = await userRepo.cariUntukDaftar(data.email);
    const passwordHash = await bcrypt.hash(data.password, PUTARAN_HASH);

    if (ada) {
      const bentrok =
        Number(ada.email_terverifikasi) === 1 || (role === "staff" && ada.role !== "staff");
      if (bentrok) throw new HttpError(400, "Email sudah terdaftar");
      await userRepo.perbaruiBelumVerifikasi(ada.id, data.nama, passwordHash, data.telepon);
    } else {
      await userRepo.buat({
        nama: data.nama,
        email: data.email,
        passwordHash,
        role,
        telepon: data.telepon,
      });
    }

    await kirimKodeVerifikasiBaru(data.email, data.nama);

    res.status(201).json({
      message: "Akun dibuat. Kode verifikasi sudah dikirim ke email kamu.",
      perlu_verifikasi: true,
      email: data.email,
    });
  } catch (err) {
    kirimError(res, err);
  }
}

export async function daftarManager(req: Request, res: Response) {
  return daftarAkun(req, res, "manager");
}

export async function daftarStaf(req: Request, res: Response) {
  return daftarAkun(req, res, "staff");
}

export async function verifikasiEmail(req: Request, res: Response) {
  try {
    const { email, kode } = bacaVerifikasiDto(req.body);

    const hasil = await cekKodeOtp(email, "verifikasi", kode);
    if (!hasil.ok) {
      res.status(400).json({ error: hasil.error });
      return;
    }

    await userRepo.tandaiTerverifikasi(email);
    await kodeRepo.hapusKode(email, "verifikasi");

    // Manager yang baru terverifikasi langsung dibuatkan gudang miliknya
    const akun = await userRepo.cariAkunUntukVerifikasi(email);
    if (akun && akun.role === "manager") {
      await pastikanGudangManager(akun);
    }

    res.json({ message: "Email berhasil diverifikasi, silakan login" });
  } catch (err) {
    kirimError(res, err);
  }
}

export async function kirimUlangKode(req: Request, res: Response) {
  try {
    const { email } = bacaKirimUlangDto(req.body);

    const akun = await userRepo.cariUntukKirimUlang(email);
    if (!akun || Number(akun.email_terverifikasi) === 1) {
      throw new HttpError(400, "Akun tidak ditemukan atau sudah terverifikasi");
    }

    await kirimKodeOtp(email, "verifikasi", akun.nama);
    res.json({ message: "Kode baru sudah dikirim ke email kamu" });
  } catch (err) {
    kirimError(res, err);
  }
}

// Mencatat percobaan login. Tidak ditunggu, dan kalau gagal tidak mengganggu login.
function catatLog(
  req: Request,
  email: string,
  userId: number | null,
  berhasil: boolean,
  alasan: string | null,
) {
  const userAgent = String(req.headers["user-agent"] ?? "").slice(0, 255);

  logRepo
    .catat({
      userId,
      email,
      berhasil,
      alasan,
      ip: req.ip ?? null,
      userAgent: userAgent || null,
    })
    .catch((err) => console.error("Gagal mencatat log login:", err.message));
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = bacaLoginDto(req.body);
    const emailLog = email.trim().toLowerCase();

    const user = await userRepo.cariUntukLogin(email);

    if (!user) {
      // Hapus baris catatLog di bawah ini kalau percobaan dengan email tak terdaftar tidak perlu dicatat
      catatLog(req, emailLog, null, false, "email_tidak_ditemukan");
      throw new HttpError(401, "Email tidak ditemukan");
    }

    const cocok = await bcrypt.compare(password, user.password);
    if (!cocok) {
      catatLog(req, emailLog, user.id, false, "password_salah");
      throw new HttpError(401, "Password salah");
    }

    if (Number(user.email_terverifikasi) !== 1) {
      catatLog(req, emailLog, user.id, false, "belum_verifikasi");
      res.status(403).json({
        error: "Email belum diverifikasi",
        perlu_verifikasi: true,
        email: user.email,
      });
      return;
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

    catatLog(req, emailLog, user.id, true, null);
    res.json({ token, nama: user.nama, role: user.role, gudang_id: gudangId || null });
  } catch (err) {
    kirimError(res, err);
  }
}