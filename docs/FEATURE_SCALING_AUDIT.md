# Feature Scaling Audit – LSTM Tennis Pipeline

**Purpose:** Document how each feature is transformed and scaled before model input. Calibration issues may stem from inappropriate scaling (especially rank).

---

## Summary

| Feature location | Feature | Raw form | Transform | Post-transform scale |
|------------------|---------|----------|-----------|----------------------|
| **Sequence (main)** | 6 features | | | |
| | adj_serve_short_decay | serve % − expected | linear | (0, 1) roughly |
| | adj_serve_medium_decay | same | linear | same |
| | opponent_rank_norm | ATP rank 1–2000 | **log-rank** `1 - log(rank)/log(2000)` | [0, 1] |
| | surface_idx | categorical | index 0–4 | 0–4 |
| | days_since_prev | days | raw | 0–365 |
| | form_delta_serve | short − medium | raw | varies |
| | adj_serve_short_decay, adj_serve_medium_decay, opponent_rank_norm, days_since_prev, form_delta_serve | | **StandardScaler (mean, std)** | z-scores |
| | surface_idx | | **no scaling** (categorical) | |
| **Raw sequence** | 4 features | | | |
| | raw_serve_pct | [0, 1] | clip | [0, 1] |
| | raw_serve_diff_prev_year | raw | raw | varies |
| | raw_player_rank_norm | ATP rank 1–2000 | **log-rank** same as above | [0, 1] |
| | raw_opponent_rank_norm | ATP rank 1–2000 | **log-rank** same | [0, 1] |
| | (all 4 base + raw) | | **StandardScaler** on combined (indices 0,1,2,4,5,6,7,8,9) | z-scores |
| **Static** | 8 features | | | |
| | player_rank_norm | ATP rank | **log-rank** `1 - log(rank)/log(2000)` | [0, 1] |
| | opponent_rank_norm | ATP rank | **log-rank** same | [0, 1] |
| | rank_diff | player_norm − opp_norm | raw | [-1, 1] |
| | career_matches_prior | count | raw | 0–1000+ |
| | days_since_prev | days | raw | 0–365 |
| | days_since_prev_log | days | log1p | log(1)–log(366) |
| | recent_weighted_serve | from sequence | raw | varies |
| | form_delta_serve | from sequence | raw | varies |
| | (all 8) | | **StandardScaler** | z-scores |

---

## Key observations

### 1. Rank features use log-rank (implemented)

- **`_rank_to_strength(rank)`** in `sequence_builder.py`:
  ```python
  strength = 1.0 - math.log(rank) / math.log(max_rank)  # max_rank=2000
  ```
- ATP ranks are skewed: rank 1 vs 10 is a larger gap than 100 vs 110.
- Log-rank mapping reflects this; rank 1→1.0, rank 2000→0.0.

### 2. Raw sequence uses log-rank and is scaled

- `raw_player_rank_norm` and `raw_opponent_rank_norm` use `_rank_to_strength` (log-rank).
- Raw sequence is concatenated with base, then **all numeric features** (base + raw) are scaled via mean/std.

### 3. Consistent rank handling

| Location | Rank transform | Scale |
|----------|----------------|-------|
| Main sequence (opponent_rank_norm) | log-rank | [0,1] |
| Raw sequence (player_rank_norm, opponent_rank_norm) | log-rank | [0,1] |
| Static (player_rank_norm, opponent_rank_norm) | log-rank | [0,1] |

### 4. What gets StandardScaler

- **Sequence (combined base + raw):** indices 0,1,2,4,5,6,7,8,9 (excluding surface_idx 3).
- **Static:** all 8 features via `StandardScaler`.

---

## Implementation notes

- Log-rank: `strength = 1 - log(rank) / log(2000)` in `_rank_to_strength()`.
- Raw sequence builder imports and uses `_rank_to_strength` for both player and opponent ranks.
- Preprocessing concatenates base + raw before fitting/transforming the sequence scaler.
