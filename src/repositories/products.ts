import { db } from "../config/db";
import type { ProdukDto } from "../dto/products";

export async function ambilSemua(gudangId: number) {
  const [rows] = await db.query<any[]>(
    "select id, sku, nama, kategori, satuan, harga, gambar, stok_saat_ini, stok_rusak, stok_minimum from products where gudang_id = ?",
    [gudangId],
  );
  return rows;
}

// SKU terakhir di gudang ini (urut menurut angkanya), atau null kalau belum ada produk
export async function ambilSkuTerakhir(gudangId: number): Promise<string | null> {
  const [rows] = await db.query<any[]>(
    "select sku from products where gudang_id = ? and sku like 'SKU%' order by cast(substring(sku, 4) as unsigned) desc limit 1",
    [gudangId],
  );
  return rows.length === 0 ? null : rows[0].sku;
}

export async function tambah(gudangId: number, sku: string, data: ProdukDto) {
  await db.query(
    "insert into products (gudang_id, sku, nama, kategori, satuan, harga, gambar, stok_saat_ini, stok_minimum) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      gudangId,
      sku,
      data.nama,
      data.kategori,
      data.satuan,
      data.harga,
      data.gambar,
      data.stok_saat_ini,
      data.stok_minimum,
    ],
  );
}

// Mengembalikan jumlah baris yang berubah (0 = produk tidak ditemukan)
export async function ubah(id: string | number, gudangId: number, data: ProdukDto) {
  const [hasil] = await db.query<any>(
    "update products set nama = ?, kategori = ?, satuan = ?, harga = ?, gambar = ?, stok_saat_ini = ?, stok_minimum = ? where id = ? and gudang_id = ?",
    [
      data.nama,
      data.kategori,
      data.satuan,
      data.harga,
      data.gambar,
      data.stok_saat_ini,
      data.stok_minimum,
      id,
      gudangId,
    ],
  );
  return hasil.affectedRows as number;
}

export async function hapus(id: string | number, gudangId: number) {
  const [hasil] = await db.query<any>(
    "delete from products where id = ? and gudang_id = ?",
    [id, gudangId],
  );
  return hasil.affectedRows as number;
}