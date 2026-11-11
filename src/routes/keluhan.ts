import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { kirimKeluhan } from "../handlers/keluhan";

const router = Router();

router.post("/", verifyToken, kirimKeluhan);

export default router;