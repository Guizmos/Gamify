const { getDb } = require("./db");

function getSetting(key, fallback = "") {
  const db = getDb();
  return db.prepare("SELECT value FROM settings WHERE key=?").get(key)?.value ?? fallback;
}

function getBoolSetting(key, fallback = false) {
  const v = getSetting(key, fallback ? "1" : "0");
  const s = String(v ?? "").trim().toLowerCase();
  return (s === "1" || s === "true" || s === "yes" || s === "on");
}

// Escape HTML pour éviter d'injecter du HTML via les variables (safe)
function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Render simple: remplace {key} par la valeur vars[key]
function renderTemplate(tpl, vars) {
  const src = String(tpl ?? "");
  return src.replace(/\{([a-z0-9_]+)\}/gi, (_, rawKey) => {
    const key = String(rawKey).toLowerCase();
    const v = vars[key];
    return (v === null || v === undefined) ? "" : String(v);
  });
}

const DEFAULT_TG_TEMPLATE =
  "<b>{name}</b>\n" +
  "🎮 {platform}\n" +
  "{size_line}" +
  "{igdb_link}";

function formatSizeGb(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "";
  const gb = n / (1024 ** 3);
  // 1 décimale, ou entier si gros
  return gb >= 100 ? gb.toFixed(0) : gb.toFixed(1);
}

async function sendTelegramGame(game) {
  const enabled = getBoolSetting("telegram_enabled", false);
  const token = getSetting("telegram_bot_token", "");
  const chatId = getSetting("telegram_chat_id", "");
  const template = getSetting("telegram_message_template", DEFAULT_TG_TEMPLATE);

  if (!enabled) return { skipped: true, reason: "disabled" };
  if (!token || !chatId) throw new Error("Telegram token/chat_id manquants");

  // --- Variables dispo dans le template ---
  const name = escHtml(game.display_name || game.name || "");
  const platform = escHtml(game.platform || "PC");

  const sizeGb = formatSizeGb(game.folder_size_bytes);
  const sizeLine = sizeGb ? `📦 ${escHtml(sizeGb)} Go\n` : "";

  const folder = escHtml(game.full_path || "");

  // Lien IGDB en HTML (si dispo)
  const igdbUrl = String(game.igdb_url || "").trim();
  const igdbLink = igdbUrl ? `\n<a href="${igdbUrl}">IGDB</a>` : "";

  // Cover (pour sendPhoto)
  const coverUrl = String(game.igdb_cover_url || "").trim();

  // Status éventuels
  const notifStatus = escHtml(game.notif_status || "");
  const igdbStatus = escHtml(game.igdb_status || "");

  // Date éventuelle
  const addedAt = escHtml(game.created_at || game.added_at || "");

  // Vars: toutes les valeurs injectées sont déjà échappées (safe)
  const vars = {
    app: "Gamify",
    id: escHtml(game.id),
    name,
    platform,
    size_gb: escHtml(sizeGb),
    size_line: sizeLine,         // pratique pour éviter une ligne vide
    folder,
    igdb_url: escHtml(igdbUrl),
    igdb_link: igdbLink,         // lien HTML prêt
    cover_url: escHtml(coverUrl),
    status_notif: notifStatus,
    status_igdb: igdbStatus,
    added_at: addedAt,
  };

  // Rendu final
  const caption = renderTemplate(template, vars).trim() || DEFAULT_TG_TEMPLATE;

  // Si cover IGDB => sendPhoto, sinon sendMessage
  const hasPhoto = !!coverUrl;
  const method = hasPhoto ? "sendPhoto" : "sendMessage";
  const url = `https://api.telegram.org/bot${token}/${method}`;

  const payload = hasPhoto
    ? { chat_id: chatId, photo: coverUrl, caption, parse_mode: "HTML" }
    : { chat_id: chatId, text: caption, parse_mode: "HTML", disable_web_page_preview: false };

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.ok === false) {
    throw new Error(`Telegram API error: ${JSON.stringify(data)}`);
  }

  return { ok: true, telegram: data.result };
}

module.exports = { sendTelegramGame };
