import { db } from "../config/db";

export async function ambilGudangIdUser(userId: number): Promise<number | null> {
  const [rows] = await db.query<any[]>("select gudang_id from users where id = ?", [userId]);
  return rows.length > 0 ? rows[0].gudang_id : null;
}

export async function ambilNamaGudang(gudangId: number): Promise<string | null> {
  const [rows] = await db.query<any[]>(
    "select nama_gudang from pengaturan_gudang where gudang_id = ?",
    [gudangId],
  );
  return rows.length > 0 ? rows[0].nama_gudang : null;
}

export async function cariIdByKode(kode: string): Promise<number | null> {
  const [rows] = await db.query<any[]>("select id from gudang where kode = ?", [kode]);
  return rows.length > 0 ? rows[0].id : null;
}

export async function ambilGudang(
  gudangId: number,
): Promise<{ id: number; kode: string } | undefined> {
  const [rows] = await db.query<any[]>("select id, kode from gudang where id = ?", [gudangId]);
  return rows[0];
}

// Bisa melempar ER_DUP_ENTRY kalau kode kebetulan sudah dipakai gudang lain
export async function ubahKode(gudangId: number, kode: string) {
  await db.query("update gudang set kode = ? where id = ?", [kode, gudangId]);
}

export async function ajukanBergabung(userId: number, gudangId: number) {
  await db.query("update users set gudang_id = ?, status_anggota = 'menunggu' where id = ?", [
    gudangId,
    userId,
  ]);
}

// Staf membatalkan permintaan atau keluar sendiri
export async function lepasDariGudang(userId: number) {
  await db.query("update users set gudang_id = null, status_anggota = 'aktif' where id = ?", [
    userId,
  ]);
}

export async function ambilStaf(gudangId: number) {
  const [rows] = await db.query<any[]>(
    "select id, nama, email, telepon, status_anggota from users where gudang_id = ? and role = 'staff' and email_terverifikasi = 1 order by nama",
    [gudangId],
  );
  return rows;
}

// Mengembalikan jumlah baris yang berubah (0 = tidak ditemukan)
export async function setujuiStaf(id: string, gudangId: number): Promise<number> {
  const [hasil] = await db.query<any>(
    "update users set status_anggota = 'aktif' where id = ? and gudang_id = ? and role = 'staff' and status_anggota = 'menunggu'",
    [id, gudangId],
  );
  return hasil.affectedRows;
}

export async function keluarkanStaf(id: string, gudangId: number): Promise<number> {
  const [hasil] = await db.query<any>(
    "update users set gudang_id = null, status_anggota = 'aktif' where id = ? and gudang_id = ? and role = 'staff'",
    [id, gudangId],
  );
  return hasil.affectedRows;
}