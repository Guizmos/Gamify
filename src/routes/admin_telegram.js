const express = require("express");
const { getDb } = require("../db");
const { requireAuth, requireAdmin } = require("../auth");

const router = express.Router();

function getSetting(db, key, fallback = "") {
  return db.prepare("SELECT value FROM settings WHERE key=?").get(key)?.value ?? fallback;
}

function setSetting(db, key, value) {
  db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)")
    .run(key, String(value ?? ""));
}

function getBoolSetting(db, key, fallback = false) {
  const v = getSetting(db, key, fallback ? "1" : "0");
  const s = String(v ?? "").trim().toLowerCase();
  return (s === "true" || s === "1" || s === "yes" || s === "on");
}

const DEFAULT_TG_TEMPLATE =
  "🎮 Nouveau jeu : {name}\n🕹 Plateforme : {platform}\n📦 Taille : {size_gb} Go\n📁 Dossier : {folder}";

router.get("/admin/telegram", requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  res.json({
    ok: true,
    telegram_enabled: getBoolSetting(db, "telegram_enabled", false),
    telegram_bot_token: getSetting(db, "telegram_bot_token", ""),
    telegram_chat_id: getSetting(db, "telegram_chat_id", ""),
    telegram_message_template: getSetting(db, "telegram_message_template", DEFAULT_TG_TEMPLATE),
  });
});

router.put("/admin/telegram", requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const {
    telegram_enabled,
    telegram_bot_token,
    telegram_chat_id,
    telegram_message_template
  } = req.body || {};

  if (typeof telegram_enabled !== "undefined") {
    setSetting(db, "telegram_enabled", telegram_enabled ? "1" : "0");
  }

  if (typeof telegram_bot_token === "string") {
    setSetting(db, "telegram_bot_token", telegram_bot_token.trim());
  }
  if (typeof telegram_chat_id === "string") {
    setSetting(db, "telegram_chat_id", telegram_chat_id.trim());
  }

  if (typeof telegram_message_template === "string") {
    const v = telegram_message_template.trim() || DEFAULT_TG_TEMPLATE;
    setSetting(db, "telegram_message_template", v);
  }

  res.json({ ok: true });
});

module.exports = router;
