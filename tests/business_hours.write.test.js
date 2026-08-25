import request from 'supertest';
import app from '../base/index.js';
import db from '../base/database.js';
import { createProfile, fetchHours, putHours } from '../commons/helper.js';

// Covers the two write endpoints, which returned 500 on every call before the
// insert was fixed to supply business_hours.type (NOT NULL in the schema).
let account_id;

beforeAll(async () => {
    account_id = (await createProfile()).res.body.profile.id;
});

afterAll(() => {
    db.prepare(`DELETE FROM business_hours WHERE account_id=?`).run(account_id);
    db.prepare(`DELETE FROM profiles WHERE id=?`).run(account_id);
    if (db.close) {
        db.close();
    }
});

const putWeek = (id, business_hours) =>
    request(app).put(`/hours/${id}`).send({ business_hours });

describe('PUT /hours/:account_id/:day_of_week', () => {

    it('replaces a single day without touching the rest of the week', async () => {
        const before = (await fetchHours(account_id)).body.hours;

        const res = await putHours(account_id, 2, [
            { open_time: '11:00', close_time: '15:00' },
        ]);
        expect(res.status).toBe(200);
        expect(res.body.day_of_week).toEqual(2);

        const after = (await fetchHours(account_id)).body.hours;
        expect(after[2]).toEqual([{ open: '11:00', close: '15:00' }]);
        // Days 1 and 3 are untouched.
        expect(after[1]).toEqual(before[1]);
        expect(after[3]).toEqual(before[3]);
    });

    it('stores multiple intervals for one day', async () => {
        const res = await putHours(account_id, 4, [
            { open_time: '09:00', close_time: '12:00' },
            { open_time: '13:00', close_time: '17:00' },
        ]);
        expect(res.status).toBe(200);

        const hours = (await fetchHours(account_id)).body.hours;
        expect(hours[4]).toEqual([
            { open: '09:00', close: '12:00' },
            { open: '13:00', close: '17:00' },
        ]);
    });

    it('clears a day when given an empty array', async () => {
        const res = await putHours(account_id, 5, []);
        expect(res.status).toBe(200);

        const hours = (await fetchHours(account_id)).body.hours;
        expect(hours[5]).toEqual([]);
    });

    it('returns 400 when business_hours is not an array', async () => {
        const res = await putHours(account_id, 3, { open_time: '09:00' });
        expect(res.status).toBe(400);
    });

    it('returns 404 for an unknown account', async () => {
        const res = await putHours('no-such-account', 3, [
            { open_time: '09:00', close_time: '17:00' },
        ]);
        expect(res.status).toBe(404);
    });

});

describe('PUT /hours/:account_id', () => {

    it('replaces the whole week', async () => {
        const res = await putWeek(account_id, [
            { day_of_week: 1, open_time: '08:00', close_time: '16:00' },
            { day_of_week: 6, open_time: '10:00', close_time: '13:00' },
        ]);
        expect(res.status).toBe(200);

        const hours = (await fetchHours(account_id)).body.hours;
        expect(hours[1]).toEqual([{ open: '08:00', close: '16:00' }]);
        expect(hours[6]).toEqual([{ open: '10:00', close: '13:00' }]);
        // Everything not in the payload is now closed.
        for (const day of [2, 3, 4, 5, 7]) {
            expect(hours[day]).toEqual([]);
        }
    });

    it('returns 400 when business_hours is not an array', async () => {
        const res = await putWeek(account_id, 'not-an-array');
        expect(res.status).toBe(400);
    });

    it('returns 404 for an unknown account', async () => {
        const res = await putWeek('no-such-account', []);
        expect(res.status).toBe(404);
    });

});
