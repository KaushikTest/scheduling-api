import { fork } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { disposableWorkspace } from './disposable.js';

export async function startDemo({ port = 0, startupTimeout = 15000 } = {}) {
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error('Demo port must be an integer from 0 to 65535 (0 selects a free port).');
    }
    const workspace = await disposableWorkspace('scheduling-demo-');
    let child;
    let failureOutput = '';
    let exited;
    let stopPromise;
    let startupTimer;
    let killTimer;
    const stop = () => stopPromise ??= (async () => {
        if (child && child.exitCode === null && child.signalCode === null) {
            if (child.connected) child.send({ type: 'stop' }, () => {});
            else child.kill();
            killTimer = setTimeout(() => child.kill(), 3000);
            await exited;
            clearTimeout(killTimer);
        }
        await workspace.cleanup();
    })();
    try {
        child = fork(fileURLToPath(new URL('./demo-server.js', import.meta.url)), [], {
            cwd: workspace.directory,
            execArgv: [],
            env: { ...process.env, NODE_ENV: 'test', SCHEDULING_DB_PATH: workspace.databasePath, DEMO_PORT: String(port) },
            stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        });
        exited = new Promise(resolve => {
            child.once('exit', resolve);
            child.once('error', resolve);
        });
        child.stderr.on('data', chunk => { failureOutput = (failureOutput + chunk).slice(-8000); });
        // Drain stdout even when embedded in a test runner.
        child.stdout.resume();
        const ready = await new Promise((resolve, reject) => {
            startupTimer = setTimeout(() => reject(new Error('Demo startup timed out.')), startupTimeout);
            child.on('message', message => { if (message?.type === 'ready') resolve(message); });
            child.once('error', reject);
            child.once('exit', (code, signal) => reject(new Error(
                `Demo exited before readiness (${code ?? signal}). ${failureOutput}`)));
        });
        clearTimeout(startupTimer);
        // Readiness means the seeded API can answer HTTP, not just a spawned PID.
        const response = await fetch(`${ready.url}/profiles/${ready.accountId}`, { signal: AbortSignal.timeout(3000) });
        const body = await response.json();
        if (!response.ok || body.profile?.timezone !== ready.timezone) throw new Error('Demo readiness check failed.');
        child.once('exit', () => { stop().catch(error => console.error('Demo cleanup failed:', error)); });
        return { ...ready, workspace: workspace.directory, databasePath: workspace.databasePath, stop };
    } catch (error) {
        clearTimeout(startupTimer);
        await stop();
        // Local diagnostic evidence for this invocation, including failed-start cleanup.
        error.workspace = workspace.directory;
        throw error;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    let demo;
    let interrupted = false;
    const stop = async () => {
        interrupted = true;
        if (demo) await demo.stop();
        if (process.connected) process.disconnect();
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    process.on('message', message => { if (message?.type === 'stop') stop(); });
    process.on('disconnect', stop);
    try {
        demo = await startDemo({ port: Number(process.env.PORT ?? 0) });
        if (interrupted) await demo.stop();
        else {
            const { stop: _stop, ...ready } = demo;
            console.log(JSON.stringify(ready));
            if (process.send) process.send(ready);
        }
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
        if (process.connected) process.disconnect();
    }
}
