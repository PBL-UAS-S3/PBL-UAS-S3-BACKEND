import { GoogleGenAI } from "@google/genai";

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

// Mengirim prompt ke Gemini, dengan retry dan pindah model kalau sibuk atau kena rate limit.
// Mengembalikan teks jawaban.
export async function mintaAnalisis(prompt: string): Promise<string> {
  let errorTerakhir: any;

  for (const model of DAFTAR_MODEL) {
    for (let percobaan = 1; percobaan <= 3; percobaan++) {
      try {
        const response = await ai.models.generateContent({ model, contents: prompt });
        return response.text || "";
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

// Pesan error yang ramah untuk pengguna
export function pesanErrorGemini(err: any): string {
  if (err.message && err.message.includes("UNAVAILABLE")) {
    return "Server Gemini sedang sibuk. Coba lagi dalam beberapa menit.";
  }
  if (err.message && err.message.includes("RESOURCE_EXHAUSTED")) {
    return "Batas pemakaian Gemini API (tier gratis) tercapai untuk sementara. Tunggu 1-2 menit sebelum generate lagi.";
  }
  return err.message;
}