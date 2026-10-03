import request from 'supertest';
import app from '../base/index.js';
import db from '../base/database.js';
import { createProfile, fetchProfile } from '../commons/helper.js';

// Negative-path coverage for profiles. PUT /profiles/:id and
// GET /profiles/:id/staff were documented in the README but had no tests at
// all, and both write bugs below were sitting in that gap.
let account;

beforeAll(async () => {
    account = (await createProfile()).res.body.profile.id;
});

afterAll(() => {
    // Creating a profile also seeds a paired STAFF profile, and business_hours
    // rows hang off BOTH. Clear every child row before any profile, or the
    // staff delete trips a FOREIGN KEY constraint.
    const staff = db.prepare(`SELECT id FROM profiles WHERE merchant_key=?`).all(account);
    for (const { id } of [...staff, { id: account }]) {
        db.prepare(`DELETE FROM business_hours WHERE account_id=?`).run(id);
    }
    db.prepare(`DELETE FROM profiles WHERE merchant_key=?`).run(account);
    db.prepare(`DELETE FROM profiles WHERE id=?`).run(account);
    if (db.close) db.close();
});

describe('PUT /profiles/:id', () => {

    // Was: no existence check at all. UPDATE ... WHERE id=? matched zero rows
    // and the handler still returned 200 PROFILE_UPDATED, so a caller could not
    // tell a successful update from a typo'd id.
    it('returns 404 for an unknown profile instead of claiming success', async () => {
        const res = await request(app)
            .put('/profiles/this-id-does-not-exist')
            .send({
                company_name: 'Ghost Ltd',
                timezone: 'Asia/Kolkata',
                location: 'nowhere',
                email: 'ghost@example.com',
                phone: '+910000000000',
            });
        expect(res.status).toBe(404);
    });

    // Was: every column was bound unconditionally, so any field the caller
    // omitted went in as undefined and tripped a NOT NULL constraint. The raw
    // SqliteError escaped as a 500 with an HTML stack trace that included the
    // server's filesystem path.
    it('rejects a partial update with 400, not a 500 stack trace', async () => {
        const res = await request(app)
            .put(`/profiles/${account}`)
            .send({ company_name: 'Renamed Only' });
        expect(res.status).toBe(400);
        expect(res.headers['content-type']).toMatch(/json/);
        expect(JSON.stringify(res.body)).not.toMatch(/SqliteError|scheduling-api[\/]/);
    });

    it('leaves the row untouched when a partial update is rejected', async () => {
        const before = (await fetchProfile(account)).body.profile;
        await request(app).put(`/profiles/${account}`).send({ company_name: 'Renamed Only' });
        const after = (await fetchProfile(account)).body.profile;
        expect(after.company_name).toBe(before.company_name);
        expect(after.timezone).toBe(before.timezone);
    });

    it('applies a complete update', async () => {
        const before = (await fetchProfile(account)).body.profile;
        const res = await request(app).put(`/profiles/${account}`).send({
            company_name: 'Updated Ltd',
            timezone: before.timezone,
            location: before.location,
            email: before.email,
            phone: before.phone,
        });
        expect(res.status).toBe(200);
        const after = (await fetchProfile(account)).body.profile;
        expect(after.company_name).toBe('Updated Ltd');
    });
});

describe('GET /profiles/:id/staff', () => {

    it('returns the staff profile seeded alongside the account', async () => {
        const res = await request(app).get(`/profiles/${account}/staff`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.profile)).toBe(true);
        expect(res.body.profile.length).toBeGreaterThan(0);
        expect(res.body.profile.every(p => p.type === 'STAFF')).toBe(true);
    });

    it('returns an empty list for an account with no staff', async () => {
        const res = await request(app).get('/profiles/no-such-account/staff');
        expect(res.status).toBe(200);
        expect(res.body.profile).toEqual([]);
    });
});
