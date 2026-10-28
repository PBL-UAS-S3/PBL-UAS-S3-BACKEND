import { Router } from "express";
import { db } from "../config/db";
import { ambilGudang, verifyManager } from "../middleware/auth";

const router = Router();

// SKU otomatis per gudang, lanjut dari nomor terakhir (SKU001, SKU002, dst)
async function generateSkuBaru(gudangId: number): Promise<string> {
  const [rows] = await db.query<any[]>(
    "select sku from products where gudang_id = ? and sku like 'SKU%' order by cast(substring(sku, 4) as unsigned) desc limit 1",
    [gudangId],
  );
  if (rows.length === 0) return "SKU001";
  const angka = parseInt(rows[0].sku.replace("SKU", ""), 10) || 0;
  return "SKU" + String(angka + 1).padStart(3, "0");
}

router.get("/", ambilGudang, async (req, res) => {
  try {
    const [rows] = await db.query<any[]>(
      "select id, sku, nama, kategori, satuan, harga, gambar, stok_saat_ini, stok_rusak, stok_minimum from products where gudang_id = ?",
      [req.gudangId],
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", verifyManager, async (req, res) => {
  const { nama, kategori, satuan, harga, gambar, stok_saat_ini, stok_minimum } =
    req.body;

  try {
    const skuBaru = await generateSkuBaru(req.gudangId!);
    await db.query(
      "insert into products (gudang_id, sku, nama, kategori, satuan, harga, gambar, stok_saat_ini, stok_minimum) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        req.gudangId,
        skuBaru,
        nama,
        kategori,
        satuan,
        harga || 0,
        gambar || null,
        stok_saat_ini,
        stok_minimum,
      ],
    );
    res.status(201).json({ message: "Produk berhasil ditambahkan", sku: skuBaru });
  } catch (err) {
    res.status(400).json({ error: "Gagal menambahkan produk" });
  }
});

router.put("/:id", verifyManager, async (req, res) => {
  const { nama, kategori, satuan, harga, gambar, stok_saat_ini, stok_minimum } =
    req.body;

  try {
    const [hasil] = await db.query<any>(
      "update products set nama = ?, kategori = ?, satuan = ?, harga = ?, gambar = ?, stok_saat_ini = ?, stok_minimum = ? where id = ? and gudang_id = ?",
      [
        nama,
        kategori,
        satuan,
        harga || 0,
        gambar || null,
        stok_saat_ini,
        stok_minimum,
        req.params.id,
        req.gudangId,
      ],
    );

    if (hasil.affectedRows === 0) {
      return res.status(404).json({ error: "Produk tidak ditemukan" });
    }
    res.json({ message: "Produk berhasil diupdate" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", verifyManager, async (req, res) => {
  try {
    const [hasil] = await db.query<any>(
      "delete from products where id = ? and gudang_id = ?",
      [req.params.id, req.gudangId],
    );

    if (hasil.affectedRows === 0) {
      return res.status(404).json({ error: "Produk tidak ditemukan" });
    }
    res.json({ message: "Produk berhasil dihapus" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;