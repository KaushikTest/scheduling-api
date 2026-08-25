import db from '../base/database.js';
import { bookEventByTime, createProfile, DeleteEvent, fetchEventById } from '../commons/helper.js';

// Regression tests for two bugs the original suite couldn't catch, because it
// only ever had one event and one account in play at a time.
let account_a;
let account_b;

beforeAll(async () => {
    account_a = (await createProfile()).res.body.profile.id;
    account_b = (await createProfile()).res.body.profile.id;
});

afterAll(() => {
    for (const id of [account_a, account_b]) {
        db.prepare(`DELETE FROM event_audit WHERE account_id=?`).run(id);
        db.prepare(`DELETE FROM events WHERE account_id=?`).run(id);
        db.prepare(`DELETE FROM business_hours WHERE account_id=?`).run(id);
        db.prepare(`DELETE FROM profiles WHERE id=?`).run(id);
    }
    if (db.close) {
        db.close();
    }
});

describe('Event isolation', () => {

    // Was: `UPDATE events SET status=?` with no WHERE clause, so deleting any
    // event cancelled every event in the table.
    it('deleting one event does not cancel unrelated events', async () => {
        const first = (await bookEventByTime('2030-01-01T09:00:00Z', '2030-01-01T10:00:00Z', account_a)).response;
        const second = (await bookEventByTime('2030-06-15T09:00:00Z', '2030-06-15T10:00:00Z', account_a)).response;

        const deleted = await DeleteEvent(first.body.event.id);
        expect(deleted.status).toBe(200);

        const survivor = await fetchEventById(second.body.event.id);
        expect(survivor.body.event.status).toEqual('booked');
    });

    // Was: the overlap check had no account_id filter, so one tenant's booking
    // blocked the same slot for every other tenant.
    it('one account booking a slot does not block another account', async () => {
        const first = await bookEventByTime('2031-03-03T09:00:00Z', '2031-03-03T10:00:00Z', account_a);
        expect(first.response.status).toBe(201);

        const second = await bookEventByTime('2031-03-03T09:00:00Z', '2031-03-03T10:00:00Z', account_b);
        expect(second.response.status).toBe(201);
        expect(second.response.body.event.account_id).toEqual(account_b);
    });

    it('still rejects a genuine double-booking within the same account', async () => {
        const first = await bookEventByTime('2032-05-05T09:00:00Z', '2032-05-05T10:00:00Z', account_a);
        expect(first.response.status).toBe(201);

        const second = await bookEventByTime('2032-05-05T09:00:00Z', '2032-05-05T10:00:00Z', account_a);
        expect(second.response.status).toBe(409);
    });

});
