# Scheduling API - Node.js & SQLite

A persistent event scheduling backend built with Express.js and SQLite, covering
events (book/update/delete/block/release with overlap prevention), business hours,
available-slot calculation, multi-tenant profiles, and an event audit trail — all
with proper UTC datetime handling.

Built as much for the **test suite** as for the API: Jest + Supertest integration
tests run against a real SQLite database and a live Express app, exercising the
booking rules end-to-end rather than mocking them.

> **Demo scope:** This API does not authenticate callers. An `account_id` in a
> request selects a tenant; it is not proof that the caller owns that tenant.
> Run it locally for testing and do not expose it to untrusted users without
> authentication, authorization checks, and deployment hardening.

## Tech Stack
Node.js (Express 5)
SQLite (via better-sqlite3) — raw SQL schema, foreign keys, parameterised queries
Luxon (for robust date-time parsing)
Jest + Supertest (integration testing)
Playwright + TypeScript (local booking demo browser tests)
k6 (load testing)
GitHub Actions (CI on every push and PR)

## Getting Started

### Clone the repository:
`git clone https://github.com/KaushikTest/scheduling-api.git`  
`cd scheduling-api`

### Install dependencies:
`npm ci`

Use a supported Node.js LTS release (Node 24 was used to verify the demo). On
Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm.ps1`.

### Disposable booking demo (recommended for demo/test work)

From a clean checkout:

```sh
npm ci
npx playwright install chromium
npm test
npm run test:demo
npm run typecheck:e2e
npm run test:e2e
npm run demo
```

`npm run demo` prints one JSON readiness record containing `url`, `uiUrl`, `accountId`,
`timezone`, `weekday`, `closedDay`, `eventId`, `workspace` and `databasePath`.
Readiness is reported only after the seeded profile responds over HTTP. Open the
printed **`uiUrl`** (`http://127.0.0.1:<port>/demo/`) for the booking page. Choose
a date and an available time, enter a title and confirm. Active bookings have a
Cancel booking action. The default account is synthetic; the demo has no login,
payments or notifications. The UI and its synthetic config are mounted only by
this demo launcher, not by the ordinary API entry point.
The server binds to **127.0.0.1 only**, with a free OS-selected port by default.
An optional `PORT` selects a fixed port (PowerShell: `$env:PORT='3100'`); an
occupied port fails and cleans up instead of connecting to someone else's server.

Every run owns a new directory under the OS temp folder and a fresh SQLite file.
It overrides inherited database settings, never opens your checkout's
`eventsdb.sqlite`, and seeds only synthetic data:

- Account `demo-account` and paired staff `demo-staff`, both in **Asia/Kolkata**.
- Monday-Friday 09:00-17:00 hours; Saturday and Sunday closed.
- Wednesday **2033-04-06**, with `demo-booking` occupying 11:00-12:00 IST
  (05:30-06:30 UTC), leaving seven one-hour slots.
- Saturday **2033-04-09**, a deterministic closed-day example.

For example, append these paths to the printed `url`:

```text
/profiles/demo-account
/slots?account_id=demo-account&date=2033-04-06&slot_size_minutes=60
/slots?account_id=demo-account&date=2033-04-09&slot_size_minutes=60
/events?account_id=demo-account&date=2033-04-06
```

Stop with **Ctrl+C** in the same terminal. Normal shutdown closes the HTTP server
and database before removing that run's owned directory. Restart to reset all
changes. Concurrent runs have separate ports and data. Force-killing the launcher
or a machine crash may leave its temp directory behind; the worker exits when
its parent IPC connection closes. No command scans for or removes other runs.

The Playwright fixtures reuse the same lifecycle directly:

```js
import { startDemo } from './scripts/demo.js';

const demo = await startDemo(); // ignores ambient PORT; pass { port: 3100 } if needed
try {
    // Use demo.url, demo.accountId, demo.weekday and demo.closedDay in tests.
    const response = await fetch(`${demo.url}/profiles/${demo.accountId}`);
    console.log(await response.json());
} finally {
    await demo.stop(); // await this before test teardown finishes; safe to call twice
}
```

The demo supports Asia/Kolkata only: the existing event-list route interprets
dates in that timezone. It does not promise arbitrary timezone support.
There are no database reset/debug HTTP endpoints. This local API still has the
authentication limitations described above.

