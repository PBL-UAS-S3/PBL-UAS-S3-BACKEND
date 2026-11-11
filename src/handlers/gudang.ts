import { Request, Response } from "express";
import { HttpError, kirimError } from "../utils/error";
import { buatKodeGudang } from "../services/gudang";
import { bacaGabungDto } from "../dto/gudang";
import * as gudangRepo from "../repositories/gudang";

// Status keanggotaan user yang login: belum / menunggu / aktif
export async function statusKeanggotaan(req: Request, res: Response) {
  try {
    const gudangId = await gudangRepo.ambilGudangIdUser(req.user!.id);

    let gudang: { id: number; nama_gudang: string | null } | null = null;
    if (gudangId) {
      gudang = { id: gudangId, nama_gudang: await gudangRepo.ambilNamaGudang(gudangId) };
    }

    res.json({ status: req.statusAnggota, gudang });
  } catch (err) {
    kirimError(res, err);
  }
}

// Staf mengajukan bergabung memakai kode gudang
export async function gabungGudang(req: Request, res: Response) {
  try {
    if (req.user!.role !== "staff") {
      throw new HttpError(403, "Hanya akun staf yang bisa bergabung ke gudang");
    }

    const { kodeGudang } = bacaGabungDto(req.body);

    if (req.statusAnggota !== "belum") {
      throw new HttpError(400, "Kamu sudah tergabung atau sedang menunggu persetujuan gudang");
    }

    const gudangId = await gudangRepo.cariIdByKode(kodeGudang);
    if (!gudangId) throw new HttpError(400, "Kode gudang tidak ditemukan");

    await gudangRepo.ajukanBergabung(req.user!.id, gudangId);
    res.json({ message: "Permintaan terkirim, tunggu persetujuan Manager gudang" });
  } catch (err) {
    kirimError(res, err);
  }
}

// Staf membatalkan permintaan atau keluar dari gudang
export async function keluarGudang(req: Request, res: Response) {
  try {
    if (req.user!.role !== "staff") {
      throw new HttpError(403, "Hanya akun staf yang bisa keluar dari gudang");
    }

    await gudangRepo.lepasDariGudang(req.user!.id);
    res.json({ message: "Kamu sudah tidak terhubung ke gudang" });
  } catch (err) {
    kirimError(res, err);
  }
}

// Info gudang milik user yang login (kode hanya terlihat oleh manager)
export async function infoGudangSaya(req: Request, res: Response) {
  try {
    const gudang = await gudangRepo.ambilGudang(req.gudangId!);
    if (!gudang) throw new HttpError(404, "Gudang tidak ditemukan");

    res.json({
      id: gudang.id,
      nama_gudang: await gudangRepo.ambilNamaGudang(req.gudangId!),
      kode: req.user!.role === "manager" ? gudang.kode : undefined,
    });
  } catch (err) {
    kirimError(res, err);
  }
}

// Buat kode gudang baru (kode lama langsung tidak berlaku)
export async function kodeBaru(req: Request, res: Response) {
  try {
    for (let percobaan = 0; percobaan < 10; percobaan++) {
      const kode = buatKodeGudang();
      try {
        await gudangRepo.ubahKode(req.gudangId!, kode);
        res.json({ message: "Kode gudang diperbarui", kode });
        return;
      } catch (err: any) {
        if (err.code !== "ER_DUP_ENTRY") throw err;
      }
    }
    throw new HttpError(500, "Gagal membuat kode baru, coba lagi");
  } catch (err) {
    kirimError(res, err);
  }
}

// Daftar staf gudang ini: yang aktif dan yang menunggu persetujuan
export async function daftarStaf(req: Request, res: Response) {
  try {
    res.json(await gudangRepo.ambilStaf(req.gudangId!));
  } catch (err) {
    kirimError(res, err);
  }
}

// Setujui permintaan bergabung
export async function setujuiStaf(req: Request, res: Response) {
  try {
    const berubah = await gudangRepo.setujuiStaf(String(req.params.id), req.gudangId!);
    if (berubah === 0) throw new HttpError(404, "Permintaan bergabung tidak ditemukan");
    res.json({ message: "Staf disetujui" });
  } catch (err) {
    kirimError(res, err);
  }
}

// Tolak permintaan atau keluarkan staf (akunnya tetap ada, riwayat transaksinya tidak hilang)
export async function keluarkanStaf(req: Request, res: Response) {
  try {
    const berubah = await gudangRepo.keluarkanStaf(String(req.params.id), req.gudangId!);
    if (berubah === 0) throw new HttpError(404, "Staf tidak ditemukan di gudang ini");
    res.json({ message: "Staf dikeluarkan dari gudang" });
  } catch (err) {
    kirimError(res, err);
  }
}