#!/usr/bin/env bash
# Reproducible load run. Pins the account deterministically (ORDER BY id) so a
# baseline and a follow-up measure the same work -- without it, LIMIT 1 picks
# an arbitrary profile and the two runs are not comparable.
set -euo pipefail
cd "$(dirname "$0")/.."
ACC=$(node -e "console.log(require('better-sqlite3')('eventsdb.sqlite').prepare('SELECT id FROM profiles ORDER BY id LIMIT 1').get().id)")
echo "account: $ACC"
k6 run -e ACCOUNT_ID="$ACC" -e BASE_URL="${BASE_URL:-http://127.0.0.1:3000}" perf/smoke.js
