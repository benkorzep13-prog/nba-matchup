# Progress checklist

- [x] PDF read through page 44
- [x] Verification note (marker missing)
- [ ] user-intent.md, plan.md, method.md
- [ ] Engine §0–14 as code + unit tests
- [ ] 145 factors + ≥200 hypotheses
- [ ] One real slate end to end (ESPN 2026-11-21)
- [ ] Per-game modules and 4+4 paragraphs
- [ ] PWA UI on :8080
- [ ] Client fallbacks: ESPN, snapshot race, IndexedDB, service worker
- [ ] 20-minute writer loop (sandbox). Production cron pending credentials
- [ ] Worker + Actions + Pages files. Do not deploy onto withered-sky-f341
- [ ] Day-1 probes written to docs/day1-tests.md
- [ ] Connectors actually called (failures recorded)
- [ ] Subagent definitions + runs
- [ ] 3x table
- [ ] sources.csv (≥250 only if actually retrieved)
- [ ] build, typecheck, browser smoke

## Acceptance honesty

D1 public workers.dev: pending Cloudflare token. Do not claim the preview URL is the workers.dev URL.
D2 three unattended production snapshots: pending until a real cron writes three `generatedAt` values ~20 min apart.
D5 full chain: implement and test locally; GitHub Pages / Netlify URLs pending deploy.
