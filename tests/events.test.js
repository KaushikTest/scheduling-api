import { EVENT_DELETED, EVENT_ERROR, OVERLAP_ERROR } from '../constants.js';
import db from '../base/database.js';
import { bookEvent, bookEventByTime, DeleteEvent, getEvents, UpdateEvent } from '../commons/helper.js';
import app, { PORT } from '../base/index.js';

let server;

beforeAll(() => {
    server = app.listen(PORT);
})
beforeEach(() => {
    db.prepare(`DELETE FROM events;`).run();
});

afterAll(() => {
    if (db.close) {
        db.close();
    }
    server.close();
});

describe('Events API', () => {
    it('should book a new event successfully', async () => {
        let response = await bookEvent();
        expect(response.status).toBe(201);
        expect(response.body.event).toMatchObject({
            title: 'Meeting 1',
            status: 'booked'
        });

    });

    it('should prevent double-booking of same time slot', async () => {
        let response = await bookEvent();
        let get_res = await getEvents();
        let startTime = get_res.body[0].startTime;
        let endTime = get_res.body[0].endTime;
        let new_response = await bookEventByTime(startTime, endTime);
        expect(new_response.status).toBe(409);
        expect(new_response.body.message).toBe(OVERLAP_ERROR);
    })

    it('should update an event', async () => {
        let book_response = await bookEvent();
        let id = book_response.body.event.id;
        let update_response = await UpdateEvent(id);
        expect(update_response.status).toBe(200);
        expect(update_response.body.event.title).toContain('Updated');
    })

    it('should delete an event', async () => {
        let book_response = await bookEvent();
        let id = book_response.body.event.id;
        let deleted_response = await DeleteEvent(id);
        expect(deleted_response.status).toBe(200);
        expect(deleted_response.body.message).toContain(EVENT_DELETED);
    })

    it('Delete a deleted event', async () => {
        let book_response = await bookEvent();
        let id = book_response.body.event.id;
        let deleted_response = await DeleteEvent(id);
        expect(deleted_response.status).toBe(200);
        expect(deleted_response.body.message).toContain(EVENT_DELETED);
        let delete_again = await DeleteEvent(id);
        expect(delete_again.status).toBe(404);
        expect(delete_again.body.message).toContain(EVENT_ERROR);
    })

});