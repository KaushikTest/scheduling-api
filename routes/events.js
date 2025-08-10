import express, { json } from 'express';
import db from '../database.js';
import { DateTime } from 'luxon';

const router = express.Router();


router.get('/', (req, res) => {
    const events = db.prepare(`SELECT * FROM events`).all();
    res.json(events);
});

router.post('/book', (req, res) => {
    const { title, startTime, endTime } = req.body;
    if (!title || !startTime || !endTime) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }

    const startUTC = DateTime.fromISO(startTime, { zone: 'utc' }).toISO({ suppressMilliseconds: true });
    const endUTC = DateTime.fromISO(endTime, { zone: 'utc' }).toISO({ suppressMilliseconds: true });

    if (!startUTC || !endUTC) {
        return res.status(400).json({ message: 'Invalid date format.' });
    }

    if (DateTime.fromISO(startUTC) >= DateTime.fromISO(endUTC)) {
        return res.status(400).json({ message: 'Start time must be before end time.' })
    }

    const overlapping = db.prepare(`SELECT * FROM events WHERE 
    status!='released' AND NOT (JULIANDAY(?) >= JULIANDAY(endTime) OR JULIANDAY(?) <= JULIANDAY(startTime))`).get(startUTC, endUTC);

    if (overlapping) {
        return res.status(409).json({ message: 'Event overlaps with an existing event.' });
    }
    const insert = db.prepare(`INSERT INTO events(title, startTime, endTime, status) VALUES(?,?,?,?)`);

    const info = insert.run(title, startUTC, endUTC, 'booked');
    const event = db.prepare(`SELECT * FROM events WHERE id =? `).get(info.lastInsertRowid);

    return res.status(201).json({ message: 'Event booked successfully.', event });
});

router.post('/block', (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ message: 'Event id is required.' });
    }
    const event = db.prepare(`SELECT * FROM events WHERE id =? `).get(id);
    if (!event) {
        return res.status(404).json({ message: 'Event not found.' });
    }
    db.prepare('UPDATE events SET status=? WHERE id=?').run('blocked', id);
    const updatedEvent = db.prepare(`SELECT * FROM events WHERE id =? `).get(id);
    res.json({ message: 'Event blocked successfully.', event: updatedEvent });
})

router.post('/release', (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ message: 'Event id is required.' });
    }
    const event = db.prepare(`SELECT * FROM events WHERE id =? `).get(id);
    if (!event) {
        return res.status(404).json({ message: 'Event not found.' });
    }
    db.prepare('UPDATE events SET status=? WHERE id=?').run('released', id);
    const updatedEvent = db.prepare(`SELECT * FROM events WHERE id =? `).get(id);
    res.json({ message: 'Event released successfully.', event: updatedEvent });
})

router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { title, startTime, endTime } = req.body;
    if (!title || !startTime || !endTime) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }

    const existing = db.prepare(`SELECT * FROM events WHERE id=?`).get(id);
    if (!existing) {
        return res.status(404).json({ message: 'Event not found.' });
    }

    const startUTC = DateTime.fromISO(startTime, { zone: 'utc' }).toISO({ suppressMilliseconds: true });
    const endUTC = DateTime.fromISO(endTime, { zone: 'utc' }).toISO({ suppressMilliseconds: true });

    if (!startUTC || !endUTC) {
        return res.status(400).json({ message: 'Invalid date format.' });
    }

    if (DateTime.fromISO(startUTC) >= DateTime.fromISO(endUTC)) {
        return res.status(400).json({ message: 'Start time must be before end time.' });
    }

    const overlapping = db.prepare(`SELECT * FROM events WHERE status!='released'
        AND id!=?
        AND NOT(JULIANDAY(?) >= JULIANDAY(endTime)
          OR JULIANDAY(?) <= JULIANDAY(startTime))`).get(id, startUTC, endUTC);

    if (overlapping) {
        return res.status(409).json({ message: 'Event overlaps with an existing event.' });
    }

    db.prepare(`UPDATE events SET title=?, startTime=?, endTime=?
        WHERE id=?`).run(title, startUTC, endUTC, id);

    const updated = db.prepare(`SELECT * FROM events WHERE id=?`).get(id);
    res.json({ message: 'Event updated successfully', event: updated });

});


router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const existing = db.prepare(`SELECT * FROM events WHERE id=?`).get(id);
    if (!existing) {
        return res.status(404).json({ message: 'Event not found.' });
    }

    db.prepare('DELETE FROM events WHERE id=?').run(id);
    res.json({ message: 'Event deleted successfully.' });
});

export default router;