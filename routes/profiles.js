import express, { json } from 'express';
import db from '../base/database.js';
import { DateTime } from 'luxon';
import { MISSING_FIELD, PROFILE_CREATED, PROFILE_FETCHED, PROFILE_NOT_FOUND } from '../commons/constants.js';

const profileRouter = express.Router();


profileRouter.post('/create', (req, res) => {
    const { company_name, timezone, location, email, phone, created_at, updated_at } = req.body;

    const profile_id = crypto.randomUUID();
    const profile_staff_id = crypto.randomUUID();
    const now = new Date().toISOString();
    const insert = db.prepare(`INSERT INTO profiles
    (id,merchant_key,company_name,timezone,location,email,phone,type,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`)
    insert.run(profile_id, profile_id, company_name, timezone, location, email, phone, 'ACCOUNT', created_at || now, updated_at || now);
    insert.run(profile_staff_id, profile_id, company_name, timezone, location, email, phone, 'STAFF', created_at || now, updated_at || now);

    const defaultHours = [{ day_of_week: 1, open_time: "09:00", close_time: "17:00" },
    { day_of_week: 2, open_time: "09:00", close_time: "17:00" },
    { day_of_week: 3, open_time: "09:00", close_time: "17:00" },
    { day_of_week: 4, open_time: "09:00", close_time: "17:00" },
    { day_of_week: 5, open_time: "09:00", close_time: "17:00" }
    ];

    for (const day of defaultHours) {
        const business_hour_id = crypto.randomUUID();
        const business_hour_staffId = crypto.randomUUID();
        db.prepare(`INSERT INTO business_hours(id,account_id,day_of_week,type,open_time,close_time) VALUES (?,?,?,?,?,?)`).run(business_hour_id, profile_id, day.day_of_week, 'ACCOUNT', day.open_time, day.close_time);
        db.prepare(`INSERT INTO business_hours(id,account_id,day_of_week,type,open_time,close_time) VALUES (?,?,?,?,?,?)`).run(business_hour_staffId, profile_staff_id, day.day_of_week, 'STAFF', day.open_time, day.close_time);
    }
    const profile = db.prepare(`SELECT * FROM profiles
        WHERE id=?`).get(profile_id);

    return res.status(201).json({ message: PROFILE_CREATED, profile });

});

profileRouter.get('/:id', (req, res) => {
    const { id } = req.params;
    const profile = db.prepare(`SELECT * FROM profiles WHERE id=?`).get(id);
    return res.status(200).json({ message: PROFILE_FETCHED, profile });
});

profileRouter.get('/:id/staff', (req, res) => {
    const { id } = req.params;
    const profile = db.prepare(`SELECT * FROM profiles WHERE merchant_key=? AND type=? `).all(id, 'STAFF');
    return res.status(200).json({ message: PROFILE_FETCHED, profile })

})

profileRouter.put('/:id', (req, res) => {
    const { id } = req.params;
    const now = new Date().toISOString();
    const { company_name, timezone, location, email, phone, updated_at } = req.body;

    // Existence first. Without it the UPDATE matched zero rows and the handler
    // still answered 200 PROFILE_UPDATED, so a caller could not tell a real
    // update from a mistyped id.
    const existing = db.prepare(`SELECT id FROM profiles WHERE id=?`).get(id);
    if (!existing) {
        return res.status(404).json({ message: PROFILE_NOT_FOUND });
    }

    // Every column is bound unconditionally, so an omitted field arrived as
    // undefined and tripped a NOT NULL constraint -- which escaped as a 500
    // carrying an HTML stack trace and the server's filesystem path. This is a
    // full replace, so say so with a 400 rather than leaking the error.
    const missing = { company_name, timezone, location, email, phone };
    if (Object.values(missing).some(v => v === undefined || v === null)) {
        return res.status(400).json({
            message: MISSING_FIELD,
            required: Object.keys(missing),
        });
    }

    db.prepare(`UPDATE profiles SET company_name=?,timezone=?,location=?,email=?,phone=?,updated_at=? WHERE id=?`).run(company_name, timezone, location, email, phone, updated_at || now, id)
    const updated_profile = db.prepare(`SELECT * FROM profiles WHERE id=?`).get(id);
    res.json({ message: 'PROFILE_UPDATED', updated_profile })
})

export default profileRouter;