import { Router } from "express";
import { db } from "../config/db";
import { verifyToken } from "../middleware/auth";

const router = Router();

router.post("/", verifyToken, async (req, res) => {
  const { pesan } = req.body;

  if (!pesan) {
    return res.status(400).json({ error: "Pesan wajib diisi" });
  }

  try {
    const [userRows] = await db.query<any[]>("select nama from users where id = ?", [
      req.user!.id,
    ]);
    const nama = userRows[0] ? userRows[0].nama : "Tidak diketahui";

    await db.query("insert into keluhan (user_id, nama, pesan) values (?, ?, ?)", [
      req.user!.id,
      nama,
      pesan,
    ]);
    res.status(201).json({
      message: "Pesan berhasil dikirim, tim kami akan segera menghubungi kamu",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;