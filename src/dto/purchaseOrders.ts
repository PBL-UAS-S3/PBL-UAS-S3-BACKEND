export function bacaBuatPoDto(body: any) {
  return {
    sku: body.sku,
    jumlah: body.jumlah,
    catatan: body.catatan || null,
  };
}

// Alasan penolakan bersifat opsional
export function bacaTolakDto(body: any) {
  return { alasan: String(body.alasan || "").trim() };
}