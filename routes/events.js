import express, { json } from 'express';
import db from '../base/database.js';
import { DateTime } from 'luxon';
import { MISSING_FIELD, INVALID_DATE, TIME_ERROR, OVERLAP_ERROR, EVENT_BOOKED, ID_ERROR, EVENT_ERROR, EVENT_BLOCKED, EVENT_RELEASED, EVENT_UPDATED, EVENT_DELETED } from '../commons/constants.js';

const router = express.Router();

router.get('/', (req, res) => {
    const { account_id, date } = req.query;
    if (!account_id || !date) {
        return res.status(400).json({ message: "Missing account_id or date" });
    }

    const startOfDay = DateTime.fromISO(date, { zone: 'Asia/Kolkata' }).startOf('day').toUTC().toISO();
    const endOfDay = DateTime.fromISO(date, { zone: 'Asia/Kolkata' }).plus({ days: 1 }).startOf('day').toUTC().toISO();

    const query = `
    SELECT * FROM events
    WHERE account_id = ?
    AND startTime < ?
    AND endTime > ?
    ORDER BY startTime
  `;
    const events = db.prepare(query).all(account_id, endOfDay, startOfDay);

    res.json({ date, events });
});

router.get('/:id', (req, res) => {
    const { id } = req.params;
    const query = `SELECT * FROM events WHERE id=?`;
    const event = db.prepare(query).get(id);
    res.json({ message: 'Event Fetched successfully', event })
})

router.post('/book', (req, res) => {
    const { account_id, title, startTime, endTime } = req.body;
    if (!account_id || !title || !startTime || !endTime) {
        return res.status(400).json({ message: MISSING_FIELD });
    }

    const startUTC = DateTime.fromISO(startTime, { zone: 'utc' }).toISO({ suppressMilliseconds: true });
    const endUTC = DateTime.fromISO(endTime, { zone: 'utc' }).toISO({ suppressMilliseconds: true });

    if (!startUTC || !endUTC) {
        return res.status(400).json({ message: INVALID_DATE });
    }

    if (DateTime.fromISO(startUTC) >= DateTime.fromISO(endUTC)) {
        return res.status(400).json({ message: TIME_ERROR })
    }

    const overlapping = db.prepare(`SELECT * FROM events WHERE 
    status!='released' AND NOT (JULIANDAY(?) >= JULIANDAY(endTime) OR JULIANDAY(?) <= JULIANDAY(startTime))`).get(startUTC, endUTC);

    if (overlapping) {
        return res.status(409).json({ message: OVERLAP_ERROR });
    }
    const id = crypto.randomUUID();
    const insert = db.prepare(`INSERT INTO events(id,account_id,title, startTime, endTime,type, status) VALUES(?,?,?,?,?,?,?)`);

    insert.run(id, account_id, title, startUTC, endUTC, 'EVENT', 'booked');
    const event = db.prepare(`SELECT * FROM events WHERE id =? `).get(id);

    return res.status(201).json({ message: EVENT_BOOKED, event });
});

router.post('/block', (req, res) => {
    const { account_id, title, startTime, endTime } = req.body;
    if (!account_id || !title || !startTime || !endTime) {
        return res.status(400).json({ message: MISSING_FIELD });
    }

    const startUTC = DateTime.fromISO(startTime, { zone: 'utc' }).toISO({ suppressMilliseconds: true });
    const endUTC = DateTime.fromISO(endTime, { zone: 'utc' }).toISO({ suppressMilliseconds: true });

    if (!startUTC || !endUTC) {
        return res.status(400).json({ message: INVALID_DATE });
    }

    if (DateTime.fromISO(startUTC) >= DateTime.fromISO(endUTC)) {
        return res.status(400).json({ message: TIME_ERROR })
    }

    const overlapping = db.prepare(`SELECT * FROM events WHERE 
    status!='released' AND NOT (JULIANDAY(?) >= JULIANDAY(endTime) OR JULIANDAY(?) <= JULIANDAY(startTime))`).get(startUTC, endUTC);

    if (overlapping) {
        return res.status(409).json({ message: OVERLAP_ERROR });
    }
    const id = crypto.randomUUID();
    const insert = db.prepare(`INSERT INTO events(id,account_id,title, startTime, endTime,type, status) VALUES(?,?,?,?,?,?,?)`);

    insert.run(id, account_id, title, startUTC, endUTC, 'BLOCKER', 'booked');
    const event = db.prepare(`SELECT * FROM events WHERE id =? `).get(id);

    return res.status(201).json({ message: EVENT_BOOKED, event });
})

router.post('/release', (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ message: ID_ERROR });
    }
    const event = db.prepare(`SELECT * FROM events WHERE id =? `).get(id);
    if (!event) {
        return res.status(404).json({ message: EVENT_ERROR });
    }
    db.prepare('UPDATE events SET status=? WHERE id=?').run('released', id);
    const updatedEvent = db.prepare(`SELECT * FROM events WHERE id =? `).get(id);
    res.json({ message: EVENT_RELEASED, event: updatedEvent });
})

router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { title, startTime, endTime } = req.body;
    if (!title || !startTime || !endTime) {
        return res.status(400).json({ message: MISSING_FIELD });
    }

    const existing = db.prepare(`SELECT * FROM events WHERE id=?`).get(id);
    if (!existing) {
        return res.status(404).json({ message: EVENT_ERROR });
    }

    const startUTC = DateTime.fromISO(startTime, { zone: 'utc' }).toISO({ suppressMilliseconds: true });
    const endUTC = DateTime.fromISO(endTime, { zone: 'utc' }).toISO({ suppressMilliseconds: true });

    if (!startUTC || !endUTC) {
        return res.status(400).json({ message: INVALID_DATE });
    }

    if (DateTime.fromISO(startUTC) >= DateTime.fromISO(endUTC)) {
        return res.status(400).json({ message: TIME_ERROR });
    }

    const overlapping = db.prepare(`SELECT * FROM events WHERE status!='released'
        AND id!=?
        AND NOT(JULIANDAY(?) >= JULIANDAY(endTime)
          OR JULIANDAY(?) <= JULIANDAY(startTime))`).get(id, startUTC, endUTC);

    if (overlapping) {
        return res.status(409).json({ message: OVERLAP_ERROR });
    }

    db.prepare(`UPDATE events SET title=?, startTime=?, endTime=?, status=?
        WHERE id=?`).run(title, startUTC, endUTC, 'updated', id);

    const updated = db.prepare(`SELECT * FROM events WHERE id=?`).get(id);
    res.json({ message: EVENT_UPDATED, event: updated });

});


router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const existing = db.prepare(`SELECT * FROM events WHERE id=?`).get(id);
    if (!existing) {
        return res.status(404).json({ message: EVENT_ERROR });
    }

    db.prepare('DELETE FROM events WHERE id=?').run(id);
    res.json({ message: EVENT_DELETED });
});

export default router;