import express, { json } from 'express';
import db from '../base/database.js';
import { DateTime } from 'luxon';

const profileRouter = express.Router();


profileRouter.post('/create', (req, res) => {
    const { company_name, timezone, location, email, phone, created_at, updated_at } = req.body;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const insert = db.prepare(`INSERT INTO profiles
    (id,company_name,timezone,location,email,phone,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`)
    insert.run(id, company_name, timezone, location, email, phone, created_at || now, updated_at || now);
    const profile = db.prepare(`SELECT * FROM profiles
        WHERE id=?`).get(id);

    return res.status(201).json({ message: 'PROFILE_CREATED', profile });

});

profileRouter.get('/:id', (req, res) => {
    const { id } = req.params;
    const profile = db.prepare(`SELECT * FROM profiles WHERE id=?`).get(id);
    return res.status(200).json({ message: 'PROFILE_FETCHED', profile });
});

profileRouter.put('/:id', (req, res) => {
    const { id } = req.params;
    const now = new Date().toISOString();
    const { company_name, timezone, location, email, phone, updated_at } = req.body;
    db.prepare(`UPDATE profiles SET company_name=?,timezone=?,location=?,email=?,phone=?,updated_at=? WHERE id=?`).run(company_name, timezone, location, email, phone, updated_at || now, id)
    const updated_profile = db.prepare(`SELECT * FROM profiles WHERE id=?`).get(id);
    res.json({ message: 'PROFILE_UPDATED', updated_profile })
})

export default profileRouter;