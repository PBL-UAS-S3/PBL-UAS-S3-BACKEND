export type PengaturanDto = {
  nama_gudang: string | null;
  telepon: string | null;
  alamat: string | null;
  provinsi: string | null;
  kota: string | null;
  kecamatan: string | null;
  kode_pos: string | null;
  catatan: string | null;
  latitude: number | null;
  longitude: number | null;
};

export function bacaPengaturanDto(body: any): PengaturanDto {
  return {
    nama_gudang: body.nama_gudang || null,
    telepon: body.telepon || null,
    alamat: body.alamat || null,
    provinsi: body.provinsi || null,
    kota: body.kota || null,
    kecamatan: body.kecamatan || null,
    kode_pos: body.kode_pos || null,
    catatan: body.catatan || null,
    latitude: body.latitude || null,
    longitude: body.longitude || null,
  };
}