const fs = require("fs");
const path = require("path");
const logger = require("./logger");
const { getDb } = require("./db");
const { searchGameByName } = require("./igdb");

// ---- helpers ----
function normalize(p) {
  return String(p || "").toLowerCase().replace(/\\/g, "/");
}

function isStable(p, stabilitySec) {
  try {
    const stat = fs.statSync(p);
    const ageMs = Date.now() - stat.mtimeMs;
    return ageMs >= (stabilitySec * 1000);
  } catch {
    return false;
  }
}

function listDirectories(folderPath) {
  try {
    return fs.readdirSync(folderPath, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => path.join(folderPath, d.name));
  } catch (e) {
    logger.error("[SCAN]", `Impossible de lire: ${folderPath}`, e.message);
    return [];
  }
}

function listFilesWithExt(folderPath, ext) {
  try {
    return fs.readdirSync(folderPath, { withFileTypes: true })
      .filter(d => d.isFile() && path.extname(d.name).toLowerCase() === ext)
      .map(d => path.join(folderPath, d.name));
  } catch {
    return [];
  }
}

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

function getFileSizeBytes(filePath) {
  try { return fs.statSync(filePath).size; } catch { return null; }
}

// règle plateforme demandée
function detectPlatform(fullPath) {
  // défaut PC
  const p = normalize(fullPath);

  // Switch seulement dans Emulateur/Swicth (ou Switch) et .xci
  const isSwitchArea = p.includes("/emulateur/swicth/") || p.includes("/emulateur/switch/");
  const ext = path.extname(fullPath).toLowerCase();
  if (isSwitchArea && ext === ".xci") return "Switch";

  return "PC";
}

function upsertGame({ folderName, displayName, fullPath, folderSizeBytes, platform }) {
  const db = getDb();

  const exists = db.prepare("SELECT id FROM games WHERE full_path=?").get(fullPath);
  if (exists) {
    // ✅ on update aussi platform / display_name / folder_name si besoin
    db.prepare(`
      UPDATE games
      SET last_seen_at=datetime('now'),
          seen_in_last_scan=1,
          is_deleted=0,
          folder_name=?,
          display_name=?,
          platform=?
      WHERE id=?
    `).run(folderName, displayName, platform, exists.id);

    if (folderSizeBytes !== null && folderSizeBytes !== undefined) {
      db.prepare(`UPDATE games SET folder_size_bytes=? WHERE id=?`).run(folderSizeBytes, exists.id);
    }

    return { created: false, id: exists.id };
  }

  const info = db.prepare(`
    INSERT INTO games (
      folder_name, display_name, full_path, platform,
      detected_at, last_seen_at,
      notif_status, igdb_status,
      seen_in_last_scan, is_deleted,
      folder_size_bytes
    )
    VALUES (
      ?, ?, ?, ?,
      datetime('now'), datetime('now'),
      'not_sent', 'not_found',
      1, 0,
      ?
    )
  `).run(folderName, displayName, fullPath, platform, folderSizeBytes ?? null);

  return { created: true, id: info.lastInsertRowid };
}

function getSetting(key, fallback) {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key=?").get(key);
  return row ? row.value : fallback;
}

