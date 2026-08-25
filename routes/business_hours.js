import express from 'express';
import db from '../base/database.js';


const hoursRouter = express.Router();

hoursRouter.get('/:account_id', (req, res) => {
    const { account_id } = req.params;
    const rows = db.prepare(
        `SELECT id, day_of_week, open_time, close_time FROM business_hours WHERE account_id = ? ORDER BY day_of_week, open_time`
    ).all(account_id);

    const grouped = {};
    for (let i = 1; i <= 7; i++) grouped[i] = [];
    for (const row of rows) {
        grouped[row.day_of_week].push({ open: row.open_time, close: row.close_time });
    }
    res.json({ account_id, hours: grouped });
});

hoursRouter.put('/:account_id', (req, res) => {
    const { account_id } = req.params;
    const { business_hours } = req.body;

    if (!Array.isArray(business_hours)) {
        return res.status(400).json({ message: 'business_hours must be an array' });
    }

    // business_hours.type is NOT NULL and mirrors the owning profile's type.
    const profile = db.prepare('SELECT type FROM profiles WHERE id=?').get(account_id);
    if (!profile) {
        return res.status(404).json({ message: 'Account not found' });
    }

    const deleteStmt = db.prepare(`DELETE FROM business_hours WHERE account_id=?`);
    const insertStmt = db.prepare(`INSERT INTO business_hours (id,account_id,day_of_week,type,open_time,close_time) VALUES (?,?,?,?,?,?)`);
    const transaction = db.transaction((hours) => {
        deleteStmt.run(account_id);
        for (const h of hours) {
            const id = crypto.randomUUID();
            insertStmt.run(id, account_id, h.day_of_week, profile.type, h.open_time, h.close_time)
        }
    });

    try {
        transaction(business_hours);
        const updated = db.prepare(`SELECT * from business_hours WHERE account_id=? ORDER BY day_of_week,open_time`).all(account_id);
        res.json({ account_id, business_hours: updated });
    }
    catch (err) {
        res.status(500).json({ message: 'Failed to update business hours', error: err.message });
    }
});

hoursRouter.put('/:account_id/:day_of_week', (req, res) => {
    const { account_id, day_of_week } = req.params;
    const { business_hours } = req.body;

    if (!Array.isArray(business_hours)) {
        return res.status(400).json({ message: 'business_hours must be an array' });
    }

    const profile = db.prepare('SELECT type FROM profiles WHERE id=?').get(account_id);
    if (!profile) {
        return res.status(404).json({ message: 'Account not found' });
    }

    const deleteStmt = db.prepare('DELETE FROM business_hours WHERE account_id = ? AND day_of_week = ?');
    const insertStmt = db.prepare(`
    INSERT INTO business_hours (id,account_id, day_of_week, type, open_time, close_time)
    VALUES (?,?, ?, ?, ?, ?)
  `);

    const transaction = db.transaction((hours) => {
        deleteStmt.run(account_id, day_of_week);
        for (const interval of hours) {
            const id = crypto.randomUUID();
            insertStmt.run(id, account_id, day_of_week, profile.type, interval.open_time, interval.close_time);
        }
    });

    try {
        transaction(business_hours);
        const updated = db.prepare('SELECT * FROM business_hours WHERE account_id = ? AND day_of_week = ? ORDER BY open_time')
            .all(account_id, day_of_week);
        res.json({ account_id, day_of_week: +day_of_week, business_hours: updated });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update business hours', error: err.message });
    }
});



export default hoursRouter;