/**
 * Appendix B §2–§10 game model.
 * STATUS: priors only. Not backtested. Do not call a model-market gap an edge.
 */
import {
  americanToImplied,
  blendPoints,
  blendProb,
  clamp,
  devigMoneyline,
  invNorm,
  kalmanUpdate,
  mean,
  mulberry32,
  normalCdf,
  normalSample,
  quantile,
  shrinkRate,
} from "./math.mjs";
import { ARENAS, haversineMiles, tzShiftHours } from "./arenas.mjs";
import { FACTOR_CATALOGUE } from "./registry.mjs";

export const LAMBDA_PRIOR = 0.1;
export const LAMBDA_STALE_LINE = 0.3;
export const MARGIN_SD = 12.5;
export const TOTAL_SD = 18;
export const HCA = 2.0;
export const LEAGUE_PPG_PRIOR = 114.5;
export const POSS_PRIOR = 99.5;
export const THREE_PT_PADDING = 240;
export const LEAGUE_3P = 0.362;

const STATUS_P = {
  probable: 0.91,
  questionable: 0.5,
  doubtful: 0.02,
  out: 0.003,
  "day-to-day": 0.5,
  dtd: 0.5,
  gtd: 0.5,
};

export function playProbability(status, { keyPlayer = false, hoursToTip = null, listedLate = false } = {}) {
  const key = String(status || "active").toLowerCase();
  if (key === "questionable" && keyPlayer && hoursToTip != null && hoursToTip <= 2) {
    return listedLate ? 0.47 : 0.6;
  }
  if (key === "probable" && keyPlayer && hoursToTip != null && hoursToTip <= 2) return 0.97;
  if (key === "doubtful" && keyPlayer && hoursToTip != null && hoursToTip <= 2) return 0.01;
  if (STATUS_P[key] != null) return STATUS_P[key];
  return 1;
}

export function blowoutMinutes(baseMin, marginAbs, role) {
  const knee = role === "starter" ? 13.5 : 18;
  if (marginAbs <= knee) return baseMin;
  const at22 = baseMin * (26 / 34);
  const t = clamp((marginAbs - knee) / (22 - knee), 0, 1.4);
  return clamp(baseMin + (at22 - baseMin) * t, 0, 42);
}

function posGroup(pos) {
  const p = String(pos || "").toUpperCase();
  if (p.startsWith("C")) return "C";
  if (p.startsWith("F")) return "F";
  if (p.startsWith("G")) return "G";
  return "F";
}

/** Per-36 prior by position, scaled later to the team scoring environment. */
const PER36 = {
  G: { pts: 16.5, reb: 4.0, ast: 4.6, tpm: 2.1, usage: 0.22 },
  F: { pts: 15.5, reb: 6.2, ast: 2.6, tpm: 1.5, usage: 0.21 },
  C: { pts: 14.2, reb: 9.0, ast: 2.0, tpm: 0.5, usage: 0.2 },
};

function teamOffDef(team) {
  const off = Number(team.ppg) || LEAGUE_PPG_PRIOR;
  const def = Number(team.oppg) || LEAGUE_PPG_PRIOR;
  return { off, def };
}

export function expectedPoints({ home, away, poss, contextHome = 0, contextAway = 0, leaguePpg }) {
  const lg = leaguePpg || LEAGUE_PPG_PRIOR;
  const h = teamOffDef(home);
  const a = teamOffDef(away);
  const homePts = (poss / 100) * (lg + (h.off - lg) - (a.def - lg)) + HCA / 2 + contextHome;
  const awayPts = (poss / 100) * (lg + (a.off - lg) - (h.def - lg)) - HCA / 2 + contextAway;
  return { homePts, awayPts };
}

function altitudeContext(homeAbbr, awayAbbr) {
  if (homeAbbr === "DEN") return { home: 1.0, note: "DEN altitude prior +1.0 ± 0.7" };
  if (homeAbbr === "UTA") return { home: 0.3, note: "UTA altitude prior +0.3 ± 0.5" };
  return { home: 0, note: null };
}

function restContext(team) {
  if (team.restDays == null) return { pts: 0, b2b: false, known: false };
  const b2b = team.restDays === 0;
  const rest = clamp(team.restDays, 0, 3);
  const pts = b2b ? -1.5 : 0.15 * rest;
  return { pts, b2b, known: true };
}

