/** Rules-based paragraphs. source is always "rules" unless a later polish step replaces it. */

function pct(p) {
  if (p == null || Number.isNaN(p)) return "n/a";
  return `${(p * 100).toFixed(1)}%`;
}

function n(x, d = 1) {
  if (x == null || Number.isNaN(x)) return "n/a";
  return Number(x).toFixed(d);
}

export function slateParagraphs(snapshot) {
  const games = snapshot.games || [];
  const withMarket = games.filter((g) => g.market?.noVigHome != null);
  const favs = withMarket
    .map((g) => {
      const homeFav = g.market.noVigHome >= 0.5;
      return {
        label: homeFav ? g.homeAbbr || g.home : g.awayAbbr,
        p: homeFav ? g.market.noVigHome : g.market.noVigAway,
        spread: g.market.homeSpread,
        total: g.market.total,
      };
    })
    .sort((a, b) => b.p - a.p);
  const totals = games.map((g) => g.headline?.total).filter((x) => x != null);
  const avgTotal = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : null;
  const pace = games.map((g) => g.model?.poss).filter((x) => x != null);
  const avgPace = pace.length ? pace.reduce((a, b) => a + b, 0) / pace.length : null;
  const env = snapshot.league?.ppg;

  const p1 =
    `This slate has ${games.length} games and a league scoring environment of ${n(env)} points per team from the season averages on the pull (the 30-day rolling ORtg in Appendix B §4.1 is not in this feed, so the environment is a prior, not a fitted seasonal shape). ` +
    `Headline totals average ${n(avgTotal)} and the pace prior averages ${n(avgPace)} possessions. ` +
    (favs[0]
      ? `The shortest no-vig price is ${favs[0].label} at ${pct(favs[0].p)}. Market spreads on the priced games run from ${games
          .map((g) => g.market?.homeSpread)
          .filter((x) => x != null)
          .map((x) => (x > 0 ? `+${x}` : `${x}`))
          .join(", ") || "none"}. `
      : "Several games have no posted moneyline on this pull, so those headlines are the model alone with a wider data penalty. ") +
    `The blend weight is λ=${snapshot.lambda ?? 0.1} toward the model. That weight is a starting prior. It is not an edge.`;

  const inj = games.flatMap((g) =>
    (g.scenarios || []).map((s) => ({
      game: `${g.awayAbbr} @ ${g.homeAbbr}`,
      ...s,
    })),
  );
  inj.sort((a, b) => Math.abs(b.dWp) - Math.abs(a.dWp));
  const top = inj[0];
  const p2 = top
    ? `Lineup uncertainty is the largest swing that is actually enumerated. ${top.player} on ${top.game} moves headline win probability by ${(top.dWp * 100).toFixed(1)} percentage points and the total by ${n(top.dTotal)} if he sits, holding everyone else's status at the current play probability. ` +
      `${inj.length} questionable-or-doubtful panels are on the board. Play probabilities use the status priors (Questionable 50%, Doubtful 2%, Out 0.3%, key-player Questionable 56% inside two hours). They are not player-specific posteriors. LeBron-style partial pooling needs the listing history, which is not loaded. ` +
      `Confirmed-starter flags are ${games.filter((g) => g.lineups?.confirmed).length} of ${games.length}. Until a starter is confirmed, minutes stay on the decayed role prior plus the blowout curve.`
    : `No Questionable or Doubtful player cleared the scenario gate on this pull. Out players are removed and their minutes are reallocated with a Dirichlet-style weight (position and headroom; prior concentration stands in for 20 games). Joint "both sit" cases appear only when two uncertain players share a team.`;

  const changes = snapshot.changes || [];
  const p3 = changes.length
    ? `Since the previous snapshot at ${snapshot.previousGeneratedAt}, ${changes.length} tracked fields moved. ${changes
        .slice(0, 3)
        .map((c) => `${c.game}: ${c.field} ${c.from} → ${c.to} (${c.reason})`)
        .join(" ")} Line movement is measured only against our own snapshots plus the ESPN open/current pair. There is no free history feed.`
    : `This is the first stored snapshot of the slate, so the changes feed is empty on purpose. ESPN open versus current is still on each game (spread move ${games
        .map((g) => `${g.awayAbbr}@${g.homeAbbr} ${g.market?.spreadMove ?? "n/a"}`)
        .join("; ")}). A later refresh will diff win probability, total, and status against this file. Nothing here was typed in by hand after the writer started.`;

  const loud = games.flatMap((g) => g.trends || []).slice(0, 3);
  const p4 =
    `No trend on this slate is Validated. The registry holds ${snapshot.hypothesisCount} pre-registered hypotheses, and the gate requires n ≥ 150 team-games or 400 player-games, a shrunk effect of at least 0.75 points, BH q=0.10 inside the family, and BY q=0.10 across families. ` +
    `Sample size on every card is 0 because the 2019–20 backfill is not in this build. ${loud.map((t) => `${t.label} (${t.family})`).join(", ") || "The trend list"} ${loud.length ? "are" : "is"} shown so the shape of the gate is visible, not because a residual beat the close. ` +
    `Revenge, birthday, and "owns this team" stay narrative-only even after a backfill unless they pass. Opponent 3P% is not a shooting-percentage adjustment.`;

  const nextTips = games
    .filter((g) => g.lockMinutes != null && g.lockMinutes > 0)
    .sort((a, b) => a.lockMinutes - b.lockMinutes);
  const p5 = nextTips.length
    ? `Next lock is ${nextTips[0].awayAbbr} at ${nextTips[0].homeAbbr} in ${nextTips[0].lockMinutes} minutes (${nextTips[0].tip}). Watch the official injury report at the next :00/:15/:30/:45 slot, starter confirmations around 30 minutes before tip, and the referee crew if it was not posted (typical post time is about 9:00 AM ET, which is a reported cadence, not something this pull re-proved). ` +
      `Live games refresh from ESPN in the browser about every 60 seconds; the full engine snapshot is on a 20-minute writer. Alerts fire for a spread move of 2 or more, a total move of 3 or more, a no-vig moneyline move of 5 percentage points, a Questionable/Doubtful/DTD tag, and any lock inside 60 minutes.`
    : `Every game on the selected date is in progress or final, so the board will roll forward at 6:00 AM ET, or sooner if this writer sees a full set of final scores and a non-empty next-day scoreboard. Injury-report polling remains on the quarter-hour. The next referee post is the following morning, about 9:00 AM ET.`;

  return [p1, p2, p3, p4, p5];
}

