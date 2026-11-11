import { db } from "../config/db";
import type { PengaturanDto } from "../dto/pengaturan";

export async function ambil(gudangId: number): Promise<any> {
  const [rows] = await db.query<any[]>(
    "select nama_gudang, telepon, alamat, provinsi, kota, kecamatan, kode_pos, catatan, latitude, longitude from pengaturan_gudang where gudang_id = ?",
    [gudangId],
  );
  return rows[0];
}

export async function simpan(gudangId: number, d: PengaturanDto) {
  await db.query(
    "update pengaturan_gudang set nama_gudang = ?, telepon = ?, alamat = ?, provinsi = ?, kota = ?, kecamatan = ?, kode_pos = ?, catatan = ?, latitude = ?, longitude = ? where gudang_id = ?",
    [
      d.nama_gudang,
      d.telepon,
      d.alamat,
      d.provinsi,
      d.kota,
      d.kecamatan,
      d.kode_pos,
      d.catatan,
      d.latitude,
      d.longitude,
      gudangId,
    ],
  );
}