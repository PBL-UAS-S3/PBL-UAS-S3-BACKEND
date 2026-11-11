import { cloudinary } from "../config/cloudinary";

// Mengunggah gambar ke Cloudinary dan mengembalikan alamat https-nya
export function simpan(buffer: Buffer, folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, hasil) => {
        if (error || !hasil) {
          reject(error ?? new Error("Gagal mengunggah gambar ke Cloudinary"));
          return;
        }
        resolve(hasil.secure_url);
      },
    );
    stream.end(buffer);
  });
}