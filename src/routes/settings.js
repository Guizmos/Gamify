const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

router.get("/settings", (req, res) => {
  const db = getDb();
  const settings = db.prepare("SELECT key, value FROM settings").all();
  const watched = db.prepare("SELECT id, path, enabled, created_at FROM watched_folders ORDER BY id DESC").all();

  res.json({
    ok: true,
    settings: Object.fromEntries(settings.map(s => [s.key, s.value])),
    watchedFolders: watched
  });
});

// Ajout dossier surveillé
router.post("/settings/watched-folders", (req, res) => {
  const { path: folderPath } = req.body || {};
  if (!folderPath || typeof folderPath !== "string") {
    return res.status(400).json({ ok: false, error: "path requis" });
  }

  const db = getDb();
  try {
    db.prepare("INSERT INTO watched_folders (path, enabled) VALUES (?, 1)").run(folderPath);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({ ok: false, error: "Déjà existant ou invalide" });
  }
});

// Activer/désactiver
router.patch("/settings/watched-folders/:id", (req, res) => {
  const id = Number(req.params.id);
  const { enabled } = req.body || {};
  if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "id invalide" });

  const db = getDb();
  db.prepare("UPDATE watched_folders SET enabled=? WHERE id=?").run(enabled ? 1 : 0, id);
  res.json({ ok: true });
});

module.exports = router;
