import { HttpError } from "../utils/error";

export const TIPE_GAMBAR_DIIZINKAN = ["image/jpeg", "image/png", "image/webp"];
export const MAKS_UKURAN_GAMBAR = 2 * 1024 * 1024;

export type GambarDto = {
  buffer: Buffer;
  mimetype: string;
  namaAsli: string;
};

// Memeriksa file hasil multer
export function bacaGambarDto(file?: Express.Multer.File): GambarDto {
  if (!file) {
    throw new HttpError(400, "Tidak ada file yang diunggah");
  }
  return { buffer: file.buffer, mimetype: file.mimetype, namaAsli: file.originalname };
}