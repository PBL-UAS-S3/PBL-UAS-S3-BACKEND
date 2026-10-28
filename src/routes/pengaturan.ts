import { Router } from "express";
import { db } from "../config/db";
import { ambilGudang, verifyManager } from "../middleware/auth";

const router = Router();

router.get("/", ambilGudang, async (req, res) => {
  try {
    const [rows] = await db.query<any[]>(
      "select nama_gudang, telepon, alamat, provinsi, kota, kecamatan, kode_pos, catatan, latitude, longitude from pengaturan_gudang where gudang_id = ?",
      [req.gudangId],
    );
    res.json(rows[0] || {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/", verifyManager, async (req, res) => {
  const {
    nama_gudang,
    telepon,
    alamat,
    provinsi,
    kota,
    kecamatan,
    kode_pos,
    catatan,
    latitude,
    longitude,
  } = req.body;

  try {
    await db.query(
      "update pengaturan_gudang set nama_gudang = ?, telepon = ?, alamat = ?, provinsi = ?, kota = ?, kecamatan = ?, kode_pos = ?, catatan = ?, latitude = ?, longitude = ? where gudang_id = ?",
      [
        nama_gudang || null,
        telepon || null,
        alamat || null,
        provinsi || null,
        kota || null,
        kecamatan || null,
        kode_pos || null,
        catatan || null,
        latitude || null,
        longitude || null,
        req.gudangId,
      ],
    );
    res.json({ message: "Pengaturan gudang berhasil disimpan" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;