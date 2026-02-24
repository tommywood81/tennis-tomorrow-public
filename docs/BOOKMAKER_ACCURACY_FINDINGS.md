# Getting Bookmaker LSTM Accuracy to ~70%

## What the literature says

- **Stanford CS230 (LSTM)**: **69.6%** on ATP men's singles using **last 50 matches** + **player ranks** + surface. "4% improvement over naive ranking-based predictions."
- **Random forest / ML**: **70–80%** when **serve strength** is the main predictor; ranking difference and surface help.
- **Key predictors**: Serve points won, return points won, **surface-specific** stats, **ranking/ELO**. Surface-specific ELO beats standard ELO.
- **DeepTennis**: 79.5% on **point-by-point** data (different task—point outcome, not match outcome).

## What we're doing differently

| Aspect | Our bookmaker pipeline | Literature / 70% setups |
|--------|------------------------|--------------------------|
| **Rank** | Explicitly removed (guide) | Rank or ELO is a strong predictor |
| **History length** | Last 3 + last 10 (EWM) | Stanford uses **last 50 matches** |
| **Bounds** | adj_spw ∈ [0.55, 0.75], adj_rpw ∈ [0.30, 0.45] | We previously had [0.40, 0.90] / [0.10, 0.50] and got ~70% |
| **Surface** | In sequence (surface_idx) only | Surface-**specific** serve/return stats recommended |
| **Sequence length** | 10 timesteps | 50 in Stanford |

## Likely reasons we're at ~63% instead of ~70%

1. **Tighter bounds** – Clipping adj_spw/adj_rpw more aggressively removes signal (especially for very strong servers/returners).
2. **No rank/ELO** – We deliberately avoid rank; the literature shows it adds several points of accuracy. To keep "no rank" we need stronger substitutes (surface-specific stats, longer history).
3. **Short history** – Only last 10 matches in EWM and in LSTM sequence; 50-match history is used in high-accuracy LSTM work.
4. **No surface-specific recency** – We use global last-10; surface-specific last-10 (e.g. "last 10 on clay") is known to help.

## Recommendations (without reintroducing official rank)

1. **Relax bounds** – Widen adj_spw and adj_rpw clipping to recover signal (e.g. adj_spw ∈ [0.50, 0.80], adj_rpw ∈ [0.25, 0.50]). Keeps bookmaker-style, no rank.
2. **Surface-specific recency** – Add `spw_adj_last10_surface` and `rpw_adj_last10_surface` (same surface only), and use them in matchup edges. Matches literature.
3. **Longer EWM window** – Add last-20 (or last-30) EWM for spw/rpw and use in static/sequence so the model sees more history (closer to "last 50" idea).
4. **Optional: ELO-style rating** – A single number derived from match results (not official ATP rank) is "bookmaker-style" and could replace rank; add only if we want to push further.

## Implemented next

- Relax `ADJ_SPW_BOUNDS` and `ADJ_RPW_BOUNDS` (recommendation 1).
- Add surface-specific last-10 features and wire them into matchup edges (recommendation 2).
