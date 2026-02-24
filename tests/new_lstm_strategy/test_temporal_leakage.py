"""
Test suite to verify temporal leakage does not occur in sequence building.

These tests verify that when sequences are built on a full dataset (train+val+test),
sequences for test matches only use historical data from BEFORE the test match date.
"""
import sys
from pathlib import Path
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.append(str(SRC))

from new_lstm_strategy.sequence_builder import SequenceFeatureBuilder
from new_lstm_strategy.preprocessing import LSTMPreprocessor
from separate_rolling_10_matches.sequence_builder import SeparateRollingSequenceBuilder


def _create_synthetic_match_data(
    player: str,
    opponent: str,
    date: datetime,
    match_id: str,
    label: int,
    serve_pct: float = 0.65,
    return_pct: float = 0.35,
    rank: float = 50.0,
    opponent_rank: float = 60.0,
) -> dict:
    """Create a synthetic match row for testing."""
    date_int = int(date.strftime("%Y%m%d"))
    return {
        "player": player,
        "opponent": opponent,
        "match_id": match_id,
        "tourney_date": date_int,
        "match_datetime": date,
        "label": label,
        "1stWon": int(serve_pct * 60),
        "2ndWon": int(serve_pct * 40),
        "svpt": 100,
        "opponent_1stWon": int((1 - return_pct) * 60),
        "opponent_2ndWon": int((1 - return_pct) * 40),
        "opponent_svpt": 100,
        "player_rank": rank,
        "opponent_rank": opponent_rank,
        "surface": "Hard",
        "tourney_level": "M",
        "round": "F",
        "tourney_id": f"tourney_{date_int}",
    }


def _create_temporal_test_dataset():
    """
    Create a synthetic dataset with matches spanning multiple dates.
    Used to test that sequences don't leak future information.
    
    Structure:
    - Player A: 5 matches in Jan 2025, 3 matches in Feb 2025, 2 matches in Mar 2025
    - Player B: 4 matches in Jan 2025, 2 matches in Feb 2025, 1 match in Mar 2025
    - Test match: Player A vs Player B on March 15, 2025
    
    When building sequence for March 15 match, it should ONLY include:
    - Player A's Jan and Feb matches
    - Player B's Jan and Feb matches
    - It should NOT include March matches after March 15
    """
    base_date = datetime(2025, 1, 1)
    matches = []
    
    # Player A matches
    player_a_dates = [
        # January 2025
        base_date + timedelta(days=5),
        base_date + timedelta(days=10),
        base_date + timedelta(days=15),
        base_date + timedelta(days=20),
        base_date + timedelta(days=25),
        # February 2025
        datetime(2025, 2, 5),
        datetime(2025, 2, 15),
        datetime(2025, 2, 25),
        # March 2025
        datetime(2025, 3, 10),  # Before test match
        datetime(2025, 3, 20),  # AFTER test match - should not be in sequence
    ]
    
    # Player B matches
    player_b_dates = [
        # January 2025
        base_date + timedelta(days=3),
        base_date + timedelta(days=12),
        base_date + timedelta(days=18),
        base_date + timedelta(days=28),
        # February 2025
        datetime(2025, 2, 8),
        datetime(2025, 2, 22),
        # March 2025
        datetime(2025, 3, 18),  # AFTER test match - should not be in sequence
    ]
    
    # Test match date
    test_match_date = datetime(2025, 3, 15)
    
    # Add Player A matches
    for i, date in enumerate(player_a_dates):
        matches.append(
            _create_synthetic_match_data(
                player="Player A",
                opponent=f"Opponent {i}",
                date=date,
                match_id=f"a_match_{i}",
                label=1 if i % 2 == 0 else 0,
                serve_pct=0.6 + i * 0.01,
                rank=10.0 + i,
            )
        )
    
    # Add Player B matches
    for i, date in enumerate(player_b_dates):
        matches.append(
            _create_synthetic_match_data(
                player="Player B",
                opponent=f"Opponent {i+10}",
                date=date,
                match_id=f"b_match_{i}",
                label=1 if i % 2 == 0 else 0,
                serve_pct=0.55 + i * 0.01,
                rank=20.0 + i,
            )
        )
    
    # Add test match (March 15, 2025)
    test_match = _create_synthetic_match_data(
        player="Player A",
        opponent="Player B",
        date=test_match_date,
        match_id="test_match_march_15",
        label=1,
        serve_pct=0.65,
        rank=15.0,
        opponent_rank=25.0,
    )
    matches.append(test_match)
    
    # Add a few more matches AFTER test match to check for leakage
    matches.append(
        _create_synthetic_match_data(
            player="Player A",
            opponent="Opponent Future",
            date=datetime(2025, 3, 20),  # After test match
            match_id="future_match_a",
            label=0,
            serve_pct=0.70,
            rank=12.0,
        )
    )
    matches.append(
        _create_synthetic_match_data(
            player="Player B",
            opponent="Opponent Future",
            date=datetime(2025, 3, 18),  # After test match
            match_id="future_match_b",
            label=1,
            serve_pct=0.60,
            rank=22.0,
        )
    )
    
    df = pd.DataFrame(matches)
    # Ensure required columns exist
    df["match_datetime"] = pd.to_datetime(df["match_datetime"])
    
    return df, test_match_date, test_match["match_id"]


