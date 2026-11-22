import { analyzeGame, slateDateET } from "./model.mjs";
import { slateParagraphs, gameParagraphs } from "./narrative.mjs";
import { HYPOTHESES, STATUS_LINE, FACTOR_CATALOGUE } from "./registry.mjs";

export { slateDateET, STATUS_LINE };

function alertId(parts) {
  return parts.join("|");
}

export function buildAlerts(games, previous, generatedAt) {
  const alerts = [];
  const prevById = new Map((previous?.games || []).map((g) => [g.id, g]));
  for (const g of games) {
    const label = `${g.awayAbbr} @ ${g.homeAbbr}`;
    const prev = prevById.get(g.id);
    if (prev?.market?.homeSpread != null && g.market?.homeSpread != null) {
      const d = g.market.homeSpread - prev.market.homeSpread;
      if (Math.abs(d) >= 2) {
        alerts.push({
          id: alertId([g.id, "spread", d]),
          gameId: g.id,
          kind: "spread",
          text: `${label} home spread moved ${d > 0 ? "+" : ""}${d.toFixed(1)} (threshold ±2).`,
        });
      }
    }
    if (prev?.market?.total != null && g.market?.total != null) {
      const d = g.market.total - prev.market.total;
      if (Math.abs(d) >= 3) {
        alerts.push({
          id: alertId([g.id, "total", d]),
          gameId: g.id,
          kind: "total",
          text: `${label} total moved ${d > 0 ? "+" : ""}${d.toFixed(1)} (threshold ±3).`,
        });
      }
    }
    if (prev?.market?.noVigHome != null && g.market?.noVigHome != null) {
      const d = (g.market.noVigHome - prev.market.noVigHome) * 100;
      if (Math.abs(d) >= 5) {
        alerts.push({
          id: alertId([g.id, "ml", d.toFixed(2)]),
          gameId: g.id,
          kind: "moneyline",
          text: `${label} no-vig home win moved ${d.toFixed(1)} percentage points (threshold ±5).`,
        });
      }
    }
    for (const inj of g.injuries || []) {
      const st = String(inj.status || "").toLowerCase();
      if (["questionable", "doubtful", "day-to-day", "dtd", "gtd"].includes(st)) {
        alerts.push({
          id: alertId([g.id, "tag", inj.name, st]),
          gameId: g.id,
          kind: "status",
          text: `${inj.name} (${inj.team}) is ${inj.status}.`,
        });
      }
    }
    if (g.lockMinutes != null && g.lockMinutes <= 60 && g.lockMinutes > 0 && g.status === "STATUS_SCHEDULED") {
      alerts.push({
        id: alertId([g.id, "lock"]),
        gameId: g.id,
        kind: "lock",
        text: `${label} locks in ${g.lockMinutes} minutes.`,
      });
    }
  }
  return alerts;
}

export function buildChanges(games, previous) {
  if (!previous) return [];
  const prevById = new Map((previous.games || []).map((g) => [g.id, g]));
  const changes = [];
  for (const g of games) {
    const prev = prevById.get(g.id);
    if (!prev) {
      changes.push({ game: `${g.awayAbbr}@${g.homeAbbr}`, field: "added", from: null, to: g.id, reason: "new event on the scoreboard" });
      continue;
    }
    const fields = [
      ["headline.wp", prev.headline?.wp, g.headline?.wp, "blend recomputed"],
      ["headline.total", prev.headline?.total, g.headline?.total, "total blend recomputed"],
      ["market.homeSpread", prev.market?.homeSpread, g.market?.homeSpread, "ESPN current spread"],
      ["status", prev.status, g.status, "scoreboard status"],
    ];
    for (const [field, from, to, reason] of fields) {
      if (from !== to && !(from == null && to == null)) {
        changes.push({
          game: `${g.awayAbbr}@${g.homeAbbr}`,
          field,
          from,
          to,
          reason,
        });
      }
    }
  }
  return changes;
}

export function analyzeSlate(input, previous = null) {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const ppgs = [];
  for (const g of input.games || []) {
    if (g.home?.ppg) ppgs.push(g.home.ppg);
    if (g.away?.ppg) ppgs.push(g.away.ppg);
  }
  const league = {
    ppg: ppgs.length ? ppgs.reduce((a, b) => a + b, 0) / ppgs.length : 114.5,
    source: ppgs.length ? "mean of team season points on this slate" : "prior 114.5",
  };
  const games = (input.games || []).map((raw) => {
    const g = analyzeGame(raw, league, { generatedAt, staleMin: input.staleMin ?? 0 });
    g.homeAbbr = raw.home.abbr;
    g.awayAbbr = raw.away.abbr;
    g.homeName = raw.home.name;
    g.awayName = raw.away.name;
    g.paragraphs = gameParagraphs(g);
    g.verdict = verdictLine(g);
    return g;
  });
  const changes = buildChanges(games, previous);
  const alerts = buildAlerts(games, previous, generatedAt);
  const snapshot = {
    schemaVersion: "1.0.0",
    generatedAt,
    label: "priors — backtest pending",
    statusLine: STATUS_LINE,
    slateDate: input.slateDate,
    source: input.source || { writer: "local", espnHost: "site.api.espn.com", status: null },
    league,
    lambda: 0.1,
    hypothesisCount: HYPOTHESES.length,
    factorCount: FACTOR_CATALOGUE.length,
    previousGeneratedAt: previous?.generatedAt || null,
    games,
    changes,
    alerts,
    narrative: { source: "rules", paragraphs: [], text: "" },
    discovery: {
      newThisRefresh: changes.slice(0, 8).map((c) => `${c.game} ${c.field}: ${c.from} → ${c.to}`),
      note: "Discovery loop ran availability, scenarios, minutes, and the market blend. No hypothesis was promoted. Promotion requires the weekly FDR pass.",
    },
  };
  snapshot.narrative.paragraphs = slateParagraphs(snapshot);
  snapshot.narrative.text = snapshot.narrative.paragraphs.join("\n\n");
  return snapshot;
}

function verdictLine(g) {
  const side = g.headline.wp >= 0.5 ? g.homeAbbr : g.awayAbbr;
  const p = g.headline.wp >= 0.5 ? g.headline.wp : 1 - g.headline.wp;
  const spread = g.market?.homeSpread;
  const spreadTxt =
    spread == null ? "no spread" : `home ${spread > 0 ? "+" : ""}${spread}`;
  return `${side} ${Math.round(p * 100)}% headline · ${spreadTxt} · total ${g.headline.total} · grade ${g.confidence.grade}`;
}

export { HYPOTHESES, FACTOR_CATALOGUE };