export function chooseLambda({ statusChangedMinutesAgo = null, lineMoved = false }) {
  if (statusChangedMinutesAgo != null && statusChangedMinutesAgo <= 15 && !lineMoved) {
    return { lambda: LAMBDA_STALE_LINE, reason: "status change inside 15 min and the line has not moved" };
  }
  return { lambda: LAMBDA_PRIOR, reason: "pre-injury-news prior λ=0.10" };
}

function grade(score) {
  if (score >= 75) return "A";
  if (score >= 55) return "B";
  if (score >= 35) return "C";
  return "D";
}

export function confidenceScore({
  ratingSd = 3,
  injuryShare = 0,
  disagreeSd = 0,
  staleMin = 0,
  unconfirmed = true,
  missingRefs = true,
  calibEce = 0.05,
}) {
  const zParam = clamp(ratingSd / 6, 0, 1.5);
  const hInj = clamp(injuryShare, 0, 1);
  const zDis = clamp(Math.abs(disagreeSd) / 3, 0, 1.5);
  const zData = clamp(staleMin / 180, 0, 1) * 0.5 + (unconfirmed ? 0.25 : 0) + (missingRefs ? 0.15 : 0);
  const zCal = clamp(calibEce / 0.05, 0, 1.5);
  const zRole = 0.2;
  const raw =
    0.25 * zParam + 0.25 * hInj + 0.15 * zDis + 0.1 * zData + 0.15 * zCal + 0.1 * zRole;
  const score = Math.round(100 * (1 - clamp(raw, 0, 1)));
  return {
    score,
    grade: grade(score),
    note: "Forecast sharpness and reliability, not a betting edge.",
    terms: { zParam, hInj, zDis, zData, zCal, zRole },
  };
}

function simulateGame({ homeMean, awayMean, poss, potScale = true, draws = 4000, seed = 7 }) {
  const rng = mulberry32(seed);
  const margins = [];
  const totals = [];
  const homePts = [];
  const awayPts = [];
  let ot = 0;
  const paceScale = Math.sqrt(clamp(poss / POSS_PRIOR, 0.85, 1.2));
  const mSd = MARGIN_SD * paceScale;
  const tSd = TOTAL_SD * paceScale;
  const corr = 0.35;
  for (let i = 0; i < draws; i++) {
    const z1 = normalSample(rng, 0, 1);
    const z2 = normalSample(rng, 0, 1);
    const shared = corr * z1 + Math.sqrt(1 - corr * corr) * z2;
    let h = homeMean + (tSd / 2) * z1 + (mSd / 2) * shared;
    let a = awayMean + (tSd / 2) * z1 - (mSd / 2) * shared;
    if (Math.abs(h - a) < 0.5) {
      ot += 1;
      const otPoss = poss * (5 / 48);
      h += normalSample(rng, (homeMean / poss) * otPoss, 3);
      a += normalSample(rng, (awayMean / poss) * otPoss, 3);
    }
    margins.push(h - a);
    totals.push(h + a);
    homePts.push(h);
    awayPts.push(a);
  }
  margins.sort((x, y) => x - y);
  totals.sort((x, y) => x - y);
  return {
    draws,
    otRate: ot / draws,
    marginMean: mean(margins),
    totalMean: mean(totals),
    marginQ: [0.1, 0.25, 0.5, 0.75, 0.9].map((q) => quantile(margins, q)),
    totalQ: [0.1, 0.25, 0.5, 0.75, 0.9].map((q) => quantile(totals, q)),
    homeWin: margins.filter((m) => m > 0).length / draws,
    margins,
    totals,
  };
}

function baseMinutes(player, index, starter) {
  if (player.baseMin != null) return player.baseMin;
  if (starter) return [34, 32, 30, 28, 26][index] ?? 24;
  return [20, 16, 14, 12, 10, 8][index] ?? 8;
}

