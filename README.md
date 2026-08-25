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

Runs the Jest + Supertest integration suite (3 suites, 9 tests). These are true
integration tests — no mocks. Each suite drives the real Express app via Supertest,
writes to a real SQLite database, asserts on the response, and cleans up its own
rows in `afterAll`. Coverage includes:

- **Events** — booking, double-booking rejection (409 on overlap), update, delete,
  and deleting an already-deleted event (404)
- **Profiles** — creation (which also seeds default business hours) and retrieval
- **Business hours** — default weekday 09:00–17:00 windows seeded on profile
  creation, and empty weekends

Test data is generated with `@faker-js/faker` and request payloads are assembled
through small builder classes (`builders/`), keeping the specs readable and the
setup reusable.

CI runs the same suite on every push and pull request.

## API Endpoints
### Health Check
`GET /`
Returns:
Scheduling API with better-sqlite3 is up and running!

### Get All Events
`GET /events:`
Returns JSON array of all events.

Example Request:
``GET http://localhost:3000/events``   
Example Response:
```[
  {
    "id": 1,
    "title": "Team Meeting",
    "startTime": "2025-08-10T09:00:00Z",
    "endTime": "2025-08-10T10:00:00Z",
    "status": "booked"
  }
]
```
### Book Event
`POST /events/book:`
Creates a new event (with overlap prevention).

Required JSON Body:
```
{
  "title": "Team Meeting",
  "startTime": "2025-08-10T09:00:00Z",
  "endTime": "2025-08-10T10:00:00Z"
}
```
All times must be in UTC, ISO 8601 (YYYY-MM-DDTHH:mm:ssZ).

Success Response:
```
{
  "message": "Event booked successfully.",
  "event": {
    "id": 1,
    "title": "Team Meeting",
    "startTime": "2025-08-10T09:00:00Z",
    "endTime": "2025-08-10T10:00:00Z",
    "status": "booked"
  }
}
```
Error Response (overlap):
```
{
  "message": "Event overlaps with an existing event."
}
```
### Block Event
`POST /events/block`
Blocks a specific event by ID.

Required JSON Body:

```
{ "id": 1 }
```
Success Response:
```
{
  "message": "Event blocked successfully.",
  "event": {
    "id": 1,
    "title": "Team Meeting",
    "startTime": "2025-08-10T09:00:00Z",
    "endTime": "2025-08-10T10:00:00Z",
    "status": "blocked"
  }
}
```
### Release Event
`POST /events/release`
Releases (frees) a blocked event by ID.

Required JSON Body:

```
{ "id": 1 }
```
Success Response:

```
{
  "message": "Event released successfully.",
  "event": {
    "id": 1,
    "title": "Team Meeting",
    "startTime": "2025-08-10T09:00:00Z",
    "endTime": "2025-08-10T10:00:00Z",
    "status": "released"
  }
}
```
### Update Event
`PUT /events/:id`
Updates an existing event. Prevents double booking.

Example:
`PUT http://localhost:3000/events/5`
Required JSON Body:
```
{
  "title": "Updated Meeting",
  "startTime": "2025-08-10T11:00:00Z",
  "endTime": "2025-08-10T12:00:00Z"
}
```
Success Response:

```
{
  "message": "Event updated successfully.",
  "event": {
    "id": 5,
    "title": "Updated Meeting",
    "startTime": "2025-08-10T11:00:00Z",
    "endTime": "2025-08-10T12:00:00Z",
    "status": "booked"
  }
}
```
Error Response (overlap):

```
{ "message": "Event overlaps with an existing event." }
```
### Delete Event
`DELETE /events/:id`
Deletes an event.

Example:

`DELETE http://localhost:3000/events/2`
Success Response:

```
{ "message": "Event deleted successfully." }
```
## Data & Time Format
All date times in API requests and responses must be UTC ISO 8601 format with Z, for example:
"2025-08-10T09:00:00Z"

Overlap checking and scheduling logic are based on these UTC timestamps.

## Other Endpoints

Beyond the events API documented above, the service also exposes:

- `POST /profiles/create`, `GET /profiles/:id`, `GET /profiles/:id/staff`,
  `PUT /profiles/:id` — multi-tenant account and staff profiles
- `GET /hours/:account_id`, `PUT /hours/:account_id`,
  `PUT /hours/:account_id/:day_of_week` — business hours per account
- `GET /slots` — available slot calculation, derived from business hours minus
  booked events
- `GET /track/events/:event_id/audit` — audit log for an event

## Roadmap / Next Features
> Blackout/off-hour blocks  
> Pagination and search  
> Authentication/authorization  
> Negative-path test coverage for profiles and business hours  

## License
[MIT](https://github.com/KaushikTest/scheduling-api?tab=MIT-1-ov-file#readme)
