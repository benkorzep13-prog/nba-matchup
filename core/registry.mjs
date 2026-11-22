/** 145-factor catalogue (Appendix B §13) and the pre-registered hypothesis grid. */

export const STATUS_LINE =
  "This engine has not yet been run or backtested. Every number in the spec is a starting prior to be re-estimated by the walk-forward backtest.";

export const FACTOR_CATALOGUE = [
  ["A", 1, "Player-based net rating", "C"],
  ["A", 2, "Results-based ORtg (Kalman)", "C"],
  ["A", 3, "Results-based DRtg", "C"],
  ["A", 4, "SRS/Massey margin rating", "C-fallback"],
  ["A", 5, "Elo", "C-fallback"],
  ["A", 6, "eFG% off", "C"],
  ["A", 7, "eFG% def", "C"],
  ["A", 8, "TOV% off", "C"],
  ["A", 9, "TOV% forced", "C"],
  ["A", 10, "ORB%", "C"],
  ["A", 11, "DRB%", "C"],
  ["A", 12, "FT rate off", "C"],
  ["A", 13, "FT rate allowed", "C"],
  ["A", 14, "3PA rate off", "C"],
  ["A", 15, "3PA rate allowed", "C"],
  ["A", 16, "Opp 3P% allowed (luck-adjusted, near-zero weight)", "C"],
  ["A", 17, "Rim rate / rim FG% allowed", "C"],
  ["A", 18, "Transition frequency", "X"],
  ["A", 19, "Half-court efficiency", "X"],
  ["A", 20, "Net rating trend last 10 (decayed)", "C"],
  ["B", 21, "Team pace", "C"],
  ["B", 22, "Opponent pace", "C"],
  ["B", 23, "Pace mismatch magnitude", "T"],
  ["B", 24, "League scoring environment (30-day)", "C"],
  ["B", 25, "Seasonal phase (pre/post-ASB)", "C"],
  ["B", 26, "Expected OT probability", "C"],
  ["B", 27, "Early-season total uncertainty", "X"],
  ["B", 28, "Rule/officiating-emphasis change flag", "D"],
  ["B", 29, "Average shot-clock usage", "X"],
  ["B", 30, "Free-throw volume expectation", "X"],
  ["C", 31, "League HCA", "C"],
  ["C", 32, "Team-specific HCA random effect", "C"],
  ["C", 33, "Altitude (DEN, UTA)", "C"],
  ["C", 34, "Neutral site flag", "C"],
  ["C", 35, "Arena-specific shooting background", "T"],
  ["C", 36, "Attendance/crowd size", "T"],
  ["C", 37, "Visitor altitude acclimation last 7 days", "X"],
  ["C", 38, "Home-court in playoffs vs regular season", "X"],
  ["C", 39, "Same-building games (LAL/LAC)", "C"],
  ["C", 40, "International game", "C"],
  ["D", 41, "Days rest", "X"],
  ["D", 42, "Rest differential", "X"],
  ["D", 43, "2nd night of B2B", "X"],
  ["D", 44, "B2B where first game was road", "X"],
  ["D", 45, "3-in-4", "X"],
  ["D", 46, "4-in-6", "X"],
  ["D", 47, "5-in-7", "X"],
  ["D", 48, "Road-trip game number", "T"],
  ["D", 49, "Homestand game number", "T"],
  ["D", 50, "Miles traveled last 72h", "X"],
  ["D", 51, "Miles traveled last 7 days", "X"],
  ["D", 52, "Excess rest ≥4 days", "X"],
  ["D", 53, "First game after All-Star break", "X"],
  ["D", 54, "Late arrival", "T"],
  ["D", 55, "Opponent prior-night OT", "X"],
  ["D", 56, "Minutes load of starters last 3 games", "X"],
  ["E", 57, "Time zones crossed", "X"],
  ["E", 58, "Eastward jet lag, home team", "X"],
  ["E", 59, "Westward circadian advantage", "X"],
  ["E", 60, "Body-clock tip time", "X"],
  ["E", 61, "Local tip time / day game", "X"],
  ["E", 62, "Matinee after night game", "T"],
  ["E", 63, "Days since tz change", "X"],
  ["E", 64, "Early-start national window", "T"],
  ["F", 65, "Injury status per player", "C"],
  ["F", 66, "Player-specific play rate when listed", "C"],
  ["F", 67, "Hours to tip at listing", "C"],
  ["F", 68, "Listed early vs late", "C"],
  ["F", 69, "Injury body part/type", "C"],
  ["F", 70, "Games missed (return-from-absence)", "C"],
  ["F", 71, "Rest-risk for unlisted stars", "C"],
  ["F", 72, "National TV / PPP-protected game", "C"],
  ["F", 73, "Two-way/G-League assignment flags", "C"],
  ["F", 74, "Confirmed starters", "C"],
  ["F", 75, "Trade/new acquisition", "C"],
  ["F", 76, "Coach rotation depth", "C"],
  ["F", 77, "Correlated star rest", "C"],
  ["F", 78, "Opponent absences", "C"],
  ["G", 79, "Decayed recent minutes", "C"],
  ["G", 80, "Starter/bench role", "C"],
  ["G", 81, "Minutes CV last 10", "C"],
  ["G", 82, "Vacated-minutes allocation weights", "C"],
  ["G", 83, "Blowout minutes curve by role", "C"],
  ["G", 84, "Projected game margin distribution", "C"],
  ["G", 85, "Foul rate PF/36", "C"],
  ["G", 86, "Opponent foul-drawing vs matchup", "X"],
  ["G", 87, "Crew foul rate", "X"],
  ["G", 88, "Minutes cap", "C"],
  ["H", 89, "Usage rate (shrunk)", "C"],
  ["H", 90, "Usage redistribution from absences", "C"],
  ["H", 91, "TS% (shrunk)", "C"],
  ["H", 92, "Usage–efficiency tradeoff", "C"],
  ["H", 93, "3PA per possession", "C"],
  ["H", 94, "3P% (padding ~240)", "C"],
  ["H", 95, "FT rate", "C"],
  ["H", 96, "FT%", "C"],
  ["H", 97, "Rim/mid/3 shot diet", "C"],
  ["H", 98, "AST%", "C"],
  ["H", 99, "Teammate FGM in scenario", "C"],
  ["H", 100, "ORB%", "C"],
  ["H", 101, "DRB%", "C"],
  ["H", 102, "Available-rebound volume", "C"],
  ["H", 103, "Teammate/opponent rebounder presence", "C"],
  ["H", 104, "TOV%", "C"],
  ["H", 105, "Aging curve", "C"],
  ["H", 106, "Rookie/draft prior", "C"],
  ["I", 107, "Opponent points allowed by position", "C"],
  ["I", 108, "Opponent 3PA allowed", "C"],
  ["I", 109, "Opponent REB%", "C"],
  ["I", 110, "Opponent TOV forced", "C"],
  ["I", 111, "Opponent rim protection", "C"],
  ["I", 112, "Primary defender assignment", "X"],
  ["I", 113, "Defender archetype vs player archetype", "T"],
  ["I", 114, "Size/length mismatch", "X"],
  ["I", 115, "Opponent switch/drop scheme", "T"],
  ["I", 116, "Player vs this team history", "T"],
  ["I", 117, "Foul-prone bigs vs foul-drawing star", "X"],
  ["I", 118, "Opponent pace effect on possessions", "C"],
  ["J", 119, "Crew total delta", "X"],
  ["J", 120, "Crew foul rate", "X"],
  ["J", 121, "Crew home lean", "X"],
  ["J", 122, "Crew chief identity", "T"],
  ["J", 123, "Crew × star foul history", "T"],
  ["K", 124, "Revenge spot", "T"],
  ["K", 125, "Former-team game", "T"],
  ["K", 126, "Contract year", "X"],
  ["K", 127, "Birthday", "T"],
  ["K", 128, "Playoff race leverage", "X"],
  ["K", 129, "Tanking incentive", "X"],
  ["K", 130, "Rivalry / national TV spotlight", "T"],
  ["K", 131, "Milestone chase", "D"],
  ["K", 132, "Coach hot seat / new coach bounce", "T"],
  ["L", 133, "No-vig opening spread/total/ML", "C"],
  ["L", 134, "No-vig current consensus", "C"],
  ["L", 135, "Line movement since open", "C"],
  ["L", 136, "Move after injury news vs no news", "C"],
  ["L", 137, "Book margin (hold)", "C"],
  ["L", 138, "Prop lines sanity check", "C"],
  ["L", 139, "Prediction-market prices", "X"],
  ["L", 140, "Favorite size", "T"],
  ["M", 141, "Data staleness", "confidence"],
  ["M", 142, "Rating posterior SD", "confidence"],
  ["M", 143, "Scenario entropy", "confidence"],
  ["M", 144, "Model–market gap", "confidence"],
  ["M", 145, "Bucket calibration error", "confidence"],
];

