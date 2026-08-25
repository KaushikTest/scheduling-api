/** 
 * @type {import('better-sqlite3')}
 */

import Database from 'better-sqlite3';
const db = new Database('eventsdb.sqlite');
db.pragma('foreign_keys = ON');

// Initialize events table if it doesn't exist
db.prepare(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    account_id TEXT,
    title TEXT,
    startTime TEXT,
    endTime TEXT,
    type TEXT CHECK(type IN ('EVENT','BLOCKER','SESSION')) NOT NULL,
    status TEXT,
    FOREIGN KEY(account_id) REFERENCES profiles(id)
  )
`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS business_hours(
  id TEXT PRIMARY KEY,
  account_id TEXT,
  -- 1 = Monday ... 7 = Sunday, matching Luxon's DateTime.weekday, which is what
  -- the slots and hours routes group by. The old 0-6 range made Sunday unstorable.
  day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 1 AND 7),
  type TEXT CHECK (type IN ('ACCOUNT','STAFF')) NOT NULL,
  open_time TEXT NOT NULL,
  close_time TEXT NOT NULL,
  FOREIGN KEY(account_id) REFERENCES profiles(id))`
).run();


db.prepare(`CREATE TABLE IF NOT EXISTS profiles(id TEXT PRIMARY KEY,
  merchant_key TEXT NOT NULL,
  company_name TEXT NOT NULL,
  timezone TEXT NOT NULL,
  location TEXT,
  email TEXT,
  phone TEXT,
  type TEXT CHECK (type IN ('ACCOUNT','STAFF')) NOT NULL,
  created_at TEXT DEFAULT (DATETIME('now')),
  updated_at TEXT DEFAULT (DATETIME('now')))`
).run();

db.prepare(`CREATE TABLE IF NOT EXISTS event_audit(id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  account_id TEXT,
  action TEXT NOT NULL,
  timestamp TEXT DEFAULT (DATETIME('now')),
  type TEXT,
  details TEXT,
  performed_by TEXT,
  FOREIGN KEY(account_id) REFERENCES profiles(id),
  FOREIGN KEY(event_id) REFERENCES events(id))`
).run();

export default db;