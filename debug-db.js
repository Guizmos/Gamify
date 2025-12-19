const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const ROOT = __dirname;

const CANDIDATE_DIRS = [
  path.join(ROOT, "data"),
  ROOT
];

function findDbFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const isFile = fs.statSync(p).isFile();
    if (!isFile) continue;
    if (/\.(db|sqlite|sqlite3)$/i.test(name)) out.push(p);
  }
  return out;
}

const candidates = CANDIDATE_DIRS.flatMap(findDbFiles);

console.log("CWD:", process.cwd());
console.log("ROOT:", ROOT);
console.log("Candidates:", candidates);

if (!candidates.length) {
  console.error("Aucune base .db/.sqlite trouvée dans ./data ou ./");
  process.exit(1);
}

const dbPath = candidates[0];
console.log("\nDB utilisée:", dbPath);

const db = new Database(dbPath, { readonly: true });

console.log("\n=== TABLES ===");
console.table(db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all());

console.log("\n=== SCHEMA games ===");
console.log(
  db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='games'").get()
);

console.log("\n=== COLUMNS games ===");
console.table(db.prepare("PRAGMA table_info(games)").all());

console.log("\n=== SAMPLE ROW games ===");
console.log(db.prepare("SELECT * FROM games LIMIT 1").get());
