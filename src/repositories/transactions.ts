import { db } from "../config/db";
import type { TransaksiDto } from "../dto/transactions";

export type ProdukStok = {
  id: number;
  stok_saat_ini: number;
  stok_rusak: number;
};

export async function cariProdukBySku(
  sku: string,
  gudangId: number,
): Promise<ProdukStok | undefined> {
  const [rows] = await db.query<any[]>(
    "select id, stok_saat_ini, stok_rusak from products where sku = ? and gudang_id = ?",
    [sku, gudangId],
  );
  return rows[0];
}

export async function simpan(productId: number, userId: number, data: TransaksiDto) {
  await db.query(
    "insert into stock_transactions (product_id, user_id, tipe, jumlah, catatan) values (?, ?, ?, ?, ?)",
    [productId, userId, data.tipe, data.jumlah, data.catatan],
  );
}

export async function ubahStok(productId: number, stok: number, stokRusak: number) {
  await db.query("update products set stok_saat_ini = ?, stok_rusak = ? where id = ?", [
    stok,
    stokRusak,
    productId,
  ]);
}

export async function ambilTerbaru(gudangId: number, batas: number) {
  const [rows] = await db.query<any[]>(
    "select stock_transactions.id, products.nama, products.sku, products.gambar, stock_transactions.tipe, stock_transactions.jumlah, stock_transactions.catatan, stock_transactions.created_at, users.nama as nama_staf from stock_transactions, products, users where stock_transactions.product_id = products.id and stock_transactions.user_id = users.id and products.gudang_id = ? order by stock_transactions.created_at desc limit ?",
    [gudangId, batas],
  );
  return rows;
}