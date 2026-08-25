import express from 'express';
import db from '../base/database.js';

const trackRouter = express.Router();

trackRouter.get('/events/:event_id/audit', (req, res) => {
    const { event_id } = req.params;
    const rows = db.prepare(`
        SELECT id,event_id,action,timestamp,details,type,performed_by FROM event_audit
        WHERE event_id=?
        ORDER BY timestamp ASC`).all(event_id);

    return res.json({
        event_id,
        audit_log: rows.map(row => ({
            action: row.action,
            timestamp: row.timestamp,
            details: row.details ? JSON.parse(row.details) : null,
            type: row.type,
            performed_by: row.performed_by

        }))
    });
});

export default trackRouter; 