import db from '../base/database.js';
import { createProfile, fetchHours } from '../commons/helper.js';


let account_id;

afterAll(() => {
    db.prepare(`DELETE FROM business_hours WHERE account_id=?`).run(account_id);
    db.prepare(`DELETE FROM profiles WHERE id=?`).run(account_id);
    if (db.close) {
        db.close();
    }
});

describe('Business Hours API', () => {

    it('Fetch Business hours', async () => {
        const request_response = await createProfile();
        account_id = request_response.res.body.profile.id;
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