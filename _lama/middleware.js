const jwt = require('jsonwebtoken');
const JWT_SECRET = 'rahasia_warehouse_ac03';

// Gudang lama (data sebelum fitur multi-gudang). Dipakai sebagai cadangan selama masa transisi.
const GUDANG_DEFAULT = 1;

// Kalau WAJIB_TOKEN_GUDANG=true, tidak ada lagi cadangan: semua permintaan harus punya token bergudang.
function wajibGudang() {
  return process.env.WAJIB_TOKEN_GUDANG === 'true';
}

// Tetapkan req.gudangId dari token. Mengembalikan false kalau sudah membalas error.
function tetapkanGudang(req, res) {
  if (req.user && req.user.gudang_id) {
    req.gudangId = req.user.gudang_id;
    return true;
  }
  if (wajibGudang()) {
    res.status(401).json({ error: 'Sesi lama, silakan login ulang' });
    return false;
  }
  req.gudangId = GUDANG_DEFAULT;
  return true;
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token tidak ada' });

  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(403).json({ error: 'Token tidak valid' });
  }

  if (!tetapkanGudang(req, res)) return;
  next();
}

function verifyManager(req, res, next) {
  verifyToken(req, res, () => {
    if (req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Hanya manager yang boleh mengakses fitur ini' });
    }
    next();
  });
}

// Untuk endpoint yang dulu terbuka (daftar produk, riwayat, pengaturan): token boleh kosong
// selama masa transisi, tapi kalau ada token maka gudangnya diambil dari token.
function ambilGudang(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    if (wajibGudang()) return res.status(401).json({ error: 'Token tidak ada' });
    req.gudangId = GUDANG_DEFAULT;
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(403).json({ error: 'Token tidak valid' });
  }

  if (!tetapkanGudang(req, res)) return;
  next();
}

module.exports = { verifyToken, verifyManager, ambilGudang, GUDANG_DEFAULT, wajibGudang };