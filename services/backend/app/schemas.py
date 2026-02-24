from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional, Literal

from pydantic import BaseModel, Field


class PlayerSummary(BaseModel):
    id: str
    name: str
    country: Optional[str] = None
    handedness: Optional[str] = None
    height_cm: Optional[int] = None
    last_rank: Optional[int] = None
    last_rank_date: Optional[date] = None


class PlayerSearchResponse(BaseModel):
    results: List[PlayerSummary]


class PlayerRecentMatch(BaseModel):
    tourney: Optional[str] = None
    date: date
    surface: Optional[str] = None
    round: Optional[str] = None
    opponent: str
    player_rank: Optional[int] = None
    opponent_rank: Optional[int] = None
    winner: bool
    serve_pct: Optional[float] = None
    return_pct: Optional[float] = None
    opponent_adjusted_serve_pct: Optional[float] = None
    opponent_adjusted_return_pct: Optional[float] = None
    score: Optional[str] = None


class PlayerHistoryResponse(BaseModel):
    player: PlayerSummary
    recent_matches: List[PlayerRecentMatch]
    last_three: List[PlayerRecentMatch]


class StoryMetric(BaseModel):
    label: str
    player_one_value: Optional[float]
    player_two_value: Optional[float]
    unit: Optional[str] = None


class HeadToHeadMeeting(BaseModel):
    date: date
    tournament: Optional[str] = None
    surface: Optional[str] = None
    round: Optional[str] = None
    winner: str
    score: Optional[str] = None


class H2HSummary(BaseModel):
    total_matches: int
    player_one_wins: int
    player_two_wins: int
    surface_breakdown: List[StoryMetric]
    recent_meetings: List[HeadToHeadMeeting]


class MatchPredictionRequest(BaseModel):
    player_one: str = Field(..., description="Primary player ID/slug")
    player_two: str = Field(..., description="Opponent player ID/slug")
    tournament_id: Optional[str] = None
    tournament_name: Optional[str] = None
    tournament_level: Optional[str] = Field(
        None, description="ATP250, ATP500, ATP1000, etc."
    )
    round: Optional[str] = None
    surface: Optional[str] = None
    match_date: Optional[date] = Field(
        None, 
        description="Date of the match. If not provided, uses current date (for future predictions). "
                   "For historical matches, provide the actual match date to use correct historical features."
    )


class AdvancedPredictionRequest(BaseModel):
    """
    Request for advanced prediction with custom last-10 match overrides.
    
    This allows overriding the sequence features (last 10 matches) while keeping
    all other features frozen to the Nov-14 snapshot.
    """
    player_one: str = Field(..., description="Primary player ID/slug")
    player_two: str = Field(..., description="Opponent player ID/slug")
    player_one_name: Optional[str] = Field(None, description="Display name for parsing match history (e.g. 'Alex De Minaur')")
    player_two_name: Optional[str] = Field(None, description="Display name for parsing match history")
    player_one_match_history: str = Field(
        ..., 
        description="Raw Tennis Abstract match history text for player one (most recent matches)"
    )
    player_two_match_history: str = Field(
        ..., 
        description="Raw Tennis Abstract match history text for player two (most recent matches)"
    )
    tournament_id: Optional[str] = None
    tournament_name: Optional[str] = None
    tournament_level: Optional[str] = Field(
        None, description="ATP250, ATP500, ATP1000, etc."
    )
    round: Optional[str] = None
    surface: Optional[str] = None
    match_date: Optional[date] = Field(
        None,
        description="Date of the match. Used for feature computation cutoff."
    )


class PredictionProbabilities(BaseModel):
    player_one: float
    player_two: float


class PredictionInsights(BaseModel):
    confidence: float
    expected_margin: Optional[float]
    score_descriptor: str
    betting_odds_player_one: Optional[float]
    betting_odds_player_two: Optional[float]
    betting_guidance: str
    feature_groups: List[StoryMetric] = []


class PlayerFeatures(BaseModel):
    sequence: List[List[float]]  # (seq_len, feature_dim) - features sent to LSTM
    static: List[float]  # (static_dim,) - static features sent to LSTM
    mask: List[float]  # (seq_len,) - mask indicating valid timesteps


class FeatureImportance(BaseModel):
    feature: str
    importance: float  # Gradient-based importance score
    category: Optional[str] = None  # Category for grouping (e.g., "Recent Form", "Opponent Strength")
    display_name: Optional[str] = None  # Human-readable display name


class PredictionFeatures(BaseModel):
    player_one: PlayerFeatures  # Features from player_one's perspective
    player_two: PlayerFeatures  # Features from player_two's perspective
    sequence_feature_names: List[str]
    static_feature_names: List[str]
    feature_importance: Optional[List[FeatureImportance]] = None  # Top 20 features by importance


class PredictionResponse(BaseModel):
    generated_at: datetime
    player_one: PlayerSummary
    player_two: PlayerSummary
    probabilities: PredictionProbabilities
    insights: PredictionInsights
    model_version: str
    features: Optional[PredictionFeatures] = None  # Features sent to LSTM
    feature_mode: Literal["frozen", "fresh"] = Field(
        ..., description="Feature mode used: 'frozen' (Nov-14 snapshot) or 'fresh' (user-entered matches)"
    )
    override_used: bool = Field(
        ..., description="Whether user-entered match features were used (true for 'fresh' mode)"
    )


class ScrapeTennisAbstractRequest(BaseModel):
    """Request to scrape Tennis Abstract match history."""
    player_name: str


class ScrapeTennisAbstractResponse(BaseModel):
    """Response from Tennis Abstract scraping."""
    player_name: str
    matches_found: int
    matches_with_return_pct: int
    raw_text: str  # Tab-separated text ready to paste
    message: str


