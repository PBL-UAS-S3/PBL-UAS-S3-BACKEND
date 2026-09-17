const jwt = require('jsonwebtoken');
const JWT_SECRET = 'rahasia_warehouse_ac03';

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token tidak ada' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Token tidak valid' });
  }
}

module.exports = verifyToken;