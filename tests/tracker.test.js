import db from '../base/database.js';
import { bookEventByTime, createProfile, DeleteEvent, fetchAudit, UpdateEventByStartEnd } from '../commons/helper.js';

let account_id;

beforeAll(async () => {
    account_id = (await createProfile()).res.body.profile.id;
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

describe('GET /track/events/:event_id/audit', () => {

    it('records a created entry when an event is booked', async () => {
        const booked = await bookEventByTime(
            '2034-02-02T09:00:00Z', '2034-02-02T10:00:00Z', account_id
        );
        const event = booked.response.body.event;

        const audit = await fetchAudit(event.id);
        expect(audit.status).toBe(200);
        expect(audit.body.event_id).toEqual(event.id);
        expect(audit.body.audit_log).toHaveLength(1);

        const entry = audit.body.audit_log[0];
        expect(entry.action).toEqual('created');
        expect(entry.performed_by).toEqual('system');
        expect(entry.type).toEqual('EVENT');
        expect(entry.timestamp).toBeDefined();
        expect(entry.details.new.title).toEqual(event.title);
    });

    it('appends an updated entry capturing the old and new values', async () => {
        const booked = await bookEventByTime(
            '2034-03-03T09:00:00Z', '2034-03-03T10:00:00Z', account_id
        );
        const event = booked.response.body.event;
        const originalTitle = event.title;

        const updated = await UpdateEventByStartEnd(
            '2034-03-03T11:00:00Z', '2034-03-03T12:00:00Z', event.id, account_id
        );
        expect(updated.response.status).toBe(200);

        const audit = await fetchAudit(event.id);
        expect(audit.body.audit_log).toHaveLength(2);

        const entry = audit.body.audit_log.find(e => e.action === 'updated');
        expect(entry).toBeDefined();
        expect(entry.details.old.title).toEqual(originalTitle);
        expect(entry.details.new.title).toEqual(updated.request_body.title);
        expect(entry.details.old.startTime).not.toEqual(entry.details.new.startTime);
    });

    it('appends a cancelled entry when an event is deleted', async () => {
        const booked = await bookEventByTime(
            '2034-04-04T09:00:00Z', '2034-04-04T10:00:00Z', account_id
        );
        const event = booked.response.body.event;

        await DeleteEvent(event.id);

        const audit = await fetchAudit(event.id);
        const actions = audit.body.audit_log.map(e => e.action);
        expect(actions).toContain('created');
        expect(actions).toContain('cancelled');
    });

    it('returns an empty log for an event with no audit history', async () => {
        const audit = await fetchAudit('no-such-event');
        expect(audit.status).toBe(200);
        expect(audit.body.audit_log).toEqual([]);
    });

});
