import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.js';

type Slot = { start: string; end: string };
function gate() {
    let release!: () => void;
    const promise = new Promise<void>(resolve => { release = resolve; });
    return { promise, release };
}
async function shownStarts(page: Page) {
    return page.getByRole('radio').evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value));
}
async function loaded(page: Page) {
    await expect(page.getByText('Loading availability…')).toBeHidden();
    await expect(page.locator('#slot-count')).not.toHaveText('—');
}

test('displayed slots match the API and a late response cannot replace a newer date', async ({ page, demo, request }, testInfo) => {
    const response = await request.get(`${demo.url}/slots`, {
        params: { account_id: demo.accountId, date: demo.weekday, slot_size_minutes: 60 },
    });
    expect(response.ok()).toBeTruthy();
    const slots: Slot[] = (await response.json()).available_slots;
    await page.goto(demo.uiUrl);
    await loaded(page);
    expect(await shownStarts(page)).toEqual(slots.map(slot => slot.start));
    await expect(page.getByText('LOCAL QA DEMO', { exact: false })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('booking-demo-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
        .toBeTruthy();
    await expect(page.getByRole('radio').first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('booking-demo-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 1000 });

    const started = gate();
    const resume = gate();
    const finished = gate();
    await page.route('**/slots?**', async route => {
        if (new URL(route.request().url()).searchParams.get('date') !== demo.weekday) return route.continue();
        const realResponse = await route.fetch();
        started.release();
        await resume.promise;
        try { await route.fulfill({ response: realResponse }); }
        catch { /* The page intentionally aborted this superseded read. */ }
        finally { finished.release(); }
    });
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await started.promise;
    await page.getByLabel('Choose date').fill(demo.closedDay);
    await expect(page.getByText('No availability on this date', { exact: true })).toBeVisible();
    resume.release();
    await finished.promise;
    await expect(page.getByLabel('Choose date')).toHaveValue(demo.closedDay);
    await expect(page.getByRole('radio')).toHaveCount(0);
    await expect(page.locator('#bookings-date')).toContainText('Saturday, 9 April 2033');
});

test('one confirmation removes the slot and persists after reload, even with repeated clicks', async ({ page, demo, request, database }) => {
    await page.goto(demo.uiUrl);
    await loaded(page);
    const target = await page.getByRole('radio').first().inputValue();
    await page.getByRole('radio').first().check();
    await page.getByLabel('Booking title', { exact: true }).fill('Browser booking');
    const pending = gate();
    const resume = gate();
    let posts = 0;
    await page.route('**/events/book', async route => {
        posts++;
        const realResponse = await route.fetch();
        pending.release();
        await resume.promise;
        await route.fulfill({ response: realResponse });
    });
    await page.getByRole('button', { name: 'Confirm booking' }).evaluate((button: HTMLButtonElement) => {
        button.click(); button.click();
    });
    await pending.promise;
    await expect(page.getByRole('button', { name: 'Confirming…' })).toBeDisabled();
    await expect(page.getByLabel('Choose date')).toBeDisabled();
    await expect(page.getByRole('radio').first()).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Cancel booking', exact: true })).toBeDisabled();
    resume.release();
    await expect(page.locator('#notice')).toContainText('Booking confirmed.');
    await expect(page.locator('#notice')).toBeInViewport();
    expect(posts).toBe(1);
    await expect(page.getByRole('radio')).toHaveCount(6);
    expect(await shownStarts(page)).not.toContain(target);
    const saved = database.prepare('SELECT * FROM events WHERE title=?').get('Browser booking') as { status: string; startTime: string; account_id: string };
    expect(saved.status).toBe('booked');
    expect(saved.account_id).toBe(demo.accountId);
    expect(Date.parse(saved.startTime)).toBe(Date.parse(target));
    const apiSlots = await request.get(`${demo.url}/slots`, {
        params: { account_id: demo.accountId, date: demo.weekday, slot_size_minutes: 60 },
    });
    expect((await apiSlots.json()).available_slots.map((slot: Slot) => slot.start)).not.toContain(target);
    await page.reload();
    await loaded(page);
    await expect(page.getByRole('article', { name: 'Browser booking', exact: true })).toBeVisible();
    expect(await shownStarts(page)).not.toContain(target);
});

test('cancellation restores availability while retaining cancelled database and audit records', async ({ page, demo, request, database }) => {
    await page.goto(demo.uiUrl);
    await loaded(page);
    const before = await shownStarts(page);
    const card = page.getByRole('article', { name: 'Synthetic demo booking', exact: true });
    await card.getByRole('button', { name: 'Cancel booking', exact: true }).click();
    await expect(page.locator('#notice')).toContainText('Booking cancelled.');
    await expect(page.getByRole('radio')).toHaveCount(8);
    expect((await shownStarts(page)).filter(start => !before.includes(start))).toHaveLength(1);
    await expect(card).toHaveCount(0);
    expect(database.prepare('SELECT status FROM events WHERE id=?').get(demo.eventId)).toEqual({ status: 'cancelled' });
    expect(database.prepare("SELECT COUNT(*) AS n FROM event_audit WHERE event_id=? AND action='cancelled'").get(demo.eventId)).toEqual({ n: 1 });
    const events = await request.get(`${demo.url}/events`, { params: { account_id: demo.accountId, date: demo.weekday } });
    expect((await events.json()).events.find((event: { id: string }) => event.id === demo.eventId).status).toBe('cancelled');
    await page.reload();
    await loaded(page);
    await expect(page.getByText('No active bookings on this date.', { exact: true })).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(8);
});

test('an occupied slot rejects a stale booking without creating a duplicate or false success', async ({ page, demo, request, database }) => {
    await page.goto(demo.uiUrl);
    await loaded(page);
    const slotResponse = await request.get(`${demo.url}/slots`, {
        params: { account_id: demo.accountId, date: demo.weekday, slot_size_minutes: 60 },
    });
    const target: Slot = (await slotResponse.json()).available_slots[0];
    await page.getByRole('radio').first().check();
    const competitor = await request.post(`${demo.url}/events/book`, {
        data: { account_id: demo.accountId, title: 'Another local client', startTime: target.start, endTime: target.end },
    });
    expect(competitor.status()).toBe(201);
    const rejected = page.waitForResponse(response => response.url().endsWith('/events/book') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Confirm booking' }).click();
    expect((await rejected).status()).toBe(409);
    await expect(page.getByRole('alert')).toContainText('That time was just booked.');
    await expect(page.getByRole('alert')).toBeInViewport();
    await expect(page.locator('#notice')).toBeHidden();
    await expect(page.getByRole('radio')).toHaveCount(6);
    await expect(page.getByRole('button', { name: 'Confirm booking' })).toBeDisabled();
    expect(database.prepare('SELECT COUNT(*) AS n FROM events WHERE account_id=? AND JULIANDAY(startTime)=JULIANDAY(?)')
        .get(demo.accountId, target.start)).toEqual({ n: 1 });
});

test('a closed day clears selection, shows loading and gives a useful empty state', async ({ page, demo, database }) => {
    await page.goto(demo.uiUrl);
    await loaded(page);
    await page.getByRole('radio').first().check();
    await expect(page.getByRole('button', { name: 'Confirm booking' })).toBeEnabled();
    const pending = gate();
    const resume = gate();
    await page.route('**/slots?**', async route => {
        const realResponse = await route.fetch();
        pending.release();
        await resume.promise;
        await route.fulfill({ response: realResponse });
    });
    await page.getByRole('button', { name: 'Closed Saturday', exact: true }).click();
    await pending.promise;
    await expect(page.getByText('Loading availability…', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm booking' })).toBeDisabled();
    await expect(page.getByText('Select an available time above.', { exact: true })).toBeVisible();
    resume.release();
    await expect(page.getByText('No availability on this date', { exact: true })).toBeVisible();
    await expect(page.getByText('This day is closed or fully booked.', { exact: false })).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(0);
    await expect(page.getByText('No active bookings on this date.', { exact: true })).toBeVisible();
    expect(database.prepare('SELECT status FROM events WHERE id=?').get(demo.eventId)).toEqual({ status: 'booked' });
});

test('a controlled API failure shows an error, stores no booking and allows a deliberate retry', async ({ page, demo, database }) => {
    await page.goto(demo.uiUrl);
    await loaded(page);
    const before = await shownStarts(page);
    await page.getByRole('radio').first().check();
    await page.route('**/events/book', route => route.fulfill({
        status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Controlled test failure' }),
    }), { times: 1 });
    await page.getByRole('button', { name: 'Confirm booking' }).click();
    await expect(page.getByRole('alert')).toContainText('Booking could not be confirmed.');
    await expect(page.getByRole('alert')).toBeInViewport();
    await expect(page.locator('#notice')).toBeHidden();
    expect(await shownStarts(page)).toEqual(before);
    expect(database.prepare('SELECT COUNT(*) AS n FROM events').get()).toEqual({ n: 1 });
    await expect(page.getByRole('button', { name: 'Confirm booking' })).toBeDisabled();
    await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: 'Confirm booking' }).click();
    await expect(page.locator('#notice')).toContainText('Booking confirmed.');
    expect(database.prepare('SELECT COUNT(*) AS n FROM events').get()).toEqual({ n: 2 });
});