### Start the server with your ordinary local database:
`node base/index.js`

The server will start at http://localhost:3000.  
The SQLite database file (eventsdb.sqlite) will be automatically created in your project folder.

## Testing

```
npm test
```

The test launcher runs Jest serially against a new temporary SQLite file, then
removes that run's directory on completion (including test failures). It overrides
inherited `SCHEDULING_DB_PATH` settings, so `npm test` does not use your ordinary
database. Jest options still work, for example `npm test -- --coverage`.
Use `npm run test:demo` for the separate Node lifecycle checks: readiness, seeded
weekday/closed-day data, booking/cancellation, concurrent isolation, restart,
port-conflict failure cleanup, CLI shutdown and existing-file preservation.
Run these checks plus the browser checks below before reviewing changes. Direct `npx jest` bypasses the
disposable launcher and uses the ordinary database unless explicitly configured.

### Booking demo browser checks

```sh
npx playwright install chromium
npm run typecheck:e2e
npm run test:e2e
```

The six TypeScript scenarios live in `e2e/`, separate from Jest. Each test starts
its own loopback server and disposable SQLite database; there is no external
base URL, normal app reuse or public database inspection endpoint. Read-only
database assertions use the owned fixture path and close before teardown.

1. Displayed slots match the real API; a delayed response cannot replace a newly
   selected date. Also checks a 390px mobile layout for horizontal overflow.
2. Booking removes the slot and persists across reload. Repeated clicks submit
   once; date, slot and action controls are disabled during the pending write.
3. Cancellation restores the slot and retains cancelled status and audit data.
4. A second real API client occupies a displayed slot; the stale UI receives a
   409 and refreshes without a duplicate or false success.
5. A closed day clears the selected slot, shows loading and useful empty states.
6. One controlled booking API failure shows an error and saves no booking; a
   deliberate retry succeeds. Core lifecycle calls and database checks are real.

The page aborts superseded reads and checks response versions before rendering.
It clears selection on date changes/refresh, serializes writes and never retries
a write automatically. Feedback stays visible while scrolling. A lost write
response can be ambiguous, so errors ask you to check refreshed bookings before
retrying. The page filters cancelled/released rows out of active bookings while
the backend retains those rows for the audit trail.

Playwright keeps traces and screenshots on failure under `test-results/` and
writes an ignored HTML report to `playwright-report/` (`npx playwright show-report`
to view it). The first scenario also saves desktop/mobile screenshots. CI runs
Jest, lifecycle checks, typechecking and Chromium tests, uploading browser failure
evidence for seven days. CI changes are configured locally; no remote run is
triggered until the changes are pushed.

