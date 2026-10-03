// Baseline load profile for GET /slots -- the heaviest read path in the API.
// It costs three SQLite queries plus a Luxon DateTime per generated slot, so
// it is the endpoint most likely to fall over first.
import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

const ACCOUNT = __ENV.ACCOUNT_ID;
const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const slotsDuration = new Trend('slots_duration', true);

export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 10 },
        { duration: '20s', target: 50 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    // Deliberately strict so a regression fails CI rather than being noticed later.
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<200'],
  },
};

export default function () {
  const url = `${BASE}/slots?account_id=${ACCOUNT}&date=2026-10-05&slot_size_minutes=15`;
  const res = http.get(url);
  slotsDuration.add(res.timings.duration);
  check(res, {
    'status 200': (r) => r.status === 200,
    'returns slots array': (r) => {
      try { return Array.isArray(r.json('available_slots')); } catch (e) { return false; }
    },
  });
}
