import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DB_PATH = new URL('./events.json', import.meta.url);

function load() {
  if (!existsSync(DB_PATH)) return {};
  try {
    return JSON.parse(readFileSync(DB_PATH, 'utf8'));
  } catch {
    return {};
  }
}

let cache = load();

/**
 * Very small persistence layer. Events are keyed by the ID of the
 * numbered-list message posted in the thread (that's the message we
 * attach reactions to and edit).
 */
export const store = {
  all() {
    return cache;
  },
  get(messageId) {
    return cache[messageId] ?? null;
  },
  set(messageId, event) {
    cache[messageId] = event;
    this._save();
  },
  delete(messageId) {
    delete cache[messageId];
    this._save();
  },
  _save() {
    writeFileSync(DB_PATH, JSON.stringify(cache, null, 2));
  },
};
