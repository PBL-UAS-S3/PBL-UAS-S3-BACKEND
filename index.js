require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const dns = require("dns").promises;
const { google } = require("googleapis");
const { verifyToken, verifyManager } = require("./middleware");
const { GoogleGenAI } = require("@google/genai");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

// Konfigurasi CORS agar bisa diakses dari frontend Vercel & Mobile
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Endpoint Root untuk cek status server
app.get("/", (req, res) => {
  res.json({ status: "success", message: "Server Backend Stockin Aktif dan Berjalan Normal!" });
});

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
app.use("/uploads", express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const namaUnik = `${Date.now()}${path.extname(file.originalname)}`;
    cb(null, namaUnik);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const tipeDiizinkan = ["image/jpeg", "image/png", "image/webp"];
    if (tipeDiizinkan.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file JPG, PNG, atau WEBP yang diizinkan"));
    }
  },
});

const JWT_SECRET = "rahasia_warehouse_ac03";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Bikin SKU otomatis, lanjut dari nomor terakhir (SKU001, SKU002, dst)
async function generateSkuBaru() {
  const [rows] = await db.query(
    "select sku from products where sku like 'SKU%' order by cast(substring(sku, 4) as unsigned) desc limit 1",
  );
  if (rows.length === 0) return "SKU001";
  const angka = parseInt(rows[0].sku.replace("SKU", ""), 10) || 0;
  return "SKU" + String(angka + 1).padStart(3, "0");
}

// ==== EMAIL & OTP ====

const MIN_PASSWORD = 8;
const POLA_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const KODE_BERLAKU_MENIT = 10;
const JEDA_KIRIM_DETIK = 60;
const MAKS_PERCOBAAN = 5;

