# Scheduling API - Node.js & SQLite

A simple, persistent event scheduling backend built with Express.js and SQLite.
Supports creating, listing, updating, deleting, blocking, and releasing events, with overlap prevention and proper UTC datetime handling.

## Tech Stack
Node.js (Express)
SQLite (via better-sqlite3)
Luxon (for robust date-time parsing)
API documentation: Markdown in this README

## Getting Started

### Clone the repository:
`git clone <your-repo-url>`  
`cd <your-project-folder>`

### Install dependencies:
`npm install`

### Start the server:
`node index.js` 

The server will start at http://localhost:3000.  
The SQLite database file (eventsdb.sqlite) will be automatically created in your project folder.

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

## Roadmap / Next Features
> Business hours API (open/close times)  
> Available slot calculation  
> Blackout/off-hour blocks  
> Pagination and search  
> Authentication/authorization  
> Test automation with Jest & Supertest  

## License
[MIT](https://github.com/KaushikTest/scheduling-api?tab=MIT-1-ov-file#readme)
