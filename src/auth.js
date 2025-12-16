const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function readToken(req) {
  return req.cookies?.token || null;
}

function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ ok:false, error:"Non connecté" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ ok:false, error:"Session invalide" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ ok:false, error:"Non connecté" });
  if (req.user.role !== "admin") return res.status(403).json({ ok:false, error:"Accès admin requis" });
  next();
}

module.exports = { signToken, requireAuth, requireAdmin };
