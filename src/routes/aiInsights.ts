import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import { db } from "../config/db";
import { verifyManager } from "../middleware/auth";

const router = Router();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const DAFTAR_MODEL = ["gemini-flash-latest", "gemini-flash-lite-latest"];

function tunggu(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ambilRetryDelay(err: any): number | null {
  try {
    const cocok = err.message.match(/"retryDelay":"(\d+)s"/);
    if (cocok) return parseInt(cocok[1], 10) * 1000;
  } catch (e) {
    // abaikan
  }
  return null;
}

async function generateContentDenganRetry(prompt: string) {
  let errorTerakhir: any;

  for (const model of DAFTAR_MODEL) {
    for (let percobaan = 1; percobaan <= 3; percobaan++) {
      try {
        return await ai.models.generateContent({ model, contents: prompt });
      } catch (err: any) {
        errorTerakhir = err;
        const modelSibuk = err.message && err.message.includes("UNAVAILABLE");
        const kenaRateLimit = err.message && err.message.includes("RESOURCE_EXHAUSTED");

        if (!modelSibuk && !kenaRateLimit) throw err;

        const delay = ambilRetryDelay(err) || percobaan * 3000;

        console.log(
          `${model}: ${kenaRateLimit ? "kena rate limit" : "sibuk"}, tunggu ${delay / 1000}s lalu coba lagi (percobaan ${percobaan}/3)...`,
        );
        await tunggu(delay);
      }
    }
    console.log(`${model} tetap gagal setelah 3 percobaan, coba model berikutnya...`);
  }

  throw errorTerakhir;
}

router.post("/generate", verifyManager, async (req, res) => {
  try {
    const [produk] = await db.query<any[]>(
      "select id, sku, nama, stok_saat_ini, stok_minimum from products where gudang_id = ?",
      [req.gudangId],
    );

    if (produk.length === 0) {
      return res
        .status(400)
        .json({ error: "Belum ada produk di gudang ini untuk dianalisis" });
    }

    const dataAnalisis = [];
    for (const p of produk) {
      const [rows] = await db.query<any[]>(
        'select sum(jumlah) as total_keluar from stock_transactions where product_id = ? and tipe = "out" and created_at >= date_sub(now(), interval 30 day)',
        [p.id],
      );
      dataAnalisis.push({
        sku: p.sku,
        nama: p.nama,
        stok_saat_ini: p.stok_saat_ini,
        stok_minimum: p.stok_minimum,
        total_keluar_30_hari: rows[0].total_keluar || 0,
      });
    }

    const prompt = `Kamu adalah asisten analisis inventaris gudang. Berikut data ${dataAnalisis.length} produk beserta stok saat ini, stok minimum, dan total barang keluar dalam 30 hari terakhir:

${JSON.stringify(dataAnalisis, null, 2)}

Untuk setiap produk, perkirakan berapa hari lagi stoknya akan habis (berdasarkan rata-rata keluar per hari). Untuk rekomendasi jumlah restock, hitung agar stok cukup untuk memenuhi kebutuhan sekitar 30 hari ke depan berdasarkan rata-rata keluar per hari, ditambah stok pengaman sekitar 20-30% dari stok minimum. Jangan merekomendasikan jumlah yang jauh lebih besar dari itu — hindari overstock. Balas HANYA dalam format JSON array, tanpa teks tambahan lain, dengan struktur persis seperti ini:
[{"sku": "...", "perkiraan_hari_habis": angka_atau_null, "rekomendasi_restock": angka, "alasan": "penjelasan singkat 1 kalimat"}]`;

    const response = await generateContentDenganRetry(prompt);

    let teksJson = (response.text || "").trim();
    teksJson = teksJson.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    const hasilAnalisis = JSON.parse(teksJson);

    for (const hasil of hasilAnalisis) {
      const produkCocok = produk.find((p) => p.sku === hasil.sku);
      if (!produkCocok) continue;

      await db.query(
        "insert into ai_insights (product_id, rekomendasi, jumlah_restock_disarankan) values (?, ?, ?)",
        [produkCocok.id, hasil.alasan, hasil.rekomendasi_restock],
      );
    }

    res.json({ message: "Analisis AI berhasil dibuat", hasil: hasilAnalisis });
  } catch (err: any) {
    let pesanUser = err.message;
    if (err.message && err.message.includes("UNAVAILABLE")) {
      pesanUser = "Server Gemini sedang sibuk. Coba lagi dalam beberapa menit.";
    } else if (err.message && err.message.includes("RESOURCE_EXHAUSTED")) {
      pesanUser =
        "Batas pemakaian Gemini API (tier gratis) tercapai untuk sementara. Tunggu 1-2 menit sebelum generate lagi.";
    }
    res.status(500).json({ error: pesanUser });
  }
});

router.get("/", verifyManager, async (req, res) => {
  try {
    const [rows] = await db.query<any[]>(
      "select ai_insights.id, products.nama, products.sku, products.gambar, products.stok_saat_ini, products.stok_minimum, ai_insights.rekomendasi, ai_insights.jumlah_restock_disarankan, ai_insights.generated_at, case when ai_insights.generated_at = (select max(b.generated_at) from ai_insights b where b.product_id = ai_insights.product_id) then 1 else 0 end as is_terbaru from ai_insights, products where ai_insights.product_id = products.id and products.gudang_id = ? order by ai_insights.generated_at desc limit 50",
      [req.gudangId],
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;