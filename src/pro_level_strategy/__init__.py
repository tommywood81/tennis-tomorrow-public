"""
Pro-level LSTM strategy: Sackmann ATP data, strict anti-leakage, seq_len=10.

Feature engineering: serve/return skills, expectation vs reality, form deltas,
surface, style clustering, matchup edges, fatigue. Outputs (N, 10, F), (N, S), labels.
"""

from .preprocessing import ProLevelPreprocessor, PreprocessedDataset

__all__ = ["ProLevelPreprocessor", "PreprocessedDataset"]
