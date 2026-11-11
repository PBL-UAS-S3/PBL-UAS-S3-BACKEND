import { db } from "../config/db";

export async function hapusKode(email: string, tujuan: "verifikasi" | "reset") {
  await db.query("delete from kode_verifikasi where email = ? and tujuan = ?", [
    email,
    tujuan,
  ]);
}