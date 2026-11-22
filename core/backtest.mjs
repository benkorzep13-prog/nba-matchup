/**
 * Appendix B §11 protocol. This module refuses to score the holdout early.
 * It does not contain a completed backtest.
 */

export const TUNE_SEASONS = ["2019-20", "2020-21", "2021-22", "2022-23", "2023-24"];
export const FREEZE_SEASON = "2024-25";
export const SCORE_ONCE_SEASON = "2025-26";
export const SHADOW_SEASON = "2026-27";

export function brier(pairs) {
  if (!pairs.length) return null;
  return pairs.reduce((s, [p, y]) => s + (p - y) ** 2, 0) / pairs.length;
}

export function logLoss(pairs) {
  if (!pairs.length) return null;
  const eps = 1e-12;
  return (
    -pairs.reduce((s, [p, y]) => {
      const pc = Math.min(1 - eps, Math.max(eps, p));
      return s + (y * Math.log(pc) + (1 - y) * Math.log(1 - pc));
    }, 0) / pairs.length
  );
}

export function ece(pairs, bins = 10) {
  if (!pairs.length) return null;
  const buckets = Array.from({ length: bins }, () => ({ n: 0, p: 0, y: 0 }));
  for (const [p, y] of pairs) {
    const i = Math.min(bins - 1, Math.floor(p * bins));
    buckets[i].n += 1;
    buckets[i].p += p;
    buckets[i].y += y;
  }
  let e = 0;
  const diagram = buckets.map((b) => {
    if (!b.n) return { n: 0, pred: null, obs: null };
    const pred = b.p / b.n;
    const obs = b.y / b.n;
    e += (b.n / pairs.length) * Math.abs(pred - obs);
    return { n: b.n, pred, obs };
  });
  return { ece: e, diagram };
}

/**
 * The auditor will not look at 2025–26 scoring until parameters are frozen
 * on 2024–25. Calling this with the holdout and frozen:false throws.
 */
export function scoreSeason({ season, frozen, pairs }) {
  if (season === SCORE_ONCE_SEASON && !frozen) {
    throw new Error(
      "backtest-auditor refuses to score 2025-26 until parameters are frozen on 2024-25",
    );
  }
  if (!pairs || !pairs.length) {
    return {
      season,
      frozen: Boolean(frozen),
      status: "not_run",
      label: "priors — backtest pending",
    };
  }
  return {
    season,
    frozen: Boolean(frozen),
    status: "scored",
    brier: brier(pairs),
    logLoss: logLoss(pairs),
    ece: ece(pairs),
  };
}