export function solveMinutes(players, pot) {
  const target = 240 * (1 + 0.104 * pot);
  const active = players.filter((p) => p.pPlay > 0.03);
  const out = players.filter((p) => p.pPlay <= 0.03);
  const vacated = out.reduce((s, p) => s + (p.base || 0), 0);
  const weights = active.map((p) => {
    const same = 1;
    const headroom = Math.max(0, 36 - p.base);
    return (p.starter ? 1.15 : 0.85) * (0.6 + headroom / 36) * same;
  });
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  let mins = active.map((p, i) => p.base + vacated * (weights[i] / wsum));
  for (let iter = 0; iter < 8; iter++) {
    mins = mins.map((m) => clamp(m, 0, 42));
    const sum = mins.reduce((a, b) => a + b, 0) || 1;
    mins = mins.map((m) => (m * target) / sum);
  }
  mins = mins.map((m) => clamp(m, 0, 42));
  const sum = mins.reduce((a, b) => a + b, 0) || 1;
  mins = mins.map((m) => (m * target) / sum);
  const byId = new Map();
  active.forEach((p, i) => byId.set(p.id, mins[i]));
  for (const p of out) byId.set(p.id, 0);
  return { minutes: byId, target, vacated };
}

function projectPlayer(p, min, ctx) {
  const g = PER36[posGroup(p.pos)];
  const env = ctx.teamPpg / LEAGUE_PPG_PRIOR;
  const opp = ctx.oppOppg / LEAGUE_PPG_PRIOR;
  const threePoint = shrinkRate(
    (p.threeMakes ?? LEAGUE_3P * THREE_PT_PADDING * 0.02) ,
    (p.threeAtt ?? THREE_PT_PADDING * 0.02),
    THREE_PT_PADDING,
    LEAGUE_3P,
  );
  const ptsPer36 = (p.ptsPer36 ?? g.pts) * env * (0.92 + 0.08 * opp);
  const rebPer36 = (p.rebPer36 ?? g.reb) * (ctx.missVolume / 90);
  const astPer36 = (p.astPer36 ?? g.ast) * (ctx.teamFgmFactor || 1);
  const tpmPer36 = (p.tpmPer36 ?? g.tpm) * env;
  const scale = min / 36;
  const meanPts = ptsPer36 * scale;
  const sd = Math.sqrt(Math.max(meanPts, 1)) * 1.15;
  return {
    min,
    minLo: Math.max(0, min - 6),
    minHi: Math.min(42, min + 5),
    pts: round1(meanPts),
    reb: round1(rebPer36 * scale),
    ast: round1(astPer36 * scale),
    tpm: round1(tpmPer36 * scale * (threePoint / LEAGUE_3P)),
    pra: round1(meanPts + rebPer36 * scale + astPer36 * scale),
    ptsLo: round1(Math.max(0, meanPts - 1.28 * sd)),
    ptsHi: round1(meanPts + 1.28 * sd),
    threePointShrunk: round3(threePoint),
    usage: round3(p.usage ?? g.usage),
    rateSource: p.ptsPer36 != null ? "player-log" : "position-prior scaled to team",
  };
}

function round1(x) {
  return Math.round(x * 10) / 10;
}
function round3(x) {
  return Math.round(x * 1000) / 1000;
}
function pct(x) {
  return Math.round(x * 1000) / 10;
}

function buildRotation(team) {
  const list = (team.players || []).map((p, i) => ({
    ...p,
    id: String(p.id || `${team.abbr}-${i}`),
    name: p.name || "Unknown",
    pos: p.pos || "F",
  }));
  const starters = [];
  const bench = [];
  for (const p of list) {
    if (p.starter) starters.push(p);
    else bench.push(p);
  }
  if (starters.length < 5) {
    for (const p of list) {
      if (starters.length >= 5) break;
      if (!starters.includes(p)) starters.push(p);
    }
  }
  const tagged = list.map((p) => ({ ...p, starter: starters.includes(p) }));
  let sIdx = 0;
  let bIdx = 0;
  return tagged.map((p) => {
    const starter = p.starter && sIdx < 8;
    const base = baseMinutes(p, starter ? sIdx : bIdx, starter);
    if (starter) sIdx += 1;
    else bIdx += 1;
    const status = p.status || (p.didNotPlay ? "out" : "active");
    const pPlay = p.didNotPlay ? 0.003 : playProbability(status, { keyPlayer: starter, hoursToTip: team.hoursToTip });
    return { ...p, starter, base, status, pPlay };
  });
}