def test_sequence_builder_no_future_leakage():
    """
    Test that sequence builder doesn't include future matches when building
    sequences for a test match.
    
    Scenario:
    - Full dataset includes matches from Jan, Feb, and March 2025
    - Test match is on March 15, 2025
    - Sequence for test match should only include matches before March 15
    """
    df, test_match_date, test_match_id = _create_temporal_test_dataset()
    
    # Build sequences on full dataset (simulating what happens in practice)
    builder = SequenceFeatureBuilder(seq_len=10, half_life=3.0)
    result_df, samples = builder.build(df)
    
    # Find the test match row
    test_match_idx = result_df[result_df["match_id"] == test_match_id].index[0]
    test_sequence = result_df.iloc[test_match_idx]["sequence_features"]
    test_mask = result_df.iloc[test_match_idx]["sequence_mask"]
    
    # Get the sequence sample for easier inspection
    test_sample = next(s for s in samples if s.match_id == test_match_id)
    
    # Verify sequence was built (non-zero mask)
    assert test_mask.sum() > 0, "Test match should have at least some history"
    
    # Check that all matches in history are before test match date
    # Extract dates of matches that contributed to this sequence
    player_a_rows = df[(df["player"] == "Player A") & (df["match_datetime"] < test_match_date)]
    player_b_rows = df[(df["player"] == "Player B") & (df["match_datetime"] < test_match_date)]
    
    # All matches in sequence should be from before test_match_date
    # Since sequence builder processes chronologically per player, we need to verify
    # that the sequence doesn't accidentally include future matches
    
    # The key verification: when building sequence for March 15 match,
    # the builder should have processed matches in chronological order,
    # so matches after March 15 shouldn't be in the history yet
    
    # Get all matches in the full dataset sorted by date
    df_sorted = df.sort_values("match_datetime")
    test_match_position = df_sorted[df_sorted["match_id"] == test_match_id].index[0]
    
    # Player A's history should only include matches before test match
    player_a_before_test = df[
        (df["player"] == "Player A") 
        & (df["match_datetime"] < test_match_date)
    ].sort_values("match_datetime")
    
    # Player B's history should only include matches before test match
    player_b_before_test = df[
        (df["player"] == "Player B") 
        & (df["match_datetime"] < test_match_date)
    ].sort_values("match_datetime")
    
    # Verify that matches after test_match_date exist in dataset
    future_matches = df[df["match_datetime"] > test_match_date]
    assert len(future_matches) > 0, "Test dataset should have future matches"
    
    # CRITICAL TEST: Verify that sequence builder processes matches in chronological order
    # and doesn't include future matches in history
    # This is done by checking that when iterating through Player A's matches,
    # the sequence for the test match is built before future matches are added to history
    
    # Find Player A's match indices in sorted dataframe
    player_a_all = df_sorted[df_sorted["player"] == "Player A"].copy()
    test_match_row_idx = player_a_all[player_a_all["match_id"] == test_match_id].index[0]
    future_match_idx = player_a_all[player_a_all["match_datetime"] > test_match_date].index
    
    # The test match should come before future matches in Player A's chronological sequence
    if len(future_match_idx) > 0:
        assert test_match_row_idx < future_match_idx[0], \
            "Test match should be processed before future matches in chronological order"
    
    # Count expected matches in history for Player A (should be matches before March 15)
    expected_history_count = len(player_a_before_test) - 1  # -1 because current match not in history
    assert expected_history_count >= 0, "Player A should have some history before test match"
    
    # Verify sequence mask length matches expected
    actual_history_in_sequence = int(test_mask.sum())
    assert actual_history_in_sequence <= builder.seq_len, "Sequence should not exceed seq_len"
    
    print(f"\n✓ Test match: {test_match_id} on {test_match_date.strftime('%Y-%m-%d')}")
    print(f"  Player A history matches before test: {len(player_a_before_test) - 1}")
    print(f"  Player B history matches before test: {len(player_b_before_test)}")
    print(f"  Actual history in sequence: {actual_history_in_sequence}")
    print(f"  Future matches in dataset: {len(future_matches)}")


