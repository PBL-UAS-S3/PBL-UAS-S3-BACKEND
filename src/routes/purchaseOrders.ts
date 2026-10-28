import { Router } from "express";
import { db } from "../config/db";
import { verifyManager } from "../middleware/auth";

const router = Router();

router.post("/", verifyManager, async (req, res) => {
  const { sku, jumlah, catatan } = req.body;

  try {
    const [produk] = await db.query<any[]>(
      "select id from products where sku = ? and gudang_id = ?",
      [sku, req.gudangId],
    );

    if (produk.length === 0) {
      return res.status(404).json({ error: "SKU tidak ditemukan" });
    }

    await db.query(
      "insert into purchase_orders (product_id, jumlah, catatan) values (?, ?, ?)",
      [produk[0].id, jumlah, catatan || null],
    );

    res.status(201).json({ message: "Purchase Order berhasil dibuat" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", verifyManager, async (req, res) => {
  try {
    const [rows] = await db.query<any[]>(
      "select purchase_orders.id, products.nama, products.sku, products.harga, products.gambar, purchase_orders.jumlah, purchase_orders.status, purchase_orders.catatan, purchase_orders.created_at from purchase_orders, products where purchase_orders.product_id = products.id and products.gudang_id = ? order by purchase_orders.created_at desc",
      [req.gudangId],
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id/selesai", verifyManager, async (req, res) => {
  try {
    const [po] = await db.query<any[]>(
      "select purchase_orders.id as id, product_id, jumlah, status from purchase_orders, products where purchase_orders.product_id = products.id and purchase_orders.id = ? and products.gudang_id = ?",
      [req.params.id, req.gudangId],
    );

    if (po.length === 0) {
      return res.status(404).json({ error: "Purchase Order tidak ditemukan" });
    }

    if (po[0].status === "selesai") {
      return res
        .status(400)
        .json({ error: "Purchase Order ini sudah selesai sebelumnya" });
    }
    if (po[0].status === "ditolak") {
      return res
        .status(400)
        .json({ error: "Purchase Order ini sudah ditolak, tidak bisa disetujui" });
    }

    const [produk] = await db.query<any[]>(
      "select stok_saat_ini from products where id = ?",
      [po[0].product_id],
    );
    const stokBaru = produk[0].stok_saat_ini + po[0].jumlah;

    await db.query("update products set stok_saat_ini = ? where id = ?", [
      stokBaru,
      po[0].product_id,
    ]);

    await db.query(
      "insert into stock_transactions (product_id, user_id, tipe, jumlah, catatan) values (?, ?, ?, ?, ?)",
      [
        po[0].product_id,
        req.user!.id,
        "in",
        po[0].jumlah,
        `Restock dari Purchase Order #${po[0].id}`,
      ],
    );

    await db.query("update purchase_orders set status = ? where id = ?", [
      "selesai",
      req.params.id,
    ]);

    res.json({
      message: "Purchase Order selesai, stok berhasil diperbarui",
      stok_baru: stokBaru,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Tolak PO yang masih menunggu. Stok tidak berubah, alasan (opsional) masuk ke catatan.
router.put("/:id/tolak", verifyManager, async (req, res) => {
  const alasan = String(req.body.alasan || "").trim();

  try {
    const [po] = await db.query<any[]>(
      "select purchase_orders.id as id, status, purchase_orders.catatan as catatan from purchase_orders, products where purchase_orders.product_id = products.id and purchase_orders.id = ? and products.gudang_id = ?",
      [req.params.id, req.gudangId],
    );

    if (po.length === 0) {
      return res.status(404).json({ error: "Purchase Order tidak ditemukan" });
    }
    if (po[0].status === "selesai") {
      return res
        .status(400)
        .json({ error: "Purchase Order ini sudah selesai, tidak bisa ditolak" });
    }
    if (po[0].status === "ditolak") {
      return res
        .status(400)
        .json({ error: "Purchase Order ini sudah ditolak sebelumnya" });
    }

    let catatanBaru: string | null = po[0].catatan;
    if (alasan) {
      catatanBaru = po[0].catatan
        ? `${po[0].catatan} | Ditolak: ${alasan}`
        : `Ditolak: ${alasan}`;
    }

    await db.query(
      "update purchase_orders set status = ?, catatan = ? where id = ?",
      ["ditolak", catatanBaru, req.params.id],
    );

    res.json({ message: "Purchase Order ditolak" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;