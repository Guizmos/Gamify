const express = require("express");
const bcrypt = require("bcryptjs");
const { getDb } = require("../db");
const { signToken, requireAuth } = require("../auth");

const router = express.Router();

router.post("/auth/login", (req, res) => {
  const db = getDb();
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ ok:false, error:"username/password requis" });

  const user = db.prepare("SELECT id, username, password_hash, role FROM users WHERE username=?").get(username);
  if (!user) return res.status(401).json({ ok:false, error:"Identifiants invalides" });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ ok:false, error:"Identifiants invalides" });

  const token = signToken({ id: user.id, username: user.username, role: user.role });

  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 7 * 24 * 3600 * 1000,
  });

  res.json({ ok:true, user: { id:user.id, username:user.username, role:user.role } });
});

router.get("/auth/me", requireAuth, (req, res) => {
  res.json({ ok:true, user: req.user });
});

router.post("/auth/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ ok:true });
});

module.exports = router;
