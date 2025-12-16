function ts() {
  return new Date().toISOString().replace("T", " ").replace("Z", "");
}

function log(level, tag, msg, extra) {
  const base = `[${ts()}] [${level}] ${tag} ${msg}`;
  if (extra) console.log(base, extra);
  else console.log(base);
}

module.exports = {
  info: (tag, msg, extra) => log("INFO", tag, msg, extra),
  warn: (tag, msg, extra) => log("WARN", tag, msg, extra),
  error: (tag, msg, extra) => log("ERROR", tag, msg, extra)
};
