import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import {
  daftarManager,
  daftarStaf,
  verifikasiEmail,
  kirimUlangKode,
  login,
} from "../handlers/auth";
import {
  lupaPassword,
  resetPassword,
  lihatProfil,
  simpanProfil,
  gantiPassword,
} from "../handlers/akun";

const router = Router();

router.post("/register", daftarManager);
router.post("/register-staff", daftarStaf);
router.post("/verifikasi-email", verifikasiEmail);
router.post("/kirim-ulang-kode", kirimUlangKode);
router.post("/login", login);
router.post("/lupa-password", lupaPassword);
router.post("/reset-password", resetPassword);
router.get("/profil", verifyToken, lihatProfil);
router.put("/profil", verifyToken, simpanProfil);
router.put("/ganti-password", verifyToken, gantiPassword);

export default router;