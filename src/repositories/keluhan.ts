import { db } from "../config/db";

export async function ambilNamaUser(userId: number): Promise<string | undefined> {
  const [rows] = await db.query<any[]>("select nama from users where id = ?", [userId]);
  return rows[0]?.nama;
}

export async function simpan(userId: number, nama: string, pesan: string) {
  await db.query("insert into keluhan (user_id, nama, pesan) values (?, ?, ?)", [
    userId,
    nama,
    pesan,
  ]);
}