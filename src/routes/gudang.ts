import { Router } from "express";
import { db } from "../config/db";
import { verifyToken, verifyAnggota, verifyManager } from "../middleware/auth";
import { buatKodeGudang } from "../services/gudang";

const router = Router();

// Status keanggotaan user yang login: belum / menunggu / aktif
router.get("/status", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query<any[]>(
      "select gudang_id from users where id = ?",
      [req.user!.id],
    );
    const gudangId = rows.length > 0 ? rows[0].gudang_id : null;

    let gudang: { id: number; nama_gudang: string | null } | null = null;
    if (gudangId) {
      const [pengaturan] = await db.query<any[]>(
        "select nama_gudang from pengaturan_gudang where gudang_id = ?",
        [gudangId],
      );
      gudang = {
        id: gudangId,
        nama_gudang: pengaturan.length > 0 ? pengaturan[0].nama_gudang : null,
      };
    }

    res.json({ status: req.statusAnggota, gudang });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Staf mengajukan bergabung memakai kode gudang
router.post("/gabung", verifyToken, async (req, res) => {
  const { kode_gudang } = req.body;

  if (req.user!.role !== "staff") {
    return res.status(403).json({ error: "Hanya akun staf yang bisa bergabung ke gudang" });
  }
  if (!kode_gudang) {
    return res.status(400).json({ error: "Kode gudang wajib diisi" });
  }
  if (req.statusAnggota !== "belum") {
    return res.status(400).json({
      error: "Kamu sudah tergabung atau sedang menunggu persetujuan gudang",
    });
  }

  try {
    const [gudang] = await db.query<any[]>("select id from gudang where kode = ?", [
      String(kode_gudang).trim().toUpperCase(),
    ]);
    if (gudang.length === 0) {
      return res.status(400).json({ error: "Kode gudang tidak ditemukan" });
    }

    await db.query(
      "update users set gudang_id = ?, status_anggota = 'menunggu' where id = ?",
      [gudang[0].id, req.user!.id],
    );
    res.json({ message: "Permintaan terkirim, tunggu persetujuan Manager gudang" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Staf membatalkan permintaan atau keluar dari gudang
router.post("/keluar", verifyToken, async (req, res) => {
  if (req.user!.role !== "staff") {
    return res.status(403).json({ error: "Hanya akun staf yang bisa keluar dari gudang" });
  }

  try {
    await db.query(
      "update users set gudang_id = null, status_anggota = 'aktif' where id = ?",
      [req.user!.id],
    );
    res.json({ message: "Kamu sudah tidak terhubung ke gudang" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Info gudang milik user yang login (kode hanya terlihat oleh manager)
router.get("/saya", verifyAnggota, async (req, res) => {
  try {
    const [gudang] = await db.query<any[]>("select id, kode from gudang where id = ?", [
      req.gudangId,
    ]);
    if (gudang.length === 0) {
      return res.status(404).json({ error: "Gudang tidak ditemukan" });
    }

    const [pengaturan] = await db.query<any[]>(
      "select nama_gudang from pengaturan_gudang where gudang_id = ?",
      [req.gudangId],
    );

    res.json({
      id: gudang[0].id,
      nama_gudang: pengaturan.length > 0 ? pengaturan[0].nama_gudang : null,
      kode: req.user!.role === "manager" ? gudang[0].kode : undefined,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Buat kode gudang baru (kode lama langsung tidak berlaku)
router.post("/kode-baru", verifyManager, async (req, res) => {
  try {
    for (let percobaan = 0; percobaan < 10; percobaan++) {
      const kode = buatKodeGudang();
      try {
        await db.query("update gudang set kode = ? where id = ?", [kode, req.gudangId]);
        return res.json({ message: "Kode gudang diperbarui", kode });
      } catch (err: any) {
        if (err.code !== "ER_DUP_ENTRY") throw err;
      }
    }
    res.status(500).json({ error: "Gagal membuat kode baru, coba lagi" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Daftar staf gudang ini: yang aktif dan yang menunggu persetujuan
router.get("/staf", verifyManager, async (req, res) => {
  try {
    const [rows] = await db.query<any[]>(
      "select id, nama, email, telepon, status_anggota from users where gudang_id = ? and role = 'staff' and email_terverifikasi = 1 order by nama",
      [req.gudangId],
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Setujui permintaan bergabung
router.put("/staf/:id/setujui", verifyManager, async (req, res) => {
  try {
    const [hasil] = await db.query<any>(
      "update users set status_anggota = 'aktif' where id = ? and gudang_id = ? and role = 'staff' and status_anggota = 'menunggu'",
      [req.params.id, req.gudangId],
    );
    if (hasil.affectedRows === 0) {
      return res.status(404).json({ error: "Permintaan bergabung tidak ditemukan" });
    }
    res.json({ message: "Staf disetujui" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Tolak permintaan atau keluarkan staf (akunnya tetap ada, riwayat transaksinya tidak hilang)
router.put("/staf/:id/keluarkan", verifyManager, async (req, res) => {
  try {
    const [hasil] = await db.query<any>(
      "update users set gudang_id = null, status_anggota = 'aktif' where id = ? and gudang_id = ? and role = 'staff'",
      [req.params.id, req.gudangId],
    );
    if (hasil.affectedRows === 0) {
      return res.status(404).json({ error: "Staf tidak ditemukan di gudang ini" });
    }
    res.json({ message: "Staf dikeluarkan dari gudang" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;