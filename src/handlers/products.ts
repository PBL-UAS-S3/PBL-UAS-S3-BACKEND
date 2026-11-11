import { Request, Response } from "express";
import { HttpError, kirimError } from "../utils/error";
import { bacaProdukDto } from "../dto/products";
import * as produkRepo from "../repositories/products";

// SKU otomatis per gudang, lanjut dari nomor terakhir (SKU001, SKU002, dst)
async function buatSkuBaru(gudangId: number): Promise<string> {
  const terakhir = await produkRepo.ambilSkuTerakhir(gudangId);
  if (!terakhir) return "SKU001";
  const angka = parseInt(terakhir.replace("SKU", ""), 10) || 0;
  return "SKU" + String(angka + 1).padStart(3, "0");
}

export async function daftarProduk(req: Request, res: Response) {
  try {
    res.json(await produkRepo.ambilSemua(req.gudangId!));
  } catch (err) {
    kirimError(res, err);
  }
}

export async function tambahProduk(req: Request, res: Response) {
  try {
    const data = bacaProdukDto(req.body);
    const skuBaru = await buatSkuBaru(req.gudangId!);
    await produkRepo.tambah(req.gudangId!, skuBaru, data);
    res.status(201).json({ message: "Produk berhasil ditambahkan", sku: skuBaru });
  } catch (err) {
    res.status(400).json({ error: "Gagal menambahkan produk" });
  }
}

export async function ubahProduk(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const data = bacaProdukDto(req.body);
    const berubah = await produkRepo.ubah(id, req.gudangId!, data);
    if (berubah === 0) throw new HttpError(404, "Produk tidak ditemukan");
    res.json({ message: "Produk berhasil diupdate" });
  } catch (err) {
    kirimError(res, err);
  }
}

export async function hapusProduk(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const berubah = await produkRepo.hapus(id, req.gudangId!);
    if (berubah === 0) throw new HttpError(404, "Produk tidak ditemukan");
    res.json({ message: "Produk berhasil dihapus" });
  } catch (err) {
    kirimError(res, err);
  }
}