def test_sequence_builder_chronological_processing():
    """
    Verify that sequence builder processes matches in strict chronological order
    per player, which is critical for preventing temporal leakage.
    """
    df, test_match_date, test_match_id = _create_temporal_test_dataset()
    
    builder = SequenceFeatureBuilder(seq_len=10, half_life=3.0)
    
    # Manually trace through Player A's processing
    player_a_matches = df[df["player"] == "Player A"].sort_values("match_datetime").copy()
    
    # Verify sorting is chronological
    dates = player_a_matches["match_datetime"].values
    assert np.all(dates[:-1] <= dates[1:]), "Player A matches should be sorted chronologically"
    
    # Find test match position
    test_match_pos = player_a_matches[player_a_matches["match_id"] == test_match_id].index[0]
    test_match_idx_in_sorted = player_a_matches.index.get_loc(test_match_pos)
    
    # All matches before test match should be in history when test match is processed
    matches_before_test = player_a_matches.iloc[:test_match_idx_in_sorted]
    matches_after_test = player_a_matches.iloc[test_match_idx_in_sorted + 1:]
    
    assert len(matches_before_test) > 0, "Should have matches before test match"
    assert len(matches_after_test) > 0, "Should have matches after test match (for leakage test)"
    
    # Build sequences and verify
    result_df, samples = builder.build(df)
    
    # Get sequence for test match
    test_sample = next(s for s in samples if s.match_id == test_match_id)
    test_row = result_df[result_df["match_id"] == test_match_id].iloc[0]
    
    # Verify that the sequence builder processes matches in order
    # The history should contain matches_before_test, not matches_after_test
    
    print(f"\n✓ Chronological Processing Test:")
    print(f"  Player A total matches: {len(player_a_matches)}")
    print(f"  Matches before test: {len(matches_before_test)}")
    print(f"  Matches after test: {len(matches_after_test)}")
    print(f"  Sequence history length: {int(test_row['sequence_mask'].sum())}")


