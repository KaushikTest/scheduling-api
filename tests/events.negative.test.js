import db from '../base/database.js';
import { EVENT_ERROR, ID_ERROR, INVALID_DATE, MISSING_FIELD, TIME_ERROR } from '../commons/constants.js';
import { createProfile, DeleteEvent, getRaw, postRaw, putRaw } from '../commons/helper.js';

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

const VALID_START = '2033-04-04T09:00:00Z';
const VALID_END = '2033-04-04T10:00:00Z';

describe('POST /events/book — validation', () => {

    it.each([
        ['account_id', { title: 'x', startTime: VALID_START, endTime: VALID_END }],
        ['title', { account_id: 'placeholder', startTime: VALID_START, endTime: VALID_END }],
        ['startTime', { account_id: 'placeholder', title: 'x', endTime: VALID_END }],
        ['endTime', { account_id: 'placeholder', title: 'x', startTime: VALID_START }],
    ])('rejects a booking with no %s', async (_field, body) => {
        const payload = { ...body };
        if (payload.account_id === 'placeholder') payload.account_id = account_id;

        const res = await postRaw('/events/book', payload);
        expect(res.status).toBe(400);
        expect(res.body.message).toEqual(MISSING_FIELD);
    });

    it('rejects an unparseable date', async () => {
        const res = await postRaw('/events/book', {
            account_id, title: 'x', startTime: 'not-a-date', endTime: VALID_END,
        });
        expect(res.status).toBe(400);
        expect(res.body.message).toEqual(INVALID_DATE);
    });

    it('rejects an end time before the start time', async () => {
        const res = await postRaw('/events/book', {
            account_id, title: 'x', startTime: VALID_END, endTime: VALID_START,
        });
        expect(res.status).toBe(400);
        expect(res.body.message).toEqual(TIME_ERROR);
    });

    it('rejects a zero-length event', async () => {
        const res = await postRaw('/events/book', {
            account_id, title: 'x', startTime: VALID_START, endTime: VALID_START,
        });
        expect(res.status).toBe(400);
        expect(res.body.message).toEqual(TIME_ERROR);
    });

});

describe('PUT /events/:id — validation', () => {

    it('returns 404 updating an event that does not exist', async () => {
        const res = await putRaw('/events/does-not-exist', {
            title: 'x', startTime: VALID_START, endTime: VALID_END,
        });
        expect(res.status).toBe(404);
        expect(res.body.message).toEqual(EVENT_ERROR);
    });

    it('rejects an update with missing fields', async () => {
        const res = await putRaw('/events/any-id', { title: 'x' });
        expect(res.status).toBe(400);
        expect(res.body.message).toEqual(MISSING_FIELD);
    });

});

describe('POST /events/release — validation', () => {

    it('requires an id', async () => {
        const res = await postRaw('/events/release', {});
        expect(res.status).toBe(400);
        expect(res.body.message).toEqual(ID_ERROR);
    });

    it('returns 404 releasing an event that does not exist', async () => {
        const res = await postRaw('/events/release', { id: 'does-not-exist' });
        expect(res.status).toBe(404);
        expect(res.body.message).toEqual(EVENT_ERROR);
    });

});

describe('DELETE /events/:id — validation', () => {

    it('returns 404 deleting an event that does not exist', async () => {
        const res = await DeleteEvent('does-not-exist');
        expect(res.status).toBe(404);
        expect(res.body.message).toEqual(EVENT_ERROR);
    });

});

describe('GET /events — validation', () => {

    it.each([
        ['both params', {}],
        ['date', { account_id: 'placeholder' }],
        ['account_id', { date: '2033-04-04' }],
    ])('returns 400 when missing %s', async (_case, query) => {
        const params = { ...query };
        if (params.account_id === 'placeholder') params.account_id = account_id;

        const res = await getRaw('/events', params);
        expect(res.status).toBe(400);
    });

});
