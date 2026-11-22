#!/bin/sh
# Sandbox writer. Not a production cron. Production schedulers are the Worker and GitHub Actions.
cd /workspace
while true; do
  sleep 1200
  node scripts/refresh-slate.mjs >> /tmp/snapshot-loop.log 2>&1 || true
done
