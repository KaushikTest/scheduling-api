/** 
 * @type {import('better-sqlite3')}
 */

import Database from 'better-sqlite3';
const db = new Database('eventsdb.sqlite');

// Initialize events table if it doesn't exist
db.prepare(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    startTime TEXT,
    endTime TEXT,
    status TEXT
  )
`).run();
export default db;