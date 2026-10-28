import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "../config/db";
import { JWT_SECRET } from "../config/env";

export interface UserToken {
  id: number;
  nama: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserToken;
      gudangId?: number;
      statusAnggota?: "belum" | "menunggu" | "aktif";
    }
  }
}

// Cek token, lalu baca data terbaru user dari database.
// gudangId hanya terisi kalau user boleh memakai gudang (manager, atau staf yang sudah disetujui).
export async function verifyToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Token tidak ada" });

  const token = authHeader.split(" ")[1];
  let payload: any;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(403).json({ error: "Token tidak valid" });
  }

  try {
    const [rows] = await db.query<any[]>(
      "select id, nama, role, gudang_id, status_anggota from users where id = ?",
      [payload.id],
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: "Akun tidak ditemukan" });
    }

    const u = rows[0];
    req.user = { id: u.id, nama: u.nama, role: u.role };

    if (u.role === "manager") {
      req.statusAnggota = "aktif";
      req.gudangId = u.gudang_id || undefined;
    } else if (!u.gudang_id) {
      req.statusAnggota = "belum";
    } else if (u.status_anggota === "aktif") {
      req.statusAnggota = "aktif";
      req.gudangId = u.gudang_id;
    } else {
      req.statusAnggota = "menunggu";
    }

    next();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// Untuk endpoint yang butuh gudang aktif (produk, transaksi, riwayat, dst)
export function verifyAnggota(req: Request, res: Response, next: NextFunction) {
  verifyToken(req, res, () => {
    if (!req.gudangId) {
      return res.status(403).json({
        error: "Kamu belum bergabung ke gudang",
        perlu_gudang: true,
        status_anggota: req.statusAnggota,
      });
    }
    next();
  });
}

export function verifyManager(req: Request, res: Response, next: NextFunction) {
  verifyAnggota(req, res, () => {
    if (req.user!.role !== "manager") {
      return res
        .status(403)
        .json({ error: "Hanya manager yang boleh mengakses fitur ini" });
    }
    next();
  });
}

// Nama lama dipertahankan supaya route products dan pengaturan tidak perlu diubah
export const ambilGudang = verifyAnggota;