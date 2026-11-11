export type ProdukDto = {
  nama: string;
  kategori: string;
  satuan: string;
  harga: number;
  gambar: string | null;
  stok_saat_ini: number;
  stok_minimum: number;
};

// Mengambil field produk dari body request, dipakai untuk tambah dan ubah
export function bacaProdukDto(body: any): ProdukDto {
  return {
    nama: body.nama,
    kategori: body.kategori,
    satuan: body.satuan,
    harga: body.harga || 0,
    gambar: body.gambar || null,
    stok_saat_ini: body.stok_saat_ini,
    stok_minimum: body.stok_minimum,
  };
}