# Plan

1. Shared engine in `core/` (plain JS) so the app, tests, and the GitHub Action import one implementation.
2. Refresh script pulls ESPN scoreboard + per-game summary (and roster only when the box is empty). Writes `public/data/latest.json`.
3. TanStack UI on port 8080 renders that snapshot, then merges a browser ESPN scoreboard poll.
4. Sandbox writer loop every 20 minutes. Cloudflare cron and GitHub Actions are in-repo but not live until secrets exist.
5. Historical backfill does not finish in this session. The app is labeled `priors — backtest pending`.
6. Do not invent a production pass for D1, D2, or D5.
