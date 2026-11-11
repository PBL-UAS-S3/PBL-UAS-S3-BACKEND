import { Router } from "express";
import { verifyManager } from "../middleware/auth";
import { buatInsight, riwayatInsight } from "../handlers/aiInsights";

const router = Router();

router.post("/generate", verifyManager, buatInsight);
router.get("/", verifyManager, riwayatInsight);

export default router;