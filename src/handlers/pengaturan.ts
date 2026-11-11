import { Request, Response } from "express";
import { kirimError } from "../utils/error";
import { bacaPengaturanDto } from "../dto/pengaturan";
import * as pengaturanRepo from "../repositories/pengaturan";

export async function lihatPengaturan(req: Request, res: Response) {
  try {
    res.json((await pengaturanRepo.ambil(req.gudangId!)) || {});
  } catch (err) {
    kirimError(res, err);
  }
}

export async function simpanPengaturan(req: Request, res: Response) {
  try {
    const data = bacaPengaturanDto(req.body);
    await pengaturanRepo.simpan(req.gudangId!, data);
    res.json({ message: "Pengaturan gudang berhasil disimpan" });
  } catch (err) {
    kirimError(res, err);
  }
}