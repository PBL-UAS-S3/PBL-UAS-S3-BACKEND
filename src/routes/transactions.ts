import { Router } from "express";
import { verifyAnggota } from "../middleware/auth";
import { catatTransaksi, transaksiTerbaru } from "../handlers/transactions";

const router = Router();

router.post("/", verifyAnggota, catatTransaksi);
router.get("/recent", verifyAnggota, transaksiTerbaru);

export default router;