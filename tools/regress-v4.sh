#!/bin/bash
# Runs every E2E one by one with a fresh server (the 1 GB sandbox swaps otherwise). Appends to evidence/v4-regression.txt.
cd /home/user/webapp; out=evidence/v4-regression.txt; : > "$out.tmp"
for t in ${@:-finance fisico gym v4voice hud drafts memory map login v31 workspace kisha life}; do
  fuser -k 3000/tcp >/dev/null 2>&1; pm2 delete all >/dev/null 2>&1; pm2 start ecosystem.config.cjs >/dev/null 2>&1
  for i in $(seq 1 30); do curl -s -o /dev/null localhost:3000/ && break; sleep 1; done
  timeout 200 node tools/e2e-$t.mjs > /tmp/e2e-$t.log 2>&1; code=$?
  last=$(grep -v '^\s*at ' /tmp/e2e-$t.log | grep -v '^$' | tail -1 | cut -c1-160)
  echo "$t | exit=$code | $last" | tee -a "$out.tmp"
done
mv "$out.tmp" "$out"
