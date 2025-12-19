const express = require("express");
const bcrypt = require("bcryptjs");
const { getDb } = require("../db");
const { requireAuth, requireAdmin } = require("../auth");

const router = express.Router();

function isStrongEnough(pw) {
  return typeof pw === "string" && pw.trim().length >= 6;
}

router.get("/admin/users", requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, username, role, created_at
    FROM users
    ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, lower(username) ASC
  `).all();

  res.json({ ok: true, users: rows });
});

router.post("/admin/users", requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const { username, password, role } = req.body || {};

  const u = String(username || "").trim();
  const r = (role === "admin" || role === "user") ? role : "user";

  if (!u) return res.status(400).json({ ok: false, error: "username requis" });
  if (!isStrongEnough(password)) return res.status(400).json({ ok: false, error: "mot de passe trop court (min 6)" });

  const exists = db.prepare("SELECT id FROM users WHERE username=?").get(u);
  if (exists) return res.status(400).json({ ok: false, error: "username déjà pris" });

  const hash = bcrypt.hashSync(String(password), 10);
  const info = db.prepare(`
    INSERT INTO users (username, password_hash, role)
    VALUES (?, ?, ?)
  `).run(u, hash, r);

  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put("/admin/users/:id/password", requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { password } = req.body || {};

  if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "id invalide" });
  if (!isStrongEnough(password)) return res.status(400).json({ ok: false, error: "mot de passe trop court (min 6)" });

  const user = db.prepare("SELECT id, username FROM users WHERE id=?").get(id);
  if (!user) return res.status(404).json({ ok: false, error: "user introuvable" });

  const hash = bcrypt.hashSync(String(password), 10);
  db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(hash, id);

  res.json({ ok: true });
});

router.delete("/admin/users/:id", requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "id invalide" });

  const target = db.prepare("SELECT id, role FROM users WHERE id=?").get(id);
  if (!target) return res.status(404).json({ ok: false, error: "user introuvable" });

  if (target.role === "admin") {
    const admins = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role='admin'").get();
    if ((admins?.c || 0) <= 1) {
      return res.status(400).json({ ok: false, error: "Impossible de supprimer le dernier admin" });
    }
  }

  db.prepare("DELETE FROM users WHERE id=?").run(id);
  res.json({ ok: true });
});

module.exports = router;
