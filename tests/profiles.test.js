import db from '../base/database.js';
import app, { PORT } from '../base/index.js';
import { PROFILE_CREATED, PROFILE_FETCHED } from '../commons/constants.js';
import { createProfile, fetchProfile } from '../commons/helper.js';


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

describe('Profile API', () => {

    it('Create Profile', async () => {
        const request_response = await createProfile();
        const profile_request = request_response.request_body;
        const profile_response = request_response.res;
        account_id = profile_response.body.profile.id;
        expect(profile_response.status).toEqual(201);
        expect(profile_response.body.message).toEqual(PROFILE_CREATED);
        expect(profile_response.body.profile.id).toBeDefined();
        expect(profile_response.body.profile.company_name).toEqual(profile_request.company_name);
        expect(profile_response.body.profile.timezone).toEqual(profile_request.timezone);
        expect(profile_response.body.profile.location).toEqual(profile_request.location);
        expect(profile_response.body.profile.email).toEqual(profile_request.email);
        expect(profile_response.body.profile.phone).toEqual(profile_request.phone);
        expect(profile_response.body.profile.created_at).toBeDefined();
        expect(profile_response.body.profile.updated_at).toBeDefined();
    });

    it('Fetch Profile', async () => {
        const response = await fetchProfile(account_id);
        expect(response.body.message).toEqual(PROFILE_FETCHED);
        expect(response.body.profile.id).toEqual(account_id);
        expect(response.body.profile.company_name).toBeDefined();
        expect(response.body.profile.timezone).toBeDefined();
        expect(response.body.profile.location).toBeDefined();
        expect(response.body.profile.email).toBeDefined();
        expect(response.body.profile.phone).toBeDefined();
        expect(response.body.profile.created_at).toBeDefined();
        expect(response.body.profile.updated_at).toBeDefined();
    });

});