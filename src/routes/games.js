const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

router.get("/games", (req, res) => {
  const db = getDb();

  const search = (req.query.search || "").trim();
  const platform = (req.query.platform || "").trim();
  const notif_status = (req.query.notif_status || "").trim();
  const igdb_status = (req.query.igdb_status || "").trim();
  const archiveOnly = String(req.query.archive_only || "0") === "1";
  const sort = String(req.query.sort || "date_desc").toLowerCase();
  const limit = Math.min(Number(req.query.limit || 200), 500);
  const where = [];
  const params = {};

  if (archiveOnly) where.push("(is_deleted = 1 OR is_archived = 1)");
  else where.push("(is_deleted = 0 AND is_archived = 0)");

  if (search) {
    where.push("(display_name LIKE @q OR folder_name LIKE @q)");
    params.q = `%${search}%`;
  }
  if (platform) {
    where.push("platform = @platform");
    params.platform = platform;
  }
  if (notif_status) {
    where.push("notif_status = @notif_status");
    params.notif_status = notif_status;
  }
  if (igdb_status) {
    where.push("igdb_status = @igdb_status");
    params.igdb_status = igdb_status;
  }

  let orderBy = "datetime(detected_at) DESC";
  if (sort === "name_asc") orderBy = "LOWER(display_name) ASC";
  else if (sort === "name_desc") orderBy = "LOWER(display_name) DESC";
  else if (sort === "date_asc") orderBy = "datetime(detected_at) ASC";

  const sql = `
    SELECT
      id,
      display_name,
      folder_name,
      platform,
      detected_at,
      notif_status,
      igdb_status,
      cover_path,
      igdb_cover_url,
      is_deleted,
      is_archived,
      folder_size_bytes
    FROM games
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY ${orderBy}
    LIMIT ${limit}
  `;

  try {
    const rows = db.prepare(sql).all(params);
    res.json({ ok: true, count: rows.length, games: rows, archiveOnly, sort });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const { requireAuth, requireAdmin } = require("../auth");
const { searchGamesByName, getGameDetailsById } = require("../igdb");

router.get("/games/:id/igdb-search", requireAuth, requireAdmin, async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const game = db.prepare(`SELECT id, display_name, folder_name FROM games WHERE id=?`).get(id);
  if (!game) return res.status(404).json({ ok:false, error:"Jeu introuvable" });

  const q = String(req.query.q || game.display_name || game.folder_name || "").trim();
  const limit = Number(req.query.limit || 8);

  try {
    const r = await searchGamesByName(q, limit);
    res.json({ ok:true, query: r.query, hits: r.hits });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

router.post("/games/:id/igdb-apply", requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);

  const game = db.prepare(`SELECT id FROM games WHERE id=?`).get(id);
  if (!game) return res.status(404).json({ ok:false, error:"Jeu introuvable" });

  const { igdb_id, slug, cover_url, igdb_url } = req.body || {};
  if (!igdb_id) return res.status(400).json({ ok:false, error:"igdb_id requis" });

  db.prepare(`
    UPDATE games
    SET igdb_id=?,
        igdb_slug=?,
        igdb_cover_url=?,
        igdb_url=?,
        igdb_status='matched'
    WHERE id=?
  `).run(
    Number(igdb_id),
    slug || null,
    cover_url || null,
    igdb_url || (slug ? `https://www.igdb.com/games/${slug}` : null),
    id
  );

  res.json({ ok:true });
});

router.get("/games/:id/igdb-details", requireAuth, async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);

  const row = db.prepare(`
    SELECT id, igdb_id, igdb_slug, igdb_url, igdb_cover_url
    FROM games
    WHERE id=?
  `).get(id);

  if (!row) return res.status(404).json({ ok:false, error:"Jeu introuvable" });
  if (!row.igdb_id) return res.json({ ok:false, error:"NO_IGDB_ID" });

  try {
    const details = await getGameDetailsById(row.igdb_id);
    if (!details) return res.json({ ok:false, error:"IGDB_NOT_FOUND" });

    const igdb_url = row.igdb_url || (details.slug ? `https://www.igdb.com/games/${details.slug}` : null);

    res.json({
      ok: true,
      igdb: {
        ...details,
        igdb_url
      }
    });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

router.post("/games/:id/archive", requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);

  const row = db.prepare(`SELECT id, is_archived FROM games WHERE id=?`).get(id);
  if (!row) return res.status(404).json({ ok:false, error:"Jeu introuvable" });

  const body = req.body || {};
  const hasValue = Object.prototype.hasOwnProperty.call(body, "archived");

  const next = hasValue ? (Number(body.archived) ? 1 : 0) : (row.is_archived ? 0 : 1);

  db.prepare(`UPDATE games SET is_archived=? WHERE id=?`).run(next, id);

  res.json({ ok:true, id, is_archived: next });
});

module.exports = router;
