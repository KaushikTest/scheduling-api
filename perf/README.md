# Load testing

k6 suite for `GET /slots` — the heaviest read path in the API. It runs three
SQLite queries, generates every candidate slot in the business day, and checks
each one against existing events, so it is where the service degrades first.

## Running it

```bash
npm start                 # or: node base/index.js
./perf/run.sh             # pins the account, runs the ramp profile
```

`run.sh` selects the account with `ORDER BY id LIMIT 1` rather than a bare
`LIMIT 1`. SQLite does not guarantee order without it, so two runs would
otherwise hit different profiles and the numbers would not be comparable —
which is exactly the mistake that made the first pair of results unusable.

## Profile

Ramp 1 → 10 → 50 virtual users over 40s. Thresholds fail the run (non-zero
exit) rather than just reporting, so this is usable as a CI gate:

| threshold | budget |
|---|---|
| `http_req_failed` | < 1% |
| `http_req_duration` p95 | < 200ms |

## What it found

The baseline **failed** the p95 budget at 240ms. Two causes, both in the hot path:

**1. Prepared statements were being re-prepared per request.** All three
`db.prepare()` calls sat inside the route handler. `prepare()` is where
better-sqlite3 compiles the SQL — doing it per request throws away the entire
benefit and recompiles three statements on every hit. Hoisted to module scope.

**2. Luxon was doing three times the necessary work per slot.** `generateSlots`
called `.plus()` once for the loop condition, once for the slot end, and once to
advance — computing the same boundary three times. Luxon returns a new immutable
`DateTime` each call, so two thirds of that was waste. Reduced to one.

## Result

Same pinned account, same ramp profile, before and after:

| metric | before | after | change |
|---|---|---|---|
| avg | 115.09 ms | 69.60 ms | **−39.5%** |
| median | 108.26 ms | 66.33 ms | −38.7% |
| p90 | 225.96 ms | 135.54 ms | −40.0% |
| **p95** | **240.49 ms** | **145.34 ms** | **−39.6%** |
| max | 430.66 ms | 303.63 ms | −29.5% |
| throughput | 194.5 req/s | 321.0 req/s | **+65%** |
| p95 threshold | ✗ fail | ✓ pass | |

All 53 existing Jest tests still pass, so the change is a pure optimisation with
no behavioural difference.

## Honest limits

- Single machine, server and load generator on the same host, so absolute
  numbers reflect this box and not production. The **relative** change is the
  meaningful figure.
- The seeded database has 0 events, so the overlap check runs against an empty
  set. With a realistic event load the `isOverlapping` cost would grow as
  O(slots × events) and would likely become the next bottleneck.
- Only `GET /slots` is covered. The remaining 38 un-hoisted `db.prepare()` calls
  across the other routes have the same defect and have not been measured.
