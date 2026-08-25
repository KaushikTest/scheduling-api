import db from '../base/database.js';
import { bookEventByTime, createProfile, fetchSlots, getRaw, putHours } from '../commons/helper.js';

// The account's timezone drives slot generation, so pin it rather than using
// whatever faker produced — these assertions are about the boundaries.
let account_id;
const TZ = 'Asia/Kolkata';
const WEEKDAY = '2033-04-06';         // a Wednesday
const OTHER_WEEKDAY = '2033-04-13';   // the following Wednesday
const SATURDAY = '2033-04-09';

beforeAll(async () => {
    account_id = (await createProfile()).res.body.profile.id;
    db.prepare('UPDATE profiles SET timezone=? WHERE id=?').run(TZ, account_id);
});

afterAll(() => {
    db.prepare(`DELETE FROM event_audit WHERE account_id=?`).run(account_id);
    db.prepare(`DELETE FROM events WHERE account_id=?`).run(account_id);
    db.prepare(`DELETE FROM business_hours WHERE account_id=?`).run(account_id);
    db.prepare(`DELETE FROM profiles WHERE id=?`).run(account_id);
    if (db.close) {
        db.close();
    }
});

describe('GET /slots', () => {

    it('generates slots across the default 09:00-17:00 window', async () => {
        const res = await fetchSlots(account_id, WEEKDAY, 60);
        expect(res.status).toBe(200);
        expect(res.body.time_zone).toEqual(TZ);
        expect(res.body.slot_size_minutes).toEqual(60);
        // 09:00-17:00 is 8 hours, so 8 one-hour slots.
        expect(res.body.available_slots).toHaveLength(8);
        expect(res.body.available_slots[0].start).toContain('T09:00:00');
        expect(res.body.available_slots[7].end).toContain('T17:00:00');
    });

    it('halves the slot count when the slot size doubles', async () => {
        const hourly = await fetchSlots(account_id, WEEKDAY, 60);
        const halfHourly = await fetchSlots(account_id, WEEKDAY, 30);
        expect(halfHourly.body.available_slots).toHaveLength(
            hourly.body.available_slots.length * 2
        );
    });

    it('returns no slots on a closed day', async () => {
        const res = await fetchSlots(account_id, SATURDAY, 60);
        expect(res.status).toBe(200);
        expect(res.body.available_slots).toEqual([]);
    });

    it('drops a slot once an event occupies it', async () => {
        const before = await fetchSlots(account_id, WEEKDAY, 60);
        const occupied = before.body.available_slots[2];

        // 11:00-12:00 IST on the target day.
        const booked = await bookEventByTime(
            `${WEEKDAY}T05:30:00Z`, `${WEEKDAY}T06:30:00Z`, account_id
        );
        expect(booked.response.status).toBe(201);

        const after = await fetchSlots(account_id, WEEKDAY, 60);
        expect(after.body.available_slots).toHaveLength(
            before.body.available_slots.length - 1
        );
        expect(after.body.available_slots.map(s => s.start)).not.toContain(occupied.start);
    });

    it('excludes a slot size that is larger than the working day', async () => {
        const res = await fetchSlots(account_id, WEEKDAY, 600);
        expect(res.status).toBe(200);
        expect(res.body.available_slots).toEqual([]);
    });

    it('generates around a lunch break when a day has two intervals', async () => {
        // Wednesday = day 3. Replace it with a split shift: 09:00-12:00, 13:00-17:00.
        const split = await putHours(account_id, 3, [
            { open_time: '09:00', close_time: '12:00' },
            { open_time: '13:00', close_time: '17:00' },
        ]);
        expect(split.status).toBe(200);

        // A different Wednesday, so the event booked by the test above doesn't
        // occupy one of the slots we're counting here.
        const res = await fetchSlots(account_id, OTHER_WEEKDAY, 60);
        const starts = res.body.available_slots.map(s => s.start.slice(11, 16));

        // 3 slots before lunch + 4 after, and nothing spanning 12:00-13:00.
        expect(starts).toEqual(['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00']);
        expect(starts).not.toContain('12:00');
    });

    describe('validation', () => {

        it.each([
            ['account_id', { date: WEEKDAY, slot_size_minutes: 60 }],
            ['date', { account_id: 'placeholder', slot_size_minutes: 60 }],
            ['slot_size_minutes', { account_id: 'placeholder', date: WEEKDAY }],
        ])('returns 400 when missing %s', async (_field, query) => {
            const params = { ...query };
            if (params.account_id === 'placeholder') params.account_id = account_id;

            const res = await getRaw('/slots', params);
            expect(res.status).toBe(400);
        });

        it.each([
            ['non-numeric', 'abc'],
            ['zero', 0],
            ['negative', -30],
        ])('returns 400 for a %s slot size', async (_case, size) => {
            const res = await fetchSlots(account_id, WEEKDAY, size);
            expect(res.status).toBe(400);
        });

        it('returns 404 for an unknown account', async () => {
            const res = await fetchSlots('no-such-account', WEEKDAY, 60);
            expect(res.status).toBe(404);
        });

    });

});
