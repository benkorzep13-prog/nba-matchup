import test from "node:test";
import assert from "node:assert/strict";
import {
  americanToImplied,
  benjaminiHochberg,
  benjaminiYekutieli,
  blendProb,
  devigMoneyline,
  kalmanUpdate,
  multiplicativeDevig,
  permutationP,
  shinDevig,
  shrinkEffect,
  shrinkRate,
} from "./math.mjs";
import { FACTOR_CATALOGUE, HYPOTHESES, STATUS_LINE, assertGroupCounts } from "./registry.mjs";
import { analyzeSlate } from "./engine.mjs";
import { blowoutMinutes, playProbability, solveMinutes } from "./model.mjs";
import { scoreSeason, brier, logLoss } from "./backtest.mjs";

test("factor catalogue is 145 and group counts match", () => {
  assert.equal(FACTOR_CATALOGUE.length, 145);
  assertGroupCounts();
  assert.equal(new Set(FACTOR_CATALOGUE.map((f) => f[1])).size, 145);
});

test("hypothesis grid is at least 200 and ids are unique", () => {
  assert.ok(HYPOTHESES.length >= 200, `got ${HYPOTHESES.length}`);
  assert.equal(new Set(HYPOTHESES.map((h) => h.id)).size, HYPOTHESES.length);
});

test("multiplicative and shin devig sum to 1", () => {
  const mult = multiplicativeDevig([0.6, 0.5]);
  assert.ok(Math.abs(mult[0] + mult[1] - 1) < 1e-9);
  const shin = shinDevig([0.87, 0.2]);
  assert.ok(Math.abs(shin[0] + shin[1] - 1) < 1e-6);
  const ml = devigMoneyline(-650, 470);
  assert.equal(ml.method, "shin");
  assert.ok(ml.home > 0.8 && ml.away < 0.2);
});

test("longshot american conversion", () => {
  const p = americanToImplied(-110);
  assert.ok(Math.abs(p - 110 / 210) < 1e-9);
});

test("lambda 0.10 blend sits near the market", () => {
  const b = blendProb(0.8, 0.4, 0.1);
  assert.ok(b > 0.7 && b < 0.8);
});

test("status priors and key-player questionable", () => {
  assert.equal(playProbability("Out"), 0.003);
  assert.equal(playProbability("Questionable"), 0.5);
  assert.equal(playProbability("Questionable", { keyPlayer: true, hoursToTip: 1.5, listedLate: false }), 0.6);
  assert.equal(playProbability("Doubtful"), 0.02);
  assert.equal(playProbability("Probable"), 0.91);
});

test("minutes sum to 240 × (1 + 0.104 P(OT))", () => {
  const players = Array.from({ length: 9 }, (_, i) => ({
    id: `p${i}`,
    base: i < 5 ? 32 - i : 14 - i,
    starter: i < 5,
    pPlay: i === 8 ? 0 : 1,
  }));
  const pot = 0.06;
  const { minutes, target } = solveMinutes(players, pot);
  const sum = [...minutes.values()].reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - target) < 0.2);
  assert.ok(Math.abs(target - 240 * (1 + 0.104 * pot)) < 1e-9);
});

test("blowout pulls a starter down", () => {
  const calm = blowoutMinutes(34, 6, "starter");
  const blow = blowoutMinutes(34, 22, "starter");
  assert.equal(calm, 34);
  assert.ok(blow < 30 && blow > 24);
});

test("3P padding does not move toward opponent", () => {
  const shrunk = shrinkRate(90, 250, 240, 0.362);
  assert.ok(shrunk < 0.362 && shrunk > 0.3);
});

