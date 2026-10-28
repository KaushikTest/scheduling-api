import { test as base, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import { startDemo } from '../scripts/demo.js';

type Demo = {
    url: string;
    uiUrl: string;
    accountId: string;
    weekday: string;
    closedDay: string;
    eventId: string;
    databasePath: string;
    workspace: string;
    stop: () => Promise<void>;
};

export const test = base.extend<{ demo: Demo; database: Database.Database; pageErrors: void }>({
    demo: async ({}, use, testInfo) => {
        const demo = await startDemo() as Demo;
        try {
            await testInfo.attach('isolated-demo', {
                body: JSON.stringify({ url: demo.url, accountId: demo.accountId, weekday: demo.weekday }),
                contentType: 'application/json',
            });
            await use(demo);
        } finally {
            await demo.stop();
        }
    },
    database: async ({ demo }, use) => {
        // Read-only assertions against this test's owned database, never an HTTP debug endpoint.
        const database = new Database(demo.databasePath, { readonly: true, fileMustExist: true });
        try { await use(database); } finally { database.close(); }
    },
    pageErrors: [async ({ page }, use) => {
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        await use();
        expect(errors, 'Uncaught errors in the booking page').toEqual([]);
    }, { auto: true }],
});

export { expect };
