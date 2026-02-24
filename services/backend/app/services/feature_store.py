from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple

import numpy as np
import pandas as pd
from slugify import slugify

from functools import lru_cache

from ..config import Settings, get_settings


@dataclass
class MatchFeatures:
    sequence: np.ndarray
    static: np.ndarray
    metadata: pd.Series
    swapped: bool


class FeatureStore:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._load_cache()

    def _load_cache(self) -> None:
        data = np.load(self.settings.dataset_cache_path, allow_pickle=True)
        self.sequences = data["sequences"]
        self.static = data["static"]
        self.labels = data["labels"]
        self.masks = data["masks"]
        metadata = pd.DataFrame(data["metadata"].tolist())
        # Expected columns: player, opponent, match_id, tourney_date
        metadata["tourney_date"] = pd.to_datetime(metadata["tourney_date"].astype(str))
        metadata["player"] = metadata["player"].astype(str)
        metadata["opponent"] = metadata["opponent"].astype(str)
        metadata["player_slug"] = metadata["player"].apply(lambda x: slugify(x, separator="-"))
        metadata["opponent_slug"] = metadata["opponent"].apply(lambda x: slugify(x, separator="-"))
        metadata["player_lower"] = metadata["player"].str.lower().str.strip()
        metadata["opponent_lower"] = metadata["opponent"].str.lower().str.strip()
        self.metadata = metadata.reset_index(drop=True)
        self.sequence_dim = self.sequences.shape[-1]
        self.static_dim = self.static.shape[-1]

    def _find_index(self, player_slug: str, opponent_slug: str) -> Tuple[Optional[int], bool]:
        """
        Find the most recent sample for the unordered pair {player_slug, opponent_slug}
        in a *canonical* orientation.

        We always search for rows where ``player_slug`` is lexicographically <= ``opponent_slug``.
        If the caller's first slug does not match that canonical order, the returned match will
        be marked as ``swapped=True`` so the caller can flip probabilities.
        """
        df = self.metadata
        a, b = sorted([player_slug, opponent_slug])

        rows = df[(df["player_slug"] == a) & (df["opponent_slug"] == b)]
        if rows.empty:
            return None, False

        idx = rows.sort_values("tourney_date").index[-1]
        # If the caller passed (player_slug, opponent_slug) in non-canonical order,
        # we treat that as swapped so the model output can be flipped accordingly.
        swapped = player_slug != a
        return idx, swapped

    def get_match_by_names(self, player_name: str, opponent_name: str) -> Optional[MatchFeatures]:
        """
        Locate the most recent sample for (player_name, opponent_name) using the
        same matching logic as the CLI inference script.
        """
        df = self.metadata
        player_key = player_name.lower().strip()
        opponent_key = opponent_name.lower().strip()

        direct = df[
            (df["player_lower"] == player_key)
            & (df["opponent_lower"] == opponent_key)
        ]
        swapped = df[
            (df["player_lower"] == opponent_key)
            & (df["opponent_lower"] == player_key)
        ]

        if not direct.empty:
            idx = direct.sort_values("tourney_date").index[-1]
            swapped_flag = False
        elif not swapped.empty:
            idx = swapped.sort_values("tourney_date").index[-1]
            swapped_flag = True
        else:
            return None

        sequence_row = self.sequences[idx]
        static_row = self.static[idx]
        meta_row = self.metadata.loc[idx]
        return MatchFeatures(
            sequence=sequence_row,
            static=static_row,
            metadata=meta_row,
            swapped=swapped_flag,
        )

    def get_match(self, player_slug: str, opponent_slug: str) -> Optional[MatchFeatures]:
        player_slug = slugify(player_slug, separator="-")
        opponent_slug = slugify(opponent_slug, separator="-")
        idx, swapped = self._find_index(player_slug, opponent_slug)
        if idx is None:
            return None
        sequence_row = self.sequences[idx]
        static_row = self.static[idx]
        meta_row = self.metadata.loc[idx]
        return MatchFeatures(sequence=sequence_row, static=static_row, metadata=meta_row, swapped=swapped)


@lru_cache
def get_feature_store() -> FeatureStore:
    return FeatureStore(get_settings())

