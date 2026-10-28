import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { verifyManager } from "../middleware/auth";

// Folder uploads ada di warehouse-backend/uploads (cwd = folder backend)
export const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const tipeDiizinkan = ["image/jpeg", "image/png", "image/webp"];
    if (tipeDiizinkan.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file JPG, PNG, atau WEBP yang diizinkan"));
    }
  },
});

const router = Router();

router.post("/", verifyManager, upload.single("gambar"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Tidak ada file yang diunggah" });
  }
  res.json({ url: `/uploads/${req.file.filename}` });
});

export default router;