function scenarioDeltas(baseWp, baseMargin, baseTotal, sitName, teamPlayers, side, ctx) {
  const without = teamPlayers.map((p) =>
    p.name === sitName ? { ...p, pPlay: 0, status: "out" } : p,
  );
  const solved = solveMinutes(without, ctx.pot);
  const minMap = solved.minutes;
  const baseSolved = solveMinutes(teamPlayers, ctx.pot);
  const teammateDeltas = teamPlayers
    .filter((p) => p.name !== sitName)
    .map((p) => ({
      name: p.name,
      dMin: round1((minMap.get(p.id) || 0) - (baseSolved.minutes.get(p.id) || 0)),
    }))
    .sort((a, b) => Math.abs(b.dMin) - Math.abs(a.dMin))
    .slice(0, 6);
  const lost = teamPlayers.find((p) => p.name === sitName);
  const impact = ((lost?.base || 28) / 48) * (lost?.starter ? 2.4 : 0.6);
  const dMargin = side === "home" ? -impact : impact;
  const dTotal = -impact * 0.55;
  const dWp = normalCdf((baseMargin + dMargin) / MARGIN_SD) - baseWp;
  return {
    player: sitName,
    side,
    dWp: round3(dWp),
    dMargin: round1(dMargin),
    dTotal: round1(dTotal),
    teammateDeltas,
  };
}

