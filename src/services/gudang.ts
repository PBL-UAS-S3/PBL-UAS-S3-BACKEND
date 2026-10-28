import crypto from "crypto";
import { db } from "../config/db";

// Tanpa huruf/angka yang mirip (I, O, 0, 1) supaya kode mudah dibaca dan diketik
const ALFABET_KODE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function buatKodeGudang(): string {
  let kode = "";
  for (let i = 0; i < 6; i++) {
    kode += ALFABET_KODE[crypto.randomInt(0, ALFABET_KODE.length)];
  }
  return kode;
}

export async function buatGudangBaru(namaGudang: string): Promise<number> {
  for (let percobaan = 0; percobaan < 10; percobaan++) {
    try {
      const [hasil] = await db.query<any>("insert into gudang (kode) values (?)", [
        buatKodeGudang(),
      ]);
      await db.query(
        "insert into pengaturan_gudang (gudang_id, nama_gudang) values (?, ?)",
        [hasil.insertId, namaGudang],
      );
      return hasil.insertId;
    } catch (err: any) {
      if (err.code !== "ER_DUP_ENTRY") throw err;
    }
  }
  throw new Error("Gagal membuat kode gudang yang unik");
}

// Pastikan akun manager punya gudang; kalau belum, buatkan
export async function pastikanGudangManager(user: {
  id: number;
  nama: string;
  gudang_id: number | null;
}): Promise<number> {
  if (user.gudang_id) return user.gudang_id;
  const gudangId = await buatGudangBaru(`Gudang ${user.nama}`);
  await db.query("update users set gudang_id = ? where id = ?", [gudangId, user.id]);
  return gudangId;
}