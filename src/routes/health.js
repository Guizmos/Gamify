const express = require("express");
const { getDb } = require("../db");
const router = express.Router();

router.get("/health", (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT 1 as ok").get();
  res.json({
    ok: true,
    db: row?.ok === 1,
    time: new Date().toISOString()
  });
});

module.exports = router;
