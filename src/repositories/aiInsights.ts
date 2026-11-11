import { db } from "../config/db";

export type ProdukAnalisis = {
  id: number;
  sku: string;
  nama: string;
  stok_saat_ini: number;
  stok_minimum: number;
};

export async function ambilProdukGudang(gudangId: number): Promise<ProdukAnalisis[]> {
  const [rows] = await db.query<any[]>(
    "select id, sku, nama, stok_saat_ini, stok_minimum from products where gudang_id = ?",
    [gudangId],
  );
  return rows;
}

// Total barang keluar 30 hari terakhir per produk (kunci = id produk)
export async function ambilTotalKeluar30Hari(gudangId: number): Promise<Map<number, number>> {
  const [rows] = await db.query<any[]>(
    "select product_id, sum(jumlah) as total_keluar from stock_transactions where tipe = 'out' and created_at >= date_sub(now(), interval 30 day) and product_id in (select id from products where gudang_id = ?) group by product_id",
    [gudangId],
  );
  return new Map(rows.map((r) => [Number(r.product_id), Number(r.total_keluar)]));
}

export async function simpan(productId: number, rekomendasi: string, jumlahRestock: number) {
  await db.query(
    "insert into ai_insights (product_id, rekomendasi, jumlah_restock_disarankan) values (?, ?, ?)",
    [productId, rekomendasi, jumlahRestock],
  );
}

export async function ambilRiwayat(gudangId: number) {
  const [rows] = await db.query<any[]>(
    "select ai_insights.id, products.nama, products.sku, products.gambar, products.stok_saat_ini, products.stok_minimum, ai_insights.rekomendasi, ai_insights.jumlah_restock_disarankan, ai_insights.generated_at, case when ai_insights.generated_at = (select max(b.generated_at) from ai_insights b where b.product_id = ai_insights.product_id) then 1 else 0 end as is_terbaru from ai_insights, products where ai_insights.product_id = products.id and products.gudang_id = ? order by ai_insights.generated_at desc limit 50",
    [gudangId],
  );
  return rows;
}