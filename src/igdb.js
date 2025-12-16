const logger = require("./logger");
const { getDb } = require("./db");

const IGDB_CLIENT_ID = process.env.IGDB_CLIENT_ID || "";
const IGDB_CLIENT_SECRET = process.env.IGDB_CLIENT_SECRET || "";

function mustIgdbEnv() {
  if (!IGDB_CLIENT_ID || !IGDB_CLIENT_SECRET) {
    throw new Error("IGDB env manquantes: IGDB_CLIENT_ID / IGDB_CLIENT_SECRET");
  }
}

function getSetting(key) {
  const db = getDb();
  return db.prepare("SELECT value FROM settings WHERE key=?").get(key)?.value ?? null;
}
function setSetting(key, value) {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)").run(key, String(value));
}

async function getAccessToken() {
  mustIgdbEnv();

  const token = getSetting("igdb_access_token");
  const exp = Number(getSetting("igdb_token_expires_at") || 0);

  if (token && Date.now() < (exp - 60_000)) return token;

  const url = new URL("https://id.twitch.tv/oauth2/token");
  url.searchParams.set("client_id", IGDB_CLIENT_ID);
  url.searchParams.set("client_secret", IGDB_CLIENT_SECRET);
  url.searchParams.set("grant_type", "client_credentials");

  const r = await fetch(url, { method: "POST" });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`IGDB oauth failed (${r.status}): ${txt}`);
  }
  const data = await r.json();

  const accessToken = data.access_token;
  const expiresInSec = Number(data.expires_in || 0);
  const expiresAt = Date.now() + expiresInSec * 1000;

  setSetting("igdb_access_token", accessToken);
  setSetting("igdb_token_expires_at", String(expiresAt));

  logger.info("[IGDB]", "Token refresh OK");
  return accessToken;
}

async function igdbPost(endpoint, body) {
  const token = await getAccessToken();

  const r = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": IGDB_CLIENT_ID,
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json"
    },
    body
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`IGDB ${endpoint} failed (${r.status}): ${txt}`);
  }
  return await r.json();
}

function normalizeName(name) {
  return String(name || "")
    .replace(/\.[a-z0-9]{2,4}$/i, "")
    .replace(/[\[\(].*?[\]\)]/g, " ")
    .replace(/[_\.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function coverUrlFromImageId(imageId) {
  return imageId
    ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`
    : null;
}

async function searchGameByName(name) {
  const q = normalizeName(name);
  if (!q) return null;

  const body = `
    search "${q.replace(/"/g, '\\"')}";
    fields id,name,slug,first_release_date,cover.image_id;
    limit 1;
  `;

  const results = await igdbPost("games", body);
  if (!Array.isArray(results) || results.length === 0) return { query: q, hit: null };

  const hit = results[0];
  const imageId = hit?.cover?.image_id || null;

  return {
    query: q,
    hit: {
      igdb_id: hit.id,
      name: hit.name,
      slug: hit.slug || null,
      cover_url: coverUrlFromImageId(imageId)
    }
  };
}

/**
 * ✅ Multi résultats pour choix manuel
 */
async function searchGamesByName(name, limit = 8) {
  const q = normalizeName(name);
  if (!q) return { query: q, hits: [] };

  const lim = Math.max(1, Math.min(Number(limit || 8), 20));

  const body = `
    search "${q.replace(/"/g, '\\"')}";
    fields id,name,slug,first_release_date,cover.image_id;
    limit ${lim};
  `;

  const results = await igdbPost("games", body);
  const hits = (Array.isArray(results) ? results : []).map(r => {
    const imageId = r?.cover?.image_id || null;
    return {
      igdb_id: r.id,
      name: r.name,
      slug: r.slug || null,
      first_release_date: r.first_release_date || null,
      cover_url: coverUrlFromImageId(imageId),
      igdb_url: r.slug ? `https://www.igdb.com/games/${r.slug}` : null
    };
  });

  return { query: q, hits };
}

module.exports = { searchGameByName, searchGamesByName };
