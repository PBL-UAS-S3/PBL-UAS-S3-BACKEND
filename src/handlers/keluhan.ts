import { Request, Response } from "express";
import { kirimError } from "../utils/error";
import { bacaKeluhanDto } from "../dto/keluhan";
import * as keluhanRepo from "../repositories/keluhan";

export async function kirimKeluhan(req: Request, res: Response) {
  try {
    const { pesan } = bacaKeluhanDto(req.body);
    const nama = (await keluhanRepo.ambilNamaUser(req.user!.id)) ?? "Tidak diketahui";

    await keluhanRepo.simpan(req.user!.id, nama, pesan);
    res.status(201).json({
      message: "Pesan berhasil dikirim, tim kami akan segera menghubungi kamu",
    });
  } catch (err) {
    kirimError(res, err);
  }
}