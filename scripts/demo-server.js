// Only the launcher may start this worker. Importing the application directly
// would otherwise open its ordinary cwd-relative database and auto-start it.
import express from 'express';
import { fileURLToPath } from 'node:url';
if (!process.send || !process.env.SCHEDULING_DB_PATH || process.env.NODE_ENV !== 'test') {
    throw new Error('Start the disposable demo with npm run demo.');
}

let server;
let db;
let stopping = false;
function shutdown() {
    if (stopping) return;
    stopping = true;
    const closeDatabase = () => {
        if (db?.open) db.close();
        process.exit(0);
    };
    if (server) {
        server.close(closeDatabase);
        server.closeAllConnections();
    } else closeDatabase();
}
process.on('message', message => { if (message?.type === 'stop') shutdown(); });
process.on('disconnect', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
    const { default: app } = await import('../base/index.js');
    ({ default: db } = await import('../base/database.js'));
    const { fixture, seedDemo } = await import('./demo-fixture.js');
    seedDemo(db);
    // The ordinary API entry point never mounts this UI or its synthetic config.
    app.get('/demo/config.json', (_req, res) => res.set('Cache-Control', 'no-store').json(fixture));
    app.use('/demo', express.static(fileURLToPath(new URL('../demo/public/', import.meta.url)), {
        etag: false, maxAge: 0, setHeaders: res => res.set('Cache-Control', 'no-store'),
    }));
    server = app.listen(Number(process.env.DEMO_PORT), '127.0.0.1');
    server.once('error', error => { console.error(error.message); process.exit(1); });
    server.once('listening', () => {
        const url = `http://127.0.0.1:${server.address().port}`;
        process.send({ type: 'ready', url, uiUrl: `${url}/demo/`, ...fixture });
    });
} catch (error) {
    console.error(error.stack);
    if (db?.open) db.close();
    process.exit(1);
}
