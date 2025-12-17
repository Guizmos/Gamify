const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { DB_PATH, DATA_DIR, ADMIN_BOOTSTRAP_USER, ADMIN_BOOTSTRAP_PASS } = require("./config");
const logger = require("./logger");
const bcrypt = require("bcryptjs");

let db;

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function initSchema() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','user')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      full_path TEXT NOT NULL UNIQUE,
      platform TEXT NOT NULL,
      detected_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      notif_status TEXT NOT NULL CHECK(notif_status IN ('sent','not_sent')) DEFAULT 'not_sent',
      cover_path TEXT,
      igdb_id INTEGER,
      igdb_url TEXT,
      igdb_status TEXT NOT NULL CHECK(igdb_status IN ('matched','not_found','error')) DEFAULT 'not_found'
    );

    CREATE TABLE IF NOT EXISTS watched_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function ensureColumns() {
  const cols = db.prepare(`PRAGMA table_info(games)`).all().map(c => c.name);

  const add = (col, ddl) => {
    if (!cols.includes(col)) {
      db.exec(ddl);
      logger.info("[DB]", `Migration OK: games.${col} ajouté`);
    }
  };

  add("igdb_slug", `ALTER TABLE games ADD COLUMN igdb_slug TEXT;`);
  add("igdb_cover_url", `ALTER TABLE games ADD COLUMN igdb_cover_url TEXT;`);

  add("seen_in_last_scan", `ALTER TABLE games ADD COLUMN seen_in_last_scan INTEGER NOT NULL DEFAULT 1;`);
  add("is_deleted", `ALTER TABLE games ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0;`);
  add("is_archived", `ALTER TABLE games ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;`);

  add("folder_size_bytes", `ALTER TABLE games ADD COLUMN folder_size_bytes INTEGER;`);
}

function ensureDefaultSettings() {
  const upsert = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");

  upsert.run("scan_enabled", "true");
  upsert.run("scan_interval_sec", "300");
  upsert.run("scan_stability_sec", "60");

  upsert.run("telegram_enabled", "0");
  upsert.run("telegram_bot_token", "");
  upsert.run("telegram_chat_id", "");
}

function normalizeTelegramEnabled() {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key='telegram_enabled'").get();
    if (!row) return;

    const s = String(row.value ?? "").trim().toLowerCase();
    const on = (s === "1" || s === "true" || s === "yes" || s === "on");
    db.prepare("UPDATE settings SET value=? WHERE key='telegram_enabled'").run(on ? "1" : "0");
  } catch (e) {
    logger.warn("[DB]", "normalizeTelegramEnabled failed:", e.message);
  }
}

function bootstrapAdminIfNeeded() {
  const exists = db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
  if (exists) return;

  const password_hash = bcrypt.hashSync(ADMIN_BOOTSTRAP_PASS, 10);
  db.prepare(
    "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')"
  ).run(ADMIN_BOOTSTRAP_USER, password_hash);

  logger.warn("[AUTH]", `Admin bootstrap créé: ${ADMIN_BOOTSTRAP_USER}`);
}

function getDb() {
  if (!db) {
    ensureDir(DATA_DIR);
    const full = path.resolve(DB_PATH);
    db = new Database(full);

    initSchema();
    ensureColumns();
    ensureDefaultSettings();
    normalizeTelegramEnabled();
    bootstrapAdminIfNeeded();

    logger.info("[DB]", `DB ready: ${full}`);
  }
  return db;
}

module.exports = { getDb };
