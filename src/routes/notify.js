const express = require("express");
const { getDb } = require("../db");
const { sendTelegramGame } = require("../telegram");

const router = express.Router();

const fs = require("fs");
const path = require("path");

function getDirSizeBytes(dirPath) {
  let total = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dirPath, e.name);
      if (e.isDirectory()) total += getDirSizeBytes(p) || 0;
      else if (e.isFile()) {
        try { total += fs.statSync(p).size; } catch {}
      }
    }
  } catch {
    return null;
  }
  return total;
}

function getPathSizeBytes(fullPath) {
  try {
    const st = fs.statSync(fullPath);
    if (st.isFile()) return st.size;
    if (st.isDirectory()) return getDirSizeBytes(fullPath);
  } catch {}
  return null;
}

function getSetting(db, key, fallback="") {
  return db.prepare("SELECT value FROM settings WHERE key=?").get(key)?.value ?? fallback;
}
function getBoolSetting(db, key, fallback=false) {
  const v = getSetting(db, key, fallback ? "1" : "0");
  const s = String(v ?? "").trim().toLowerCase();
  return (s === "1" || s === "true" || s === "yes" || s === "on");
}

router.post("/games/:id/notify", async (req, res) => {
  const db = getDb();

  if (!getBoolSetting(db, "telegram_enabled", false)) {
    return res.status(400).json({ ok:false, error:"Telegram est désactivé" });
  }

  const id = Number(req.params.id);

  // ✅ IMPORTANT: on récupère aussi full_path + folder_size_bytes
  const game = db.prepare(`
    SELECT
      id,
      display_name,
      platform,
      full_path,
      folder_size_bytes,
      igdb_url,
      igdb_cover_url,
      notif_status,
      igdb_status
    FROM games
    WHERE id=?
  `).get(id);

  if (!game) return res.status(404).json({ ok:false, error:"Jeu introuvable" });
  // ✅ si taille absente, calcule et persiste
  if (game && (game.folder_size_bytes === null || game.folder_size_bytes === undefined)) {
    const size = getPathSizeBytes(game.full_path);
    if (size !== null && size !== undefined) {
      db.prepare("UPDATE games SET folder_size_bytes=? WHERE id=?").run(size, id);
      game.folder_size_bytes = size; // pour le template Telegram tout de suite
    }
  }

  try {
    await sendTelegramGame(game);
    db.prepare("UPDATE games SET notif_status='sent' WHERE id=?").run(id);
    res.json({ ok:true });
  } catch (e) {
    res.status(500).json({ ok:false, error:e.message });
  }
});

module.exports = router;
