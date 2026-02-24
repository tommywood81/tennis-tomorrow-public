export interface PlayerSummary {
  id: string;
  name: string;
  country?: string;
  current_rank?: number;
  last_rank?: number;
  last_rank_date?: string;
  handedness?: string;
  height_cm?: number;
}

export interface PlayerRecentMatch {
  tourney?: string;
  date: string;
  surface?: string;
  round?: string;
  opponent: string;
  player_rank?: number;
  opponent_rank?: number;
  winner: boolean;
  serve_pct?: number;
  return_pct?: number;
  opponent_adjusted_serve_pct?: number;
  opponent_adjusted_return_pct?: number;
  score?: string;
}

export interface PlayerHistoryResponse {
  player: PlayerSummary;
  recent_matches: PlayerRecentMatch[];
  last_three: PlayerRecentMatch[];
}

export interface StoryMetric {
  label: string;
  player_one_value?: number;
  player_two_value?: number;
  unit?: string;
}

export interface PredictionRequest {
  player_one: string;
  player_two: string;
  tournament_id?: string;
  tournament_name?: string;
  tournament_level?: string;
  round?: string;
  surface?: string;
}

export interface ScrapeTennisAbstractRequest {
  player_name: string;
}

export interface ScrapeTennisAbstractResponse {
  player_name: string;
  matches_found: number;
  matches_with_return_pct: number;
  raw_text: string;
  message: string;
}

export interface DisplayTableRow {
  row_index: number;
  fields: string[];
  /** Comma-separated string for display (optional; frontend falls back to fields.join(", ")) */
  formatted_line?: string;
  is_ignored: boolean;
  ignore_reasons: string[];
  original_line: string;
}

export interface DisplayParsingSummary {
  total_rows: number;
  valid_matches: number;
  ignored_rows: number;
  has_header: boolean;
}

export interface DisplayParsingRequest {
  match_history_text: string;
}

export interface DisplayParsingResponse {
  table_rows: DisplayTableRow[];
  summary: DisplayParsingSummary;
  /** Header row labels when pasted text has a header (e.g. Date, Tournament, Surface). */
  column_headers?: string[] | null;
}

export interface AdvancedPredictionRequest {
  player_one: string;
  player_two: string;
  player_one_name?: string;
  player_two_name?: string;
  player_one_match_history: string;
  player_two_match_history: string;
  tournament_id?: string;
  tournament_name?: string;
  tournament_level?: string;
  round?: string;
  surface?: string;
  match_date?: string;
}

export interface PredictionProbabilities {
  player_one: number;
  player_two: number;
}

export interface PredictionInsights {
  confidence: number;
  expected_margin: number;
  score_descriptor: string;
  betting_odds_player_one?: number;
  betting_odds_player_two?: number;
  betting_guidance?: string;
  feature_groups: StoryMetric[];
}

export interface PlayerFeatures {
  sequence: number[];
  static: number[];
  mask: number[];
}

export interface FeatureImportance {
  feature: string;
  importance: number; // Gradient-based importance score
  category: string; // Added for frontend grouping
  display_name: string; // Added for frontend display
}

export interface PredictionFeatures {
  player_one: PlayerFeatures; // Features from player_one's perspective
  player_two: PlayerFeatures; // Features from player_two's perspective
  sequence_feature_names: string[];
  static_feature_names: string[];
  feature_importance?: FeatureImportance[]; // Added for gradient-based importance
}

export interface PredictionResponse {
  generated_at: string;
  player_one: PlayerSummary;
  player_two: PlayerSummary;
  probabilities: PredictionProbabilities;
  insights: PredictionInsights;
  model_version: string;
  features?: PredictionFeatures; // Features sent to LSTM
  feature_mode: "frozen" | "fresh";
  override_used: boolean;
}

export interface AdvancedPredictionResponse {
  generated_at: string;
  player_one: PlayerSummary;
  player_two: PlayerSummary;
  standard_probabilities: PredictionProbabilities;
  standard_insights: PredictionInsights;
  advanced_probabilities: PredictionProbabilities;
  advanced_insights: PredictionInsights;
  probability_delta: number; // Difference in player_one win probability (Advanced - Standard)
  model_version: string;
  features?: PredictionFeatures;
  feature_mode: "frozen" | "fresh";
  override_used: boolean;
}

export interface H2HResponse {
  total_matches: number;
  player_one_wins: number;
  player_two_wins: number;
  surface_breakdown: { label: string; player_one_value?: number; player_two_value?: number }[];
  recent_meetings: {
    date: string;
    tournament?: string;
    surface?: string;
    round?: string;
    winner: string;
    score?: string;
  }[];
}

