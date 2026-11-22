import { createServerFn } from "@tanstack/react-start";

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export const readLatestSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const file = path.join(process.cwd(), "public/data/latest.json");
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw) as Json;
});

type LiveRow = {
  id: string;
  status?: string;
  clock?: string;
  home?: number;
  away?: number;
};

/** Same-origin live scores. The preview browser blocks ESPN even when curl sees ACAO *. */
export const liveScoreboard = createServerFn({ method: "GET" })
  .validator((input: { date?: string } | undefined) => ({
    date: String(input?.date || "").replace(/[^\d]/g, "").slice(0, 8),
  }))
  .handler(async ({ data }): Promise<{ ok: boolean; status: string; events: LiveRow[] }> => {
    if (!data.date) return { ok: false, status: "no date", events: [] };
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${data.date}`;
    try {
      const res = await fetch(url, {
        headers: { "user-agent": CHROME_UA, accept: "application/json" },
      });
      if (!res.ok) return { ok: false, status: `ESPN ${res.status}`, events: [] };
      const body = (await res.json()) as {
        events?: Array<{
          id: string;
          competitions?: Array<{
            status?: { type?: { name?: string; shortDetail?: string } };
            competitors?: Array<{ homeAway?: string; score?: string }>;
          }>;
        }>;
      };
      const events: LiveRow[] = [];
      for (const event of body.events || []) {
        const comp = event.competitions?.[0];
        const home = comp?.competitors?.find((t) => t.homeAway === "home");
        const away = comp?.competitors?.find((t) => t.homeAway === "away");
        events.push({
          id: event.id,
          status: comp?.status?.type?.name,
          clock: comp?.status?.type?.shortDetail,
          home: home?.score != null ? Number(home.score) : undefined,
          away: away?.score != null ? Number(away.score) : undefined,
        });
      }
      return { ok: true, status: "ESPN scores via same origin", events };
    } catch (err) {
      return { ok: false, status: err instanceof Error ? err.message : "ESPN fetch failed", events: [] };
    }
  });
