/**
 * Cloudflare Worker shell. Name in wrangler.toml is nba-matchup.
 * Do not deploy this onto withered-sky-f341 unless that Worker is verified
 * as this project and the account owner approves the replace.
 *
 * Heavy sims stay out of the 10ms CPU budget. This handler fetches the
 * scoreboard and, when KV is bound, stores the raw pull. The full engine
 * snapshot is produced by scripts/refresh-slate.mjs (GitHub Action / sandbox).
 */
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/snapshot.json") {
      let body = null;
      if (env.SNAP) {
        body = await env.SNAP.get("latest");
      }
      return new Response(body || JSON.stringify({ error: "no snapshot in KV yet", label: "priors — backtest pending" }), {
        headers: {
          "content-type": "application/json",
          "cache-control": "max-age=60",
          "access-control-allow-origin": "*",
        },
      });
    }
    if (url.pathname === "/refresh") {
      const expected = env.REFRESH_KEY;
      if (!expected || url.searchParams.get("key") !== expected) {
        return new Response("forbidden", { status: 403 });
      }
      const snap = await pull(env);
      return new Response(JSON.stringify(snap), {
        headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
      });
    }
    return new Response("nba-matchup worker", {
      headers: { "content-type": "text/plain", "access-control-allow-origin": "*" },
    });
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(pull(env));
  },
};

async function pull(env) {
  const res = await fetch(`${ESPN}?dates=${slateDate()}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
  });
  const generatedAt = new Date().toISOString();
  const record = {
    schemaVersion: "1.0.0",
    generatedAt,
    source: { writer: "cloudflare-worker", espnHost: "site.api.espn.com", status: res.status },
    label: "priors — backtest pending",
    rawStatus: res.status,
  };
  if (env.SNAP) {
    await env.SNAP.put("latest", JSON.stringify(record));
    await env.SNAP.put(`latest:${generatedAt.slice(0, 10)}`, JSON.stringify(record));
  }
  return record;
}

function slateDate() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return `${parts.year}${parts.month}${parts.day}`;
}
