export type HasilAnalisisDto = {
  sku: string;
  perkiraan_hari_habis: number | null;
  rekomendasi_restock: number;
  alasan: string;
};

// Membaca jawaban Gemini: buang pembungkus ```json, lalu ubah jadi array
export function bacaHasilAnalisis(teks: string): HasilAnalisisDto[] {
  const bersih = teks
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/i, "");

  const hasil = JSON.parse(bersih);
  if (!Array.isArray(hasil)) {
    throw new Error("Format jawaban AI tidak valid");
  }
  return hasil;
}