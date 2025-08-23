import { EVENT_DELETED, EVENT_ERROR, OVERLAP_ERROR } from '../constants.js';
import db from '../base/database.js';
import { bookEvent, bookEventByTime, createProfile, DeleteEvent, fetchHours, fetchProfile, getEvents, UpdateEvent } from '../commons/helper.js';
import app, { PORT } from '../base/index.js';


let server;
let account_id;
beforeAll(() => {
    server = app.listen(PORT);
})

afterAll(() => {
    db.prepare(`DELETE FROM business_hours WHERE account_id=?`).run(account_id);
    db.prepare(`DELETE FROM profiles WHERE id=?`).run(account_id);
    if (db.close) {
        db.close();
    }
    server.close();
});

describe('Business Hours API', () => {

    it('Fetch Business hours', async () => {
        const profile = await createProfile();
        account_id = profile.body.profile.id;
        const business_hours = await fetchHours(account_id);
        expect(business_hours.body.account_id).toEqual(account_id);
        expect(business_hours.body.hours).toBeDefined();

    });

    it('Validate default hours', async () => {
        const business_hours = await fetchHours(account_id);
        const hours = business_hours.body.hours;
        const expectedDays = [1, 2, 3, 4, 5];
        const expectedOpen = '09:00';
        const expectedClose = '17:00';
        expectedDays.forEach(day => {
            expect(hours[day]).toBeDefined();
            expect(hours[day].length).toBeGreaterThan(0);
            hours[day].forEach(interval => {
                expect(interval.open).toBe(expectedOpen);
                expect(interval.close).toBe(expectedClose);
            });
        });
        const weekendDays = [6, 7];
        weekendDays.forEach(day => {
            expect(hours[day]).toHaveLength(0);
        });
    });

});