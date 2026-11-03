import "dotenv/config";
import { db } from "./config/db";
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import gudangRouter from "./routes/gudang";
import pengaturanRouter from "./routes/pengaturan";
import keluhanRouter from "./routes/keluhan";
import productsRouter from "./routes/products";
import transactionsRouter from "./routes/transactions";
import aiInsightsRouter from "./routes/aiInsights";
import purchaseOrdersRouter from "./routes/purchaseOrders";
import uploadRouter, { uploadDir } from "./routes/upload";

const app = express();

// Bersihkan akun yang tidak pernah diverifikasi (misalnya email palsu), tiap 30 menit
async function bersihkanAkunBelumVerifikasi() {
  try {
    const [hasil] = await db.query<any>(
      "delete from users where email_terverifikasi = 0 and email not in (select email from kode_verifikasi where tujuan = 'verifikasi' and kadaluarsa > date_sub(now(), interval 1 hour))",
    );
    if (hasil.affectedRows > 0) {
      console.log(`Membersihkan ${hasil.affectedRows} akun yang belum terverifikasi`);
    }
  } catch (err: any) {
    console.error("Gagal membersihkan akun belum terverifikasi:", err.message);
  }
}

setInterval(bersihkanAkunBelumVerifikasi, 30 * 60 * 1000);
bersihkanAkunBelumVerifikasi();
// CORS terbuka supaya bisa diakses dari frontend Vercel dan mobile
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

// Cek status server
app.get("/", (req, res) => {
  res.json({
    status: "success",
    message: "Server Backend Stockin Aktif dan Berjalan Normal!",
  });
});

app.use("/uploads", express.static(uploadDir));

app.use("/upload", uploadRouter);
app.use("/auth", authRouter);
app.use("/gudang", gudangRouter);
app.use("/pengaturan", pengaturanRouter);
app.use("/keluhan", keluhanRouter);
app.use("/products", productsRouter);
app.use("/transactions", transactionsRouter);
app.use("/ai-insights", aiInsightsRouter);
app.use("/purchase-orders", purchaseOrdersRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server jalan di port ${PORT}`);
});