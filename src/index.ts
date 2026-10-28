import "dotenv/config";
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