const express = require("express");
const { scanOnce } = require("../scan");
const { getDb } = require("../db");

const router = express.Router();

router.post("/scan", async (req, res) => {
  try {
    const result = await scanOnce();
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error("[SCAN_ROUTE] scanOnce failed:", e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

router.get("/scan/status", (req, res) => {
  const db = getDb();
  const get = (k) =>
    db.prepare("SELECT value FROM settings WHERE key=?").get(k)?.value ?? null;

  res.json({
    ok: true,
    last_scan_at: get("last_scan_at"),
    last_scan_new: Number(get("last_scan_new") || 0),
    last_scan_errors: Number(get("last_scan_errors") || 0),
  });
});

module.exports = router;
