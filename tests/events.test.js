import db from '../base/database.js';
import app, { PORT } from '../base/index.js';
import { EVENT_BOOKED, EVENT_DELETED, EVENT_ERROR, EVENT_UPDATED, OVERLAP_ERROR, TIME_ZONE } from '../commons/constants.js';
import { bookEvent, bookEventByTime, convertToUTC, createProfile, DeleteEvent, fetchEventById, getEvents, UpdateEvent, UpdateEventByStartEnd, UTCToLocal } from '../commons/helper.js';

let server;
let account_id;
let event_id;

beforeAll(async () => {
    server = app.listen(PORT);
    const request_response = await createProfile();
    account_id = request_response.res.body.profile.id;
})

afterAll(() => {
    db.prepare(`DELETE FROM business_hours WHERE account_id=?`).run(account_id);
    db.prepare(`DELETE FROM events WHERE account_id=?`).run(account_id);
    db.prepare(`DELETE FROM profiles WHERE id=?`).run(account_id);
    if (db.close) {
        db.close();
    }
    server.close();
});

describe('Events API', () => {
    it('should book a new event successfully', async () => {
        let req_resp = await bookEvent(account_id);
        const event_response = req_resp.response.body.event;
        const request_body = req_resp.request_body;
        event_id = event_response.id;
        expect(req_resp.response.status).toBe(201);
        expect(req_resp.response.body.message).toEqual(EVENT_BOOKED);
        expect(event_response.id).toBeDefined();
        expect(event_response.account_id).toEqual(request_body.account_id);
        expect(event_response.title).toEqual(request_body.title);
        expect(event_response.startTime).toEqual(convertToUTC(request_body.startTime));
        expect(event_response.endTime).toEqual(convertToUTC(request_body.endTime));
        expect(event_response.status).toEqual('booked');

    });

    it('should prevent double-booking of same time slot', async () => {
        let response = await fetchEventById(event_id);
        let start = UTCToLocal(response.body.event.startTime, TIME_ZONE);
        let end = UTCToLocal(response.body.event.endTime, TIME_ZONE);
        response = await bookEventByTime(start, end, account_id);
        expect(response.status).toBe(409);
        expect(response.body.message).toBe(OVERLAP_ERROR);
    })

    it('should update an event', async () => {
        let fetch_response = await fetchEventById(event_id);
        let start = UTCToLocal(fetch_response.body.event.startTime, TIME_ZONE);
        let end = UTCToLocal(fetch_response.body.event.endTime, TIME_ZONE);
        let updated_response = await UpdateEventByStartEnd(start, end, event_id, account_id);
        const updated_event = updated_response.body.event;
        expect(updated_response.status).toBe(200);
        expect(updated_response.body.message).toEqual(EVENT_UPDATED);
        expect(updated_event.id).toEqual(event_id);
        expect(updated_event.account_id).toEqual(fetch_response.body.event.account_id);
        expect(updated_event.title).toBeDefined();
        expect(updated_event.startTime).toEqual(fetch_response.body.event.startTime);
        expect(updated_event.endTime).toEqual(fetch_response.body.event.endTime);
        expect(updated_event.status).toEqual('updated');
    })

    it('should delete an event', async () => {
        let deleted_response = await DeleteEvent(event_id);
        expect(deleted_response.status).toBe(200);
        expect(deleted_response.body.message).toContain(EVENT_DELETED);
    })

    it('Delete a deleted event', async () => {
        let delete_again = await DeleteEvent(event_id);
        expect(delete_again.status).toBe(404);
        expect(delete_again.body.message).toContain(EVENT_ERROR);
    })

});