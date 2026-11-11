import { Request, Response } from "express";
import { HttpError, kirimError } from "../utils/error";
import { bacaBuatPoDto, bacaTolakDto } from "../dto/purchaseOrders";
import * as poRepo from "../repositories/purchaseOrders";

export async function buatPO(req: Request, res: Response) {
  try {
    const data = bacaBuatPoDto(req.body);

    const produkId = await poRepo.cariProdukIdBySku(data.sku, req.gudangId!);
    if (!produkId) throw new HttpError(404, "SKU tidak ditemukan");

    await poRepo.buat(produkId, data.jumlah, data.catatan);
    res.status(201).json({ message: "Purchase Order berhasil dibuat" });
  } catch (err) {
    kirimError(res, err);
  }
}

export async function daftarPO(req: Request, res: Response) {
  try {
    res.json(await poRepo.ambilSemua(req.gudangId!));
  } catch (err) {
    kirimError(res, err);
  }
}

// Approve: stok bertambah, transaksi masuk dicatat, status jadi selesai
export async function selesaikanPO(req: Request, res: Response) {
  try {
    const id = String(req.params.id);

    const po = await poRepo.cariUntukSelesai(id, req.gudangId!);
    if (!po) throw new HttpError(404, "Purchase Order tidak ditemukan");
    if (po.status === "selesai") {
      throw new HttpError(400, "Purchase Order ini sudah selesai sebelumnya");
    }
    if (po.status === "ditolak") {
      throw new HttpError(400, "Purchase Order ini sudah ditolak, tidak bisa disetujui");
    }

    const stokBaru = (await poRepo.ambilStokLayak(po.product_id)) + po.jumlah;

    await poRepo.ubahStokLayak(po.product_id, stokBaru);
    await poRepo.catatStokMasuk(
      po.product_id,
      req.user!.id,
      po.jumlah,
      `Restock dari Purchase Order #${po.id}`,
    );
    await poRepo.ubahStatus(id, "selesai");

    res.json({
      message: "Purchase Order selesai, stok berhasil diperbarui",
      stok_baru: stokBaru,
    });
  } catch (err) {
    kirimError(res, err);
  }
}

// Tolak PO yang masih menunggu. Stok tidak berubah, alasan (opsional) masuk ke catatan.
export async function tolakPO(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const { alasan } = bacaTolakDto(req.body);

    const po = await poRepo.cariUntukTolak(id, req.gudangId!);
    if (!po) throw new HttpError(404, "Purchase Order tidak ditemukan");
    if (po.status === "selesai") {
      throw new HttpError(400, "Purchase Order ini sudah selesai, tidak bisa ditolak");
    }
    if (po.status === "ditolak") {
      throw new HttpError(400, "Purchase Order ini sudah ditolak sebelumnya");
    }

    let catatanBaru: string | null = po.catatan;
    if (alasan) {
      catatanBaru = po.catatan ? `${po.catatan} | Ditolak: ${alasan}` : `Ditolak: ${alasan}`;
    }

    await poRepo.tolak(id, catatanBaru);
    res.json({ message: "Purchase Order ditolak" });
  } catch (err) {
    kirimError(res, err);
  }
}