export interface DetailedFeaturesResponse {
  historical_matches: {
    date: string;
    opponent: string;
    opponent_rank: number;
    player_rank: number;
    won: boolean;
    surface: string;
    round: string;
    tourney_level: string;
    serve_pct: number;
    return_pct: number;
    raw_serve_pct: number;
    raw_return_pct: number;
  }[];
  static_features: {
    [key: string]: number;
  };
  sequence_features: {
    [key: string]: number[];
  };
}

export interface RankBucketAccuracy {
  player_rank_bucket: string;
  opponent_rank_bucket: string;
  accuracy: number;
  sample_count: number;
}

export interface ModelStatsResponse {
  model_version: string;
  last_trained: string;
  training_cutoff: string;
  training_range: string;
  validation_range: string;
  test_range: string;
  cross_validation_plan: string[];
  accuracy: number;
  auc_roc: number;
  pr_auc?: number;
  brier?: number;
  log_loss?: number;
  confidence_interval: number[];
  confusion_matrix: {
    true_positive: number;
    true_negative: number;
    false_positive: number;
    false_negative: number;
  };
  calibration_curve: { predicted: number; actual: number }[];
  loss_history: { label: string; value: number }[];
  auc_history: { label: string; value: number }[];
  seasonal_stability: { label: string; value: number }[];
  surface_performance: { label: string; player_one_value?: number; player_two_value?: number }[];
  level_performance: { label: string; player_one_value?: number; player_two_value?: number }[];
  feature_group_importance: { label: string; player_one_value?: number; player_two_value?: number }[];
  rank_bucket_accuracy: RankBucketAccuracy[];
  shap_values?: { feature: string; shap_value: number }[];
  log_loss_history?: { label: string; value: number }[];
  brier_history?: { label: string; value: number }[];
  accuracy_history?: { label: string; value: number }[];
  changelog?: string[];
  phase1_test_accuracy?: number; // Phase 1: Test accuracy on 2024
  phase1_test_auc?: number; // Phase 1: Test AUC-ROC on 2024
  phase1_test_brier?: number; // Phase 1: Test Brier score on 2024
  phase1_test_log_loss?: number; // Phase 1: Test log loss on 2024
  phase2_test_accuracy?: number; // Phase 2: Test accuracy on 2025
  phase1_hyperparameters?: {
    seq_len: number;
    half_life: number;
    lstm_hidden: number;
    lstm_layers: number;
    dropout: number;
    batch_size: number;
    learning_rate: number;
    patience: number;
    max_epochs: number;
  };
  phase2_hyperparameters?: {
    seq_len: number;
    half_life: number;
    lstm_hidden: number;
    lstm_layers: number;
    dropout: number;
    batch_size: number;
    learning_rate: number;
    patience: number;
    max_epochs: number;
  };
  final_hyperparameters?: {
    seq_len: number;
    half_life: number;
    lstm_hidden: number;
    lstm_layers: number;
    dropout: number;
    batch_size: number;
    learning_rate: number;
    patience: number;
    max_epochs: number;
  };
}

// Tournament Evaluation Types
export interface TournamentMatch {
  match_id: string;
  player_one: PlayerSummary;
  player_two: PlayerSummary;
  round: string;
  surface: string;
  date: string;
  actual_winner: "player_one" | "player_two";
  predicted_probability_player_one: number;
  predicted_probability_player_two: number;
  top_features?: FeatureImportance[];
}

export interface TournamentRound {
  round_name: string;
  matches: TournamentMatch[];
}

export interface Tournament {
  tournament_id: string;
  tournament_name: string;
  start_date: string;
  end_date: string;
  surface: string;
  tournament_level?: string; // G=Grand Slam, M=ATP 1000, 500/250=ATP 500/250
  accuracy?: number; // Match-level accuracy for this tournament
  rounds: TournamentRound[];
}

export interface BacktestStrategy {
  strategy: string;
  num_bets_placed: number;
  bets_won: number;
  bets_lost: number;
  win_rate: number;
  final_bankroll: number;
  total_profit: number;
  roi_pct: number;
  max_drawdown: number;
  risk_adjusted_roi: number;
  pct_bet_on: number;
}

export interface BacktestSummaryResponse {
  strategies: BacktestStrategy[];
  total_matches: number;
  note: string;
  calibration_reliability_exists?: boolean;
  underdog_diagnostic_exists?: boolean;
}

export interface TemperatureOptimizationResponse {
  optimal_temperature: {
    optimal_temperature: number;
    roi: number;
    bets: number;
    profit: number;
    hit_rate: number;
    max_drawdown: number;
  };
  comparison_table: Array<{
    temperature: number;
    bets: number;
    profit: number;
    roi: number;
    hit_rate: number;
    avg_edge: number;
    max_drawdown: number;
  }>;
  equity_curve: {
    bet_number: number[];
    bankroll: number[];
  } | null;
  equity_curve_image_exists: boolean;
  equity_curve_image_path: string | null;
}

export interface TournamentListResponse {
  tournaments: Tournament[];
}
