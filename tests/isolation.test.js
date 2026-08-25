import db from '../base/database.js';
import { bookEventByTime, createProfile, DeleteEvent, fetchEventById } from '../commons/helper.js';

// The existing suites only ever have one event in play, so anything that leaks
// across events goes unnoticed. These use two.
let account_a;

beforeAll(async () => {
    account_a = (await createProfile()).res.body.profile.id;
});

afterAll(() => {
    db.prepare(`DELETE FROM event_audit WHERE account_id=?`).run(account_a);
    db.prepare(`DELETE FROM events WHERE account_id=?`).run(account_a);
    db.prepare(`DELETE FROM business_hours WHERE account_id=?`).run(account_a);
    db.prepare(`DELETE FROM profiles WHERE id=?`).run(account_a);
    if (db.close) {
        db.close();
    }
});

describe('Event isolation', () => {

    it('deleting one event does not cancel unrelated events', async () => {
        const first = (await bookEventByTime('2030-01-01T09:00:00Z', '2030-01-01T10:00:00Z', account_a)).response;
        const second = (await bookEventByTime('2030-06-15T09:00:00Z', '2030-06-15T10:00:00Z', account_a)).response;

        const deleted = await DeleteEvent(first.body.event.id);
        expect(deleted.status).toBe(200);

        const survivor = await fetchEventById(second.body.event.id);
        expect(survivor.body.event.status).toEqual('booked');
    });

});
