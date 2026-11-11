import { HttpError } from "../utils/error";

export const TIPE_VALID = ["in", "out", "rusak", "buang_rusak", "pulih_rusak"] as const;
export type TipeTransaksi = (typeof TIPE_VALID)[number];

export type TransaksiDto = {
  sku: string;
  tipe: TipeTransaksi;
  jumlah: number;
  catatan: string | null;
};

// Membaca dan memeriksa body POST /transactions
export function bacaTransaksiDto(body: any): TransaksiDto {
  const jumlah = Number(body.jumlah);

  if (!TIPE_VALID.includes(body.tipe)) {
    throw new HttpError(400, "Tipe transaksi tidak valid");
  }
  if (!Number.isInteger(jumlah) || jumlah <= 0) {
    throw new HttpError(400, "Jumlah harus angka bulat lebih dari 0");
  }

  return { sku: body.sku, tipe: body.tipe, jumlah, catatan: body.catatan || null };
}