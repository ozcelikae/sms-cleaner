/**
 * Spam Database Service
 * SQLite-backed blacklist + whitelist management
 */

import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

const DATABASE_NAME = 'smscleaner.db';
const DATABASE_VERSION = '1.0';
const DATABASE_DISPLAYNAME = 'SMS Cleaner Database';
const DATABASE_SIZE = 200000;

let db = null;

async function getDatabase() {
  if (db) return db;

  db = await SQLite.openDatabase({
    name: DATABASE_NAME,
    location: 'default',
  });

  await initDatabase(db);
  return db;
}

async function initDatabase(database) {
  // Kullanıcı izin durumunu takip eden tablo
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS blacklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL UNIQUE,
      reason TEXT,
      added_at INTEGER NOT NULL,
      auto_detected INTEGER DEFAULT 0
    )
  `);

  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS whitelist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL UNIQUE,
      label TEXT,
      added_at INTEGER NOT NULL
    )
  `);

  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS blocked_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL,
      preview TEXT,
      blocked_at INTEGER NOT NULL,
      reason TEXT,
      category TEXT DEFAULT 'spam'
    )
  `);

  // Seed some known spam numbers
  const seedNumbers = [
    ['1234', 'Sıralı kısa kod'],
    ['0000', 'Tekrarlayan sıfırlar'],
    ['111111', 'Tekrarlayan birler'],
    ['999999', 'Tekrarlayan dokuzlar'],
    ['123456', 'Sıralı numara'],
    ['654321', 'Ters sıralı numara'],
  ];

  for (const [number, reason] of seedNumbers) {
    await database
      .executeSql(
        `INSERT OR IGNORE INTO blacklist (number, reason, added_at, auto_detected)
         VALUES (?, ?, ?, 1)`,
        [number, reason, Date.now()],
      )
      .catch(() => {});
  }
}

// ─── Blacklist ────────────────────────────────────────────────────────────────

export async function isBlacklisted(number) {
  const database = await getDatabase();
  const [result] = await database.executeSql(
    'SELECT id FROM blacklist WHERE number = ? LIMIT 1',
    [number],
  );
  return result.rows.length > 0;
}

export async function addToBlacklist(number, reason = '', autoDetected = false) {
  const database = await getDatabase();
  await database.executeSql(
    `INSERT OR REPLACE INTO blacklist (number, reason, added_at, auto_detected)
     VALUES (?, ?, ?, ?)`,
    [number, reason, Date.now(), autoDetected ? 1 : 0],
  );
}

export async function removeFromBlacklist(number) {
  const database = await getDatabase();
  await database.executeSql('DELETE FROM blacklist WHERE number = ?', [number]);
}

export async function getBlacklist() {
  const database = await getDatabase();
  const [result] = await database.executeSql(
    'SELECT * FROM blacklist ORDER BY added_at DESC',
  );
  const items = [];
  for (let i = 0; i < result.rows.length; i++) {
    items.push(result.rows.item(i));
  }
  return items;
}

// ─── Whitelist ────────────────────────────────────────────────────────────────

export async function isWhitelisted(number) {
  const database = await getDatabase();
  const [result] = await database.executeSql(
    'SELECT id FROM whitelist WHERE number = ? LIMIT 1',
    [number],
  );
  return result.rows.length > 0;
}

export async function addToWhitelist(number, label = '') {
  const database = await getDatabase();
  await database.executeSql(
    `INSERT OR REPLACE INTO whitelist (number, label, added_at)
     VALUES (?, ?, ?)`,
    [number, label, Date.now()],
  );
}

export async function removeFromWhitelist(number) {
  const database = await getDatabase();
  await database.executeSql('DELETE FROM whitelist WHERE number = ?', [number]);
}

export async function getWhitelist() {
  const database = await getDatabase();
  const [result] = await database.executeSql(
    'SELECT * FROM whitelist ORDER BY added_at DESC',
  );
  const items = [];
  for (let i = 0; i < result.rows.length; i++) {
    items.push(result.rows.item(i));
  }
  return items;
}

// ─── Blocked Messages Log ─────────────────────────────────────────────────────

export async function logBlockedMessage(number, preview, reason, category = 'spam') {
  const database = await getDatabase();
  await database.executeSql(
    `INSERT INTO blocked_messages (number, preview, blocked_at, reason, category)
     VALUES (?, ?, ?, ?, ?)`,
    [number, preview, Date.now(), reason, category],
  );
}

export async function getBlockedMessages(limit = 100, offset = 0) {
  const database = await getDatabase();
  const [result] = await database.executeSql(
    'SELECT * FROM blocked_messages ORDER BY blocked_at DESC LIMIT ? OFFSET ?',
    [limit, offset],
  );
  const items = [];
  for (let i = 0; i < result.rows.length; i++) {
    items.push(result.rows.item(i));
  }
  return items;
}

export async function getStats() {
  const database = await getDatabase();
  const [[blacklistResult], [whitelistResult], [blockedResult]] =
    await Promise.all([
      database.executeSql('SELECT COUNT(*) as count FROM blacklist'),
      database.executeSql('SELECT COUNT(*) as count FROM whitelist'),
      database.executeSql('SELECT COUNT(*) as count FROM blocked_messages'),
    ]);

  return {
    blacklistCount: blacklistResult.rows.item(0).count,
    whitelistCount: whitelistResult.rows.item(0).count,
    blockedCount: blockedResult.rows.item(0).count,
  };
}

export async function clearBlockedMessages() {
  const database = await getDatabase();
  await database.executeSql('DELETE FROM blocked_messages');
}

// ─── Settings (izin takibi) ───────────────────────────────────────────────────

export async function getSetting(key) {
  const database = await getDatabase();
  const [result] = await database.executeSql(
    'SELECT value FROM settings WHERE key = ? LIMIT 1',
    [key],
  );
  if (result.rows.length === 0) return null;
  return result.rows.item(0).value;
}

export async function setSetting(key, value) {
  const database = await getDatabase();
  await database.executeSql(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, String(value)],
  );
}

export default {
  isBlacklisted,
  addToBlacklist,
  removeFromBlacklist,
  getBlacklist,
  isWhitelisted,
  addToWhitelist,
  removeFromWhitelist,
  getWhitelist,
  logBlockedMessage,
  getBlockedMessages,
  getStats,
  clearBlockedMessages,
  getSetting,
  setSetting,
};