async function scanOnce() {
  const db = getDb();
  const stabilitySec = Number(getSetting("scan_stability_sec", "60"));

  // Reset vu au dernier scan
  db.prepare("UPDATE games SET seen_in_last_scan=0").run();

  const watched = db.prepare("SELECT path FROM watched_folders WHERE enabled=1").all();
  const createdGames = [];
  const errors = [];

  for (const w of watched) {
    const root = w.path;

    if (!fs.existsSync(root)) {
      errors.push(`Dossier introuvable: ${root}`);
      continue;
    }

    // -------------------------
    // 1) PC : tous les dossiers à la racine = PC
    // -------------------------
    const gameDirs = listDirectories(root);

    for (const gameDir of gameDirs) {
      if (!isStable(gameDir, stabilitySec)) continue;

      const folderName = path.basename(gameDir);
      const displayName = folderName; // PC = nom du dossier
      const folderSizeBytes = null;
      const platform = "PC"; // ✅ règle demandée

      const res = upsertGame({ folderName, displayName, fullPath: gameDir, folderSizeBytes, platform });

      if (res.created) {
        createdGames.push({ id: res.id, folderName, fullPath: gameDir });

        // IGDB auto (best effort)
        try {
          const r = await searchGameByName(displayName);

          if (r?.hit) {
            db.prepare(`
              UPDATE games
              SET igdb_id=?,
                  igdb_url=?,
                  igdb_slug=?,
                  igdb_cover_url=?,
                  igdb_status='matched'
              WHERE id=?
            `).run(
              r.hit.igdb_id,
              r.hit.slug ? `https://www.igdb.com/games/${r.hit.slug}` : null,
              r.hit.slug,
              r.hit.cover_url,
              res.id
            );
          } else {
            db.prepare(`UPDATE games SET igdb_status='not_found' WHERE id=?`).run(res.id);
          }
        } catch (e) {
          db.prepare(`UPDATE games SET igdb_status='error' WHERE id=?`).run(res.id);
          errors.push(`IGDB error (${displayName}): ${e.message}`);
        }

        // Telegram auto (best effort)
        try {
          const tgOn = String(getSetting("telegram_enabled", "0")).trim().toLowerCase();
          const enabled = (tgOn === "1" || tgOn === "true" || tgOn === "yes" || tgOn === "on");

          if (enabled) {
            const game = db.prepare(`
              SELECT id, display_name, platform, full_path, folder_size_bytes, igdb_url, igdb_cover_url
              FROM games WHERE id=?
            `).get(res.id);

            const { sendTelegramGame } = require("./telegram");
            await sendTelegramGame(game);

            db.prepare("UPDATE games SET notif_status='sent' WHERE id=?").run(res.id);
          }
        } catch (e) {
          errors.push(`TELEGRAM error (${displayName}): ${e.message}`);
        }
      }
    }

    // -------------------------
    // 2) Switch : Emulateur/Swicth/*.xci
    // -------------------------
    const switchDir1 = path.join(root, "Emulateur", "Swicth");
    const switchDir2 = path.join(root, "Emulateur", "Switch");
    const switchDir = fs.existsSync(switchDir1) ? switchDir1 : (fs.existsSync(switchDir2) ? switchDir2 : null);

    if (switchDir) {
      const xcis = listFilesWithExt(switchDir, ".xci");

      for (const xciPath of xcis) {
        if (!isStable(xciPath, stabilitySec)) continue;

        const base = path.basename(xciPath, ".xci");
        const folderName = base;     // on garde la convention table games
        const displayName = base;    // affichage = nom sans extension
        const folderSizeBytes = getFileSizeBytes(xciPath);
        const platform = "Switch";

        const res = upsertGame({ folderName, displayName, fullPath: xciPath, folderSizeBytes, platform });

        if (res.created) {
          createdGames.push({ id: res.id, folderName, fullPath: xciPath });

          // IGDB auto (best effort) (sur le nom sans extension)
          try {
            const r = await searchGameByName(displayName);

            if (r?.hit) {
              db.prepare(`
                UPDATE games
                SET igdb_id=?,
                    igdb_url=?,
                    igdb_slug=?,
                    igdb_cover_url=?,
                    igdb_status='matched'
                WHERE id=?
              `).run(
                r.hit.igdb_id,
                r.hit.slug ? `https://www.igdb.com/games/${r.hit.slug}` : null,
                r.hit.slug,
                r.hit.cover_url,
                res.id
              );
            } else {
              db.prepare(`UPDATE games SET igdb_status='not_found' WHERE id=?`).run(res.id);
            }
          } catch (e) {
            db.prepare(`UPDATE games SET igdb_status='error' WHERE id=?`).run(res.id);
            errors.push(`IGDB error (${displayName}): ${e.message}`);
          }

          // Telegram auto (best effort)
          try {
            const tgOn = String(getSetting("telegram_enabled", "0")).trim().toLowerCase();
            const enabled = (tgOn === "1" || tgOn === "true" || tgOn === "yes" || tgOn === "on");

            if (enabled) {
              const game = db.prepare(`
                SELECT id, display_name, platform, full_path, folder_size_bytes, igdb_url, igdb_cover_url
                FROM games WHERE id=?
              `).get(res.id);

              const { sendTelegramGame } = require("./telegram");
              await sendTelegramGame(game);

              db.prepare("UPDATE games SET notif_status='sent' WHERE id=?").run(res.id);
            }
          } catch (e) {
            errors.push(`TELEGRAM error (${displayName}): ${e.message}`);
          }
        }
      }
    }
  }

  // Archive automatique : éléments plus vus
  const gone = db.prepare(`
    SELECT id, display_name, full_path
    FROM games
    WHERE seen_in_last_scan=0 AND is_deleted=0
  `).all();

  if (gone.length) {
    db.prepare("UPDATE games SET is_deleted=1 WHERE seen_in_last_scan=0").run();
  }

  // stats scan
  db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('last_scan_at', datetime('now'))").run();
  db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('last_scan_new', ?)").run(String(createdGames.length));
  db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('last_scan_errors', ?)").run(String(errors.length));

  logger.info("[SCAN]", `Scan terminé: +${createdGames.length} (archivés=${gone.length}) (errors=${errors.length})`);
  if (errors.length) logger.warn("[SCAN]", "Erreurs scan", errors);

  return { createdGames, errors, stabilitySec, archivedGames: gone };
}

module.exports = { scanOnce };