export function analyzeGame(game, league, opts = {}) {
  const home = game.home;
  const away = game.away;
  const generatedAt = opts.generatedAt || new Date().toISOString();
  const venue = ARENAS[home.abbr] || null;
  const awayArena = ARENAS[away.abbr] || null;
  const miles = haversineMiles(awayArena, venue);
  const tz = tzShiftHours(awayArena?.tz, venue?.tz);
  const alt = altitudeContext(home.abbr, away.abbr);
  const restH = restContext(home);
  const restA = restContext(away);
  const poss =
    POSS_PRIOR *
    ((Number(home.pace) || POSS_PRIOR) / POSS_PRIOR) *
    ((Number(away.pace) || POSS_PRIOR) / POSS_PRIOR);
  const contextHome = alt.home + restH.pts;
  const contextAway = restA.pts;
  const exp = expectedPoints({
    home,
    away,
    poss,
    contextHome,
    contextAway,
    leaguePpg: league.ppg,
  });
  const modelMargin = exp.homePts - exp.awayPts;
  const modelTotal = exp.homePts + exp.awayPts;
  const modelWp = normalCdf(modelMargin / MARGIN_SD);

  const ml = devigMoneyline(home.moneyline, away.moneyline);
  const marketMargin = home.spread != null ? -Number(home.spread) : null;
  // ESPN home.spread stored as the home team's point spread (negative if favored).
  const spreadForHome = home.spread != null ? Number(home.spread) : null;
  const marketTotal = game.total != null ? Number(game.total) : null;
  const hasLine = ml != null && marketMargin != null && marketTotal != null;
  const lam = chooseLambda({
    statusChangedMinutesAgo: game.statusChangedMinutesAgo ?? null,
    lineMoved: Boolean(game.lineMoved),
  });
  const headlineWp = hasLine ? blendProb(ml.home, modelWp, lam.lambda) : modelWp;
  const headlineMargin = hasLine ? blendPoints(marketMargin, modelMargin, lam.lambda) : modelMargin;
  const headlineTotal = hasLine ? blendPoints(marketTotal, modelTotal, lam.lambda) : modelTotal;

  const sim = simulateGame({
    homeMean: hasLine ? headlineTotal / 2 + headlineMargin / 2 : exp.homePts,
    awayMean: hasLine ? headlineTotal / 2 - headlineMargin / 2 : exp.awayPts,
    poss,
    seed: Number(String(game.id).slice(-6)) || 11,
  });
  const coverP =
    spreadForHome == null
      ? null
      : sim.margins.filter((m) => m + spreadForHome > 0).length / sim.draws;
  const overP = marketTotal == null ? null : sim.totals.filter((t) => t > marketTotal).length / sim.draws;

  const bpiMargin = game.predictorHomeWp != null ? MARGIN_SD * invNorm(clamp(game.predictorHomeWp, 0.02, 0.98)) : null;
  const inferredCenter =
    marketMargin != null && bpiMargin != null ? (marketMargin + bpiMargin) / 2 : marketMargin ?? bpiMargin;
  const inferred = inferredCenter == null ? null : { lo: round1(inferredCenter - 5), hi: round1(inferredCenter + 5) };

  const pot = sim.otRate;
  const homeRot = buildRotation({ ...home, hoursToTip: game.hoursToTip });
  const awayRot = buildRotation({ ...away, hoursToTip: game.hoursToTip });
  const homeMin = solveMinutes(homeRot, pot);
  const awayMin = solveMinutes(awayRot, pot);

  const missVolume = (exp.homePts + exp.awayPts) * 0.48;
  const projSide = (rot, mins, teamPpg, oppOppg) =>
    rot.map((p) => {
      const min = mins.get(p.id) || 0;
      const adj = blowoutMinutes(min, Math.abs(sim.marginMean), p.starter ? "starter" : "bench");
      const foulRisk = clamp(((p.pf36 ?? 3.2) - 2.5) / 6, 0, 0.45);
      const foulMin = adj * (1 - 0.08 * foulRisk);
      const stat = projectPlayer(p, foulMin, {
        teamPpg,
        oppOppg,
        missVolume,
        pot,
        teamFgmFactor: 1,
      });
      return {
        ...stat,
        id: p.id,
        name: p.name,
        pos: p.pos,
        starter: p.starter,
        status: p.status,
        pPlay: round3(p.pPlay),
        foulRisk: round3(foulRisk),
        team: rot === homeRot ? home.abbr : away.abbr,
      };
    });

  const homePlayers = projSide(homeRot, homeMin.minutes, home.ppg || league.ppg, away.oppg || league.ppg);
  const awayPlayers = projSide(awayRot, awayMin.minutes, away.ppg || league.ppg, home.oppg || league.ppg);

  const uncertain = [...homeRot, ...awayRot].filter((p) => p.pPlay > 0.03 && p.pPlay < 0.97);
  const panels = uncertain.slice(0, 8).map((p) => {
    const side = homeRot.includes(p) ? "home" : "away";
    const club = side === "home" ? homeRot : awayRot;
    return scenarioDeltas(headlineWp, headlineMargin, headlineTotal, p.name, club, side, { pot });
  });

  const openSpread = game.openSpreadHome != null ? Number(game.openSpreadHome) : null;
  const spreadMove = openSpread != null && spreadForHome != null ? round1(spreadForHome - openSpread) : null;
  const disagree = hasLine ? Math.abs(modelMargin - marketMargin) : null;
  const disagreeFlag = disagree != null && disagree >= 3;
  const conf = confidenceScore({
    ratingSd: 3.2,
    injuryShare: clamp(uncertain.length / 8, 0, 1),
    disagreeSd: disagree != null ? disagree / MARGIN_SD : 0,
    staleMin: opts.staleMin ?? 0,
    unconfirmed: !game.startersConfirmed,
    missingRefs: !(game.officials && game.officials.length),
    calibEce: 0.05,
  });

  const kHome = kalmanUpdate({
    priorMean: (home.ppg || league.ppg) - league.ppg,
    priorVar: 16,
    obs: (home.ppg || league.ppg) - (away.oppg || league.ppg),
    obsVar: 25,
  });

  const factors = factorTable({
    game,
    home,
    away,
    poss,
    exp,
    pot,
    alt,
    restH,
    restA,
    miles,
    tz,
    ml,
    spreadMove,
    conf,
    league,
    uncertain,
    disagree,
  });

  const trends = trendCards({ game, home, away, restH, restA, miles, tz, poss, league });

  const swings = [
    ...panels.map((p) => ({
      name: `${p.player} sits`,
      dWp: p.dWp,
      dTotal: p.dTotal,
    })),
    {
      name: "1 extra possession of pace",
      dWp: round3(normalCdf((headlineMargin + 0.15) / MARGIN_SD) - headlineWp),
      dTotal: round1((headlineTotal / poss) * 1),
    },
    {
      name: "home-court prior removed",
      dWp: round3(normalCdf((headlineMargin - HCA) / MARGIN_SD) - headlineWp),
      dTotal: 0,
    },
  ]
    .sort((a, b) => Math.abs(b.dWp) - Math.abs(a.dWp))
    .slice(0, 5);

  const tip = game.date;
  const lockMin = tip ? (new Date(tip).getTime() - new Date(generatedAt).getTime()) / 60000 : null;

  return {
    id: game.id,
    tip: game.date,
    status: game.status,
    clock: game.clock || null,
    homeScore: game.homeScore ?? null,
    awayScore: game.awayScore ?? null,
    venue: game.venue || venue?.name || null,
    city: game.city || null,
    altitudeFt: venue?.alt ?? null,
    timezone: venue?.tz || null,
    tv: game.tv || null,
    hoursToTip: game.hoursToTip,
    lockMinutes: lockMin == null ? null : Math.round(lockMin),
    confidence: conf,
    market: {
      provider: game.book || "DraftKings",
      homeSpread: spreadForHome,
      total: marketTotal,
      mlHome: home.moneyline ?? null,
      mlAway: away.moneyline ?? null,
      noVigHome: ml ? round3(ml.home) : null,
      noVigAway: ml ? round3(ml.away) : null,
      devigMethod: ml?.method || null,
      openSpreadHome: openSpread,
      openTotal: game.openTotal ?? null,
      openMlAway: game.openMlAway ?? null,
      spreadMove,
      hold:
        ml && home.moneyline != null
          ? round3((americanToImplied(home.moneyline) || 0) + (americanToImplied(away.moneyline) || 0) - 1)
          : null,
    },
    model: {
      wp: round3(modelWp),
      margin: round1(modelMargin),
      total: round1(modelTotal),
      poss: round1(poss),
      homePts: round1(exp.homePts),
      awayPts: round1(exp.awayPts),
      lambda: lam.lambda,
      lambdaReason: lam.reason,
    },
    headline: {
      wp: round3(headlineWp),
      margin: round1(headlineMargin),
      total: round1(headlineTotal),
      cover: coverP == null ? null : round3(coverP),
      over: overP == null ? null : round3(overP),
      ot: round3(sim.otRate),
      marginQuantiles: sim.marginQ.map(round1),
      totalQuantiles: sim.totalQ.map(round1),
      disagreeFlag,
      disagreePts: disagree == null ? null : round1(disagree),
      edgeLabel: "not an edge — backtest has not been run",
    },
    inferred,
    predictorHomeWp: game.predictorHomeWp ?? null,
    officials: game.officials || [],
    series: game.series || null,
    lastMeetings: game.lastMeetings || [],
    lineups: {
      confirmed: Boolean(game.startersConfirmed),
      home: homePlayers,
      away: awayPlayers,
      homeMinutesTarget: round1(homeMin.target),
      awayMinutesTarget: round1(awayMin.target),
    },
    scenarios: panels,
    factors,
    trends,
    swings,
    injuries: game.injuries || [],
    reasoning: [
      `λ=${lam.lambda} because ${lam.reason}.`,
      hasLine
        ? `Market no-vig home win is ${pct(ml.home)}% via ${ml.method}; model WP is ${pct(modelWp)}%; headline is ${pct(headlineWp)}%.`
        : "No full moneyline. Headline is the model alone and confidence is capped in the data term.",
      `Margin SD prior ${MARGIN_SD}, total SD prior ${TOTAL_SD}, ${sim.draws} draws, OT rate ${(sim.otRate * 100).toFixed(1)}%.`,
      alt.note || "No altitude prior on this floor.",
      restH.known || restA.known
        ? `Rest context applied (home ${home.restDays}d, away ${away.restDays}d). Priors, not a fitted posterior.`
        : "Rest days were not on this pull. Schedule-density factors are display-only.",
    ],
  };
}

