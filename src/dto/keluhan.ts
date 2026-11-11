import { HttpError } from "../utils/error";

export type KeluhanDto = { pesan: string };

export function bacaKeluhanDto(body: any): KeluhanDto {
  if (!body.pesan) {
    throw new HttpError(400, "Pesan wajib diisi");
  }
  return { pesan: body.pesan };
}