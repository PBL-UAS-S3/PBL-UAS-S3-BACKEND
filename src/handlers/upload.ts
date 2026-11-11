import { Request, Response } from "express";
import { kirimError } from "../utils/error";
import { bacaGambarDto } from "../dto/upload";
import * as gambarRepo from "../repositories/gambar";

export async function unggahFotoProduk(req: Request, res: Response) {
  try {
    const gambar = bacaGambarDto(req.file);
    const url = await gambarRepo.simpan(gambar.buffer, `stockin/gudang-${req.gudangId}`);
    res.json({ url });
  } catch (err) {
    kirimError(res, err);
  }
}