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

})

export default profileRouter;