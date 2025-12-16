require("dotenv").config();

function must(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

module.exports = {
  PORT: Number(process.env.PORT || 8080),
  GAMES_ROOT: must("GAMES_ROOT", "/games"),
  DATA_DIR: must("DATA_DIR", "/data"),
  DB_PATH: must("DB_PATH", "/data/gamify.sqlite"),

  JWT_SECRET: must("JWT_SECRET", "change_me_dev_only"),

  ADMIN_BOOTSTRAP_USER: must("ADMIN_BOOTSTRAP_USER", "admin"),
  ADMIN_BOOTSTRAP_PASS: must("ADMIN_BOOTSTRAP_PASS", "admin123")
};