test("BH and BY reject a true spike and spare noise", () => {
  const p = [0.001, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
  const bh = benjaminiHochberg(p, 0.1);
  assert.equal(bh[0], true);
  assert.equal(bh[7], false);
  const by = benjaminiYekutieli(p, 0.1);
  assert.equal(by[0], true);
});

test("permutation p is small for a separated sample", () => {
  const values = [1, 1.2, 0.8, 1.1, 5, 5.2, 4.8, 5.1];
  const group = [false, false, false, false, true, true, true, true];
  const p = permutationP(values, group, { draws: 400, seed: 2 });
  assert.ok(p < 0.05);
});

test("shrinkage pulls a noisy effect toward 0", () => {
  const shrunk = shrinkEffect(4, 3, 0.25);
  assert.ok(Math.abs(shrunk) < 0.2);
});

test("kalman update moves toward the observation", () => {
  const k = kalmanUpdate({ priorMean: 0, priorVar: 4, obs: 2, obsVar: 4 });
  assert.ok(k.mean > 0.9 && k.mean < 1.1);
  assert.ok(k.variance < 4);
});

test("auditor refuses the 2025-26 holdout before freeze", () => {
  assert.throws(() => scoreSeason({ season: "2025-26", frozen: false, pairs: [[0.5, 1]] }));
  const pending = scoreSeason({ season: "2024-25", frozen: false, pairs: [] });
  assert.equal(pending.status, "not_run");
  const scored = scoreSeason({
    season: "2023-24",
    frozen: false,
    pairs: [
      [0.7, 1],
      [0.2, 0],
    ],
  });
  assert.ok(scored.brier < 0.2);
  assert.ok(logLoss([[0.7, 1]]) > 0);
  assert.ok(brier([[0.5, 1]]) === 0.25);
});

test("slate narrative and per-game modules from computed numbers", () => {
  const snap = analyzeSlate({
    slateDate: "20261121",
    generatedAt: "2026-11-22T02:20:00.000Z",
    games: [
      {
        id: "401910028",
        date: "2026-11-22T03:00:00Z",
        status: "STATUS_SCHEDULED",
        venue: "Golden 1 Center",
        city: "Sacramento",
        tv: "NBA TV",
        book: "DraftKings",
        total: 217.5,
        openTotal: 218,
        openSpreadHome: 12.5,
        predictorHomeWp: 0.156,
        officials: ["Tyler Ford", "Sean Corbin", "Brett Nansel"],
        hoursToTip: 1.2,
        injuries: [
          { team: "BOS", name: "Jayson Tatum", status: "Out" },
          { team: "SAC", name: "Maxime Raynaud", status: "Out" },
        ],
        home: {
          abbr: "SAC",
          name: "Kings",
          ppg: 110,
          oppg: 118,
          spread: 12.5,
          moneyline: 470,
          record: "1-14",
          players: [
            { id: "1", name: "Zach LaVine", pos: "G", starter: true, status: "active" },
            { id: "2", name: "DeMar DeRozan", pos: "F", starter: true, status: "active" },
            { id: "3", name: "Domantas Sabonis", pos: "C", starter: true, status: "Questionable" },
          ],
        },
        away: {
          abbr: "BOS",
          name: "Celtics",
          ppg: 114,
          oppg: 108,
          spread: -12.5,
          moneyline: -650,
          record: "11-4",
          players: [
            { id: "4", name: "Jaylen Brown", pos: "G", starter: true, status: "active" },
            { id: "5", name: "Derrick White", pos: "G", starter: true, status: "Out" },
          ],
        },
      },
    ],
  });
  assert.equal(snap.label, "priors — backtest pending");
  assert.equal(snap.statusLine, STATUS_LINE);
  assert.ok(snap.narrative.paragraphs.length >= 5);
  assert.equal(snap.narrative.source, "rules");
  const g = snap.games[0];
  assert.ok(g.paragraphs.length >= 4);
  assert.equal(g.factors.length, 145);
  assert.ok(g.market.noVigAway > 0.8);
  assert.equal(g.headline.edgeLabel.includes("not an edge"), true);
  assert.ok(g.scenarios.some((s) => s.player === "Domantas Sabonis"));
  assert.ok(g.lineups.homeMinutesTarget > 240);
  assert.ok(snap.alerts.some((a) => a.kind === "lock"));
  assert.ok(!g.paragraphs.join(" ").includes("edge of"));
});
