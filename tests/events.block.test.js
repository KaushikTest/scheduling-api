import request from 'supertest';
import app from '../base/index.js';
import db from '../base/database.js';
import { createProfile, bookEventByTime } from '../commons/helper.js';

// POST /events/block had no coverage at all despite being documented. It is a
// near-copy of /events/book, which is exactly the shape of code that drifts:
// the account-scoping bug fixed in /book had to be fixed here separately.
let account_a;
let account_b;

const DAY = '2033-06-15';
const t = (h) => `${DAY}T${String(h).padStart(2, '0')}:00:00Z`;

beforeAll(async () => {
    account_a = (await createProfile()).res.body.profile.id;
    account_b = (await createProfile()).res.body.profile.id;
});

afterAll(() => {
    for (const acct of [account_a, account_b]) {
        const staff = db.prepare(`SELECT id FROM profiles WHERE merchant_key=?`).all(acct);
        db.prepare(`DELETE FROM event_audit WHERE account_id=?`).run(acct);
        db.prepare(`DELETE FROM events WHERE account_id=?`).run(acct);
        for (const { id } of [...staff, { id: acct }]) {
            db.prepare(`DELETE FROM business_hours WHERE account_id=?`).run(id);
        }
        db.prepare(`DELETE FROM profiles WHERE merchant_key=?`).run(acct);
        db.prepare(`DELETE FROM profiles WHERE id=?`).run(acct);
    }
    if (db.close) db.close();
});

const block = (account_id, start, end, over = {}) =>
    request(app).post('/events/block').send({
        account_id, title: 'Maintenance', startTime: start, endTime: end, ...over,
    });

describe('POST /events/block', () => {

    it('creates a BLOCKER-type event', async () => {
        const res = await block(account_a, t(9), t(10));
        expect(res.status).toBe(201);
        expect(res.body.event.type).toBe('BLOCKER');
        expect(res.body.event.status).toBe('booked');
    });

    it('rejects a block that overlaps an existing event in the same account', async () => {
        await bookEventByTime(t(14), t(15), account_a);
        const res = await block(account_a, t(14), t(15));
        expect(res.status).toBe(409);
    });

    // The same isolation bug that affected /book: the overlap query must be
    // scoped by account, or one tenant's block makes the slot unavailable to
    // every other tenant.
    it('does not block the same time for a different account', async () => {
        const res = await block(account_b, t(9), t(10));
        expect(res.status).toBe(201);
    });

    // Blocks the slot the API itself offers, rather than a hardcoded UTC hour.
    // createProfile() assigns a random timezone via faker and /slots renders in
    // that timezone, so a fixed 11:00Z fell outside business hours whenever the
    // roll went the wrong way -- the test passed alone and failed in a full run.
    it('a block makes that slot disappear from available slots', async () => {
        const url = `/slots?account_id=${account_b}&date=${DAY}&slot_size_minutes=60`;
        const before = await request(app).get(url);
        const slots = before.body.available_slots;
        expect(slots.length).toBeGreaterThan(0);

        const target = slots[0];
        const res = await block(account_b, target.start, target.end);
        expect(res.status).toBe(201);

        const after = await request(app).get(url);
        expect(after.body.available_slots.length).toBe(slots.length - 1);
        expect(after.body.available_slots.some(s => s.start === target.start)).toBe(false);
    });

    it.each([
        ['missing account_id', { account_id: undefined }],
        ['missing title', { title: undefined }],
    ])('rejects %s with 400', async (_label, over) => {
        const res = await block(account_a, t(20), t(21), over);
        expect(res.status).toBe(400);
    });

    it('rejects end before start with 400', async () => {
        const res = await block(account_a, t(18), t(17));
        expect(res.status).toBe(400);
    });

    it('rejects an unparseable date with 400', async () => {
        const res = await block(account_a, 'not-a-date', t(19));
        expect(res.status).toBe(400);
    });
});
