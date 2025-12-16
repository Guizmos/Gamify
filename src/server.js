const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");

const { PORT } = require("./config");
const { getDb } = require("./db");
const logger = require("./logger");

const healthRoutes = require("./routes/health");
const scanRoutes = require("./routes/scan");
const settingsRoutes = require("./routes/settings");
const gamesRoutes = require("./routes/games");
const igdbBackfillRoutes = require("./routes/igdb_backfill");

const authRoutes = require("./routes/auth");
const notifyRoutes = require("./routes/notify");
const adminTelegramRoutes = require("./routes/admin_telegram");
const adminUsersRoutes = require("./routes/admin_users");

const app = express();
const db = getDb();

// ✅ Middlewares AVANT les routes
app.use(cookieParser());
app.use(express.json({ limit: "5mb" }));

// ✅ Routes API
app.use("/api", authRoutes);
app.use("/api", adminTelegramRoutes);
app.use("/api", adminUsersRoutes);
app.use("/api", notifyRoutes);
app.use("/api", igdbBackfillRoutes);

app.use("/api", healthRoutes);
app.use("/api", scanRoutes);
app.use("/api", settingsRoutes);
app.use("/api", gamesRoutes);

// ✅ Static en dernier
app.use(express.static(path.join(__dirname, "..", "public")));

function getSetting(key, fallback) {
  const row = db.prepare("SELECT value FROM settings WHERE key=?").get(key);
  return row ? row.value : fallback;
}

// Auto scan
function scheduleAutoScan() {
  const enabled = (getSetting("scan_enabled", "true") === "true");
  const intervalSec = Number(getSetting("scan_interval_sec", "300"));

  if (!enabled) {
    logger.warn("[SCAN]", "Scan auto désactivé");
    return;
  }

  logger.info("[SCAN]", `Scan auto activé (toutes les ${intervalSec}s)`);
  setInterval(() => {
    require("./scan").scanOnce()
      .catch(e => logger.error("[SCAN]", "Scan auto crash", e.message));
  }, intervalSec * 1000);
}

const server = app.listen(PORT, () => {
  logger.info("[APP]", `Gamify running on http://localhost:${PORT}`);
  scheduleAutoScan();
});

// Bonus: message clair si port déjà pris
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    logger.error("[APP]", `Port ${PORT} déjà utilisé`);
    process.exit(1);
  }
  throw err;
});
