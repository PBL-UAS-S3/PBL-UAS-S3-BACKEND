require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { verifyToken, verifyManager } = require("./middleware");
const { GoogleGenAI } = require("@google/genai");

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = "rahasia_warehouse_ac03";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ==== AUTH ====

app.post("/auth/register", async (req, res) => {
  const { nama, email, password, telepon } = req.body;

  if (!nama || !email || !password) {
    return res
      .status(400)
      .json({ error: "Nama, email, dan password wajib diisi" });
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
    [nama, email, passwordHash, "manager", telepon || null],
  );

  res.status(201).json({ message: "Akun berhasil dibuat, silakan login" });
});

app.post("/auth/register-staff", async (req, res) => {
  const { nama, email, password, telepon } = req.body;

  if (!nama || !email || !password) {
    return res
      .status(400)
      .json({ error: "Nama, email, dan password wajib diisi" });
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

  const [rows] = await db.query(
    "select id, nama, email, password, role from users where email = ?",
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

  const token = jwt.sign(
    { id: user.id, nama: user.nama, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" },
  );

  res.json({ token, nama: user.nama, role: user.role });
});

// ==== PRODUCTS (CRUD) ====

app.get("/products", async (req, res) => {
  try {
    const [rows] = await db.query(
      "select id, sku, nama, kategori, satuan, harga, stok_saat_ini, stok_minimum from products",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/products", verifyManager, async (req, res) => {
  const { sku, nama, kategori, satuan, harga, stok_saat_ini, stok_minimum } =
    req.body;

  try {
    await db.query(
      "insert into products (sku, nama, kategori, satuan, harga, stok_saat_ini, stok_minimum) values (?, ?, ?, ?, ?, ?, ?)",
      [sku, nama, kategori, satuan, harga || 0, stok_saat_ini, stok_minimum],
    );
    res.status(201).json({ message: "Produk berhasil ditambahkan" });
  } catch (err) {
    res.status(400).json({ error: "SKU sudah dipakai atau data tidak valid" });
  }
});

app.put("/products/:id", verifyManager, async (req, res) => {
  const { nama, kategori, satuan, harga, stok_saat_ini, stok_minimum } =
    req.body;

  await db.query(
    "update products set nama = ?, kategori = ?, satuan = ?, harga = ?, stok_saat_ini = ?, stok_minimum = ? where id = ?",
    [
      nama,
      kategori,
      satuan,
      harga || 0,
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
    "select stock_transactions.id, products.nama, products.sku, stock_transactions.tipe, stock_transactions.jumlah, stock_transactions.catatan, stock_transactions.created_at, users.nama as nama_staf from stock_transactions, products, users where stock_transactions.product_id = products.id and stock_transactions.user_id = users.id order by stock_transactions.created_at desc limit 50",
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
    "select ai_insights.id, products.nama, products.sku, products.stok_saat_ini, products.stok_minimum, ai_insights.rekomendasi, ai_insights.jumlah_restock_disarankan, ai_insights.generated_at, case when ai_insights.generated_at = (select max(b.generated_at) from ai_insights b where b.product_id = ai_insights.product_id) then 1 else 0 end as is_terbaru from ai_insights, products where ai_insights.product_id = products.id order by ai_insights.generated_at desc limit 50",
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
    "select purchase_orders.id, products.nama, products.sku, purchase_orders.jumlah, purchase_orders.status, purchase_orders.catatan, purchase_orders.created_at from purchase_orders, products where purchase_orders.product_id = products.id order by purchase_orders.created_at desc",
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

app.listen(3000, () => {
  console.log("Server jalan di http://localhost:3000");
});
