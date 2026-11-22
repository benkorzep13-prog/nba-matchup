/**
 * Writer used by the sandbox loop and by GitHub Actions.
 * ESPN only. No Grok, Claude, or connector calls.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { analyzeSlate, slateDateET } from "../core/engine.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

async function getJson(url) {
  const started = Date.now();
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Origin: "https://example.com", Accept: "application/json" },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  let json = null;
  try {
    json = JSON.parse(buf.toString("utf8"));
  } catch {
    json = null;
  }
  return {
    url,
    status: res.status,
    bytes: buf.length,
    ms: Date.now() - started,
    acao: res.headers.get("access-control-allow-origin"),
    json,
  };
}

function ymd(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function addDays(yyyymmdd, n) {
  const y = Number(yyyymmdd.slice(0, 4));
  const m = Number(yyyymmdd.slice(4, 6));
  const d = Number(yyyymmdd.slice(6, 8));
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return ymd(dt);
}

function num(x) {
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
}

function parseScoreboardEvent(event) {
  const comp = event.competitions?.[0] || {};
  const home = (comp.competitors || []).find((t) => t.homeAway === "home");
  const away = (comp.competitors || []).find((t) => t.homeAway === "away");
  const odds = comp.odds?.[0] || {};
  return {
    id: event.id,
    date: event.date,
    status: comp.status?.type?.name || event.status?.type?.name,
    clock: comp.status?.type?.shortDetail || null,
    completed: Boolean(comp.status?.type?.completed),
    venue: comp.venue?.fullName || null,
    city: comp.venue?.address?.city || null,
    home: teamSide(home),
    away: teamSide(away),
    broadcast: (comp.broadcasts || []).map((b) => b.names || b.media?.shortName).flat().filter(Boolean),
    odds,
  };
}

function teamSide(t) {
  if (!t) return { abbr: "UNK", name: "Unknown", id: null, score: null, record: null };
  return {
    abbr: t.team?.abbreviation,
    name: t.team?.displayName || t.team?.shortDisplayName,
    id: t.team?.id || t.id,
    score: num(t.score),
    record: t.records?.[0]?.summary || null,
  };
}

function statMap(stats) {
  const out = {};
  for (const s of stats || []) out[s.name] = s.displayValue ?? s.value;
  return out;
}

function parseSummary(raw, base) {
  const pick = (raw.pickcenter || [])[0] || {};
  const headerComp = raw.header?.competitions?.[0] || {};
  const hOdds = headerComp.odds?.[0] || {};
  const homeSpread = num(pick.homeTeamOdds ? spreadFromDetails(pick, base.home.abbr) : hOdds);
  const details = pick.details || hOdds.details || "";
  const spreadHome = spreadHomeFromDetails(details, base.home.abbr, base.away.abbr);
  const open = hOdds.awayTeamOdds?.open || hOdds.homeTeamOdds?.open || null;
  const injuries = [];
  for (const block of raw.injuries || []) {
    const team = block.team?.abbreviation;
    for (const inj of block.injuries || []) {
      injuries.push({
        team,
        name: inj.athlete?.displayName,
        id: inj.athlete?.id,
        pos: inj.athlete?.position?.abbreviation || null,
        status: inj.status,
        comment: inj.shortComment || inj.longComment || "",
      });
    }
  }
  const boxPlayers = [];
  for (const group of raw.boxscore?.players || []) {
    const team = group.team?.abbreviation;
    const block = (group.statistics || [])[0];
    for (const a of block?.athletes || []) {
      boxPlayers.push({
        team,
        id: a.athlete?.id,
        name: a.athlete?.displayName,
        pos: a.athlete?.position?.abbreviation || "F",
        starter: Boolean(a.starter),
        didNotPlay: Boolean(a.didNotPlay),
        status: a.didNotPlay ? "out" : "active",
        stats: a.stats || [],
      });
    }
  }
  const teamStats = {};
  for (const t of raw.boxscore?.teams || []) {
    teamStats[t.team?.abbreviation] = statMap(t.statistics);
  }
  const predictor = raw.predictor || {};
  const homePred = predictor.homeTeam?.gameProjection;
  const officials = (raw.gameInfo?.officials || []).map((o) => o.displayName).filter(Boolean);
  const series = (raw.seasonseries || [])[0] || null;
  return {
    spreadHome,
    total: num(pick.overUnder ?? hOdds.overUnder),
    openTotal: num(hOdds.current?.total?.alternateDisplayValue) ? null : num(open?.total),
    mlHome: num(pick.homeTeamOdds?.moneyLine),
    mlAway: num(pick.awayTeamOdds?.moneyLine),
    openSpreadHome: openSpread(hOdds, base.home.abbr),
    openMlAway: num(hOdds.awayTeamOdds?.open?.moneyLine?.american),
    predictorHomeWp: homePred != null ? num(homePred) / 100 : null,
    injuries,
    boxPlayers,
    teamStats,
    officials,
    series: series
      ? { summary: series.summary, score: series.seriesScore, events: (series.events || []).length }
      : null,
    broadcasts: (raw.broadcasts || []).map((b) => b.media?.shortName).filter(Boolean),
  };
}

function spreadHomeFromDetails(details, homeAbbr, awayAbbr) {
  if (!details || typeof details !== "string") return null;
  const m = details.match(/([A-Z]{2,3})\s*([+-]?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const abbr = m[1];
  const line = Number(m[2]);
  if (abbr === homeAbbr) return line;
  if (abbr === awayAbbr) return -line;
  return null;
}

function openSpread(hOdds, homeAbbr) {
  const homeOpen = hOdds.homeTeamOdds?.open?.pointSpread?.american;
  if (homeOpen == null) return null;
  const n = Number(String(homeOpen).replace("+", ""));
  return Number.isFinite(n) ? n : null;
}

function unusedSpread(pick, abbr) {
  return abbr && pick;
}

async function rosterPlayers(abbr) {
  const res = await getJson(`${ESPN}/teams/${abbr}/roster`);
  const athletes = res.json?.athletes || [];
  const players = [];
  for (const group of athletes) {
    const list = group.items || group.athletes || (group.displayName ? [group] : []);
    if (Array.isArray(group.items) || Array.isArray(group.athletes)) {
      for (const a of group.items || group.athletes || []) {
        players.push(athleteToPlayer(a));
      }
    }
  }
  if (!players.length && Array.isArray(res.json?.athletes)) {
    for (const a of res.json.athletes) {
      if (a.displayName) players.push(athleteToPlayer(a));
    }
  }
  return { players: players.filter((p) => p.name).slice(0, 12), health: healthRow(res) };
}

function athleteToPlayer(a) {
  return {
    id: a.id,
    name: a.displayName,
    pos: a.position?.abbreviation || "F",
    starter: false,
    status: (a.injuries && a.injuries[0]?.status) || "active",
  };
}

function healthRow(res) {
  return {
    url: res.url.replace(/https:\/\/[^/]+/, ""),
    status: res.status,
    bytes: res.bytes,
    ms: res.ms,
    acao: res.acao,
    ok: res.status >= 200 && res.status < 300 && res.json != null,
  };
}

function applyTeamStats(side, stats) {
  if (!stats) return side;
  return {
    ...side,
    ppg: num(stats.avgPoints) ?? side.ppg,
    oppg: num(stats.avgPointsAgainst) ?? side.oppg,
  };
}

function playersFor(side, summary) {
  const fromBox = (summary.boxPlayers || []).filter((p) => p.team === side.abbr);
  if (fromBox.length) {
    return fromBox.map((p) => ({
      id: p.id,
      name: p.name,
      pos: p.pos,
      starter: p.starter,
      didNotPlay: p.didNotPlay,
      status: p.status,
    }));
  }
  return null;
}

function tagInjuries(players, injuries, abbr) {
  const byName = new Map(injuries.filter((i) => i.team === abbr).map((i) => [i.name, i]));
  return players.map((p) => {
    const inj = byName.get(p.name);
    if (!inj) return p;
    return { ...p, status: inj.status || p.status };
  });
}

async function main() {
  const fetches = [];
  let slateDate = slateDateET(new Date());
  let board = await getJson(`${ESPN}/scoreboard?dates=${slateDate}`);
  fetches.push(healthRow(board));
  let events = board.json?.events || [];
  const allFinal = events.length > 0 && events.every((e) => e.competitions?.[0]?.status?.type?.completed);
  if (!events.length || allFinal) {
    const next = addDays(slateDate, 1);
    const nxt = await getJson(`${ESPN}/scoreboard?dates=${next}`);
    fetches.push(healthRow(nxt));
    if ((nxt.json?.events || []).length) {
      slateDate = next;
      board = nxt;
      events = nxt.json.events;
    }
  }

  const bases = events.map(parseScoreboardEvent);
  const games = [];
  for (const base of bases) {
    const sumRes = await getJson(`${ESPN}/summary?event=${base.id}`);
    fetches.push(healthRow(sumRes));
    const summary = sumRes.json ? parseSummary(sumRes.json, base) : {};
    let homePlayers = playersFor(base.home, summary);
    let awayPlayers = playersFor(base.away, summary);
    if (!homePlayers) {
      const roster = await rosterPlayers(base.home.abbr);
      fetches.push(roster.health);
      homePlayers = roster.players;
    }
    if (!awayPlayers) {
      const roster = await rosterPlayers(base.away.abbr);
      fetches.push(roster.health);
      awayPlayers = roster.players;
    }
    homePlayers = tagInjuries(homePlayers || [], summary.injuries || [], base.home.abbr);
    awayPlayers = tagInjuries(awayPlayers || [], summary.injuries || [], base.away.abbr);
    const home = applyTeamStats({ ...base.home, players: homePlayers }, summary.teamStats?.[base.home.abbr]);
    const away = applyTeamStats({ ...base.away, players: awayPlayers }, summary.teamStats?.[base.away.abbr]);
    home.spread = summary.spreadHome;
    home.moneyline = summary.mlHome;
    away.moneyline = summary.mlAway;
    const tipMs = new Date(base.date).getTime();
    games.push({
      id: base.id,
      date: base.date,
      status: base.status,
      clock: base.clock,
      venue: base.venue,
      city: base.city,
      tv: (summary.broadcasts || [])[0] || null,
      book: "DraftKings",
      total: summary.total,
      openTotal: null,
      openSpreadHome: summary.openSpreadHome,
      openMlAway: summary.openMlAway,
      predictorHomeWp: summary.predictorHomeWp,
      officials: summary.officials || [],
      hoursToTip: (tipMs - Date.now()) / 36e5,
      homeScore: base.home.score,
      awayScore: base.away.score,
      injuries: summary.injuries || [],
      series: summary.series,
      startersConfirmed: false,
      home,
      away,
    });
  }

  const outPath = join(ROOT, "public/data/latest.json");
  let previous = null;
  try {
    previous = JSON.parse(await readFile(outPath, "utf8"));
  } catch {
    previous = null;
  }
  const snapshot = analyzeSlate(
    {
      slateDate,
      generatedAt: new Date().toISOString(),
      games,
      source: {
        writer: process.env.SNAPSHOT_WRITER || "sandbox-loop",
        espnHost: "site.api.espn.com",
        status: board.status,
        fetches,
      },
    },
    previous && previous.schemaVersion ? previous : null,
  );
  snapshot.source.fetches = fetches;
  const body = JSON.stringify(snapshot);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, body);
  const histDir = join(ROOT, "public/data/history");
  await mkdir(histDir, { recursive: true });
  const stamp = snapshot.generatedAt.replace(/[:.]/g, "-");
  await writeFile(join(histDir, `${stamp}.json`), body);
  await mkdir(join(ROOT, "site/data"), { recursive: true });
  await writeFile(join(ROOT, "site/data/latest.json"), body);
  console.log(
    JSON.stringify({
      generatedAt: snapshot.generatedAt,
      slateDate,
      games: snapshot.games.length,
      bytes: body.length,
      alerts: snapshot.alerts.length,
      fetches: fetches.map((f) => ({ url: f.url, status: f.status, bytes: f.bytes, ms: f.ms })),
    }),
  );
}

const spreadFromDetails = unusedSpread;

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
