/**
 * Database layer.
 *
 * Uses SQLite through sql.js (pure WebAssembly), so the project runs on any
 * machine with Node.js and needs no separate database server. The schema is
 * standard SQL and maps directly to MySQL (see docs/schema.sql).
 *
 * The database lives in memory and is written to server/data/realestate.db
 * after every change. Set DB_FILE=:memory: to keep it in memory only (tests).
 */
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DEFAULT_FILE = path.join(__dirname, '..', 'data', 'realestate.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  phone         TEXT,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('buyer','tenant','owner','agent','builder','admin')),
  city          TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS properties (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                TEXT    NOT NULL,
  description          TEXT,
  listing_type         TEXT    NOT NULL CHECK (listing_type IN ('sale','rent')),
  property_type        TEXT    NOT NULL CHECK (property_type IN ('apartment','house','villa','plot','office','shop')),
  price                INTEGER NOT NULL,
  city                 TEXT    NOT NULL,
  locality             TEXT    NOT NULL,
  address              TEXT,
  bedrooms             INTEGER NOT NULL DEFAULT 0,
  bathrooms            INTEGER NOT NULL DEFAULT 0,
  area_sqft            INTEGER NOT NULL,
  furnishing           TEXT    NOT NULL DEFAULT 'unfurnished' CHECK (furnishing IN ('unfurnished','semi-furnished','furnished')),
  status               TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','sold','rented')),
  rejection_reason     TEXT,
  is_duplicate_suspect INTEGER NOT NULL DEFAULT 0,
  duplicate_of         INTEGER,
  views                INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_properties_search ON properties (status, city, listing_type, property_type, price);

CREATE TABLE IF NOT EXISTS property_images (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url         TEXT    NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS favourites (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, property_id)
);

CREATE TABLE IF NOT EXISTS enquiries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  sender_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open','replied','closed')),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS enquiry_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  enquiry_id INTEGER NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  sender_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT    NOT NULL,
  message    TEXT    NOT NULL,
  link       TEXT,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS flags (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT    NOT NULL CHECK (reason IN ('fake','duplicate','wrong_info','not_available','other')),
  details     TEXT,
  status      TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (property_id, reporter_id)
);
`;

let db = null;
let dbFile = null;

async function initDb(file = process.env.DB_FILE || DEFAULT_FILE) {
  const SQL = await initSqlJs();
  dbFile = file === ':memory:' ? null : file;

  if (dbFile && fs.existsSync(dbFile)) {
    db = new SQL.Database(fs.readFileSync(dbFile));
  } else {
    db = new SQL.Database();
  }
  db.run('PRAGMA foreign_keys = ON;');
  db.run(SCHEMA);
  persist();
  return db;
}

/** Write the in-memory database to disk (no-op for in-memory databases). */
function persist() {
  if (!dbFile) return;
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  fs.writeFileSync(dbFile, Buffer.from(db.export()));
  // export() resets pragmas, so switch foreign keys back on
  db.run('PRAGMA foreign_keys = ON;');
}

function getDb() {
  if (!db) throw new Error('Database not initialised. Call initDb() first.');
  return db;
}

/** sql.js does not accept undefined, so map it to null. */
function clean(params) {
  if (Array.isArray(params)) return params.map((v) => (v === undefined ? null : v));
  return params;
}

/** Run a SELECT and return all rows as plain objects. */
function all(sql, params = []) {
  const stmt = getDb().prepare(sql);
  try {
    stmt.bind(clean(params));
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

/** Run a SELECT and return the first row (or undefined). */
function get(sql, params = []) {
  return all(sql, params)[0];
}

/** Run an INSERT / UPDATE / DELETE. Returns { changes, lastId }. */
function run(sql, params = []) {
  const d = getDb();
  d.run(sql, clean(params));
  const changes = d.getRowsModified();
  const lastId = d.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
  persist();
  return { changes, lastId };
}

/** Run several statements as one unit; rolls back if any of them fails. */
function transaction(fn) {
  const d = getDb();
  const saved = dbFile;
  dbFile = null; // write once at the end, not after every statement
  d.run('BEGIN');
  try {
    const result = fn();
    d.run('COMMIT');
    dbFile = saved;
    persist();
    return result;
  } catch (err) {
    d.run('ROLLBACK');
    dbFile = saved;
    throw err;
  }
}

module.exports = { initDb, all, get, run, transaction, persist };
