import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function disposableWorkspace(prefix) {
    // No caller-supplied cleanup path: only this exact newly created directory
    // is owned by this invocation. Never scan/delete other runs or database files.
    const directory = await mkdtemp(join(tmpdir(), prefix));
    return {
        directory,
        databasePath: join(directory, 'eventsdb.sqlite'),
        cleanup: () => rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }),
    };
}
