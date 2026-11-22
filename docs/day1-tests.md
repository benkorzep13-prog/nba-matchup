# Day-1 tests

Run from this sandbox on 2026-11-22 around 02:35–02:45 UTC. Raw results, not a production Worker or a GitHub-hosted runner.

## T1 — ESPN from Cloudflare

Not run. No Cloudflare API token is available, and `withered-sky-f341` was not queried. Deploy was not attempted.

## T2 — ESPN from GitHub Actions

Workflow run [44978541635](https://github.com/benkorzep13-prog/nba-matchup/actions/runs/44978541635), triggered once, not a cron proof.

- Job `build` / step `write snapshot`: success (ESPN fetch from Actions egress returned a snapshot).
- Job `deploy` / `actions/deploy-pages@v4`: **failure**. `HttpError: Not Found`, status 404, request id `5018:4625B:E4D102:2E141B8:6B025A9F`. Message: GitHub Pages has not been enabled.
- Enabling Pages from this session: `POST /repos/benkorzep13-prog/nba-matchup/pages` with `build_type=workflow` returned **403** `Resource not accessible by integration`.

No pages URL exists. This is not a D1 or D2 pass.


## T3 — wrangler deploy without a connector

Not run. `CLOUDFLARE_API_TOKEN` is unset. `deploy-worker.yml` exits 1 in that case on purpose.

`curl -sS -m 15 -o /dev/null -w "%{http_code}" https://api.cloudflare.com/client/v4/user` → **403** (network reaches the API; unauthenticated).

## T4 — cdn.nba.com with Chrome headers

```
curl --http2 … https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json
HTTP/2 403
content-length: 445
```

From this environment the CDN did not return the scoreboard. It stays off the runtime path. Writer B is allowed to retry later; the live slate uses ESPN only.

## T5 — Worker CPU

Not measured. No `wrangler tail`. The heavy sim runs in Node and in the browser, not in the Worker handler.

## T6 — Injury PDF cadence

Not listed. The official HTML page was not polled on a quarter-hour grid in this session, so the 15-minute claim stays unverified.

## T7 — Keyed APIs

No Odds API, Gemini, or Groq key was added. Limits stay unverified.

## T8 — Netlify credits

No Netlify project was deployed. Credits after 24h are not available.

## T9 — Sandbox network

| Target | Result |
|---|---|
| site.api.espn.com scoreboard, browser UA | 200, 102119 bytes |
| site.api.espn.com scoreboard, `nba-matchup` UA | 403, 449 bytes |
| api.github.com/zen | 200 |
| api.cloudflare.com/client/v4/user | 403 |
| stats.nba.com scoreboardv2 | timeout, 0 bytes after 15s |

The refresh script uses the browser UA after the 403.

## T10 — stats.nba.com

Timed out from this host. Not used at runtime. Not used for backfill.

## T11 — withered-sky-f341

Not listed. No account token. Treated as unverified and left untouched.
