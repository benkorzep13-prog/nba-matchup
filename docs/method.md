# Method

This engine has not yet been run or backtested. Every number in the spec is a starting prior to be re-estimated by the walk-forward backtest.

Label on every slate: **priors — backtest pending**.

Headline blend uses λ = 0.10 in probability logit space and in point space for margin and total. λ rises to 0.30 only after a status change in the last 15 minutes with no line move. That temporary rise is still a prior, not a fitted weight.

The market number is the headline. The independent model is context. Neither is called an edge.

Walk-forward protocol (code in `core/backtest.mjs`, not yet executed on seasons):

- Tune 2019–20 through 2023–24. Bubble and 2020–21 HCA rows downweighted to 0.5 when a backfill exists.
- Freeze on 2024–25.
- Score 2025–26 once, and only after `frozen: true`. The auditor throws otherwise.
- 2026–27 would run in shadow. It is not scored here.

Metrics specified for that future run: Brier, log loss, ECE (10 bins), CRPS/MAE. Benchmarks: home-win-rate, Elo, no-vig close, no-vig open, public-DPM-style minutes. Gap to the close is reported, not hidden.

3P% uses padding K = 240 and is not adjusted for opponent 3P% allowed. Attempts allowed can be adjusted. Defender matchup weight is capped at 25% and is display-only until a backtest says otherwise.
