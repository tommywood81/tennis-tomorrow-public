# Feature Null & Cold-Start Report

## 1. Null Check

**Result: OK**

- **Sequences:** 0 NaN, 0 inf (46M elements checked)
- **Static:** 0 NaN, 0 inf (3.5M elements checked)

All bookmaker and sequence features use `fillna()` with global means (SPW, RPW) or sensible defaults before scaling. The sequence builder asserts no NaN in valid masked positions.

## 2. Cold Start Check

**Result: Small edge case (2.3%)**

- **Early 2024 matches sampled:** 1,878
- **Matches with ZERO history (cold start):** 44 (2.3%)
- **Matches with ≥1 history:** 1,834 (97.7%)
- **Mean history length (non-zero):** 17.9 matches

**Interpretation:** The sequence builder uses `history_before_today = [r for r in player_history if r["match_datetime"] < current_date]`. So a Jan 2024 match gets all prior matches (2023, 2022, …). We are **not** cold-starting on 2024 in general. The 44 cases with zero history are likely new players or long gaps in the data; they receive zero-padded sequences (mask=0) and are handled by the model.

## 3. Conclusion

Nulls and cold start are both acceptable. A/B test can proceed.