export function gameParagraphs(g) {
  const h = g.homeAbbr;
  const a = g.awayAbbr;
  const p1 =
    `${a} at ${h} is priced at a home spread of ${g.market?.homeSpread ?? "n/a"} and a total of ${g.market?.total ?? "n/a"} ` +
    `(${g.market?.provider || "the posted book"}). No-vig home win probability is ${pct(g.market?.noVigHome)} by the ${g.market?.devigMethod || "n/a"} method. ` +
    `The independent model has home win ${pct(g.model?.wp)}, margin ${n(g.model?.margin)}, total ${n(g.model?.total)}, on ${n(g.model?.poss)} possessions and a home-court prior of +2.0. ` +
    `Headline numbers blend those with λ=${g.model?.lambda}: win ${pct(g.headline?.wp)}, margin ${n(g.headline?.margin)}, total ${n(g.headline?.total)}. ` +
    `The model-market gap is ${n(g.headline?.disagreePts)} points. ${g.headline?.edgeLabel}. ` +
    `Cover probability for the home spread is ${pct(g.headline?.cover)} and the over is ${pct(g.headline?.over)}, from the same draws as the win probability so the numbers cannot disagree with each other.`;

  const mins = [...(g.lineups?.home || []), ...(g.lineups?.away || [])];
  const topMin = [...mins].sort((x, y) => y.min - x.min)[0];
  const scen = (g.scenarios || [])[0];
  const p2 =
    `Minutes are solved to ${n(g.lineups?.homeMinutesTarget, 1)} per team, which is 240 × (1 + 0.104 × P(OT)). P(OT) on this game is ${pct(g.headline?.ot)}. ` +
    (topMin
      ? `${topMin.name} leads the minute projection at ${n(topMin.min)} (10–90 style band ${n(topMin.minLo)}–${n(topMin.minHi)}), with foul-trouble risk ${pct(topMin.foulRisk)} shrinking the mean slightly. `
      : "No rotation was returned for this game. ") +
    (scen
      ? `If ${scen.player} sits, win probability moves ${(scen.dWp * 100).toFixed(1)} points and the total moves ${n(scen.dTotal)}. Teammate minute changes: ${scen.teammateDeltas
          .map((t) => `${t.name} ${t.dMin > 0 ? "+" : ""}${t.dMin}`)
          .join(", ") || "none"}. `
      : "No one is inside the uncertain band (play probability between 3% and 97%), so the scenario tree collapses toward the listed outs. ") +
    `A return-from-absence cap (about 24–28 minutes after five missed games) is in the spec and is not applied unless games-missed is on the feed. Starters are ${g.lineups?.confirmed ? "confirmed" : "projected, not confirmed"}.`;

  const players = mins.filter((p) => p.min >= 20).slice(0, 4);
  const p3 = players.length
    ? `Player rates are ${players[0].rateSource}. Among the rotation, ${players
        .map((p) => `${p.name} ${n(p.pts)} pts / ${n(p.reb)} reb / ${n(p.ast)} ast / ${n(p.tpm)} threes (PRA ${n(p.pra)}, points band ${n(p.ptsLo)}–${n(p.ptsHi)})`)
        .join("; ")}. ` +
      `3P% is shrunk with K=${240} attempts toward the league prior and is not moved by the opponent's 3P% allowed. Attempt volume may move. Defender matchups, if a feed appears later, are capped at 25% of the generic opponent adjustment and do not enter this projection. ` +
      `Personal home/road, rest, night, month, and opponent history are display-only until they pass the trend gate. They are not inside these point totals. Prop lines were not attached on this pull, so there is no prop-versus-projection gap to show.`
    : `Player-level rates could not be built because the box and the roster were both empty. Team totals still come from the pace and efficiency prior.`;

  const t0 = (g.trends || [])[0];
  const p4 =
    `Context sitting next to the model: altitude ${g.altitudeFt ?? "n/a"} ft, timezone ${g.timezone || "n/a"}, officials ${(g.officials || []).map((o) => o).join(", ") || "not posted"}. ` +
    `INFERRED margin band (market blended with the margin implied by ESPN's predictor, then ±5) is ${g.inferred ? `${g.inferred.lo} to ${g.inferred.hi}` : "unavailable"}. ` +
    (t0 ? `The loudest context card is "${t0.label}". ${t0.whyNoise} ` : "") +
    `Quantiles for the home margin (10/25/50/75/90) are ${(g.headline?.marginQuantiles || []).join(", ") || "n/a"}. ` +
    `Total quantiles are ${(g.headline?.totalQuantiles || []).join(", ") || "n/a"}. ` +
    `Confidence is ${g.confidence?.grade} (${g.confidence?.score}). ${g.confidence?.note} Grades have not been shown to separate realized error, because the backtest has not been run.`;

  return [p1, p2, p3, p4];
}
