import { db } from "../config/db";

export async function catat(data: {
  userId: number | null;
  email: string;
  berhasil: boolean;
  alasan: string | null;
  ip: string | null;
  userAgent: string | null;
}) {
  await db.query(
    "insert into log_login (user_id, email, berhasil, alasan, ip, user_agent) values (?, ?, ?, ?, ?, ?)",
    [data.userId, data.email, data.berhasil ? 1 : 0, data.alasan, data.ip, data.userAgent],
  );
}