function factorTable(ctx) {
  const { home, away, poss, pot, alt, restH, miles, tz, ml, spreadMove, conf, league, uncertain, disagree } = ctx;
  const num = (id) => {
    switch (id) {
      case 1:
        return round1(((home.ppg || 0) - (home.oppg || 0) - ((away.ppg || 0) - (away.oppg || 0))) / 10);
      case 2:
        return round1((home.ppg || league.ppg) - league.ppg);
      case 3:
        return round1((home.oppg || league.ppg) - league.ppg);
      case 21:
        return round1(poss);
      case 24:
        return round1(league.ppg);
      case 26:
        return round3(pot);
      case 31:
        return HCA;
      case 33:
        return alt.home;
      case 41:
        return home.restDays ?? null;
      case 42:
        return home.restDays != null && away.restDays != null ? home.restDays - away.restDays : null;
      case 43:
        return restH.b2b ? 1 : 0;
      case 50:
        return miles == null ? null : Math.round(miles);
      case 57:
        return tz;
      case 65:
        return uncertain.length;
      case 94:
        return THREE_PT_PADDING;
      case 112:
        return 0.25;
      case 133:
        return ctx.game.openSpreadHome ?? null;
      case 134:
        return ml ? round3(ml.home) : null;
      case 135:
        return spreadMove;
      case 141:
        return conf.terms.zData;
      case 144:
        return disagree == null ? null : round1(disagree);
      default:
        return null;
    }
  };
  return FACTOR_CATALOGUE.map(([group, id, name, role]) => {
    const value = num(id);
    const inModel = role === "C" || role === "C-fallback";
    return {
      id,
      group,
      name,
      role,
      value,
      direction: value == null ? "n/a" : value > 0 ? "home" : value < 0 ? "away" : "flat",
      posterior: "prior — not refit",
      inProjection: inModel && value != null,
      displayOnly: role === "D" || role === "T" || value == null,
    };
  });
}