if (FACTOR_CATALOGUE.length !== 145) {
  throw new Error(`factor catalogue length ${FACTOR_CATALOGUE.length} !== 145`);
}

const GROUP_COUNTS = { A: 20, B: 10, C: 10, D: 16, E: 8, F: 14, G: 10, H: 18, I: 12, J: 5, K: 9, L: 8, M: 5 };
export function assertGroupCounts() {
  const got = {};
  for (const [g] of FACTOR_CATALOGUE) got[g] = (got[g] || 0) + 1;
  for (const [g, n] of Object.entries(GROUP_COUNTS)) {
    if (got[g] !== n) throw new Error(`group ${g} is ${got[g]} not ${n}`);
  }
}

/**
 * Fixed threshold grid. Every cell is a hypothesis and counts toward m forever.
 * Outcomes are residuals, never raw W/L. None are Validated without a backfill.
 */
export function buildHypothesisRegistry(registeredAt = "2026-11-21") {
  const rows = [];
  const add = (family, id, subgroup, outcome, direction) => {
    rows.push({
      family,
      id: `${family}.${id}.${outcome}`,
      subgroup,
      outcome,
      direction,
      registeredAt,
      tier: "untested",
    });
  };
  const outcomes = ["margin_residual", "total_residual"];
  const subgroups = [];

  for (const d of [0, 1, 2, 3, 4]) subgroups.push(["Schedule", `rest_eq_${d}`, `days_rest==${d}`]);
  for (const d of [1, 2, 3]) subgroups.push(["Schedule", `rest_ge_${d}`, `days_rest>=${d}`]);
  subgroups.push(["Schedule", "b2b", "second_night_b2b"]);
  subgroups.push(["Schedule", "b2b_road_first", "b2b_and_first_was_road"]);
  for (const d of [3, 4, 5]) subgroups.push(["Schedule", `density_${d}`, `games_in_window>=${d}`]);
  for (const n of [1, 2, 3, 4, 5]) subgroups.push(["Schedule", `road_trip_${n}`, `road_trip_game==${n}`]);
  for (const n of [1, 2, 3, 4, 5]) subgroups.push(["Schedule", `homestand_${n}`, `homestand_game==${n}`]);

  for (const h of [-3, -2, -1, 1, 2, 3]) subgroups.push(["Travel", `tz_${h}`, `tz_shift==${h}`]);
  subgroups.push(["Travel", "east_home", "eastward_jetlag_home"]);
  subgroups.push(["Travel", "west_adv", "westward_circadian"]);
  subgroups.push(["Travel", "alt_den", "visitor_at_DEN"]);
  subgroups.push(["Travel", "alt_uta", "visitor_at_UTA"]);
  for (const miles of [500, 1000, 1500, 2000]) {
    subgroups.push(["Travel", `miles72_${miles}`, `miles_72h>=${miles}`]);
  }
  for (const hour of [12, 13, 15, 17, 19, 20, 21]) {
    subgroups.push(["Travel", `tip_${hour}`, `local_tip_hour==${hour}`]);
  }
  subgroups.push(["Travel", "day_game", "local_tip<17"]);
  subgroups.push(["Travel", "night_game", "local_tip>=19"]);

  for (const m of [10, 11, 12, 1, 2, 3, 4]) subgroups.push(["Calendar", `month_${m}`, `month==${m}`]);
  subgroups.push(["Calendar", "pre_asb", "before_all_star"]);
  subgroups.push(["Calendar", "post_asb", "after_all_star"]);
  subgroups.push(["Calendar", "first10", "team_game_number<=10"]);
  subgroups.push(["Calendar", "last10", "games_left<=10"]);
  for (const dow of [0, 1, 2, 3, 4, 5, 6]) subgroups.push(["Calendar", `dow_${dow}`, `dow==${dow}`]);

  for (const b of [-1, -0.5, 0.5, 1]) subgroups.push(["Officials", `crew_total_${b}`, `crew_total_delta_bucket_${b}`]);
  subgroups.push(["Officials", "foul_high", "crew_foul_rate_top_quartile"]);
  subgroups.push(["Officials", "foul_low", "crew_foul_rate_bottom_quartile"]);
  subgroups.push(["Officials", "home_lean", "crew_home_lean_nonzero"]);

  subgroups.push(["Exposure", "national_tv", "national_tv"]);
  subgroups.push(["Exposure", "christmas", "christmas"]);
  subgroups.push(["Exposure", "nba_cup", "nba_cup"]);
  subgroups.push(["Exposure", "noon_et", "tip_before_15et"]);

  for (const name of ["revenge", "rematch", "former_team", "contract_year", "birthday", "playoff_race", "tank"]) {
    subgroups.push(["Motivation", name, name]);
  }

  for (const t of [2, 4, 6, 8]) subgroups.push(["Style", `pace_mis_${t}`, `abs_pace_diff>=${t}`]);
  for (const t of [0.02, 0.04, 0.06]) subgroups.push(["Style", `tpa_mis_${t}`, `abs_3pa_rate_diff>=${t}`]);
  for (const t of [2, 4]) subgroups.push(["Style", `reb_mis_${t}`, `abs_reb_rate_diff>=${t}`]);

  for (const side of ["home", "away", "b2b"]) subgroups.push(["Player", side, `player_${side}`]);
  for (const arch of ["point", "wing", "forward", "big"]) {
    subgroups.push(["Player", `vs_${arch}`, `defender_archetype==${arch}`]);
  }

  for (const mv of [0.5, 1, 1.5, 2, 3]) subgroups.push(["Market", `move_${mv}`, `abs_spread_move>=${mv}`]);
  for (const fav of [3, 6, 9, 12, 15]) subgroups.push(["Market", `fav_${fav}`, `abs_spread>=${fav}`]);
  for (const tot of [210, 220, 230, 240]) subgroups.push(["Market", `total_${tot}`, `total>=${tot}`]);

  for (const [family, id, subgroup] of subgroups) {
    for (const outcome of outcomes) add(family, id, subgroup, outcome, "either");
  }
  return rows;
}

export const HYPOTHESES = buildHypothesisRegistry();
