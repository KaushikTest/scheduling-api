# Scheduling API - Node.js & SQLite

A persistent event scheduling backend built with Express.js and SQLite, covering
events (book/update/delete/block/release with overlap prevention), business hours,
available-slot calculation, multi-tenant profiles, and an event audit trail — all
with proper UTC datetime handling.

Built as much for the **test suite** as for the API: Jest + Supertest integration
tests run against a real SQLite database and a live Express app, exercising the
booking rules end-to-end rather than mocking them.

## Tech Stack
Node.js (Express 5)
SQLite (via better-sqlite3) — raw SQL schema, foreign keys, parameterised queries
Luxon (for robust date-time parsing)
Jest + Supertest (integration testing)
GitHub Actions (CI on every push and PR)

## Getting Started

### Clone the repository:
`git clone https://github.com/KaushikTest/scheduling-api.git`  
`cd scheduling-api`

### Install dependencies:
`npm install`

### Start the server:
`node base/index.js`

The server will start at http://localhost:3000.  
The SQLite database file (eventsdb.sqlite) will be automatically created in your project folder.

## Testing

```
npm test
```

Runs the Jest + Supertest integration suite (8 suites, 53 tests). These are true
integration tests — no mocks. Each suite drives the real Express app via Supertest,
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
  days, slots disappearing once an event occupies them, and param validation
- **Audit trail** — created/updated/cancelled entries, and the old-vs-new value
  capture on an update
- **Isolation** — regression tests for the first two bugs below

Test data is generated with `@faker-js/faker` and request payloads are assembled
through small builder classes (`builders/`), keeping the specs readable and the
setup reusable.

CI runs the same suite on every push and pull request.

### Bugs the tests caught

Four bugs surfaced while widening the suite. The first two were invisible to the
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

`tests/isolation.test.js` covers the first two and `tests/business_hours.write.test.js`
the rest; each fails if the corresponding fix regresses.

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
> Negative-path test coverage for profiles  
> Load testing with k6  

## License
[MIT](https://github.com/KaushikTest/scheduling-api?tab=MIT-1-ov-file#readme)