function noise(n, family, mFamily) {
  return [
    `Based on n = ${n} games (historical backfill not loaded). The 80% interval is not estimated.`,
    `This is 1 of ${mFamily} patterns pre-registered in the ${family} family. No p-value is shown because the permutation test was not run on an empty sample.`,
    "Shrunk estimate is withheld. A raw split would be regression to the mean, and this one was not computed.",
    "Held up in later seasons? Not tested.",
    "Already priced by the market? Residual vs closing line was not computed. Treat as noise until the weekly re-test.",
    "Confounders checked: none yet — team quality, rest, home/away, and opponent strength require the backfill.",
  ].join(" ");
}

function trendCards({ home, away, restH, restA, miles, tz, poss }) {
  const cards = [];
  const push = (family, label, detail) => {
    cards.push({
      family,
      label,
      tier: "untested",
      n: 0,
      q: null,
      residualModel: null,
      residualClose: null,
      shrunk: null,
      inProjection: false,
      whyNoise: noise(0, family, 40),
      detail,
    });
  };
  push("Travel", "Tip-time / night", `Local timezone ${home.abbr} floor. tz shift ${tz ?? "unknown"} h.`);
  push("Calendar", "Month", "November slate. Month effects are pre-registered and not validated.");
  push("Calendar", "Day of week", "Day-of-week grid is in the registry. No residual is attached.");
  push(
    "Schedule",
    "Rest",
    restH.known
      ? `Home rest ${home.restDays}d (B2B ${restH.b2b}). Away rest ${away.restDays}d.`
      : "Rest not on this pull.",
  );
  push("Travel", "Miles", miles == null ? "Arena pair missing." : `${Math.round(miles)} miles between home arenas, a travel proxy not a measured itinerary.`);
  push("Officials", "Crew", "Crew effect prior is ~0 until a closing-line residual exists. Assignment is display-only.");
  push("Home", "Altitude", home.abbr === "DEN" || home.abbr === "UTA" ? "Altitude prior is inside the model." : "Not a DEN/UTA floor.");
  push("Schedule", "Density", "3-in-4 and 4-in-6 need the trailing schedule. Not inferred from one scoreboard.");
  push("Style", "Pace mismatch", `Game pace prior ${poss.toFixed(1)} possessions. Mismatch vs league is a trend card, not a projection term.`);
  push("Motivation", "After a loss", `${away.abbr} record ${away.record || "n/a"}, ${home.abbr} record ${home.record || "n/a"}. Revenge is narrative-only.`);
  return cards;
}

export function slateDateET(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  let y = Number(parts.year);
  let m = Number(parts.month);
  let d = Number(parts.day);
  const hour = Number(parts.hour);
  if (hour < 6) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 1);
    y = dt.getUTCFullYear();
    m = dt.getUTCMonth() + 1;
    d = dt.getUTCDate();
  }
  return `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`;
}

export { pct };
