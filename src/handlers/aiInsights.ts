import { Request, Response } from "express";
import { HttpError, kirimError } from "../utils/error";
import { mintaAnalisis, pesanErrorGemini } from "../services/gemini";
import { bacaHasilAnalisis } from "../dto/aiInsights";
import * as aiRepo from "../repositories/aiInsights";

type DataAnalisis = {
  sku: string;
  nama: string;
  stok_saat_ini: number;
  stok_minimum: number;
  total_keluar_30_hari: number;
};

function susunPrompt(data: DataAnalisis[]) {
  return `Kamu adalah asisten analisis inventaris gudang. Berikut data ${data.length} produk beserta stok saat ini, stok minimum, dan total barang keluar dalam 30 hari terakhir:

${JSON.stringify(data, null, 2)}

Untuk setiap produk, perkirakan berapa hari lagi stoknya akan habis (berdasarkan rata-rata keluar per hari). Untuk rekomendasi jumlah restock, hitung agar stok cukup untuk memenuhi kebutuhan sekitar 30 hari ke depan berdasarkan rata-rata keluar per hari, ditambah stok pengaman sekitar 20-30% dari stok minimum. Jangan merekomendasikan jumlah yang jauh lebih besar dari itu — hindari overstock. Balas HANYA dalam format JSON array, tanpa teks tambahan lain, dengan struktur persis seperti ini:
[{"sku": "...", "perkiraan_hari_habis": angka_atau_null, "rekomendasi_restock": angka, "alasan": "penjelasan singkat 1 kalimat"}]`;
}

export async function buatInsight(req: Request, res: Response) {
  try {
    const gudangId = req.gudangId!;

    const produk = await aiRepo.ambilProdukGudang(gudangId);
    if (produk.length === 0) {
      throw new HttpError(400, "Belum ada produk di gudang ini untuk dianalisis");
    }

    const keluar = await aiRepo.ambilTotalKeluar30Hari(gudangId);
    const dataAnalisis: DataAnalisis[] = produk.map((p) => ({
      sku: p.sku,
      nama: p.nama,
      stok_saat_ini: p.stok_saat_ini,
      stok_minimum: p.stok_minimum,
      total_keluar_30_hari: keluar.get(p.id) ?? 0,
    }));

    const teks = await mintaAnalisis(susunPrompt(dataAnalisis));
    const hasilAnalisis = bacaHasilAnalisis(teks);

    const produkBySku = new Map(produk.map((p) => [p.sku, p]));
    for (const hasil of hasilAnalisis) {
      const cocok = produkBySku.get(hasil.sku);
      if (!cocok) continue;
      await aiRepo.simpan(cocok.id, hasil.alasan, hasil.rekomendasi_restock);
    }

    res.json({ message: "Analisis AI berhasil dibuat", hasil: hasilAnalisis });
  } catch (err: any) {
    if (err instanceof HttpError) {
      kirimError(res, err);
      return;
    }
    res.status(500).json({ error: pesanErrorGemini(err) });
  }
}

export async function riwayatInsight(req: Request, res: Response) {
  try {
    res.json(await aiRepo.ambilRiwayat(req.gudangId!));
  } catch (err) {
    kirimError(res, err);
  }
}