import { google } from "googleapis";

// Kirim email lewat Gmail API (HTTPS), bukan SMTP
export async function kirimEmail(tujuan: string, subjek: string, html: string) {
  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_REFRESH_TOKEN ||
    !process.env.EMAIL_PENGIRIM
  ) {
    throw new Error("Konfigurasi Gmail API belum lengkap (cek variabel environment)");
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground",
  );
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  const gmail = google.gmail({ version: "v1", auth: oauth2 });

  const pesan = [
    `From: Stockin <${process.env.EMAIL_PENGIRIM}>`,
    `To: ${tujuan}`,
    `Subject: =?UTF-8?B?${Buffer.from(subjek).toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    html,
  ].join("\r\n");

  const raw = Buffer.from(pesan)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
}