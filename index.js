import express, { json } from 'express';
const app = express();
const PORT = 3000;
import db from './database.js';
import { DateTime } from 'luxon';

app.use(json());

app.get('/', (req, res) => {
    res.send('Scheduling API with SQLite is up and running!');
});

app.post('/events/book', (req, res) => {
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
    status!='released' AND JULIANDAY(?) < JULIANDAY(endTime)
          AND JULIANDAY(?) > JULIANDAY(startTime)`).get(endUTC, startUTC);

    if (overlapping) {
        return res.status(409).json({ message: 'Event overlaps with an existing event.' });
    }
    const insert = db.prepare(`INSERT INTO events(title, startTime, endTime, status) VALUES(?,?,?,?)`);

    const info = insert.run(title, startUTC, endUTC, 'booked');
    const event = db.prepare(`SELECT * FROM events WHERE id =? `).get(info.lastInsertRowid);

    return res.status(201).json({ message: 'Event booked successfully.', event });
});

app.get('/events', (req, res) => {
    const events = db.prepare(`SELECT * FROM events`).all();
    res.json(events);
});

app.post('/events/block', (req, res) => {
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

app.post('/events/release', (req, res) => {
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

app.put('/events/:id', (req, res) => {
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
        AND JULIANDAY(?)<JULIANDAY(endTime)
        AND JULIANDAY(?)>JULIANDAY(startTime)`).get(id, endUTC, startUTC);

    if (overlapping) {
        return res.status(409).json({ message: 'Event overlaps with an existing event.' });
    }

    db.prepare(`UPDATE events SET title=?, startTime=?, endTime=?
        WHERE id=?`).run(title, startUTC, endUTC, id);

    const updated = db.prepare(`SELECT * FROM events WHERE id=?`).get(id);
    res.json({ message: 'Event updated successfully', event: updated });

});


app.delete('/events/:id', (req, res) => {
    const { id } = req.params;
    const existing = db.prepare(`SELECT * FROM events WHERE id=?`).get(id);
    if (!existing) {
        return res.status(404).json({ message: 'Event not found.' });
    }

    db.prepare('DELETE FROM events WHERE id=?').run(id);
    res.json({ message: 'Event deleted successfully.' });
});



app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
})