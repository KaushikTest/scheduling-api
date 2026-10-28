export const fixture = Object.freeze({
    accountId: 'demo-account',
    staffId: 'demo-staff',
    timezone: 'Asia/Kolkata',
    weekday: '2033-04-06', // Wednesday; dates intentionally independent of today.
    closedDay: '2033-04-09', // Saturday.
    eventId: 'demo-booking',
});

export function seedDemo(db) {
    db.transaction(() => {
        const timestamp = '2033-01-01T00:00:00.000Z';
        const profile = db.prepare(`INSERT INTO profiles
            (id, merchant_key, company_name, timezone, location, email, phone, type, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        for (const [id, type] of [[fixture.accountId, 'ACCOUNT'], [fixture.staffId, 'STAFF']]) {
            profile.run(id, fixture.accountId, 'Synthetic Booking Demo', fixture.timezone,
                'Demo location', 'demo@example.invalid', '0000000000', type, timestamp, timestamp);
            for (let day = 1; day <= 5; day++) {
                db.prepare(`INSERT INTO business_hours
                    (id, account_id, day_of_week, type, open_time, close_time) VALUES (?, ?, ?, ?, ?, ?)`)
                    .run(`${id}-hours-${day}`, id, day, type, '09:00', '17:00');
            }
        }
        // 11:00-12:00 IST: one occupied hour, seven available hourly slots.
        const event = {
            title: 'Synthetic demo booking',
            startTime: `${fixture.weekday}T05:30:00Z`,
            endTime: `${fixture.weekday}T06:30:00Z`,
        };
        db.prepare(`INSERT INTO events (id, account_id, title, startTime, endTime, type, status)
            VALUES (?, ?, ?, ?, ?, 'EVENT', 'booked')`)
            .run(fixture.eventId, fixture.accountId, event.title, event.startTime, event.endTime);
        db.prepare(`INSERT INTO event_audit
            (id, event_id, account_id, action, timestamp, type, details, performed_by)
            VALUES (?, ?, ?, 'created', ?, 'EVENT', ?, 'demo-seed')`)
            .run('demo-audit', fixture.eventId, fixture.accountId, timestamp,
                JSON.stringify({ old: {}, new: event }));
    })();
}
