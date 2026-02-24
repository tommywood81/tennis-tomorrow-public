# Temporal Leakage Verification Tests

## Overview

These tests verify that sequence building does **NOT** leak future information when building sequences on a full dataset (train+val+test) before temporal splitting.

## Critical Concern Addressed

**Issue**: When sequences are built on the full dataset before train/test split, sequences for test matches (e.g., March 15, 2025) must only use historical data from **before** that match date, not matches that occur later in the dataset (e.g., April 2025).

## Test Suite

### 1. `test_sequence_builder_no_future_leakage`
**Purpose**: Verify that sequences for a test match don't include future matches

**Method**:
- Creates synthetic dataset with matches spanning Jan-Mar 2025
- Test match is on March 15, 2025
- Dataset includes matches AFTER March 15 (potential leakage sources)
- Verifies that when building sequence for March 15 match, only matches before March 15 are in history

**Key Verification**:
- Future matches exist in dataset (confirms test validity)
- Sequence history length matches expected (only past matches)
- Chronological processing ensures future matches aren't in history yet

### 2. `test_sequence_builder_chronological_processing`
**Purpose**: Verify strict chronological ordering per player

**Method**:
- Traces through Player A's match processing
- Verifies matches are sorted chronologically
- Confirms test match is processed before future matches

**Key Verification**:
- Matches sorted by `match_datetime` before processing
- Test match position < future match positions in sorted order

### 3. `test_separate_rolling_builder_no_leakage`
**Purpose**: Verify the separate rolling sequence builder (used in `raw_rolling` mode) doesn't leak

**Method**: Same as test 1, but using `SeparateRollingSequenceBuilder`

**Key Verification**:
- Both sequence builders handle temporal ordering correctly

### 4. `test_real_dataset_sequence_ordering`
**Purpose**: Verify on real dataset that sequences don't leak

**Method**:
- Loads actual preprocessed data
- Selects a player with many matches
- Picks a mid-point match to test
- Verifies sequence only includes matches before test match date

**Key Verification**:
- Real-world validation of chronological processing
- Sequence history size matches expected (only past matches)

## Test Results

All 4 tests **PASS** ✅

This confirms that:
1. **Sequences are built chronologically per player** - matches are processed in date order
2. **Future matches are NOT in history** - when building sequence for a test match, only matches before that date are included
3. **Both builders handle this correctly** - `SequenceFeatureBuilder` and `SeparateRollingSequenceBuilder`

## How It Works

The sequence builders work by:
1. **Grouping by player** - `groupby("player")`
2. **Processing iteratively** - For each match:
   - Build sequence from current `history` (which only contains past matches)
   - Add current match to `history` AFTER building sequence
3. **Chronological sorting** - Data is sorted by `["player", "match_datetime"]` before processing

This ensures that when processing a March 15 match:
- History contains matches from Jan 1 - March 14 ✅
- History does NOT contain matches from March 16+ ❌ (they haven't been added yet)

## Confidence Level

**HIGH** ✅ - The tests confirm that temporal leakage does NOT occur in sequence building, even when building on the full dataset before splitting.

## Running the Tests

```bash
# Run all temporal leakage tests
pytest tests/new_lstm_strategy/test_temporal_leakage.py -v

# Run specific test
pytest tests/new_lstm_strategy/test_temporal_leakage.py::test_sequence_builder_no_future_leakage -v -s
```

## Recommendations

While the tests confirm no leakage, consider:
1. **Explicit date filtering** - Filter dataset by cutoff date before sequence building for extra safety
2. **Add date assertions** - Add assertions in sequence builders to explicitly check dates
3. **Documentation** - Document that chronological processing prevents leakage

However, the current implementation is **correct** and the tests verify it works as expected.

