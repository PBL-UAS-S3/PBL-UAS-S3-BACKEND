import { Router } from "express";
import { ambilGudang, verifyManager } from "../middleware/auth";
import { lihatPengaturan, simpanPengaturan } from "../handlers/pengaturan";

const router = Router();

router.get("/", ambilGudang, lihatPengaturan);
router.put("/", verifyManager, simpanPengaturan);

export default router;