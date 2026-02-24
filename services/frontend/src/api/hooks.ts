import { useQuery } from "@tanstack/react-query";
import api from "./client";
import {
  ModelStatsResponse,
  PlayerHistoryResponse,
  PlayerSummary,
  PredictionRequest,
  PredictionResponse,
  AdvancedPredictionRequest,
  AdvancedPredictionResponse,
  H2HResponse,
  StoryMetric,
  DetailedFeaturesResponse,
  Tournament,
  ScrapeTennisAbstractRequest,
  ScrapeTennisAbstractResponse,
  DisplayParsingRequest,
  DisplayParsingResponse,
  BacktestSummaryResponse,
  TemperatureOptimizationResponse,
} from "./types";

export const usePlayerSearch = (query: string) =>
  useQuery({
    queryKey: ["players", query],
    queryFn: async () => {
      const response = await api.get<{ results: PlayerSummary[] }>("/players", {
        params: { q: query },
      });
      return response.data.results;
    },
    enabled: query.length > 1,
    staleTime: 5 * 60 * 1000,
  });

export const usePlayerHistory = (playerId: string | null, limit?: number) =>
  useQuery({
    queryKey: ["player-history", playerId, limit],
    queryFn: async () => {
      if (!playerId) return null;
      const response = await api.get<PlayerHistoryResponse>(`/players/${playerId}/history`, {
        params: limit ? { limit } : undefined,
      });
      return response.data;
    },
    enabled: !!playerId,
  });

export const useModelStats = () =>
  useQuery({
    queryKey: ["model-stats"],
    queryFn: async () => {
      const response = await api.get<ModelStatsResponse>("/model-stats");
      return response.data;
    },
    staleTime: 10 * 60 * 1000,
  });

export const fetchPrediction = async (payload: PredictionRequest) => {
  const response = await api.post<PredictionResponse>("/predict", payload);
  return response.data;
};

export const fetchAdvancedPrediction = async (payload: AdvancedPredictionRequest) => {
  const response = await api.post<AdvancedPredictionResponse>("/predict/advanced", payload);
  return response.data;
};

export const useHeadToHead = (playerOne: string | null, playerTwo: string | null) =>
  useQuery({
    queryKey: ["h2h", playerOne, playerTwo],
    queryFn: async (): Promise<H2HResponse | null> => {
      if (!playerOne || !playerTwo) return null;
      try {
        const response = await api.get<H2HResponse>("/h2h", {
          params: { player_one: playerOne, player_two: playerTwo },
        });
        return response.data;
      } catch (error: any) {
        // Handle 404 gracefully - no h2h data is a valid state
        if (error.response?.status === 404) {
          return null;
        }
        // Re-throw other errors
        throw error;
      }
    },
    enabled: Boolean(playerOne && playerTwo),
    retry: false, // Don't retry on 404
  });

export const useStoryMetrics = (playerOne: string | null, playerTwo: string | null) =>
  useQuery({
    queryKey: ["story", playerOne, playerTwo],
    queryFn: async (): Promise<StoryMetric[] | null> => {
      if (!playerOne || !playerTwo) return null;
      const response = await api.get<StoryMetric[]>("/story", {
        params: { player_one: playerOne, player_two: playerTwo },
      });
      return response.data;
    },
    enabled: Boolean(playerOne && playerTwo),
  });

export const useDetailedFeatures = (
  playerOne: string | null,
  playerTwo: string | null,
  surface?: string,
  tournamentLevel?: string,
  round?: string
) =>
  useQuery({
    queryKey: ["detailed-features", playerOne, playerTwo, surface, tournamentLevel, round],
    queryFn: async (): Promise<DetailedFeaturesResponse | null> => {
      if (!playerOne || !playerTwo) return null;
      const response = await api.post<DetailedFeaturesResponse>("/predict/features/detailed", {
        player_one: playerOne,
        player_two: playerTwo,
        surface: surface || "Hard",
        tournament_level: tournamentLevel || "M",
        round: round || "F",
      });
      return response.data;
    },
    enabled: Boolean(playerOne && playerTwo),
    staleTime: 30 * 1000, // 30 seconds - features are computed on the fly
  });

export const useTournaments = (year: number = 2025) =>
  useQuery({
    queryKey: ["tournaments", year],
    queryFn: async (): Promise<Tournament[]> => {
      const response = await api.get<Tournament[]>("/tournaments", {
        params: { year },
      });
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - tournaments don't change
  });

export const useTournament = (tournamentId: string | null, year: number = 2025) =>
  useQuery({
    queryKey: ["tournament", tournamentId, year],
    queryFn: async (): Promise<Tournament | null> => {
      if (!tournamentId) return null;
      const response = await api.get<Tournament>(`/tournaments/${tournamentId}`, {
        params: { year },
      });
      return response.data;
    },
    enabled: !!tournamentId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

export const scrapeTennisAbstract = async (payload: ScrapeTennisAbstractRequest): Promise<ScrapeTennisAbstractResponse> => {
  const response = await api.post<ScrapeTennisAbstractResponse>("/predict/scrape-tennis-abstract", payload);
  return response.data;
};

export const parseMatchHistoryForDisplay = async (payload: DisplayParsingRequest): Promise<DisplayParsingResponse> => {
  const response = await api.post<DisplayParsingResponse>("predict/parse-display", payload, {
    timeout: 30000,
  });
  return response.data;
};

/** Load backtest summary from static JSON (no backend API). 404 returns null. */
export const useBacktestSummary = () =>
  useQuery({
    queryKey: ["backtest-summary"],
    queryFn: async (): Promise<BacktestSummaryResponse | null> => {
      const res = await fetch("/backtesting/summary.json");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

/** Load temperature optimization from static JSON (no backend API). 404 returns null. */
export const useTemperatureOptimization = () =>
  useQuery({
    queryKey: ["temperature-optimization"],
    queryFn: async (): Promise<TemperatureOptimizationResponse | null> => {
      const res = await fetch("/backtesting/temperature_optimization.json");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });


