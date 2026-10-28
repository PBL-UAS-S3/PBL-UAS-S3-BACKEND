import { Router } from "express";
import { db } from "../config/db";
import { verifyAnggota } from "../middleware/auth";

const router = Router();

const TIPE_VALID = ["in", "out", "rusak", "buang_rusak", "pulih_rusak"];

router.post("/", verifyAnggota, async (req, res) => {
  const { sku, tipe, catatan } = req.body;
  const jumlah = Number(req.body.jumlah);

  if (!TIPE_VALID.includes(tipe)) {
    return res.status(400).json({ error: "Tipe transaksi tidak valid" });
  }
  if (!Number.isInteger(jumlah) || jumlah <= 0) {
    return res.status(400).json({ error: "Jumlah harus angka bulat lebih dari 0" });
  }

  try {
    const [produk] = await db.query<any[]>(
      "select id, stok_saat_ini, stok_rusak from products where sku = ? and gudang_id = ?",
      [sku, req.gudangId],
    );

    if (produk.length === 0) {
      return res.status(404).json({ error: "SKU tidak ditemukan" });
    }

    const product = produk[0];
    let stokBaru: number = product.stok_saat_ini;
    let stokRusakBaru: number = product.stok_rusak;

    if (tipe === "in") {
      stokBaru = stokBaru + jumlah;
    } else if (tipe === "out") {
      if (stokBaru < jumlah) {
        return res.status(400).json({ error: "Stok tidak mencukupi" });
      }
      stokBaru = stokBaru - jumlah;
    } else if (tipe === "rusak") {
      if (stokBaru < jumlah) {
        return res.status(400).json({ error: "Stok layak tidak mencukupi" });
      }
      stokBaru = stokBaru - jumlah;
      stokRusakBaru = stokRusakBaru + jumlah;
    } else if (tipe === "buang_rusak") {
      if (stokRusakBaru < jumlah) {
        return res.status(400).json({ error: "Stok rusak tidak mencukupi" });
      }
      stokRusakBaru = stokRusakBaru - jumlah;
    } else if (tipe === "pulih_rusak") {
      if (stokRusakBaru < jumlah) {
        return res.status(400).json({ error: "Stok rusak tidak mencukupi" });
      }
      stokRusakBaru = stokRusakBaru - jumlah;
      stokBaru = stokBaru + jumlah;
    }

    await db.query(
      "insert into stock_transactions (product_id, user_id, tipe, jumlah, catatan) values (?, ?, ?, ?, ?)",
      [product.id, req.user!.id, tipe, jumlah, catatan || null],
    );

    await db.query(
      "update products set stok_saat_ini = ?, stok_rusak = ? where id = ?",
      [stokBaru, stokRusakBaru, product.id],
    );

    res.status(201).json({
      message: "Transaksi berhasil dicatat",
      stok_baru: stokBaru,
      stok_rusak_baru: stokRusakBaru,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/recent", verifyAnggota, async (req, res) => {
  try {
    const [rows] = await db.query<any[]>(
      "select stock_transactions.id, products.nama, products.sku, products.gambar, stock_transactions.tipe, stock_transactions.jumlah, stock_transactions.catatan, stock_transactions.created_at, users.nama as nama_staf from stock_transactions, products, users where stock_transactions.product_id = products.id and stock_transactions.user_id = users.id and products.gudang_id = ? order by stock_transactions.created_at desc limit 50",
      [req.gudangId],
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;