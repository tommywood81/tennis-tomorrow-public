# Advanced Inference: Sequence Features to Override

## Overview

The LSTM model uses **sequence features** (last-10 matches) and **static features** (career stats, frozen Nov-14). For Advanced Inference, we override **only** the sequence features.

## Sequence Features (Last-10 Matches)

Based on `src/new_lstm_strategy/sequence_builder.py`, the sequence features are:

### 1. **serve_pct_weighted** ✅ OVERRIDDEN
- **What**: Weighted serve percentage (points won on serve / total serve points)
- **Source**: Calculated from `1stWon`, `2ndWon`, `svpt` in each match
- **Status**: ✅ Currently overridden from Tennis Abstract serve stats

### 2. **return_pct_weighted** ⚠️ PARTIALLY OVERRIDDEN
- **What**: Weighted return percentage (points won on return / opponent's serve points)
- **Source**: Calculated from `opponent_1stWon`, `opponent_2ndWon`, `opponent_svpt`
- **Status**: ⚠️ **BLOCKER** - Tennis Abstract player history doesn't include opponent serve stats
- **Current**: Raises error (as intended during development)

### 3. **win_flag** ✅ OVERRIDDEN
- **What**: Win (1.0) or loss (0.0) for each match
- **Source**: Parsed from match result ("W" or "L")
- **Status**: ✅ Currently overridden

### 4. **opp_rank_norm_weighted** ✅ OVERRIDDEN
- **What**: Normalized opponent rank (lower rank → higher strength, 0-1 scale)
- **Source**: `opponent_rank` from Tennis Abstract (vRk column)
- **Status**: ✅ Currently overridden

### 5. **opp_strength_weighted** ⚠️ NOT OVERRIDDEN
- **What**: Opponent baseline strength (career win %)
- **Source**: `opponent_career_win_pct_since2018` or `opponent_career_win_pct`
- **Status**: ⚠️ Not available from Tennis Abstract - uses frozen value (0.0 default)

### 6. **surface_idx** ✅ OVERRIDDEN
- **What**: Surface index (Hard=0, Clay=1, Grass=2, Carpet=3, Unknown=4)
- **Source**: Parsed from Tennis Abstract `surface` column
- **Status**: ✅ Currently overridden

### 7. **tourney_level_idx** ⚠️ NOT PROPERLY OVERRIDDEN
- **What**: Tournament level index (C=0, A=1, 250=2, 500=3, M=4, G=5, F=6, D=7, Unknown=8)
- **Source**: Should be inferred from tournament name
- **Status**: ⚠️ **ISSUE** - Currently uses prediction match's `tourney_level` for ALL matches
- **Fix Needed**: Infer `tourney_level` from tournament name (e.g., "Australian Open" → "G")

### 8. **round_idx** ✅ OVERRIDDEN
- **What**: Round index (RR=0, R128=1, R64=2, ..., F=9, Unknown=11)
- **Source**: Parsed from Tennis Abstract `round` column
- **Status**: ✅ Currently overridden

### 9. **days_since_prev_weighted** ⚠️ AUTO-CALCULATED (NEEDS VERIFICATION)
- **What**: Days between consecutive matches (weighted)
- **Source**: Calculated automatically by `sequence_builder.build()` from match dates
- **Status**: ⚠️ **AUTO-CALCULATED** - Sequence builder computes `days_since_prev` from sorted match dates
- **Calculation**: `diff()` on `match_datetime` grouped by player, clipped to [0, 365]
- **Verification**: ✅ Should work correctly if matches are sorted by date (most recent first)

### 10. **decay_weight** ✅ AUTO-CALCULATED
- **What**: Exponential decay weight for recency (newest match = 1.0)
- **Source**: Calculated by sequence builder based on half-life (3.0 matches)
- **Status**: ✅ Auto-calculated correctly

## Summary

### ✅ Currently Overridden Correctly:
1. `serve_pct_weighted` - from serve stats
2. `win_flag` - from match result
3. `opp_rank_norm_weighted` - from opponent rank
4. `surface_idx` - from surface
5. `round_idx` - from round
6. `days_since_prev_weighted` - auto-calculated from dates
7. `decay_weight` - auto-calculated

### ⚠️ Issues to Fix:

1. **`tourney_level_idx`** - Currently uses prediction match's level for all matches
   - **Fix**: Infer tournament level from tournament name
   - **Mapping needed**: "Australian Open" → "G", "Miami Masters" → "M", etc.

2. **`return_pct_weighted`** - Cannot calculate without opponent serve stats
   - **Current**: Raises error (as intended)
   - **Options**: 
     - Estimate from match score/result
     - Use frozen value
     - Require opponent match history

3. **`opp_strength_weighted`** - Not available from Tennis Abstract
   - **Current**: Uses default 0.0 (frozen)
   - **Impact**: Lower than ideal, but acceptable

## Tournament Level Inference

We need to infer `tourney_level` from tournament names. Common patterns:

- **Grand Slams (G)**: "Australian Open", "French Open", "Roland Garros", "Wimbledon", "US Open"
- **ATP 1000 (M)**: "Miami", "Indian Wells", "Monte Carlo", "Madrid", "Rome", "Toronto", "Cincinnati", "Shanghai", "Paris Masters"
- **ATP 500 (500)**: "Dubai", "Barcelona", "Hamburg", "Washington", "Beijing", "Vienna", "Basel"
- **ATP 250 (250)**: Most other tournaments
- **ATP Finals (F)**: "Tour Finals", "ATP Finals", "Nitto ATP Finals"
- **Challenger (C)**: "Challenger" in name
- **ATP Cup (A)**: "ATP Cup", "United Cup"
- **Davis Cup (D)**: "Davis Cup"

## Days Between Matches

The `days_since_prev` is **automatically calculated** by the sequence builder when it processes the DataFrame:

```python
working["days_since_prev"] = (
    working.groupby("player")["match_datetime"]
    .diff()
    .dt.days.fillna(0)
    .clip(lower=0, upper=365)
    .astype(float)
)
```

**Requirements:**
- Matches must be sorted by date (most recent first) ✅ Already done
- First match in sequence gets `days_since_prev = 0` (no previous match)
- Subsequent matches get days since previous match
- Clipped to max 365 days

**Status**: ✅ Should work correctly - sequence builder handles this automatically.

## Next Steps

1. **Add tournament level inference** from tournament names
2. **Handle return_pct** (either estimate or use frozen)
3. **Verify days_since_prev** calculation with test data