Runs the Jest + Supertest integration suite (10 suites, 68 tests). The current count
is verified by [the main-branch CI run on 2026-10-26 (UTC)](https://github.com/KaushikTest/scheduling-api/actions/runs/40418827430)
at commit `90db5b7`, including the cancellation regression from
[PR #1](https://github.com/KaushikTest/scheduling-api/pull/1). The previously reported
route coverage was 91% statement / 93% branch; that CI run verifies test counts,
not coverage percentages. These are true integration tests - no mocks. Each suite
drives the real Express app via Supertest,
writes to a real SQLite database, asserts on the response, and cleans up its own
rows in `afterAll`. Coverage:

- **Events** — booking, double-booking rejection (409 on overlap), update, delete,
  and deleting an already-deleted event (404)
- **Events (negative paths)** — every validation branch: missing fields, unparseable
  dates, end-before-start, zero-length events, and 404s on unknown ids
- **Profiles** — creation (which also seeds default business hours) and retrieval
- **Business hours (read)** — default weekday 09:00–17:00 windows seeded on profile
  creation, and empty weekends
- **Business hours (write)** — single-day and whole-week replacement, split shifts,
  clearing a day, and the Sunday boundary
- **Slots** — slot generation across the working day, slot-size arithmetic, closed
  days, slots disappearing once an event occupies them and returning after
  cancellation, and param validation
- **Audit trail** — created/updated/cancelled entries, and the old-vs-new value
  capture on an update
- **Isolation** — regression tests for the first two bugs below
- **Profiles (negative paths)** — unknown-id updates, partial updates, and the
  staff lookup, including the empty case
- **Block** — BLOCKER creation, overlap rejection, cross-account isolation, a
  blocked slot disappearing from `/slots`, and every validation branch

Test data is generated with `@faker-js/faker` and request payloads are assembled
through small builder classes (`builders/`), keeping the specs readable and the
setup reusable.

CI runs the same suite on every push and pull request.

### Bugs the tests caught

Six bugs surfaced while widening the suite. The first two were invisible to the
original tests because those only ever had a single event and a single account in
play — the bugs only appear once a second one exists. The others were in endpoints
that had no coverage at all:

1. **Delete cancelled every event in the database.** `DELETE /events/:id` ran
   `UPDATE events SET status='cancelled'` with no `WHERE` clause, so removing one
   booking silently cancelled every other booking for every account.
2. **Overlap detection ignored the account.** The overlap query in book/block/update
   had no `account_id` filter, so one tenant's booking made that time slot return
   409 for every other tenant — all accounts effectively shared one calendar.
3. **Both business-hours write endpoints were dead.** `business_hours.type` is
   `NOT NULL`, but neither `PUT` supplied it, so every call failed with
   `NOT NULL constraint failed` and a 500. Profile creation inserted the column
   correctly, which is why the seeded defaults worked and the gap went unnoticed.
4. **Sunday could not be stored.** The schema capped `day_of_week` at
   `BETWEEN 0 AND 6`, but every route groups by Luxon's `weekday`, which is 1–7.
   Day 7 failed the constraint, so Sunday hours were unsettable.

5. **`PUT /profiles/:id` claimed success for profiles that did not exist.** There
   was no existence check, so `UPDATE ... WHERE id=?` matched zero rows and the
   handler still returned `200 PROFILE_UPDATED`. A caller could not distinguish a
   real update from a mistyped id.
6. **A partial profile update returned a 500 with an HTML stack trace.** Every
   column was bound unconditionally, so an omitted field arrived as `undefined`
   and tripped `NOT NULL constraint failed`. The raw `SqliteError` escaped to the
   client complete with the server's filesystem path. Now a `400` with a JSON
   body naming the required fields.

`tests/isolation.test.js` covers the first two, `tests/business_hours.write.test.js`
the next two, and `tests/profiles.negative.test.js` the last two; each fails if the
corresponding fix regresses.

`POST /events/block` also had no coverage. `tests/events.block.test.js` closes
that — it found no bugs, but the endpoint is a near-copy of `/events/book`, which
is exactly the shape of code where a fix applied to one copy silently misses the
other.

## Performance

A k6 ramp (1 → 50 VUs over 40s) against `GET /slots`, the heaviest read path —
three SQLite queries, slot generation across the business day, then an overlap
check per slot. Thresholds fail the run rather than just reporting, so it works
as a CI gate.

The baseline **failed** its 200ms p95 budget and the profiling found two causes:

1. **All three `db.prepare()` calls sat inside the request handler.** `prepare()`
   is where better-sqlite3 compiles the SQL, so every request recompiled three
   statements — throwing away the entire point of a prepared statement.
2. **`generateSlots` called Luxon's `.plus()` three times per slot** — once for
   the loop condition, once for the slot end, once to advance — recomputing the
   same boundary each time, on a type that allocates a new object per call.

| metric | before | after | change |
|---|---|---|---|
| p95 | 240.49 ms | 145.34 ms | **−39.6%** |
| median | 108.26 ms | 66.33 ms | −38.7% |
| throughput | 194.5 req/s | 321.0 req/s | **+65%** |

At the performance optimisation recorded on 2026-10-04 (commit `6e426a4`), all
53 tests in the then-current suite passed unchanged. This is the historical
benchmark context; the current suite has 68 tests across 10 suites (see Testing).

Method, reproduction steps and the honest limits (single host, zero-event seed
data, and the 38 un-hoisted `prepare()` calls still on the other routes) are in
[`perf/README.md`](perf/README.md).

## API Endpoints

Every event belongs to an account, so create a profile first — `POST /profiles/create`
returns the `account_id` the rest of the endpoints expect.

### Health Check
`GET /` → `Scheduling API with SQLite is up and running!`

### Events

#### List events for a day
`GET /events?account_id=<id>&date=<YYYY-MM-DD>`

Both query params are required (400 otherwise). The date is interpreted in
Asia/Kolkata.

```
GET /events?account_id=3f2a...&date=2030-01-01
```
```
{
  "date": "2030-01-01",
  "events": [
    {
      "id": "9c1e...",
      "account_id": "3f2a...",
      "title": "Team Meeting",
      "startTime": "2030-01-01T09:00:00Z",
      "endTime": "2030-01-01T10:00:00Z",
      "type": "EVENT",
      "status": "booked"
    }
  ]
}
```

#### Get one event
`GET /events/:id`

#### Book an event
`POST /events/book` — creates an event, rejecting overlaps within the same account.

```
{
  "account_id": "3f2a...",
  "title": "Team Meeting",
  "startTime": "2030-01-01T09:00:00Z",
  "endTime": "2030-01-01T10:00:00Z"
}
```

`201` with `{ message, event }`. Errors: `400` missing fields / unparseable date /
start not before end, `409` overlaps an existing event for that account.

#### Block time
`POST /events/block` — same body as booking. Creates a `BLOCKER`-type event that
occupies the slot (it is not a state change on an existing event). Returns `201`.

#### Release an event
`POST /events/release` with `{ "id": "<event id>" }` — sets status to `released`,
freeing the slot for rebooking. Errors: `400` no id, `404` unknown id.

#### Update an event
`PUT /events/:id`

```
{
  "title": "Updated Meeting",
  "startTime": "2030-01-01T11:00:00Z",
  "endTime": "2030-01-01T12:00:00Z"
}
```

Returns the updated event with status `updated`. Errors: `400` missing fields /
invalid dates, `404` unknown id, `409` overlaps another event for that account.

#### Delete an event
`DELETE /events/:id` — a soft delete: status becomes `cancelled` and the row is
retained for the audit trail. Returns `{ "message": "Event deleted successfully." }`,
or `404` if the event is unknown or already cancelled.

### Profiles
- `POST /profiles/create` — creates an ACCOUNT profile plus a paired STAFF profile,
  and seeds default business hours (Mon–Fri 09:00–17:00)
- `GET /profiles/:id`
- `GET /profiles/:id/staff` — staff profiles under an account
- `PUT /profiles/:id`

### Business Hours
- `GET /hours/:account_id` — hours grouped by day of week (1 = Monday, 7 = Sunday);
  a closed day is an empty array
- `PUT /hours/:account_id` — replace the whole week
- `PUT /hours/:account_id/:day_of_week` — replace a single day

Both writes take a `business_hours` array and run as a single transaction
(existing rows are deleted, then the new set inserted), so a partial update can't
leave the week half-written. Passing an empty array closes that day. Errors:
`400` if `business_hours` isn't an array, `404` for an unknown account.

```
{
  "business_hours": [
    { "day_of_week": 1, "open_time": "09:00", "close_time": "13:00" },
    { "day_of_week": 1, "open_time": "14:00", "close_time": "18:00" }
  ]
}
```

Multiple intervals per day are supported — that's how split shifts and lunch
breaks are modelled, and `GET /slots` generates around each interval separately.

### Slots
`GET /slots?account_id=<id>&date=<YYYY-MM-DD>&slot_size_minutes=<n>`

Generates bookable slots from the account's business hours for that weekday, minus
any time already occupied by events. Times are returned in the account's timezone.

```
{
  "account_id": "3f2a...",
  "date": "2033-04-06",
  "slot_size_minutes": 60,
  "time_zone": "Asia/Kolkata",
  "available_slots": [
    { "start": "2033-04-06T09:00:00+05:30", "end": "2033-04-06T10:00:00+05:30" }
  ]
}
```

Errors: `400` missing params or a non-numeric/zero/negative slot size, `404`
unknown account. A closed day returns `200` with an empty `available_slots`.

### Audit Trail
`GET /track/events/:event_id/audit` — chronological log of `created` / `updated` /
`cancelled` entries, each with a `details` object holding the old and new values.

## Data & Time Format
Request times must be ISO 8601. They are normalised to UTC on write, and overlap
checking and scheduling logic operate on those UTC timestamps. Slot responses are
rendered back in the account's own timezone.

## Roadmap / Next Features
> Blackout/off-hour blocks  
> Pagination and search  
> Authentication/authorization  
> Hoist the remaining 38 per-request `db.prepare()` calls on the other routes  
> Re-run the load profile with a seeded event volume, to exercise the overlap check  

## License
[MIT](https://github.com/KaushikTest/scheduling-api?tab=MIT-1-ov-file#readme)
