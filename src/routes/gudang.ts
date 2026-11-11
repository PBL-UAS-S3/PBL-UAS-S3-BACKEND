import { Router } from "express";
import { verifyToken, verifyAnggota, verifyManager } from "../middleware/auth";
import {
  statusKeanggotaan,
  gabungGudang,
  keluarGudang,
  infoGudangSaya,
  kodeBaru,
  daftarStaf,
  setujuiStaf,
  keluarkanStaf,
} from "../handlers/gudang";

const router = Router();

router.get("/status", verifyToken, statusKeanggotaan);
router.post("/gabung", verifyToken, gabungGudang);
router.post("/keluar", verifyToken, keluarGudang);
router.get("/saya", verifyAnggota, infoGudangSaya);
router.post("/kode-baru", verifyManager, kodeBaru);
router.get("/staf", verifyManager, daftarStaf);
router.put("/staf/:id/setujui", verifyManager, setujuiStaf);
router.put("/staf/:id/keluarkan", verifyManager, keluarkanStaf);

export default router;