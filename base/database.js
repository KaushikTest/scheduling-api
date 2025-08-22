/** 
 * @type {import('better-sqlite3')}
 */

import Database from 'better-sqlite3';
const db = new Database('eventsdb.sqlite');

// Initialize events table if it doesn't exist
db.prepare(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    account_id TEXT,
    title TEXT,
    startTime TEXT,
    endTime TEXT,
    type TEXT,
    status TEXT,
    FOREIGN KEY(account_id) REFERENCES profiles(id)
  )
`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS business_hours(
  id TEXT PRIMARY KEY,
  account_id TEXT,
  day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
  open_time TEXT NOT NULL,
  close_time TEXT NOT NULL,
  FOREIGN KEY(account_id) REFERENCES profiles(id))`).run();


db.prepare(`CREATE TABLE IF NOT EXISTS profiles(id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  timezone TEXT NOT NULL,
  location TEXT,
  email TEXT,
  phone TEXT,
  created_at TEXT DEFAULT (DATETIME('now')),
  updated_at TEXT DEFAULT (DATETIME('now'))
)`).run();

export default db;