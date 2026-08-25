import express from 'express';
import { DateTime } from 'luxon';
import db from '../base/database.js';
import { TIME_FORMAT } from '../commons/constants.js';
import { generateSlots, isOverlapping } from '../commons/helper.js';

const slotsRouter = express.Router();

slotsRouter.get('/', (req, res) => {
    const { account_id, date, slot_size_minutes } = req.query;

    if (!account_id || !date || !slot_size_minutes) {
        return res.status(400).json({ message: 'Missing required query params' });
    }

    const slotSize = parseInt(slot_size_minutes, 10);
    if (isNaN(slotSize) || slotSize <= 0) {
        return res.status(400).json({ message: 'Invalid slot_size_minutes' });
    }


    const profile = db.prepare('SELECT timezone FROM profiles WHERE id = ?').get(account_id);
    if (!profile) {
        return res.status(404).json({ message: 'Account not found' });
    }
    const timeZone = profile.timezone;


    const dayDate = DateTime.fromISO(date, { zone: timeZone });
    const dayOfWeek = dayDate.weekday;


    const businessHoursRows = db.prepare(`
    SELECT open_time, close_time FROM business_hours 
    WHERE account_id = ? AND day_of_week = ? ORDER BY open_time
  `).all(account_id, dayOfWeek);

    if (!businessHoursRows.length) {
        return res.json({ account_id, date, available_slots: [] });
    }


    const businessIntervals = businessHoursRows.map(({ open_time, close_time }) => {
        const start = DateTime.fromISO(`${date}T${open_time}`, { zone: timeZone });
        const end = DateTime.fromISO(`${date}T${close_time}`, { zone: timeZone });
        return { start, end };
    });


    const dayStartUTC = dayDate.startOf('day').toUTC().toISO();
    const dayEndUTC = dayDate.endOf('day').toUTC().toISO();

    const eventsRows = db.prepare(`
    SELECT startTime, endTime FROM events 
    WHERE account_id = ?
      AND startTime < ?
      AND endTime > ?
      AND status != 'released'
  `).all(account_id, dayEndUTC, dayStartUTC);


    const unavailableIntervals = eventsRows.map(({ startTime, endTime }) => {
        const start = DateTime.fromISO(startTime, { zone: 'utc' }).setZone(timeZone);
        const end = DateTime.fromISO(endTime, { zone: 'utc' }).setZone(timeZone);
        return { start, end };
    });

    const availableSlots = [];
    for (const interval of businessIntervals) {
        const slots = generateSlots(interval.start, interval.end, slotSize);
        for (const slot of slots) {
            if (!isOverlapping(slot, unavailableIntervals)) {
                availableSlots.push({
                    start: slot.start.toFormat(TIME_FORMAT),
                    end: slot.end.toFormat(TIME_FORMAT)
                });
            }
        }
    }

    return res.json({
        account_id,
        date,
        slot_size_minutes: slotSize,
        time_zone: timeZone,
        available_slots: availableSlots
    });
});

export default slotsRouter;