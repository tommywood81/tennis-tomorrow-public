from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from slugify import slugify

from .config import Settings, get_settings
from .schemas import PlayerRecentMatch, PlayerSummary, StoryMetric

_DATA_LOCK = threading.Lock()


@dataclass
class PlayerRecord:
    slug: str
    name: str
    country: Optional[str]
    handedness: Optional[str]
    height_cm: Optional[int]
    last_rank: Optional[int]
    last_rank_date: Optional[pd.Timestamp]


class DataRepository:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._df = self._load_dataset()
        self._player_cache = self._build_player_cache()

    def _load_dataset(self) -> pd.DataFrame:
        # Optimize memory: only load columns we actually use
        # Process in chunks to reduce peak memory usage
        print("Loading dataset (this may take 30-60 seconds)...")
        
        # Define columns we actually need
        required_cols = [
            'tourney_date', 'player', 'opponent', 'winner_name',
            'winner_ioc', 'loser_ioc', 'winner_hand', 'loser_hand',
            'winner_ht', 'loser_ht', 'winner_rank', 'loser_rank',
            'w_svpt', 'l_svpt', 'w_1stIn', 'l_1stIn', 'w_1stWon', 'l_1stWon',
            'w_2ndWon', 'l_2ndWon', 'w_bpSaved', 'l_bpSaved',
            'w_bpFaced', 'l_bpFaced', 'surface', 'tourney_level', 'tourney_id',
            'score', 'tourney_name', 'round'  # Needed for h2h endpoint
        ]
        
        # Read CSV with only required columns and optimized dtypes
        df = pd.read_csv(
            self.settings.dataset_path,
            usecols=required_cols,
            dtype={
                'tourney_date': 'int64',
                'player': 'string',
                'opponent': 'string',
                'winner_name': 'string',
                'winner_ioc': 'string',
                'loser_ioc': 'string',
                'winner_hand': 'string',
                'loser_hand': 'string',
                'winner_rank': 'float32',
                'loser_rank': 'float32',
                'w_svpt': 'float32',
                'l_svpt': 'float32',
                'w_1stIn': 'float32',
                'l_1stIn': 'float32',
                'w_1stWon': 'float32',
                'l_1stWon': 'float32',
                'w_2ndWon': 'float32',
                'l_2ndWon': 'float32',
                'w_bpSaved': 'float32',
                'l_bpSaved': 'float32',
                'w_bpFaced': 'float32',
                'l_bpFaced': 'float32',
                'winner_ht': 'float32',
                'loser_ht': 'float32',
                'surface': 'string',
                'tourney_level': 'string',
                'tourney_id': 'string',
            }
        )
        df["tourney_date"] = pd.to_datetime(df["tourney_date"].astype(str), format="%Y%m%d")
        df["player"] = df["player"].astype(str)
        df["opponent"] = df["opponent"].astype(str)
        print(f"Dataset loaded: {len(df)} rows, using {df.memory_usage(deep=True).sum() / 1024**2:.1f} MB")
        winner_mask = df["player"] == df["winner_name"]

        def pick(col_w: str, col_l: str) -> pd.Series:
            return np.where(winner_mask, df[col_w], df[col_l])

        df["player_ioc"] = pick("winner_ioc", "loser_ioc")
        df["player_hand"] = pick("winner_hand", "loser_hand")
        df["player_ht"] = pick("winner_ht", "loser_ht")
        
        # Map winner/loser ranks to player/opponent ranks
        if "winner_rank" in df.columns and "loser_rank" in df.columns:
            df["player_rank"] = pick("winner_rank", "loser_rank")
            df["opponent_rank"] = np.where(winner_mask, df["loser_rank"], df["winner_rank"])

        serve_cols = [
            ("svpt", "w_svpt", "l_svpt"),
            ("1stIn", "w_1stIn", "l_1stIn"),
            ("1stWon", "w_1stWon", "l_1stWon"),
            ("2ndWon", "w_2ndWon", "l_2ndWon"),
            ("bpSaved", "w_bpSaved", "l_bpSaved"),
            ("bpFaced", "w_bpFaced", "l_bpFaced"),
        ]
        for suffix, win_col, lose_col in serve_cols:
            df[f"player_{suffix}"] = pick(win_col, lose_col)
            df[f"opponent_{suffix}"] = np.where(winner_mask, df[lose_col], df[win_col])

        df["player_serve_pct"] = (
            (df["player_1stWon"] + df["player_2ndWon"]) / df["player_svpt"].replace(0, np.nan)
        ).fillna(0.0)
        df["player_return_pct"] = (
            (
                df["opponent_svpt"]
                - df["opponent_1stWon"]
                - df["opponent_2ndWon"]
            )
            / df["opponent_svpt"].replace(0, np.nan)
        ).fillna(0.0)

        # Slugs used for stable player IDs across the API
        df["player_slug"] = df["player"].apply(lambda x: slugify(str(x), separator="-"))
        df["opponent_slug"] = df["opponent"].apply(lambda x: slugify(str(x), separator="-"))
        # Winner slug is used to avoid double-counting dual-perspective rows in H2H
        if "winner_name" in df.columns:
            df["winner_slug"] = df["winner_name"].apply(lambda x: slugify(str(x), separator="-"))
        return df

    def _build_player_cache(self) -> Dict[str, PlayerRecord]:
        latest = (
            self._df.sort_values("tourney_date")
            .groupby("player_slug")
            .tail(1)
        )
        cache: Dict[str, PlayerRecord] = {}
        for _, row in latest.iterrows():
            cache[row["player_slug"]] = PlayerRecord(
                slug=row["player_slug"],
                name=row["player"],
                country=row.get("player_ioc"),
                handedness=row.get("player_hand"),
                height_cm=int(row["player_ht"]) if not pd.isna(row["player_ht"]) else None,
                last_rank=int(row["player_rank"]) if not pd.isna(row["player_rank"]) else None,
                last_rank_date=row["tourney_date"],
            )
        return cache

    def search_players(self, query: Optional[str], limit: int) -> List[PlayerSummary]:
        if not query:
            source = list(self._player_cache.values())
        else:
            q = query.lower()
            source = [
                record
                for record in self._player_cache.values()
                if q in record.name.lower()
            ]
        source = sorted(source, key=lambda r: (r.last_rank or 9999))
        return [
            PlayerSummary(
                id=record.slug,
                name=record.name,
                country=record.country,
                handedness=record.handedness,
                height_cm=record.height_cm,
                last_rank=record.last_rank,
                last_rank_date=record.last_rank_date.date() if record.last_rank_date else None,
            )
            for record in source[:limit]
        ]

    def get_player(self, slug: str) -> Optional[PlayerSummary]:
        record = self._player_cache.get(slug)
        if not record:
            return None
        # Handle pandas NA values - convert to None for optional fields
        handedness = record.handedness if pd.notna(record.handedness) else None
        country = record.country if pd.notna(record.country) else None
        return PlayerSummary(
            id=record.slug,
            name=record.name,
            country=country,
            handedness=handedness,
            height_cm=record.height_cm,
            last_rank=record.last_rank,
            last_rank_date=record.last_rank_date.date() if record.last_rank_date else None,
        )

    def _player_frame(self, slug: str) -> pd.DataFrame:
        return self._df[self._df["player_slug"] == slug].sort_values("tourney_date", ascending=False)

    def recent_matches(self, slug: str, limit: int = 10) -> List[PlayerRecentMatch]:
        frame = self._player_frame(slug)

        # Drop walkovers/retirements and matches without serve stats to avoid
        # misleading 0% serve/return lines in the dashboard.
        if "score" in frame.columns:
            frame = frame[~frame["score"].astype(str).str.contains("W/O|RET", na=False)]
        if "player_svpt" in frame.columns and "opponent_svpt" in frame.columns:
            frame = frame[(frame["player_svpt"] > 0) & (frame["opponent_svpt"] > 0)]

        frame = frame.head(limit)
        matches: List[PlayerRecentMatch] = []
        
        # Helper function to safely get string values (handle NaN)
        def safe_str_get(row, key):
            val = row.get(key)
            if val is None or pd.isna(val):
                return None
            return str(val) if not isinstance(val, str) else val
        
        def compute_opponent_adjustment(player_rank: Optional[int], opponent_rank: Optional[int], won: bool) -> float:
            """Compute opponent adjustment bonus/penalty based on rank difference.
            
            Returns adjustment in decimal form (e.g., 0.02 for +2 percentage points).
            """
            if player_rank is None or opponent_rank is None:
                return 0.0
            
            rank_diff = opponent_rank - player_rank  # Positive = opponent ranked higher
            
            if won:
                # Bonus for beating higher-ranked opponent, penalty for beating lower-ranked
                # Beat top 5: +2%, beat top 10: +1.5%, beat top 20: +1%, beat top 50: +0.5%
                if opponent_rank <= 5:
                    return 0.02  # +2 percentage points = 0.02 decimal
                elif opponent_rank <= 10:
                    return 0.015
                elif opponent_rank <= 20:
                    return 0.01
                elif opponent_rank <= 50:
                    return 0.005
                elif opponent_rank <= 100:
                    return 0.0025
                else:
                    # Beating someone ranked >100 gets small bonus or no change
                    return max(0.0, -0.0025 * (opponent_rank - 100) / 100)
            else:
                # Penalty for losing to lower-ranked opponent, smaller penalty for losing to higher-ranked
                # Lose to someone ranked >100: -2%, lose to 51-100: -1.5%, lose to 21-50: -1%
                if opponent_rank > 100:
                    return -0.02
                elif opponent_rank > 50:
                    return -0.015
                elif opponent_rank > 20:
                    return -0.01
                elif opponent_rank > 10:
                    return -0.005
                elif opponent_rank > 5:
                    return -0.0025
                else:
                    # Losing to top 5 gets minimal penalty
                    return 0.0
        
        for _, row in frame.iterrows():
            winner = bool(row["player"] == row["winner_name"])
            player_rank = int(row.get("player_rank")) if "player_rank" in frame.columns and not pd.isna(row.get("player_rank")) else None
            opponent_rank = int(row.get("opponent_rank")) if "opponent_rank" in frame.columns and not pd.isna(row.get("opponent_rank")) else None
            
            serve_pct_val = row.get("player_serve_pct")
            return_pct_val = row.get("player_return_pct")
            
            # Convert to float, handling NaN/None - base stats should always exist after filtering
            serve_pct = float(serve_pct_val) if serve_pct_val is not None and not pd.isna(serve_pct_val) else None
            return_pct = float(return_pct_val) if return_pct_val is not None and not pd.isna(return_pct_val) else None
            
            # Compute opponent stats from match data (opponent's serve/return in this match)
            # opponent_serve_pct = opponent's serve points won % in this match
            opponent_svpt = row.get("opponent_svpt", 0)
            opponent_1stWon = row.get("opponent_1stWon", 0)
            opponent_2ndWon = row.get("opponent_2ndWon", 0)
            opponent_serve_pct = (
                (opponent_1stWon + opponent_2ndWon) / opponent_svpt
                if opponent_svpt > 0 and not pd.isna(opponent_svpt)
                else None
            )
            
            # opponent_return_pct = opponent's return points won % in this match
            # (points opponent won when player served)
            player_svpt = row.get("player_svpt", 0)
            player_1stWon = row.get("player_1stWon", 0)
            player_2ndWon = row.get("player_2ndWon", 0)
            opponent_return_pct = (
                (player_svpt - player_1stWon - player_2ndWon) / player_svpt
                if player_svpt > 0 and not pd.isna(player_svpt)
                else None
            )
            
            # Convert to float if computed
            opponent_serve_pct = float(opponent_serve_pct) if opponent_serve_pct is not None else None
            opponent_return_pct = float(opponent_return_pct) if opponent_return_pct is not None else None
            
            # Compute opponent-adjusted stats using pipeline logic
            # Pipeline formula: adj_spw_match = spw_percent - opponent_adj_rpw
            #                   adj_rpw_match = rpw_percent - opponent_adj_spw
            # Using match-level opponent stats (simplified version of pipeline logic)
            # adj_spw = player_serve_pct - opponent_return_pct (how well player served vs opponent's return ability)
            # adj_rpw = player_return_pct - opponent_serve_pct (how well player returned vs opponent's serve ability)
            adjusted_serve = (serve_pct - opponent_return_pct) if (serve_pct is not None and opponent_return_pct is not None) else None
            adjusted_return = (return_pct - opponent_serve_pct) if (return_pct is not None and opponent_serve_pct is not None) else None
            
            matches.append(
                PlayerRecentMatch(
                    tourney=safe_str_get(row, "tourney_name"),
                    date=row["tourney_date"].date(),
                    surface=safe_str_get(row, "surface"),
                    round=safe_str_get(row, "round"),
                    opponent=row["opponent"],
                    player_rank=player_rank,
                    opponent_rank=opponent_rank,
                    winner=winner,
                    # Base stats should always exist after filtering, so include them
                    serve_pct=serve_pct,
                    return_pct=return_pct,
                    score=safe_str_get(row, "score"),
                    # Adjusted stats should always exist when base stats exist
                    opponent_adjusted_serve_pct=adjusted_serve,
                    opponent_adjusted_return_pct=adjusted_return,
                )
            )
        return matches

    def head_to_head(self, player_slug: str, opponent_slug: str) -> Tuple[int, int, pd.DataFrame]:
        """Return head-to-head stats for all matches across all surfaces.

        - Includes all surfaces (Hard, Clay, Grass).
        - Filter to matches since 2018 (aligned with model training data).
        - Exclude walkovers and retirements (W/O, RET).
        - Includes all tournament levels (ATP 250/500/1000, Grand Slams, etc.).
        - Deduplicate by ``match_id`` so each real match is counted once, even
          though the preprocessed dataset contains both player/opponent rows.
        """
        mask = (
            (self._df["player_slug"] == player_slug) & (self._df["opponent_slug"] == opponent_slug)
        ) | (
            (self._df["player_slug"] == opponent_slug) & (self._df["opponent_slug"] == player_slug)
        )
        # Filter to matches since 2018-01-01 (no surface filter - include all surfaces)
        if "tourney_date" in self._df.columns:
            mask &= self._df["tourney_date"] >= pd.Timestamp("2018-01-01")

        frame = self._df[mask].copy()

        # Exclude walkovers and retirements
        if "score" in frame.columns:
            frame = frame[~frame["score"].astype(str).str.contains("W/O|RET", na=False, case=False)]

        # Create match_id if it doesn't exist (for deduplication)
        # Use slugs instead of names to ensure consistency across both perspectives
        if "match_id" not in frame.columns:
            def create_match_id(row):
                player_slug_val = str(row['player_slug'])
                opponent_slug_val = str(row['opponent_slug'])
                date = row['tourney_date']
                if isinstance(date, pd.Timestamp):
                    date_str = date.strftime('%Y%m%d')
                elif hasattr(date, 'strftime'):
                    date_str = date.strftime('%Y%m%d')
                else:
                    date_str = str(date).replace('-', '').replace(' ', '').replace(':', '')[:8]
                # Sort slugs alphabetically to ensure both perspectives have the same match_id
                return f"{min(player_slug_val, opponent_slug_val)}_{max(player_slug_val, opponent_slug_val)}_{date_str}"
            frame["match_id"] = frame.apply(create_match_id, axis=1)

        # Collapse dual-perspective rows into a single record per real match.
        # Use tourney_date as secondary sort to ensure consistent selection
        frame = (
            frame.sort_values(["match_id", "tourney_date"])
            .drop_duplicates(subset="match_id", keep="last")
        )

        # Determine wins for player_slug based on the true winner, not row perspective.
        if "winner_slug" in frame.columns:
            frame["player_one_win"] = frame["winner_slug"] == player_slug
        else:
            frame["player_one_win"] = frame["player_slug"] == player_slug

        total = len(frame)
        player_one_wins = int(frame["player_one_win"].sum())
        return total, player_one_wins, frame

    def story_metrics(self, player_one: str, player_two: str) -> List[StoryMetric]:
        metrics: List[StoryMetric] = []
        def rolling_form(slug: str) -> float:
            df = self._player_frame(slug).head(10)
            if df.empty:
                return 0.5
            wins = (df["player_rank"] < df["opponent_rank"]).astype(int)
            return float(wins.mean())

        def level_performance(slug: str, level: str) -> float:
            df = self._player_frame(slug)
            subset = df[df["tourney_level"] == level]
            if subset.empty:
                return 0.0
            wins = (subset["player_rank"] < subset["opponent_rank"]).astype(int)
            return float(wins.mean())

        def opponent_difficulty(slug: str) -> float:
            df = self._player_frame(slug).head(10)
            return float(df["opponent_rank"].mean()) if not df.empty else 0.0

        metrics.append(
            StoryMetric(
                label="Rolling form (last 10)",
                player_one_value=rolling_form(player_one),
                player_two_value=rolling_form(player_two),
                unit="win %"
            )
        )
        metrics.append(
            StoryMetric(
                label="Masters win %",
                player_one_value=level_performance(player_one, "M"),
                player_two_value=level_performance(player_two, "M"),
                unit="win %"
            )
        )
        metrics.append(
            StoryMetric(
                label="Avg opponent rank (10 matches)",
                player_one_value=opponent_difficulty(player_one),
                player_two_value=opponent_difficulty(player_two),
                unit="rank"
            )
        )
        metrics.append(
            StoryMetric(
                label="Serve consistency index",
                player_one_value=self._serve_consistency(player_one),
                player_two_value=self._serve_consistency(player_two),
                unit="std"
            )
        )
        return metrics

    def _serve_consistency(self, slug: str) -> float:
        df = self._player_frame(slug).head(10)
        if df.empty:
            return 0.0
        return float(df["player_serve_pct"].std(ddof=0))


_repository_instance: Optional[DataRepository] = None

def get_repository() -> DataRepository:
    global _repository_instance
    if _repository_instance is not None:
        return _repository_instance
    with _DATA_LOCK:
        # Double-check pattern to avoid race conditions
        if _repository_instance is not None:
            return _repository_instance
        settings = get_settings()
        _repository_instance = DataRepository(settings)
        return _repository_instance

