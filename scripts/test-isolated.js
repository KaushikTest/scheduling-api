import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { disposableWorkspace } from './disposable.js';

const workspace = await disposableWorkspace('scheduling-tests-');
try {
    const child = spawn(process.execPath, [
        fileURLToPath(new URL('../node_modules/jest/bin/jest.js', import.meta.url)),
        '--runInBand', ...process.argv.slice(2),
    ], {
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'test', SCHEDULING_DB_PATH: workspace.databasePath },
    });
    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.on(signal, () => child.kill(signal));
    }
    process.exitCode = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', code => resolve(code ?? 1));
    });
} finally {
    await workspace.cleanup();
}
