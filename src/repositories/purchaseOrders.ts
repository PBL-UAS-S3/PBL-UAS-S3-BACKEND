import { db } from "../config/db";

export async function cariProdukIdBySku(sku: string, gudangId: number): Promise<number | null> {
  const [rows] = await db.query<any[]>(
    "select id from products where sku = ? and gudang_id = ?",
    [sku, gudangId],
  );
  return rows.length > 0 ? rows[0].id : null;
}

export async function buat(productId: number, jumlah: number, catatan: string | null) {
  await db.query("insert into purchase_orders (product_id, jumlah, catatan) values (?, ?, ?)", [
    productId,
    jumlah,
    catatan,
  ]);
}

export async function ambilSemua(gudangId: number) {
  const [rows] = await db.query<any[]>(
    "select purchase_orders.id, products.nama, products.sku, products.harga, products.gambar, purchase_orders.jumlah, purchase_orders.status, purchase_orders.catatan, purchase_orders.created_at from purchase_orders, products where purchase_orders.product_id = products.id and products.gudang_id = ? order by purchase_orders.created_at desc",
    [gudangId],
  );
  return rows;
}

export async function cariUntukSelesai(id: string, gudangId: number): Promise<any> {
  const [rows] = await db.query<any[]>(
    "select purchase_orders.id as id, product_id, jumlah, status from purchase_orders, products where purchase_orders.product_id = products.id and purchase_orders.id = ? and products.gudang_id = ?",
    [id, gudangId],
  );
  return rows[0];
}

export async function cariUntukTolak(id: string, gudangId: number): Promise<any> {
  const [rows] = await db.query<any[]>(
    "select purchase_orders.id as id, status, purchase_orders.catatan as catatan from purchase_orders, products where purchase_orders.product_id = products.id and purchase_orders.id = ? and products.gudang_id = ?",
    [id, gudangId],
  );
  return rows[0];
}

export async function ambilStokLayak(productId: number): Promise<number> {
  const [rows] = await db.query<any[]>("select stok_saat_ini from products where id = ?", [
    productId,
  ]);
  return rows[0].stok_saat_ini;
}

export async function ubahStokLayak(productId: number, stok: number) {
  await db.query("update products set stok_saat_ini = ? where id = ?", [stok, productId]);
}

// Restock dari PO dicatat sebagai transaksi masuk
export async function catatStokMasuk(
  productId: number,
  userId: number,
  jumlah: number,
  catatan: string,
) {
  await db.query(
    "insert into stock_transactions (product_id, user_id, tipe, jumlah, catatan) values (?, ?, ?, ?, ?)",
    [productId, userId, "in", jumlah, catatan],
  );
}

export async function ubahStatus(id: string, status: "selesai" | "ditolak") {
  await db.query("update purchase_orders set status = ? where id = ?", [status, id]);
}

export async function tolak(id: string, catatan: string | null) {
  await db.query("update purchase_orders set status = ?, catatan = ? where id = ?", [
    "ditolak",
    catatan,
    id,
  ]);
}