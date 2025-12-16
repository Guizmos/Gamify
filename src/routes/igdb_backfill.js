const express = require("express");
const { getDb } = require("../db");
const { searchGameByName } = require("../igdb");

const router = express.Router();

router.post("/igdb/backfill", async (req, res) => {
  const db = getDb();
  const limit = Math.min(Number(req.body?.limit || 25), 200);

  const games = db.prepare(`
    SELECT id, display_name, folder_name
    FROM games
    WHERE igdb_status != 'matched'
    ORDER BY datetime(detected_at) DESC
    LIMIT ?
  `).all(limit);

  let matched = 0, notFound = 0, error = 0;

  for (const g of games) {
    const name = (g.display_name || g.folder_name || "").trim();
    try {
      const r = await searchGameByName(name);

      if (r?.hit) {
        db.prepare(`
          UPDATE games
          SET igdb_id=?, igdb_url=?, igdb_slug=?, igdb_cover_url=?, igdb_status='matched'
          WHERE id=?
        `).run(
          r.hit.igdb_id,
          r.hit.slug ? `https://www.igdb.com/games/${r.hit.slug}` : null,
          r.hit.slug,
          r.hit.cover_url,
          g.id
        );
        matched++;
      } else {
        db.prepare(`UPDATE games SET igdb_status='not_found' WHERE id=?`).run(g.id);
        notFound++;
      }
    } catch (e) {
      db.prepare(`UPDATE games SET igdb_status='error' WHERE id=?`).run(g.id);
      error++;
    }
  }

  res.json({ ok: true, processed: games.length, matched, notFound, error });
});

module.exports = router;