class AdvancedPredictionResponse(BaseModel):
    """
    Response for advanced prediction showing both standard and custom predictions.
    
    This shows:
    - Standard prediction (using Nov-14 frozen features)
    - Advanced prediction (using custom last-10 matches)
    - Delta between the two predictions
    """
    generated_at: datetime
    player_one: PlayerSummary
    player_two: PlayerSummary
    
    # Standard prediction (frozen features)
    standard_probabilities: PredictionProbabilities
    standard_insights: PredictionInsights
    
    # Advanced prediction (custom last-10 features)
    advanced_probabilities: PredictionProbabilities
    advanced_insights: PredictionInsights
    
    # Delta analysis
    probability_delta: float = Field(
        ...,
        description="Difference in player_one win probability (Advanced - Standard)"
    )
    
    model_version: str
    feature_mode: Literal["frozen", "fresh"] = Field(
        default="fresh", description="Feature mode: 'fresh' for user-entered matches"
    )
    override_used: bool = Field(
        default=True, description="User-entered match features were used"
    )
    features: Optional[PredictionFeatures] = None  # Features sent to LSTM (advanced version)


class ModelMetricSeriesPoint(BaseModel):
    label: str
    value: float


class ConfusionMatrix(BaseModel):
    true_positive: int
    true_negative: int
    false_positive: int
    false_negative: int


class CalibrationPoint(BaseModel):
    predicted: float
    actual: float


class RankBucketAccuracy(BaseModel):
    player_rank_bucket: str  # e.g., "1-5", "6-10", "11-20", etc.
    opponent_rank_bucket: str
    accuracy: float
    sample_count: int


class Hyperparameters(BaseModel):
    seq_len: int
    half_life: float
    lstm_hidden: int
    lstm_layers: int
    dropout: float
    batch_size: int
    learning_rate: float
    patience: int
    max_epochs: int


class ModelStatsResponse(BaseModel):
    model_version: str
    last_trained: datetime
    training_cutoff: date
    training_range: str
    validation_range: str
    test_range: str
    cross_validation_plan: List[str]
    phase1_test_accuracy: Optional[float] = None  # Phase 1: Test accuracy on 2024
    phase1_test_auc: Optional[float] = None  # Phase 1: Test AUC-ROC on 2024
    phase1_test_brier: Optional[float] = None  # Phase 1: Test Brier score on 2024
    phase1_test_log_loss: Optional[float] = None  # Phase 1: Test log loss on 2024
    phase2_test_accuracy: Optional[float] = None  # Phase 2: Test accuracy on 2025
    phase1_hyperparameters: Optional[Hyperparameters] = None
    phase2_hyperparameters: Optional[Hyperparameters] = None
    final_hyperparameters: Optional[Hyperparameters] = None
    accuracy: float
    auc_roc: float
    pr_auc: Optional[float]
    brier: Optional[float]
    log_loss: Optional[float]
    confidence_interval: List[float]
    confusion_matrix: ConfusionMatrix
    calibration_curve: List[CalibrationPoint]
    loss_history: List[ModelMetricSeriesPoint]
    auc_history: List[ModelMetricSeriesPoint]
    seasonal_stability: List[ModelMetricSeriesPoint]
    surface_performance: List[StoryMetric]
    level_performance: List[StoryMetric]
    feature_group_importance: List[StoryMetric]
    rank_bucket_accuracy: List[RankBucketAccuracy] = []  # Accuracy by rank bucket combinations
    changelog: Optional[List[str]] = None


class BatchPredictionRequest(BaseModel):
    matches: List[MatchPredictionRequest]


class BatchPredictionResponse(BaseModel):
    predictions: List[PredictionResponse]


# Tournament Evaluation Schemas
class TournamentMatch(BaseModel):
    match_id: str
    player_one: PlayerSummary
    player_two: PlayerSummary
    round: str
    surface: str
    date: str
    actual_winner: str  # "player_one" or "player_two"
    predicted_probability_player_one: float
    predicted_probability_player_two: float
    top_features: Optional[List[FeatureImportance]] = None


class TournamentRound(BaseModel):
    round_name: str
    matches: List[TournamentMatch]


class Tournament(BaseModel):
    tournament_id: str
    tournament_name: str
    start_date: str
    end_date: str
    surface: str
    tournament_level: Optional[str] = None  # G=Grand Slam, M=ATP 1000, 500/250=ATP 500/250, D=Davis Cup
    accuracy: Optional[float] = None  # Match-level accuracy for this tournament
    rounds: List[TournamentRound]


# Display parsing schemas
class DisplayTableRow(BaseModel):
    """A single row in the display table."""
    row_index: int
    fields: List[str]  # All field values as strings
    formatted_line: str  # Comma-separated string for display (e.g. "Date, Tournament, Surface, ...")
    is_ignored: bool  # Whether this row will be ignored by inference
    ignore_reasons: List[str]  # Reasons why this row is ignored (if any)
    original_line: str  # Original normalized line


class DisplayParsingSummary(BaseModel):
    """Summary statistics for parsed match history."""
    total_rows: int
    valid_matches: int
    ignored_rows: int
    has_header: bool


class DisplayParsingRequest(BaseModel):
    """Request to parse match history for display."""
    match_history_text: str = Field(..., description="Raw Tennis Abstract match history text")


class DisplayParsingResponse(BaseModel):
    """Response from display parsing."""
    table_rows: List[DisplayTableRow]
    summary: DisplayParsingSummary
    column_headers: Optional[List[str]] = None  # Header row labels when pasted text has a header (e.g. Date, Tournament, Surface)







