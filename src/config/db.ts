import mysql from "mysql2/promise";

const env = process.env;

// Lokal: DB_HOST, DB_USER, ... dari .env
// Railway: MYSQLHOST, MYSQLUSER, ... disediakan otomatis oleh service MySQL
export const db = mysql.createPool({
  host: env.DB_HOST || env.MYSQLHOST || "localhost",
  user: env.DB_USER || env.MYSQLUSER || "root",
  password: env.DB_PASSWORD ?? env.MYSQLPASSWORD ?? "",
  database: env.DB_NAME || env.MYSQLDATABASE || "warehouse_db",
  port: Number(env.DB_PORT || env.MYSQLPORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});