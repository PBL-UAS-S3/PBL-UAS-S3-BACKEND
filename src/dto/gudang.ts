import { HttpError } from "../utils/error";

export function bacaGabungDto(body: any) {
  if (!body.kode_gudang) {
    throw new HttpError(400, "Kode gudang wajib diisi");
  }
  return { kodeGudang: String(body.kode_gudang).trim().toUpperCase() };
}