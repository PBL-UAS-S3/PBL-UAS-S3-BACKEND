import { Router } from "express";
import { verifyManager } from "../middleware/auth";
import { unggahGambar } from "../middleware/unggah";
import { unggahFotoProduk } from "../handlers/upload";

const router = Router();

router.post("/", verifyManager, unggahGambar, unggahFotoProduk);

export default router;