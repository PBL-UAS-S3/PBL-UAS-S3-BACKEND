import { Router } from "express";
import { ambilGudang, verifyManager } from "../middleware/auth";
import { daftarProduk, tambahProduk, ubahProduk, hapusProduk } from "../handlers/products";

const router = Router();

router.get("/", ambilGudang, daftarProduk);
router.post("/", verifyManager, tambahProduk);
router.put("/:id", verifyManager, ubahProduk);
router.delete("/:id", verifyManager, hapusProduk);

export default router;