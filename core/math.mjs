/** Numerical helpers for the matchup engine. Priors, not fitted constants. */

export function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

export function americanToImplied(american) {
  const a = Number(american);
  if (!Number.isFinite(a) || a === 0) return null;
  if (a < 0) return (-a) / (-a + 100);
  return 100 / (a + 100);
}

/** Multiplicative / proportional devig. Default method (Appendix B §4.3). */
export function multiplicativeDevig(implied) {
  const ps = implied.map((p) => Number(p));
  if (ps.some((p) => !Number.isFinite(p) || p <= 0)) return null;
  const s = ps.reduce((a, b) => a + b, 0);
  if (s <= 0) return null;
  return ps.map((p) => p / s);
}

/**
 * Shin devig. Binary-search the insider share z so fair probs sum to 1.
 * Used for moneylines with a long favorite (Appendix B §4.3).
 */
export function shinDevig(implied) {
  const raw = implied.map(Number);
  const n = raw.length;
  if (n < 2 || raw.some((p) => !Number.isFinite(p) || p <= 0)) return null;
  const fairAt = (z) => {
    const out = [];
    for (const pi of raw) {
      const inner = z * z + (4 * (1 - z) * pi * pi) / n;
      const num = Math.sqrt(Math.max(0, inner)) - z;
      out.push(num / (2 * (1 - z)));
    }
    return out;
  };
  let lo = 1e-6;
  let hi = 0.999;
  let best = fairAt(0.01);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const vals = fairAt(mid);
    const sum = vals.reduce((a, b) => a + b, 0);
    best = vals;
    if (sum > 1) lo = mid;
    else hi = mid;
  }
  const s = best.reduce((a, b) => a + b, 0);
  return best.map((p) => p / s);
}

export function devigMoneyline(homeAmerican, awayAmerican) {
  const ih = americanToImplied(homeAmerican);
  const ia = americanToImplied(awayAmerican);
  if (ih == null || ia == null) return null;
  const longFav = Math.min(homeAmerican, awayAmerican) <= -300;
  const method = longFav ? "shin" : "multiplicative";
  const fair = longFav ? shinDevig([ih, ia]) : multiplicativeDevig([ih, ia]);
  if (!fair) return null;
  return { home: fair[0], away: fair[1], method, rawHome: ih, rawAway: ia };
}

export function logit(p) {
  const x = clamp(p, 1e-6, 1 - 1e-6);
  return Math.log(x / (1 - x));
}

export function sigmoid(z) {
  if (z >= 0) {
    const ez = Math.exp(-z);
    return 1 / (1 + ez);
  }
  const ez = Math.exp(z);
  return ez / (1 + ez);
}

export function blendProb(marketP, modelP, lambda) {
  return sigmoid((1 - lambda) * logit(marketP) + lambda * logit(modelP));
}

export function blendPoints(market, model, lambda) {
  return (1 - lambda) * market + lambda * model;
}

/** Abramowitz and Stegun 7.1.26 approximation, |error| < 1.5e-7. */
export function normalCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p =
    d *
    t *
    (0.319381530 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

/** Acklam's inverse normal approximation. */
export function invNorm(p) {
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  const phigh = 1 - plow;
  let q;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p > phigh) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  q = p - 0.5;
  const r = q * q;
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}

export function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - pos) + sorted[hi] * (pos - lo);
}

export function mean(xs) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function sampleStd(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

/** Empirical-Bayes padding. Appendix B §7.1. */
export function shrinkRate(numerator, denominator, k, groupMean) {
  return (numerator + k * groupMean) / (denominator + k);
}

export function benjaminiHochberg(pvals, q = 0.1) {
  const m = pvals.length;
  const idx = pvals.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const reject = Array(m).fill(false);
  let cutoff = -1;
  for (let k = 0; k < m; k++) {
    if (idx[k].p <= ((k + 1) / m) * q) cutoff = k;
  }
  for (let k = 0; k <= cutoff; k++) reject[idx[k].i] = true;
  return reject;
}

export function harmonic(m) {
  let s = 0;
  for (let i = 1; i <= m; i++) s += 1 / i;
  return s;
}

export function benjaminiYekutieli(pvals, q = 0.1) {
  const m = pvals.length;
  const c = harmonic(m);
  const idx = pvals.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const reject = Array(m).fill(false);
  let cutoff = -1;
  for (let k = 0; k < m; k++) {
    if (idx[k].p <= ((k + 1) / (m * c)) * q) cutoff = k;
  }
  for (let k = 0; k <= cutoff; k++) reject[idx[k].i] = true;
  return reject;
}

/** Two-sided permutation p for a mean difference. Blocks are optional ids. */
export function permutationP(values, inGroup, { draws = 2000, seed = 1 } = {}) {
  const idxIn = [];
  const idxOut = [];
  for (let i = 0; i < values.length; i++) {
    (inGroup[i] ? idxIn : idxOut).push(i);
  }
  if (idxIn.length === 0 || idxOut.length === 0) return null;
  const meanOf = (ids) => mean(ids.map((i) => values[i]));
  const observed = meanOf(idxIn) - meanOf(idxOut);
  let rng = seed >>> 0;
  const next = () => {
    rng = (1664525 * rng + 1013904223) >>> 0;
    return rng / 4294967296;
  };
  const n = values.length;
  const k = idxIn.length;
  let extreme = 0;
  const ids = values.map((_, i) => i);
  for (let d = 0; d < draws; d++) {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      const tmp = ids[i];
      ids[i] = ids[j];
      ids[j] = tmp;
    }
    const g = ids.slice(0, k);
    const o = ids.slice(k);
    const diff = mean(g.map((i) => values[i])) - mean(o.map((i) => values[i]));
    if (Math.abs(diff) >= Math.abs(observed) - 1e-12) extreme += 1;
  }
  return (extreme + 1) / (draws + 1);
}

export function shrinkEffect(theta, se, tau2) {
  const w = tau2 / (tau2 + se * se);
  return theta * w;
}

export function ewma(values, halfLife) {
  if (!values.length) return null;
  const alpha = 1 - Math.exp(Math.log(0.5) / halfLife);
  let acc = values[0];
  for (let i = 1; i < values.length; i++) acc = alpha * values[i] + (1 - alpha) * acc;
  return acc;
}

/** One Kalman step for a random-walk rating. Appendix B §3.1. */
export function kalmanUpdate({ priorMean, priorVar, obs, obsVar }) {
  const k = priorVar / (priorVar + obsVar);
  return {
    mean: priorMean + k * (obs - priorMean),
    variance: (1 - k) * priorVar,
    gain: k,
  };
}

/** 538-style Elo update. Fallback only. Home prior refit target is +60, not +100. */
export function eloUpdate({ winner, loser, homeWon, k = 20, homeAdv = 60 }) {
  const wAdj = winner + (homeWon ? homeAdv : 0);
  const lAdj = loser + (!homeWon ? homeAdv : 0);
  const expected = 1 / (1 + 10 ** ((lAdj - wAdj) / 400));
  const mov = 1;
  const mult = (Math.log(mov + 1) * 2.2) / (0.001 * Math.abs(wAdj - lAdj) + 2.2);
  const delta = k * mult * (1 - expected);
  return { winner: winner + delta, loser: loser - delta, expected, delta };
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normalSample(rng, mu, sd) {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mu + sd * z;
}
