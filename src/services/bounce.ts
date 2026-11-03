import { buatKlienGmail } from "./email";

const DETIK_CEK = Number(process.env.CEK_BOUNCE_DETIK ?? 6);
const JEDA_MS = 1500;

function tunggu(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mengecek apakah email yang baru dikirim ditolak (alamat tidak ada).
// true  = ada pesan penolakan dari mailer-daemon untuk alamat itu
// false = tidak ada tanda gagal selama masa tunggu
// null  = tidak bisa dicek (izin Gmail belum lengkap atau pengecekan dimatikan)
export async function emailTidakTerkirim(
  email: string,
  sejakMs: number,
): Promise<boolean | null> {
  if (DETIK_CEK <= 0) {
    console.log(`[cek-email] ${email}: dilewati (CEK_BOUNCE_DETIK=0)`);
    return null;
  }

  let gmail;
  try {
    gmail = buatKlienGmail();
  } catch (err: any) {
    console.log(`[cek-email] ${email}: dilewati (${err.message})`);
    return null;
  }

  const alamat = email.replace(/["\\]/g, "");
  const q = `from:(mailer-daemon OR postmaster) "${alamat}" after:${Math.floor(sejakMs / 1000) - 2}`;
  const batas = Date.now() + DETIK_CEK * 1000;

  while (Date.now() < batas) {
    await tunggu(JEDA_MS);

    try {
      const res = await gmail.users.messages.list({
        userId: "me",
        q,
        maxResults: 5,
        includeSpamTrash: true,
      });

      for (const p of res.data.messages || []) {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: p.id!,
          format: "metadata",
          metadataHeaders: ["Subject"],
        });
        const subjek =
          detail.data.payload?.headers
            ?.find((h) => h.name?.toLowerCase() === "subject")
            ?.value?.toLowerCase() ?? "";

        // "Delay" hanya pemberitahuan tertunda, bukan alamat tidak ada
        if (subjek.includes("delay")) continue;

        console.log(`[cek-email] ${email}: DITOLAK server tujuan ("${subjek}")`);
        return true;
      }
    } catch (err: any) {
      console.log(
        `[cek-email] ${email}: dilewati, izin Gmail kurang? (${err.message})`,
      );
      return null;
    }
  }

  console.log(
    `[cek-email] ${email}: tidak ada penolakan dalam ${DETIK_CEK} detik (server menerima atau penolakan terlambat)`,
  );
  return false;
}