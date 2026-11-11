import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { TIPE_GAMBAR_DIIZINKAN, MAKS_UKURAN_GAMBAR } from "../dto/upload";

// File ditahan di memori, lalu dikirim ke Cloudinary oleh handler
const penerima = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAKS_UKURAN_GAMBAR },
  fileFilter: (req, file, cb) => {
    if (TIPE_GAMBAR_DIIZINKAN.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file JPG, PNG, atau WEBP yang diizinkan"));
    }
  },
}).single("gambar");

// Error multer dijawab sebagai JSON supaya terbaca di form (bukan halaman error mentah)
export function unggahGambar(req: Request, res: Response, next: NextFunction) {
  penerima(req, res, (err: any) => {
    if (err) {
      const pesan =
        err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
          ? "Ukuran gambar maksimal 2 MB"
          : err.message;
      res.status(400).json({ error: pesan });
      return;
    }
    next();
  });
}