import { createServerFn } from "@tanstack/react-start";

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const readLatestSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const file = path.join(process.cwd(), "public/data/latest.json");
  const raw = await readFile(file, "utf8");
  const full = JSON.parse(raw) as {
    generatedAt?: string;
    slateDate?: string;
    label?: string;
    statusLine?: string;
    hypothesisCount?: number;
    factorCount?: number;
    narrative?: { paragraphs?: string[]; source?: string };
    league?: { ppg?: number; source?: string };
    alerts?: Array<{ id: string; kind: string; text: string }>;
    games?: Array<Record<string, unknown>>;
  };
  return {
    generatedAt: full.generatedAt || "",
    slateDate: full.slateDate || "",
    label: full.label || "",
    statusLine: full.statusLine || "",
    hypothesisCount: full.hypothesisCount || 0,
    factorCount: full.factorCount || 0,
    narrative: {
      paragraphs: (full.narrative?.paragraphs || []).slice(0, 6),
      source: full.narrative?.source || "rules",
    },
    league: full.league?.ppg != null ? { ppg: Number(full.league.ppg), source: String(full.league.source || "") } : null,
    alerts: (full.alerts || []).slice(0, 8),
    games: (full.games || []).map((g) => ({
      id: String(g.id || ""),
      awayAbbr: String(g.awayAbbr || ""),
      homeAbbr: String(g.homeAbbr || ""),
      awayName: String(g.awayName || g.awayAbbr || ""),
      homeName: String(g.homeName || g.homeAbbr || ""),
      status: String(g.status || ""),
      clock: g.clock == null ? null : String(g.clock),
      homeScore: typeof g.homeScore === "number" ? g.homeScore : null,
      awayScore: typeof g.awayScore === "number" ? g.awayScore : null,
      verdict: String(g.verdict || ""),
      confidence:
        g.confidence && typeof g.confidence === "object"
          ? {
              grade: String((g.confidence as { grade?: string }).grade || ""),
              score: Number((g.confidence as { score?: number }).score || 0),
              note: String((g.confidence as { note?: string }).note || ""),
            }
          : undefined,
    })),
  };
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
