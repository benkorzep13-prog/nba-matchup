#!/bin/sh
set -e
cd /workspace
if [ ! -f /tmp/snapshot-loop.pid ] || ! kill -0 "$(cat /tmp/snapshot-loop.pid)" 2>/dev/null; then
  sh /workspace/scripts/snapshot-loop.sh >/tmp/snapshot-loop.log 2>&1 &
  echo $! > /tmp/snapshot-loop.pid
fi
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >/tmp/dev-server.log 2>&1 &
i=0
while [ "$i" -lt 30 ]; do
  if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
    exit 0
  fi
  i=$((i + 1))
  sleep 1
done
exit 1
