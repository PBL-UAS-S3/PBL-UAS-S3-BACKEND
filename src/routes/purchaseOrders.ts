import { Router } from "express";
import { verifyManager } from "../middleware/auth";
import { buatPO, daftarPO, selesaikanPO, tolakPO } from "../handlers/purchaseOrders";

const router = Router();

router.post("/", verifyManager, buatPO);
router.get("/", verifyManager, daftarPO);
router.put("/:id/selesai", verifyManager, selesaikanPO);
router.put("/:id/tolak", verifyManager, tolakPO);

export default router;