import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startDemo } from '../scripts/demo.js';
import { disposableWorkspace } from '../scripts/disposable.js';

async function json(demo, path, options) {
    const response = await fetch(`${demo.url}${path}`, { ...options, signal: AbortSignal.timeout(3000) });
    return { status: response.status, body: await response.json() };
}
const slots = (demo, date = demo.weekday) => json(demo,
    `/slots?account_id=${demo.accountId}&date=${date}&slot_size_minutes=60`);

test('ready fixture, real booking/cancellation, parallel isolation and clean restart', { timeout: 30000 }, async t => {
    const first = await startDemo();
    t.after(() => first.stop());
    assert.match(first.url, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.ok(existsSync(first.databasePath));
    const ui = await fetch(first.uiUrl);
    assert.equal(ui.status, 200);
    assert.match(ui.headers.get('content-type'), /text\/html/);
    assert.match(await ui.text(), /LOCAL QA DEMO/);
    const config = (await json(first, '/demo/config.json')).body;
    assert.equal(config.accountId, first.accountId);
    assert.equal(config.databasePath, undefined);
    const profile = await json(first, `/profiles/${first.accountId}`);
    assert.equal(profile.body.profile.timezone, 'Asia/Kolkata');
    assert.equal(profile.body.profile.email, 'demo@example.invalid');
    const initial = await slots(first);
    assert.equal(initial.status, 200);
    assert.equal(initial.body.available_slots.length, 7);
    assert.equal(initial.body.time_zone, 'Asia/Kolkata');
    assert.equal((await slots(first, first.closedDay)).body.available_slots.length, 0);
    const events = await json(first, `/events?account_id=${first.accountId}&date=${first.weekday}`);
    assert.equal(events.body.events[0].id, first.eventId);

    const second = await startDemo();
    t.after(() => second.stop());
    assert.notEqual(first.workspace, second.workspace);
    assert.notEqual(first.url, second.url);
    const target = initial.body.available_slots[0];
    const booking = { account_id: first.accountId, title: 'Lifecycle test', startTime: target.start, endTime: target.end };
    const booked = await json(first, '/events/book', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(booking) });
    assert.equal(booked.status, 201);
    assert.equal((await slots(first)).body.available_slots.length, 6);
    assert.deepEqual((await slots(second)).body, initial.body);
    assert.equal((await json(first, `/events/${booked.body.event.id}`, { method: 'DELETE' })).status, 200);
    assert.deepEqual((await slots(first)).body, initial.body);

    await Promise.all([first.stop(), first.stop(), second.stop()]); // stop is idempotent.
    assert.equal(existsSync(first.workspace), false);
    assert.equal(existsSync(second.workspace), false);
    await assert.rejects(fetch(first.url, { signal: AbortSignal.timeout(1000) }));
    const restarted = await startDemo();
    t.after(() => restarted.stop());
    assert.deepEqual((await slots(restarted)).body, initial.body);
    assert.deepEqual((await json(restarted, `/events?account_id=${restarted.accountId}&date=${restarted.weekday}`)).body,
        events.body);
    await restarted.stop();
    assert.equal(existsSync(restarted.workspace), false);
});

test('occupied port fails safely and removes only its own failed workspace', { timeout: 30000 }, async t => {
    const running = await startDemo();
    t.after(() => running.stop());
    await assert.rejects(startDemo({ port: Number(new URL(running.url).port) }), error => {
        assert.match(error.message, /EADDRINUSE/);
        assert.notEqual(error.workspace, running.workspace);
        assert.equal(existsSync(error.workspace), false);
        return true;
    });
    assert.equal((await slots(running)).body.available_slots.length, 7);
    await assert.rejects(startDemo({ port: -1 }), /Demo port/);
});

test('CLI ignores caller database settings, preserves cwd data and cleans up on stop', { timeout: 30000 }, async t => {
    const caller = await disposableWorkspace('scheduling-sentinel-');
    t.after(() => caller.cleanup());
    const sentinel = Buffer.from('Existing database sentinel: must never be opened or overwritten.');
    await writeFile(caller.databasePath, sentinel);
    const child = fork(fileURLToPath(new URL('../scripts/demo.js', import.meta.url)), [], {
        cwd: caller.directory, execArgv: [], silent: true,
        env: { ...process.env, PORT: '0', SCHEDULING_DB_PATH: caller.databasePath, NODE_ENV: 'production' },
    });
    let stderr = '';
    child.stdout.resume();
    child.stderr.on('data', chunk => { stderr += chunk; });
    const exited = new Promise(resolve => child.once('exit', resolve));
    t.after(async () => {
        if (child.exitCode === null) { child.kill(); await exited; }
    });
    const ready = await new Promise((resolve, reject) => {
        child.once('message', resolve);
        child.once('error', reject);
        child.once('exit', code => reject(new Error(`CLI exited ${code}: ${stderr}`)));
    });
    assert.notEqual(ready.databasePath, caller.databasePath);
    assert.equal((await slots(ready)).body.available_slots.length, 7);
    assert.deepEqual(await readFile(caller.databasePath), sentinel);
    child.send({ type: 'stop' });
    assert.equal(await exited, 0);
    assert.equal(existsSync(ready.workspace), false);
    assert.deepEqual(await readFile(caller.databasePath), sentinel);
});