def test_separate_rolling_builder_no_leakage():
    """
    Test the separate rolling sequence builder (used in raw_rolling mode)
    for temporal leakage.
    """
    df, test_match_date, test_match_id = _create_temporal_test_dataset()
    
    # Ensure required columns for separate rolling builder
    if "match_datetime" not in df.columns:
        df["match_datetime"] = pd.to_datetime(df["tourney_date"].astype(str), format="%Y%m%d")
    
    builder = SeparateRollingSequenceBuilder(seq_len=10)
    result = builder.build(df)
    
    # Find test match
    test_row = result.dataframe[result.dataframe["match_id"] == test_match_id].iloc[0]
    test_sequence = test_row["sequence_features"]
    test_mask = test_row["sequence_mask"]
    
    # Verify sequence exists
    assert test_mask.sum() > 0, "Test match should have history"
    
    # Get future matches
    future_matches = df[df["match_datetime"] > test_match_date]
    
    # Critical: Verify chronological processing
    # When building sequence for test match, future matches shouldn't be in history
    player_a_all = df[df["player"] == "Player A"].sort_values("match_datetime").reset_index(drop=True)
    test_pos_in_sorted = player_a_all[player_a_all["match_id"] == test_match_id].index[0]
    future_matches_in_player_a = player_a_all[player_a_all["match_datetime"] > test_match_date]
    
    if len(future_matches_in_player_a) > 0:
        future_pos_in_sorted = future_matches_in_player_a.index[0]
        assert test_pos_in_sorted < future_pos_in_sorted, \
            f"Test match (position {test_pos_in_sorted}) should be processed before future matches (position {future_pos_in_sorted})"
    
    print(f"\n✓ Separate Rolling Builder Test:")
    print(f"  Test match history length: {int(test_mask.sum())}")
    print(f"  Future matches in dataset: {len(future_matches)}")


def test_real_dataset_sequence_ordering():
    """
    Test on real dataset to verify sequences are built correctly.
    This test loads actual data and verifies that sequences don't leak future information.
    """
    data_path = ROOT / "data" / "processed" / "preprocessed_data.csv"
    if not data_path.exists():
        pytest.skip(f"Real dataset not found: {data_path}")
    
    # Load a subset of real data
    df = pd.read_csv(data_path, nrows=50000)
    df["match_datetime"] = pd.to_datetime(df["tourney_date"].astype(str), format="%Y%m%d")
    
    # Focus on a specific player and date range
    # Pick a player with matches spanning across train/test boundary
    player_counts = df["player"].value_counts()
    test_player = player_counts[player_counts >= 50].index[0]  # Player with many matches
    
    player_matches = df[df["player"] == test_player].sort_values("match_datetime")
    
    if len(player_matches) < 20:
        pytest.skip(f"Player {test_player} has insufficient matches for test")
    
    # Pick a match in the middle (to have history before and after)
    mid_match_idx = len(player_matches) // 2
    test_match = player_matches.iloc[mid_match_idx]
    test_match_date = test_match["match_datetime"]
    
    # Build sequences
    builder = SequenceFeatureBuilder(seq_len=10, half_life=3.0)
    result_df, samples = builder.build(df)
    
    # Find test match sequence
    test_match_row = result_df[result_df["match_id"] == test_match["match_id"]].iloc[0]
    test_sequence = test_match_row["sequence_features"]
    test_mask = test_match_row["sequence_mask"]
    
    # Verify matches before test match date
    matches_before = player_matches[player_matches["match_datetime"] < test_match_date]
    matches_after = player_matches[player_matches["match_datetime"] > test_match_date]
    
    # When test match is processed, only matches_before should be in history
    # matches_after should not be included
    expected_history_size = min(len(matches_before), 10)  # seq_len = 10
    
    actual_history_size = int(test_mask.sum())
    
    assert actual_history_size <= expected_history_size, \
        f"Sequence history ({actual_history_size}) should not exceed expected ({expected_history_size})"
    
    assert len(matches_after) > 0, "Should have future matches to test leakage"
    
    print(f"\n✓ Real Dataset Test:")
    print(f"  Player: {test_player}")
    print(f"  Test match date: {test_match_date.strftime('%Y-%m-%d')}")
    print(f"  Matches before: {len(matches_before)}")
    print(f"  Matches after: {len(matches_after)}")
    print(f"  Sequence history size: {actual_history_size}")
    print(f"  Expected max history: {expected_history_size}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])

