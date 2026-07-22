import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Points at the persistent volume in production (e.g. Fly.io: mount a
// volume at /data and set DB_PATH=/data/events.db; Railway: mount a
// volume and point DB_PATH at its path). Falls back to a local file
// for development, where no volume is attached.
const DB_PATH = process.env.DB_PATH || './data/events.db';

mkdirSync(dirname(DB_PATH), { recursive: true });

// Using Node's built-in node:sqlite (stable as of Node 24, available
// since Node 22.5) instead of the better-sqlite3 npm package. Same
// synchronous prepare/run/get/all API, but ships with Node itself —
// no native module to compile, so nothing breaks when a new Node
// version changes V8 internals out from under a compiled addon.
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    message_id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  )
`);

const stmts = {
  all: db.prepare('SELECT message_id, data FROM events'),
  get: db.prepare('SELECT data FROM events WHERE message_id = ?'),
  set: db.prepare(`
    INSERT INTO events (message_id, data) VALUES (?, ?)
    ON CONFLICT(message_id) DO UPDATE SET data = excluded.data
  `),
  delete: db.prepare('DELETE FROM events WHERE message_id = ?'),
};

/**
 * Same interface as the old JSON-file store, so eventManager.js and
 * index.js don't need to change. Events are stored as JSON blobs
 * keyed by the ID of the numbered-list message posted in the thread
 * (that's the message reactions attach to and the one we edit) —
 * that shape (nested participants/waitlist/watchers arrays) doesn't
 * need a relational schema, so a blob column keeps this simple while
 * still getting SQLite's durability and atomic writes on a volume.
 */
export const store = {
  all() {
    const rows = stmts.all.all();
    const result = {};
    for (const row of rows) {
      result[row.message_id] = JSON.parse(row.data);
    }
    return result;
  },
  get(messageId) {
    const row = stmts.get.get(messageId);
    return row ? JSON.parse(row.data) : null;
  },
  set(messageId, event) {
    stmts.set.run(messageId, JSON.stringify(event));
  },
  delete(messageId) {
    stmts.delete.run(messageId);
  },
};
