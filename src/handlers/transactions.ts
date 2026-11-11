import { Request, Response } from "express";
import { HttpError, kirimError } from "../utils/error";
import { bacaTransaksiDto, type TipeTransaksi } from "../dto/transactions";
import * as transaksiRepo from "../repositories/transactions";

const BATAS_RIWAYAT = 50;

// Aturan perubahan stok layak dan stok rusak untuk tiap tipe transaksi
function hitungStok(tipe: TipeTransaksi, jumlah: number, stok: number, rusak: number) {
  switch (tipe) {
    case "in":
      return { stok: stok + jumlah, rusak };
    case "out":
      if (stok < jumlah) throw new HttpError(400, "Stok tidak mencukupi");
      return { stok: stok - jumlah, rusak };
    case "rusak":
      if (stok < jumlah) throw new HttpError(400, "Stok layak tidak mencukupi");
      return { stok: stok - jumlah, rusak: rusak + jumlah };
    case "buang_rusak":
      if (rusak < jumlah) throw new HttpError(400, "Stok rusak tidak mencukupi");
      return { stok, rusak: rusak - jumlah };
    case "pulih_rusak":
      if (rusak < jumlah) throw new HttpError(400, "Stok rusak tidak mencukupi");
      return { stok: stok + jumlah, rusak: rusak - jumlah };
  }
}

export async function catatTransaksi(req: Request, res: Response) {
  try {
    const data = bacaTransaksiDto(req.body);

    const produk = await transaksiRepo.cariProdukBySku(data.sku, req.gudangId!);
    if (!produk) throw new HttpError(404, "SKU tidak ditemukan");

    const baru = hitungStok(data.tipe, data.jumlah, produk.stok_saat_ini, produk.stok_rusak);

    await transaksiRepo.simpan(produk.id, req.user!.id, data);
    await transaksiRepo.ubahStok(produk.id, baru.stok, baru.rusak);

    res.status(201).json({
      message: "Transaksi berhasil dicatat",
      stok_baru: baru.stok,
      stok_rusak_baru: baru.rusak,
    });
  } catch (err) {
    kirimError(res, err);
  }
}

export async function transaksiTerbaru(req: Request, res: Response) {
  try {
    res.json(await transaksiRepo.ambilTerbaru(req.gudangId!, BATAS_RIWAYAT));
  } catch (err) {
    kirimError(res, err);
  }
}