function escapeHtml(teks) {
  return String(teks)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function kirimError(res, err) {
  res.status(err.status || 500).json({ error: err.message });
}

// Cek apakah domain email benar-benar punya server email (MX record)
async function domainEmailValid(email) {
  const domain = email.split("@")[1];
  try {
    const mx = await dns.resolveMx(domain);
    return mx.length > 0;
  } catch (err) {
    if (err.code === "ENOTFOUND" || err.code === "ENODATA") return false;
    // masalah DNS sementara, jangan blokir pendaftar
    return true;
  }
}

function buatKode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function templateEmailKode(nama, kode, tujuan) {
  const keterangan =
    tujuan === "verifikasi"
      ? "Gunakan kode berikut untuk memverifikasi email akun Stockin kamu."
      : "Gunakan kode berikut untuk mengatur ulang password akun Stockin kamu.";
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
<h2 style="color:#1E3A8A;margin:0 0 12px">Stockin</h2>
<p>Halo ${escapeHtml(nama)},</p>
<p>${keterangan}</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#E8EEFC;color:#1E3A8A;padding:16px;text-align:center;border-radius:12px;margin:20px 0">${kode}</p>
<p>Kode berlaku ${KODE_BERLAKU_MENIT} menit. Jangan bagikan kode ini ke siapa pun.</p>
<p style="color:#64748b;font-size:13px">Jika kamu tidak merasa memintanya, abaikan email ini.</p>
</div>`;
}

// Kirim email lewat Gmail API (HTTPS), bukan SMTP
async function kirimEmail(tujuan, subjek, html) {
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

// Buat kode baru, simpan hash-nya, lalu kirim ke email
async function kirimKodeOtp(email, tujuan, nama) {
  const [terakhir] = await db.query(
    "select timestampdiff(second, created_at, now()) as detik from kode_verifikasi where email = ? and tujuan = ? order by id desc limit 1",
    [email, tujuan],
  );
  if (terakhir.length > 0 && terakhir[0].detik < JEDA_KIRIM_DETIK) {
    const sisa = JEDA_KIRIM_DETIK - terakhir[0].detik;
    const err = new Error(`Tunggu ${sisa} detik sebelum meminta kode baru`);
    err.status = 429;
    throw err;
  }

  const kode = buatKode();
  const kodeHash = await bcrypt.hash(kode, 10);

  await db.query(
    "delete from kode_verifikasi where email = ? and tujuan = ?",
    [email, tujuan],
  );
  await db.query(
    "insert into kode_verifikasi (email, tujuan, kode_hash, kadaluarsa) values (?, ?, ?, date_add(now(), interval ? minute))",
    [email, tujuan, kodeHash, KODE_BERLAKU_MENIT],
  );

  const judul =
    tujuan === "verifikasi"
      ? "Kode verifikasi email Stockin"
      : "Kode reset password Stockin";

  try {
    await kirimEmail(email, judul, templateEmailKode(nama, kode, tujuan));
  } catch (err) {
    console.error("Gagal kirim email OTP:", err.message);
    await db.query(
      "delete from kode_verifikasi where email = ? and tujuan = ?",
      [email, tujuan],
    );
    const errBaru = new Error("Gagal mengirim email. Coba lagi beberapa saat.");
    errBaru.status = 502;
    throw errBaru;
  }
}

// Cocokkan kode yang diketik user dengan yang tersimpan
async function cekKodeOtp(email, tujuan, kode) {
  const [rows] = await db.query(
    "select id, kode_hash, percobaan, kadaluarsa > now() as masih_berlaku from kode_verifikasi where email = ? and tujuan = ? order by id desc limit 1",
    [email, tujuan],
  );
  if (rows.length === 0) {
    return { ok: false, error: "Kode tidak ditemukan. Minta kode baru." };
  }

  const data = rows[0];
  if (!Number(data.masih_berlaku)) {
    return { ok: false, error: "Kode sudah kedaluwarsa. Minta kode baru." };
  }
  if (data.percobaan >= MAKS_PERCOBAAN) {
    return { ok: false, error: "Terlalu banyak percobaan salah. Minta kode baru." };
  }

  const cocok = await bcrypt.compare(kode, data.kode_hash);
  if (!cocok) {
    await db.query(
      "update kode_verifikasi set percobaan = percobaan + 1 where id = ?",
      [data.id],
    );
    const sisa = MAKS_PERCOBAAN - data.percobaan - 1;
    return {
      ok: false,
      error:
        sisa > 0
          ? `Kode salah. Sisa percobaan: ${sisa}`
          : "Kode salah. Terlalu banyak percobaan, minta kode baru.",
    };
  }

  return { ok: true };
}

// ==== UPLOAD GAMBAR ====

app.post("/upload", verifyManager, upload.single("gambar"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Tidak ada file yang diunggah" });
  }
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ==== AUTH ====

app.post("/auth/register", async (req, res) => {
  const { nama, email, password, telepon } = req.body;

  if (!nama || !email || !password) {
    return res
      .status(400)
      .json({ error: "Nama, email, dan password wajib diisi" });
  }

  const emailBersih = String(email).trim().toLowerCase();

  if (!POLA_EMAIL.test(emailBersih)) {
    return res.status(400).json({ error: "Format email tidak valid" });
  }
  if (password.length < MIN_PASSWORD) {
    return res
      .status(400)
      .json({ error: `Password minimal ${MIN_PASSWORD} karakter` });
  }
  if (!(await domainEmailValid(emailBersih))) {
    return res.status(400).json({
      error: "Domain email tidak ditemukan. Gunakan email aktif, contoh: nama@gmail.com",
    });
  }

  try {
    const [existing] = await db.query(
      "select id, email_terverifikasi from users where email = ?",
      [emailBersih],
    );

    const passwordHash = await bcrypt.hash(password, 10);

    if (existing.length > 0) {
      if (Number(existing[0].email_terverifikasi) === 1) {
        return res.status(400).json({ error: "Email sudah terdaftar" });
      }
      // akun lama yang belum sempat diverifikasi: perbarui data, kirim kode baru
      await db.query(
        "update users set nama = ?, password = ?, telepon = ? where id = ?",
        [nama, passwordHash, telepon || null, existing[0].id],
      );
    } else {
      await db.query(
        "insert into users (nama, email, password, role, telepon, email_terverifikasi) values (?, ?, ?, ?, ?, 0)",
        [nama, emailBersih, passwordHash, "manager", telepon || null],
      );
    }

    await kirimKodeOtp(emailBersih, "verifikasi", nama);

    res.status(201).json({
      message: "Akun dibuat. Kode verifikasi sudah dikirim ke email kamu.",
      perlu_verifikasi: true,
      email: emailBersih,
    });
  } catch (err) {
    kirimError(res, err);
  }
});

app.post("/auth/verifikasi-email", async (req, res) => {
  const { email, kode } = req.body;

  if (!email || !kode) {
    return res.status(400).json({ error: "Email dan kode wajib diisi" });
  }

  const emailBersih = String(email).trim().toLowerCase();

  try {
    const hasil = await cekKodeOtp(emailBersih, "verifikasi", String(kode).trim());
    if (!hasil.ok) {
      return res.status(400).json({ error: hasil.error });
    }

    await db.query("update users set email_terverifikasi = 1 where email = ?", [
      emailBersih,
    ]);
    await db.query(
      "delete from kode_verifikasi where email = ? and tujuan = ?",
      [emailBersih, "verifikasi"],
    );

    res.json({ message: "Email berhasil diverifikasi, silakan login" });
  } catch (err) {
    kirimError(res, err);
  }
});

app.post("/auth/kirim-ulang-kode", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email wajib diisi" });
  }

  const emailBersih = String(email).trim().toLowerCase();

  try {
    const [rows] = await db.query(
      "select nama, email_terverifikasi from users where email = ?",
      [emailBersih],
    );
    if (rows.length === 0 || Number(rows[0].email_terverifikasi) === 1) {
      return res
        .status(400)
        .json({ error: "Akun tidak ditemukan atau sudah terverifikasi" });
    }

    await kirimKodeOtp(emailBersih, "verifikasi", rows[0].nama);
    res.json({ message: "Kode baru sudah dikirim ke email kamu" });
  } catch (err) {
    kirimError(res, err);
  }
});

app.post("/auth/register-staff", async (req, res) => {
  const { nama, email, password, telepon } = req.body;

  if (!nama || !email || !password) {
    return res
      .status(400)
      .json({ error: "Nama, email, dan password wajib diisi" });
  }
  if (password.length < MIN_PASSWORD) {
    return res
      .status(400)
      .json({ error: `Password minimal ${MIN_PASSWORD} karakter` });
  }

  const [existing] = await db.query("select id from users where email = ?", [
    email,
  ]);
  if (existing.length > 0) {
    return res.status(400).json({ error: "Email sudah terdaftar" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await db.query(
    "insert into users (nama, email, password, role, telepon) values (?, ?, ?, ?, ?)",
    [nama, email, passwordHash, "staff", telepon || null],
  );

  res.status(201).json({ message: "Akun berhasil dibuat, silakan login" });
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email dan password wajib diisi" });
  }

  const [rows] = await db.query(
    "select id, nama, email, password, role, email_terverifikasi from users where email = ?",
    [email],
  );

  if (rows.length === 0) {
    return res.status(401).json({ error: "Email tidak ditemukan" });
  }

  const user = rows[0];
  const cocok = await bcrypt.compare(password, user.password);

  if (!cocok) {
    return res.status(401).json({ error: "Password salah" });
  }

  if (Number(user.email_terverifikasi) !== 1) {
    return res.status(403).json({
      error: "Email belum diverifikasi",
      perlu_verifikasi: true,
      email: user.email,
    });
  }

  const token = jwt.sign(
    { id: user.id, nama: user.nama, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" },
  );

  res.json({ token, nama: user.nama, role: user.role });
});

// Lupa password langkah 1: kirim kode OTP ke email (khusus akun manager)
app.post("/auth/lupa-password", async (req, res) => {
  const { email } = req.body;

  if (!email || !POLA_EMAIL.test(String(email).trim())) {
    return res.status(400).json({ error: "Format email tidak valid" });
  }

  const emailBersih = String(email).trim().toLowerCase();

  try {
    const [rows] = await db.query(
      "select id, nama, role from users where email = ?",
      [emailBersih],
    );

    if (rows.length > 0 && rows[0].role === "manager") {
      await kirimKodeOtp(emailBersih, "reset", rows[0].nama);
    }

    // jawaban sama untuk email terdaftar maupun tidak
    res.json({
      message: "Jika email terdaftar sebagai Manager, kode reset sudah dikirim",
    });
  } catch (err) {
    kirimError(res, err);
  }
});

// Lupa password langkah 2: cek kode OTP, lalu ganti password
app.post("/auth/reset-password", async (req, res) => {
  const { email, kode, password_baru } = req.body;

  if (!email || !kode || !password_baru) {
    return res
      .status(400)
      .json({ error: "Email, kode, dan password baru wajib diisi" });
  }
  if (password_baru.length < MIN_PASSWORD) {
    return res
      .status(400)
      .json({ error: `Password minimal ${MIN_PASSWORD} karakter` });
  }

  const emailBersih = String(email).trim().toLowerCase();

  try {
    const [rows] = await db.query(
      "select id, role from users where email = ?",
      [emailBersih],
    );
    if (rows.length === 0 || rows[0].role !== "manager") {
      return res.status(400).json({ error: "Kode salah atau sudah tidak berlaku" });
    }

    const hasil = await cekKodeOtp(emailBersih, "reset", String(kode).trim());
    if (!hasil.ok) {
      return res.status(400).json({ error: hasil.error });
    }

    const passwordHash = await bcrypt.hash(password_baru, 10);
    await db.query(
      "update users set password = ?, email_terverifikasi = 1 where id = ?",
      [passwordHash, rows[0].id],
    );
    await db.query(
      "delete from kode_verifikasi where email = ? and tujuan = ?",
      [emailBersih, "reset"],
    );

    res.json({ message: "Password berhasil diubah" });
  } catch (err) {
    kirimError(res, err);
  }
});

// Ambil data profil user yang sedang login
app.get("/auth/profil", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      "select id, nama, email, telepon, role from users where id = ?",
      [req.user.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Akun tidak ditemukan" });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update nama & telepon (email dikunci, tidak bisa diubah dari sini)
app.put("/auth/profil", verifyToken, async (req, res) => {
  const { nama, telepon } = req.body;

  if (!nama) {
    return res.status(400).json({ error: "Nama wajib diisi" });
  }

  try {
    await db.query("update users set nama = ?, telepon = ? where id = ?", [
      nama,
      telepon || null,
      req.user.id,
    ]);
    res.json({ message: "Profil berhasil diperbarui", nama });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ganti password (wajib verifikasi password lama)
app.put("/auth/ganti-password", verifyToken, async (req, res) => {
  const { password_lama, password_baru } = req.body;

  if (!password_lama || !password_baru) {
    return res
      .status(400)
      .json({ error: "Password lama dan password baru wajib diisi" });
  }
  if (password_baru.length < MIN_PASSWORD) {
    return res
      .status(400)
      .json({ error: `Password baru minimal ${MIN_PASSWORD} karakter` });
  }

  try {
    const [rows] = await db.query("select password from users where id = ?", [
      req.user.id,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Akun tidak ditemukan" });
    }

    const cocok = await bcrypt.compare(password_lama, rows[0].password);
    if (!cocok) {
      return res.status(401).json({ error: "Password lama salah" });
    }

    const hashBaru = await bcrypt.hash(password_baru, 10);
    await db.query("update users set password = ? where id = ?", [
      hashBaru,
      req.user.id,
    ]);
    res.json({ message: "Password berhasil diubah" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==== PENGATURAN GUDANG ====

app.get("/pengaturan", async (req, res) => {
  try {
    const [rows] = await db.query(
      "select nama_gudang, telepon, alamat, provinsi, kota, kecamatan, kode_pos, catatan, latitude, longitude from pengaturan_gudang where id = 1",
    );
    res.json(rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/pengaturan", verifyManager, async (req, res) => {
  const {
    nama_gudang,
    telepon,
    alamat,
    provinsi,
    kota,
    kecamatan,
    kode_pos,
    catatan,
    latitude,
    longitude,
  } = req.body;

  try {
    await db.query(
      "update pengaturan_gudang set nama_gudang = ?, telepon = ?, alamat = ?, provinsi = ?, kota = ?, kecamatan = ?, kode_pos = ?, catatan = ?, latitude = ?, longitude = ? where id = 1",
      [
        nama_gudang || null,
        telepon || null,
        alamat || null,
        provinsi || null,
        kota || null,
        kecamatan || null,
        kode_pos || null,
        catatan || null,
        latitude || null,
        longitude || null,
      ],
    );
    res.json({ message: "Pengaturan gudang berhasil disimpan" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==== KELUHAN / HUBUNGI KAMI ====

app.post("/keluhan", verifyToken, async (req, res) => {
  const { pesan } = req.body;

  if (!pesan) {
    return res.status(400).json({ error: "Pesan wajib diisi" });
  }

  try {
    const [userRows] = await db.query("select nama from users where id = ?", [
      req.user.id,
    ]);
    const nama = userRows[0] ? userRows[0].nama : "Tidak diketahui";

    await db.query(
      "insert into keluhan (user_id, nama, pesan) values (?, ?, ?)",
      [req.user.id, nama, pesan],
    );
    res
      .status(201)
      .json({
        message:
          "Pesan berhasil dikirim, tim kami akan segera menghubungi kamu",
      });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==== PRODUCTS (CRUD) ====

app.get("/products", async (req, res) => {
  try {
    const [rows] = await db.query(
      "select id, sku, nama, kategori, satuan, harga, gambar, stok_saat_ini, stok_minimum from products",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/products", verifyManager, async (req, res) => {
  const { nama, kategori, satuan, harga, gambar, stok_saat_ini, stok_minimum } =
    req.body;

  try {
    const skuBaru = await generateSkuBaru();
    await db.query(
      "insert into products (sku, nama, kategori, satuan, harga, gambar, stok_saat_ini, stok_minimum) values (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        skuBaru,
        nama,
        kategori,
        satuan,
        harga || 0,
        gambar || null,
        stok_saat_ini,
        stok_minimum,
      ],
    );
    res
      .status(201)
      .json({ message: "Produk berhasil ditambahkan", sku: skuBaru });
  } catch (err) {
    res.status(400).json({ error: "Gagal menambahkan produk" });
  }
});

app.put("/products/:id", verifyManager, async (req, res) => {
  const { nama, kategori, satuan, harga, gambar, stok_saat_ini, stok_minimum } =
    req.body;

  await db.query(
    "update products set nama = ?, kategori = ?, satuan = ?, harga = ?, gambar = ?, stok_saat_ini = ?, stok_minimum = ? where id = ?",
    [
      nama,
      kategori,
      satuan,
      harga || 0,
      gambar || null,
      stok_saat_ini,
      stok_minimum,
      req.params.id,
    ],
  );
  res.json({ message: "Produk berhasil diupdate" });
});

app.delete("/products/:id", verifyManager, async (req, res) => {
  await db.query("delete from products where id = ?", [req.params.id]);
  res.json({ message: "Produk berhasil dihapus" });
});

// ==== TRANSACTIONS ====

app.post("/transactions", verifyToken, async (req, res) => {
  const { sku, tipe, jumlah, catatan } = req.body;

  const [produk] = await db.query(
    "select id, stok_saat_ini from products where sku = ?",
    [sku],
  );

  if (produk.length === 0) {
    return res.status(404).json({ error: "SKU tidak ditemukan" });
  }

  const product = produk[0];

  if (tipe === "out" && product.stok_saat_ini < jumlah) {
    return res.status(400).json({ error: "Stok tidak mencukupi" });
  }

  const stokBaru =
    tipe === "in"
      ? product.stok_saat_ini + jumlah
      : product.stok_saat_ini - jumlah;

  await db.query(
    "insert into stock_transactions (product_id, user_id, tipe, jumlah, catatan) values (?, ?, ?, ?, ?)",
    [product.id, req.user.id, tipe, jumlah, catatan || null],
  );

  await db.query("update products set stok_saat_ini = ? where id = ?", [
    stokBaru,
    product.id,
  ]);

  res
    .status(201)
    .json({ message: "Transaksi berhasil dicatat", stok_baru: stokBaru });
});

app.get("/transactions/recent", async (req, res) => {
  const [rows] = await db.query(
    "select stock_transactions.id, products.nama, products.sku, products.gambar, stock_transactions.tipe, stock_transactions.jumlah, stock_transactions.catatan, stock_transactions.created_at, users.nama as nama_staf from stock_transactions, products, users where stock_transactions.product_id = products.id and stock_transactions.user_id = users.id order by stock_transactions.created_at desc limit 50",
  );
  res.json(rows);
});

// ==== AI INSIGHTS ====

function tunggu(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DAFTAR_MODEL = ["gemini-flash-latest", "gemini-flash-lite-latest"];

function ambilRetryDelay(err) {
  try {
    const cocok = err.message.match(/"retryDelay":"(\d+)s"/);
    if (cocok) return parseInt(cocok[1], 10) * 1000;
  } catch (e) {
    // abaikan
  }
  return null;
}

async function generateContentDenganRetry(prompt) {
  let errorTerakhir;

  for (const model of DAFTAR_MODEL) {
    for (let percobaan = 1; percobaan <= 3; percobaan++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });
        return response;
      } catch (err) {
        errorTerakhir = err;
        const modelSibuk = err.message && err.message.includes("UNAVAILABLE");
        const kenaRateLimit =
          err.message && err.message.includes("RESOURCE_EXHAUSTED");

        if (!modelSibuk && !kenaRateLimit) throw err;

        const delaySaran = ambilRetryDelay(err);
        const delay = delaySaran || percobaan * 3000;

        console.log(
          `${model}: ${kenaRateLimit ? "kena rate limit" : "sibuk"}, tunggu ${delay / 1000}s lalu coba lagi (percobaan ${percobaan}/3)...`,
        );
        await tunggu(delay);
      }
    }
    console.log(
      `${model} tetap gagal setelah 3 percobaan, coba model berikutnya...`,
    );
  }

  throw errorTerakhir;
}

app.post("/ai-insights/generate", verifyManager, async (req, res) => {
  try {
    const [produk] = await db.query(
      "select id, sku, nama, stok_saat_ini, stok_minimum from products",
    );

    const dataAnalisis = [];
    for (const p of produk) {
      const [rows] = await db.query(
        'select sum(jumlah) as total_keluar from stock_transactions where product_id = ? and tipe = "out" and created_at >= date_sub(now(), interval 30 day)',
        [p.id],
      );
      dataAnalisis.push({
        sku: p.sku,
        nama: p.nama,
        stok_saat_ini: p.stok_saat_ini,
        stok_minimum: p.stok_minimum,
        total_keluar_30_hari: rows[0].total_keluar || 0,
      });
    }

    const prompt = `Kamu adalah asisten analisis inventaris gudang. Berikut data ${dataAnalisis.length} produk beserta stok saat ini, stok minimum, dan total barang keluar dalam 30 hari terakhir:

${JSON.stringify(dataAnalisis, null, 2)}

Untuk setiap produk, perkirakan berapa hari lagi stoknya akan habis (berdasarkan rata-rata keluar per hari). Untuk rekomendasi jumlah restock, hitung agar stok cukup untuk memenuhi kebutuhan sekitar 30 hari ke depan berdasarkan rata-rata keluar per hari, ditambah stok pengaman sekitar 20-30% dari stok minimum. Jangan merekomendasikan jumlah yang jauh lebih besar dari itu — hindari overstock. Balas HANYA dalam format JSON array, tanpa teks tambahan lain, dengan struktur persis seperti ini:
[{"sku": "...", "perkiraan_hari_habis": angka_atau_null, "rekomendasi_restock": angka, "alasan": "penjelasan singkat 1 kalimat"}]`;

    const response = await generateContentDenganRetry(prompt);

    let teksJson = response.text.trim();
    teksJson = teksJson.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    const hasilAnalisis = JSON.parse(teksJson);

    for (const hasil of hasilAnalisis) {
      const produkCocok = produk.find((p) => p.sku === hasil.sku);
      if (!produkCocok) continue;

      await db.query(
        "insert into ai_insights (product_id, rekomendasi, jumlah_restock_disarankan) values (?, ?, ?)",
        [produkCocok.id, hasil.alasan, hasil.rekomendasi_restock],
      );
    }

    res.json({ message: "Analisis AI berhasil dibuat", hasil: hasilAnalisis });
  } catch (err) {
    let pesanUser = err.message;
    if (err.message && err.message.includes("UNAVAILABLE")) {
      pesanUser = "Server Gemini sedang sibuk. Coba lagi dalam beberapa menit.";
    } else if (err.message && err.message.includes("RESOURCE_EXHAUSTED")) {
      pesanUser =
        "Batas pemakaian Gemini API (tier gratis) tercapai untuk sementara. Tunggu 1-2 menit sebelum generate lagi.";
    }
    res.status(500).json({ error: pesanUser });
  }
});

app.get("/ai-insights", verifyManager, async (req, res) => {
  const [rows] = await db.query(
    "select ai_insights.id, products.nama, products.sku, products.gambar, products.stok_saat_ini, products.stok_minimum, ai_insights.rekomendasi, ai_insights.jumlah_restock_disarankan, ai_insights.generated_at, case when ai_insights.generated_at = (select max(b.generated_at) from ai_insights b where b.product_id = ai_insights.product_id) then 1 else 0 end as is_terbaru from ai_insights, products where ai_insights.product_id = products.id order by ai_insights.generated_at desc limit 50",
  );
  res.json(rows);
});

// ==== PURCHASE ORDERS ====

app.post("/purchase-orders", verifyManager, async (req, res) => {
  const { sku, jumlah, catatan } = req.body;

  const [produk] = await db.query("select id from products where sku = ?", [
    sku,
  ]);

  if (produk.length === 0) {
    return res.status(404).json({ error: "SKU tidak ditemukan" });
  }

  await db.query(
    "insert into purchase_orders (product_id, jumlah, catatan) values (?, ?, ?)",
    [produk[0].id, jumlah, catatan || null],
  );

  res.status(201).json({ message: "Purchase Order berhasil dibuat" });
});

app.get("/purchase-orders", verifyManager, async (req, res) => {
  const [rows] = await db.query(
    "select purchase_orders.id, products.nama, products.sku, products.harga, products.gambar, purchase_orders.jumlah, purchase_orders.status, purchase_orders.catatan, purchase_orders.created_at from purchase_orders, products where purchase_orders.product_id = products.id order by purchase_orders.created_at desc",
  );
  res.json(rows);
});

app.put("/purchase-orders/:id/selesai", verifyManager, async (req, res) => {
  const [po] = await db.query(
    "select id, product_id, jumlah, status from purchase_orders where id = ?",
    [req.params.id],
  );

  if (po.length === 0) {
    return res.status(404).json({ error: "Purchase Order tidak ditemukan" });
  }

  if (po[0].status === "selesai") {
    return res
      .status(400)
      .json({ error: "Purchase Order ini sudah selesai sebelumnya" });
  }

  const [produk] = await db.query(
    "select stok_saat_ini from products where id = ?",
    [po[0].product_id],
  );
  const stokBaru = produk[0].stok_saat_ini + po[0].jumlah;

  await db.query("update products set stok_saat_ini = ? where id = ?", [
    stokBaru,
    po[0].product_id,
  ]);

  await db.query(
    "insert into stock_transactions (product_id, user_id, tipe, jumlah, catatan) values (?, ?, ?, ?, ?)",
    [
      po[0].product_id,
      req.user.id,
      "in",
      po[0].jumlah,
      `Restock dari Purchase Order #${po[0].id}`,
    ],
  );

  await db.query("update purchase_orders set status = ? where id = ?", [
    "selesai",
    req.params.id,
  ]);

  res.json({
    message: "Purchase Order selesai, stok berhasil diperbarui",
    stok_baru: stokBaru,
  });
});

// ==== START SERVER ====

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server jalan di port ${PORT}`);
});