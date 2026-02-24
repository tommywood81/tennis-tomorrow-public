import {
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  MenuItem,
  Select,
  Stack,
  Typography,
  Box,
  Paper,
  Link,
  useMediaQuery,
  useTheme,
  TextField,
  CircularProgress,
  Alert,
} from "@mui/material";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import PlayerAutocomplete from "../components/PlayerAutocomplete";
import ParsedMatchHistoryTable from "../components/ParsedMatchHistoryTable";
import PlayerSummaryCard from "../components/PlayerSummaryCard";
import PredictionResultCard from "../components/PredictionResultCard";
import RecentFormCard from "../components/RecentFormCard";
import LastTenMatchesGraph from "../components/LastTenMatchesGraph";
import MonthlyRankGraph from "../components/MonthlyRankGraph";
import PredictionLoadingAnimation from "../components/PredictionLoadingAnimation";
import H2HDisplay from "../components/H2HDisplay";
import { fetchPrediction, fetchAdvancedPrediction, parseMatchHistoryForDisplay, useHeadToHead, usePlayerHistory, useStoryMetrics } from "../api/hooks";
import { PlayerSummary, PredictionResponse, AdvancedPredictionResponse, PredictionRequest, DisplayParsingResponse } from "../api/types";

const MatchPredictionPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const location = useLocation();
  const navigate = useNavigate();

  // Tab state (0 = Standard, 1 = Advanced)
  const [activeTab, setActiveTab] = useState(0);

  const handleReset = () => {
    setActiveTab(0);
    setPlayerOne(null);
    setPlayerTwo(null);
    setTournamentLevel("ATP1000");
    setRound("QF");
    setSurface("Hard");
    setPrediction(null);
    setAdvancedPrediction(null);
    setPlayerOneMatchHistory("");
    setPlayerTwoMatchHistory("");
    setPlayerOneDisplayData(null);
    setPlayerTwoDisplayData(null);
    setPlayerOneParseError(false);
    setPlayerTwoParseError(false);
    setPlayerOneLoading(false);
    setPlayerTwoLoading(false);
    if (playerOneTimeoutRef.current) clearTimeout(playerOneTimeoutRef.current);
    if (playerTwoTimeoutRef.current) clearTimeout(playerTwoTimeoutRef.current);
  };

  useEffect(() => {
    if (location.pathname === "/" && location.state?.reset) {
      handleReset();
      navigate(".", { replace: true, state: {} });
    }
  }, [location.pathname, location.state]);

  // Standard mode state
  const [playerOne, setPlayerOne] = useState<PlayerSummary | null>(null);
  const [playerTwo, setPlayerTwo] = useState<PlayerSummary | null>(null);
  const [tournamentLevel, setTournamentLevel] = useState("ATP1000");
  const [round, setRound] = useState("QF");
  const [surface, setSurface] = useState("Hard");
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  
  // User entered match features mode state
  const [advancedPrediction, setAdvancedPrediction] = useState<AdvancedPredictionResponse | null>(null);
  const [playerOneMatchHistory, setPlayerOneMatchHistory] = useState("");
  const [playerTwoMatchHistory, setPlayerTwoMatchHistory] = useState("");
  
  // Display parsing state (backend only)
  const [playerOneDisplayData, setPlayerOneDisplayData] = useState<DisplayParsingResponse | null>(null);
  const [playerTwoDisplayData, setPlayerTwoDisplayData] = useState<DisplayParsingResponse | null>(null);
  const [playerOneParseError, setPlayerOneParseError] = useState(false);
  const [playerTwoParseError, setPlayerTwoParseError] = useState(false);
  const [playerOneLoading, setPlayerOneLoading] = useState(false);
  const [playerTwoLoading, setPlayerTwoLoading] = useState(false);
  
  // Refs for debouncing
  const playerOneTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const playerTwoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const playerOneHistory = usePlayerHistory(playerOne?.id ?? null);
  const playerTwoHistory = usePlayerHistory(playerTwo?.id ?? null);
  // Fetch more matches for rank graph to cover 12 months
  const playerOneHistoryForRank = usePlayerHistory(playerOne?.id ?? null, 100);
  const playerTwoHistoryForRank = usePlayerHistory(playerTwo?.id ?? null, 100);
  const h2h = useHeadToHead(playerOne?.id ?? null, playerTwo?.id ?? null);
  const storyMetrics = useStoryMetrics(playerOne?.id ?? null, playerTwo?.id ?? null);

  const mutation = useMutation({
    mutationFn: fetchPrediction,
    onSuccess: (data) => setPrediction(data),
    onError: (error: any) => {
      console.error("Prediction error:", error);
      alert(`Prediction failed: ${error.response?.data?.detail || error.message || "Unknown error"}`);
    },
  });

  const advancedMutation = useMutation({
    mutationFn: fetchAdvancedPrediction,
    onSuccess: (data) => setAdvancedPrediction(data),
    onError: (error: any) => {
      console.error("Advanced prediction error:", error);
      alert(`Advanced prediction failed: ${error.response?.data?.detail || error.message || "Unknown error"}`);
    },
  });

  // Parse display for player one (backend only)
  const parseDisplayOne = useMutation({
    mutationFn: parseMatchHistoryForDisplay,
    onSuccess: (data) => {
      setPlayerOneDisplayData(data);
      setPlayerOneParseError(false);
      setPlayerOneLoading(false);
    },
    onError: (err: unknown) => {
      console.error("[parse-display] Player 1 failed:", err);
      setPlayerOneDisplayData(null);
      setPlayerOneParseError(true);
      setPlayerOneLoading(false);
    },
  });

  // Parse display for player two (backend only)
  const parseDisplayTwo = useMutation({
    mutationFn: parseMatchHistoryForDisplay,
    onSuccess: (data) => {
      setPlayerTwoDisplayData(data);
      setPlayerTwoParseError(false);
      setPlayerTwoLoading(false);
    },
    onError: (err: unknown) => {
      console.error("[parse-display] Player 2 failed:", err);
      setPlayerTwoDisplayData(null);
      setPlayerTwoParseError(true);
      setPlayerTwoLoading(false);
    },
  });

  const handlePredict = () => {
    if (!playerOne || !playerTwo) return;
    mutation.mutate({
      player_one: playerOne.id,
      player_two: playerTwo.id,
      tournament_level: tournamentLevel,
      round,
      surface,
    });
  };

  const handleAdvancedPredict = () => {
    if (!playerOne || !playerTwo) return;
    if (!playerOneMatchHistory.trim() || !playerTwoMatchHistory.trim()) {
      alert("Please paste match history for both players");
      return;
    }
    advancedMutation.mutate({
      player_one: playerOne.id,
      player_two: playerTwo.id,
      player_one_name: playerOne.name,
      player_two_name: playerTwo.name,
      player_one_match_history: playerOneMatchHistory,
      player_two_match_history: playerTwoMatchHistory,
      tournament_level: tournamentLevel,
      round,
      surface,
    });
  };

  // Refs to avoid stale closure in setTimeout (React Strict Mode double-mount)
  const playerOneHistoryRef = useRef(playerOneMatchHistory);
  const playerTwoHistoryRef = useRef(playerTwoMatchHistory);
  playerOneHistoryRef.current = playerOneMatchHistory;
  playerTwoHistoryRef.current = playerTwoMatchHistory;

  // Handle player one history change: 200ms debounce, show loading, send to backend
  useEffect(() => {
    if (playerOneTimeoutRef.current) clearTimeout(playerOneTimeoutRef.current);

    if (playerOneMatchHistory.trim()) {
      setPlayerOneLoading(true);
      setPlayerOneParseError(false);
      playerOneTimeoutRef.current = setTimeout(() => {
        const text = playerOneHistoryRef.current.trim();
        if (text) parseDisplayOne.mutate({ match_history_text: text });
      }, 200);
    } else {
      setPlayerOneDisplayData(null);
      setPlayerOneParseError(false);
      setPlayerOneLoading(false);
    }

    return () => {
      if (playerOneTimeoutRef.current) clearTimeout(playerOneTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerOneMatchHistory]);

  // Handle player two history change: 200ms debounce, show loading, send to backend
  useEffect(() => {
    if (playerTwoTimeoutRef.current) clearTimeout(playerTwoTimeoutRef.current);

    if (playerTwoMatchHistory.trim()) {
      setPlayerTwoLoading(true);
      setPlayerTwoParseError(false);
      playerTwoTimeoutRef.current = setTimeout(() => {
        const text = playerTwoHistoryRef.current.trim();
        if (text) parseDisplayTwo.mutate({ match_history_text: text });
      }, 200);
    } else {
      setPlayerTwoDisplayData(null);
      setPlayerTwoParseError(false);
      setPlayerTwoLoading(false);
    }

    return () => {
      if (playerTwoTimeoutRef.current) clearTimeout(playerTwoTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerTwoMatchHistory]);

  const bothPlayersSelected = playerOne && playerTwo;

  return (
    <Box sx={{ maxWidth: { xs: "100%", sm: "1200px", md: "1400px" }, mx: "auto", px: { xs: 1.5, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2, sm: 3, md: 4 }, pt: { xs: 12, sm: 14, md: 16 }, width: "100%", boxSizing: "border-box", minWidth: 0 }}>
      <Stack spacing={{ xs: 3, sm: 4, md: 4 }}>
        {/* Hero Section */}
        <Box>
          {activeTab === 0 ? (
            <>
              <Typography
                variant="h3"
                fontWeight={700}
                sx={{
                  color: "#0A2540",
                  mb: { xs: 2, sm: 2.5, md: 3 },
                  textAlign: "center",
                  fontSize: { xs: "1.5rem", sm: "1.75rem", md: "2rem", lg: "2.25rem" },
                  lineHeight: { xs: 1.2, sm: 1.25, md: 1.3 },
                  px: { xs: 1, sm: 2 },
                  letterSpacing: "-0.02em",
                }}
              >
                End-to-End Tennis Prediction System with True Out-of-Sample Validation
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  maxWidth: { xs: "100%", sm: "800px", md: "900px" },
                  mx: "auto",
                  mb: { xs: 2, sm: 2.5, md: 3 },
                  textAlign: "center",
                  lineHeight: { xs: 1.6, sm: 1.65, md: 1.7 },
                  fontSize: { xs: "0.9375rem", sm: "1rem", md: "1.0625rem" },
                  px: { xs: 1, sm: 2 },
                  color: "#425466",
                }}
              >
                A fully deployed deep learning system for ATP match prediction, built for forward-only evaluation and real-world use.
              </Typography>
              <Box component="ul" sx={{ maxWidth: 600, mx: "auto", mb: 3, pl: 3, "& li": { mb: 0.75 } }}>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  Single frozen LSTM — trained on 1990–2022
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  Strict temporal validation — tune (2023) → test (2024–2025)
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  Calibration — temperature scaling (T ≈ 0.72)
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  OOS performance — ~70% accuracy, consistent across future periods
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  Market-aligned backtesting — edge vs closing odds
                </Typography>
              </Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ color: "#0A2540", textAlign: "center", mb: 1.5 }}>
                Two Ways to Use the Model
              </Typography>
              <Box sx={{ maxWidth: 600, mx: "auto", mb: 2, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: 1 }}>
                  <strong>As At (12/11/2025)</strong> — A fixed snapshot using only information available up to that date.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  <strong>Current Inference</strong> — Live predictions using fresh inputs (e.g. Tennis Abstract) with the same model.
                </Typography>
              </Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ color: "#0A2540", textAlign: "center", mb: 1.5 }}>
                Why This Is Best Practice
              </Typography>
              <Box component="ul" sx={{ maxWidth: 500, mx: "auto", mb: 2, pl: 3, "& li": { mb: 0.5 } }}>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>No data leakage</Typography>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>No post-hoc tuning</Typography>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>No retraining on test data</Typography>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>Same model used for validation, backtesting, and inference</Typography>
              </Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ color: "#0A2540", textAlign: "center", mb: 1.5 }}>
                Explore
              </Typography>
              <Box sx={{ maxWidth: 600, mx: "auto", mb: 2, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  <Link component={RouterLink} to="/model-card" sx={{ color: "#0066CC", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>Model Card</Link>
                  {" · "}
                  <Link component={RouterLink} to="/tournament-evaluation" sx={{ color: "#0066CC", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>Tournament Evaluation</Link>
                  {" · "}
                  <Link component={RouterLink} to="/backtesting" sx={{ color: "#0066CC", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>Backtesting</Link>
                </Typography>
              </Box>
              <Typography
                variant="body2"
                sx={{
                  maxWidth: 560,
                  mx: "auto",
                  textAlign: "center",
                  fontStyle: "italic",
                  lineHeight: 1.7,
                  color: "#425466",
                  borderLeft: "3px solid #0066CC",
                  pl: 2,
                  py: 0.5,
                }}
              >
                Key Idea — A single, time-consistent model evaluated on truly unseen data — showing evidence of generalisation under strict temporal validation. All reported metrics and backtesting results are derived from predictions generated before outcomes were known.
              </Typography>
            </>
          ) : (
            <>
              <Typography
                variant="h3"
                fontWeight={700}
                sx={{
                  color: "#0A2540",
                  mb: { xs: 2, sm: 2.5, md: 3 },
                  textAlign: "center",
                  fontSize: { xs: "1.5rem", sm: "1.75rem", md: "2rem", lg: "2.25rem" },
                  lineHeight: { xs: 1.2, sm: 1.25, md: 1.3 },
                  px: { xs: 1, sm: 2 },
                  letterSpacing: "-0.02em",
                }}
              >
                Current prediction (with recent form)
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  maxWidth: { xs: "100%", sm: "800px", md: "900px" },
                  mx: "auto",
                  mb: { xs: 2, sm: 2.5, md: 3 },
                  textAlign: "center",
                  lineHeight: { xs: 1.6, sm: 1.65, md: 1.7 },
                  fontSize: { xs: "0.9375rem", sm: "1rem", md: "1.0625rem" },
                  px: { xs: 1, sm: 2 },
                  color: "#425466",
                }}
              >
                This page updates the prediction by incorporating matches played after the As At date.
                Instead of a fixed snapshot, this view reflects how each player is performing now.
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  maxWidth: { xs: "100%", sm: "800px", md: "900px" },
                  mx: "auto",
                  mb: { xs: 4, sm: 4.5, md: 5 },
                  textAlign: "center",
                  lineHeight: { xs: 1.6, sm: 1.65, md: 1.7 },
                  fontSize: { xs: "0.8125rem", sm: "0.875rem", md: "0.9375rem" },
                  px: { xs: 1, sm: 2 },
                  color: "#425466",
                }}
              >
                Recent match history is added manually so the process stays transparent.
                By pasting the matches yourself, you can see exactly what information the model is using to generate a current prediction.
              </Typography>
            </>
          )}

        </Box>

      {/* Player Selection Card */}
      <Card
        id="prediction-box"
        elevation={0}
        sx={{
          position: "relative",
          background: "#FFFFFF",
          border: activeTab === 0 ? "4px solid #0066CC" : "1px solid #E3E8EF",
          borderRadius: 2,
          overflow: "hidden",
          scrollMarginTop: "20px",
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3, md: 4 }, position: "relative" }}>
          <Typography
            variant="h6"
            fontWeight={600}
            gutterBottom
            sx={{
              mb: 2,
              color: activeTab === 0 ? "#0066CC" : "#5A9BD5",
              fontSize: "1.125rem",
            }}
          >
            Player Selection
          </Typography>
          <Typography
            variant="body2"
            sx={{
              mb: 4,
              color: "text.secondary",
              fontSize: "0.875rem",
              lineHeight: 1.6,
            }}
          >
            {activeTab === 0
              ? "Select two players to see the model's win probability based on information available as at your selected date."
              : "Select two players, then paste each player's match history below."}
          </Typography>

          {activeTab === 0 ? (
            /* As At: Grid layout with even spacing */
            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom fontWeight={600} sx={{ color: "#0A2540", mb: 1.5 }}>
                  Player One
                </Typography>
                <Box sx={{ width: "100%", ...(activeTab === 0 ? { "& .MuiOutlinedInput-root": { backgroundColor: "#FFFFFF" }, "& .MuiInputLabel-root": { color: "#0066CC !important" }, "& .MuiInputBase-input": { color: "#0A2540" } } : {}) }}>
                  <PlayerAutocomplete label="Type Player Name..." value={playerOne} onChange={setPlayerOne} />
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom fontWeight={600} sx={{ color: "#0A2540", mb: 1.5 }}>
                  Player Two
                </Typography>
                <Box sx={{ width: "100%", ...(activeTab === 0 ? { "& .MuiOutlinedInput-root": { backgroundColor: "#FFFFFF" }, "& .MuiInputLabel-root": { color: "#0066CC !important" }, "& .MuiInputBase-input": { color: "#0A2540" } } : {}) }}>
                  <PlayerAutocomplete label="Type Player Name..." value={playerTwo} onChange={setPlayerTwo} />
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" gutterBottom fontWeight={600} sx={{ color: "#0A2540", mb: 1.5 }}>
                  Tournament Level
                </Typography>
                <Select fullWidth value={tournamentLevel} onChange={(e) => setTournamentLevel(e.target.value)} displayEmpty size="small" sx={{ backgroundColor: "#FFFFFF", "& .MuiSelect-select": { color: "#0A2540" } }}>
                  <MenuItem value="ATP250">ATP 250</MenuItem>
                  <MenuItem value="ATP500">ATP 500</MenuItem>
                  <MenuItem value="ATP1000">ATP 1000</MenuItem>
                </Select>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" gutterBottom fontWeight={600} sx={{ color: "#0A2540", mb: 1.5 }}>
                  Round
                </Typography>
                <Select fullWidth value={round} onChange={(e) => setRound(e.target.value)} displayEmpty size="small" sx={{ backgroundColor: "#FFFFFF", "& .MuiSelect-select": { color: "#0A2540" } }}>
                  {["R32", "R16", "QF", "SF", "F"].map((r) => (
                    <MenuItem key={r} value={r}>{r}</MenuItem>
                  ))}
                </Select>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" gutterBottom fontWeight={600} sx={{ color: "#0A2540", mb: 1.5 }}>
                  Surface
                </Typography>
                <Select fullWidth value={surface} onChange={(e) => setSurface(e.target.value)} displayEmpty size="small" sx={{ backgroundColor: "#FFFFFF", "& .MuiSelect-select": { color: "#0A2540" } }}>
                  <MenuItem value="Hard">Hard</MenuItem>
                  <MenuItem value="Clay">Clay</MenuItem>
                  <MenuItem value="Grass">Grass</MenuItem>
                </Select>
              </Grid>
            </Grid>
          ) : isMobile ? (
            // Mobile: Stacked layout
            <Stack spacing={3} sx={{ mt: 2 }}>
              <Box>
                <Typography 
                  variant="subtitle2" 
                  gutterBottom 
                  sx={{ 
                    mb: 1.5, 
                    fontWeight: 600, 
                    color: "#5A9BD5",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  Player 1
                </Typography>
                <Box sx={{
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: "#FFFFFF",
                    borderRadius: "8px",
                    "& fieldset": {
                      borderColor: "#E3E8EF",
                      borderWidth: "1px",
                    },
                    "&:hover fieldset": {
                      borderColor: "#8898AA",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "#B8D4F0",
                      borderWidth: "2px",
                    },
                  },
                  "& .MuiInputLabel-root": {
                    color: "#6B7280",
                  },
                  "& .MuiInputLabel-root.Mui-focused": {
                    color: "#6B7280",
                  },
                  "& .MuiInputBase-input": {
                    color: "#0A2540",
                    fontSize: "1rem",
                  },
                }}>
                  <PlayerAutocomplete label="Type Player Name..." value={playerOne} onChange={setPlayerOne} />
                </Box>
              </Box>
              <Box>
                <Typography 
                  variant="subtitle2" 
                  gutterBottom 
                  sx={{ 
                    mb: 1.5, 
                    fontWeight: 600, 
                    color: "#5A9BD5",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  Player 2
                </Typography>
                <Box sx={{
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: "#FFFFFF",
                    borderRadius: "8px",
                    "& fieldset": {
                      borderColor: "#E3E8EF",
                      borderWidth: "1px",
                    },
                    "&:hover fieldset": {
                      borderColor: "#8898AA",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "#B8D4F0",
                      borderWidth: "2px",
                    },
                  },
                  "& .MuiInputLabel-root": {
                    color: "#6B7280",
                  },
                  "& .MuiInputLabel-root.Mui-focused": {
                    color: "#6B7280",
                  },
                  "& .MuiInputBase-input": {
                    color: "#0A2540",
                    fontSize: "1rem",
                  },
                }}>
                  <PlayerAutocomplete label="Type Player Name..." value={playerTwo} onChange={setPlayerTwo} />
                </Box>
              </Box>

              {/* Match Parameters - Mobile: After player inputs */}
              <Box sx={{ mt: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Box>
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          display: "block", 
                          mb: 1.5, 
                          fontWeight: 600, 
                          color: "#0A2540",
                          fontSize: "0.875rem",
                        }}
                      >
                        Tournament Level
                      </Typography>
                      <Select
                        fullWidth
                        value={tournamentLevel}
                        onChange={(e) => setTournamentLevel(e.target.value)}
                        displayEmpty
                        size="small"
                        sx={{
                          backgroundColor: "#FFFFFF",
                          color: "#0A2540",
                          borderRadius: "8px",
                          fontSize: "0.875rem",
                          "& .MuiOutlinedInput-notchedOutline": {
                            borderColor: "#E3E8EF",
                            borderWidth: "1px",
                          },
                          "&:hover .MuiOutlinedInput-notchedOutline": {
                            borderColor: "#8898AA",
                          },
                          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                            borderColor: "#B8D4F0",
                            borderWidth: "2px",
                          },
                        }}
                      >
                        <MenuItem value="ATP250">ATP 250</MenuItem>
                        <MenuItem value="ATP500">ATP 500</MenuItem>
                        <MenuItem value="ATP1000">ATP 1000</MenuItem>
                      </Select>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box>
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          display: "block", 
                          mb: 1.5, 
                          fontWeight: 600, 
                          color: "#0A2540",
                          fontSize: "0.875rem",
                        }}
                      >
                        Surface
                      </Typography>
                      <Select 
                        fullWidth 
                        value={surface} 
                        onChange={(e) => setSurface(e.target.value)} 
                        displayEmpty 
                        size="small"
                        sx={{
                          backgroundColor: "#FFFFFF",
                          color: "#0A2540",
                          borderRadius: "8px",
                          fontSize: "0.875rem",
                          "& .MuiOutlinedInput-notchedOutline": {
                            borderColor: "#E3E8EF",
                            borderWidth: "1px",
                          },
                          "&:hover .MuiOutlinedInput-notchedOutline": {
                            borderColor: "#8898AA",
                          },
                          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                            borderColor: "#B8D4F0",
                            borderWidth: "2px",
                          },
                        }}
                      >
                        <MenuItem value="Hard">Hard</MenuItem>
                        <MenuItem value="Clay">Clay</MenuItem>
                        <MenuItem value="Grass">Grass</MenuItem>
                      </Select>
                    </Box>
                  </Grid>
                  
                  {/* User entered match features: One box per player - paste area becomes parsed table in same space */}
                  {activeTab === 1 && bothPlayersSelected && (
                    <>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 3, mb: 2, textAlign: "center", fontSize: "0.875rem" }}>
                      Paste recent match history for each player below.
                      Public sources such as{" "}
                      <Link href="https://www.tennisabstract.com" target="_blank" rel="noopener noreferrer" sx={{ color: "#5A9BD5", fontWeight: 600 }}>
                        tennisabstract.com
                      </Link>{" "}
                      can be used for convenience.
                    </Typography>
                    <Grid container spacing={2} sx={{ mt: 2 }}>
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ border: "1px solid #E3E8EF", borderRadius: 2, p: 2, backgroundColor: "#FAFAFA", minHeight: 140, display: "flex", flexDirection: "column", overflow: "visible" }}>
                          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: "#0A2540", mt: 0 }}>
                            {playerOne.name} - Tennis Abstract Match History
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                            Paste recent match history from Tennis Abstract (10+ completed matches)
                          </Typography>
                          {playerOneLoading && <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={28} /></Box>}
                          {playerOneParseError && !playerOneLoading && (
                            <Box><Alert severity="warning" sx={{ borderRadius: 2 }}>Can&apos;t parse the text, continue anyway!</Alert>
                            <Link component="button" variant="caption" onClick={() => { setPlayerOneMatchHistory(""); setPlayerOneDisplayData(null); setPlayerOneParseError(false); }} sx={{ mt: 1, display: "block", cursor: "pointer" }}>Paste again</Link></Box>
                          )}
                          {!playerOneDisplayData && !playerOneLoading && !playerOneParseError && (
                            <TextField multiline rows={6} fullWidth placeholder="Paste match history here..." value={playerOneMatchHistory} onChange={(e) => setPlayerOneMatchHistory(e.target.value)} onPaste={() => { setPlayerOneLoading(true); setPlayerOneParseError(false); }} sx={{ fontFamily: "monospace", fontSize: "0.75rem", flex: 1, "& .MuiOutlinedInput-root": { backgroundColor: "#FFFFFF" } }} />
                          )}
                          {playerOneDisplayData && !playerOneLoading && (
                            <Box sx={{ mt: 1, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                              <Typography variant="caption" sx={{ color: "#6B7280", mb: 1 }}>{playerOne.name}: {playerOneDisplayData.summary.total_rows} rows | Valid: {playerOneDisplayData.summary.valid_matches} | Ignored: {playerOneDisplayData.summary.ignored_rows}</Typography>
                              {playerOneDisplayData.table_rows.length > 0 && <ParsedMatchHistoryTable data={playerOneDisplayData} maxHeight={320} />}
                              <Link component="button" variant="caption" onClick={() => { setPlayerOneMatchHistory(""); setPlayerOneDisplayData(null); setPlayerOneParseError(false); }} sx={{ mt: 1, cursor: "pointer", alignSelf: "flex-start" }}>Paste again</Link>
                            </Box>
                          )}
                        </Box>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ border: "1px solid #E3E8EF", borderRadius: 2, p: 2, backgroundColor: "#FAFAFA", minHeight: 140, display: "flex", flexDirection: "column", overflow: "visible" }}>
                          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: "#0A2540", mt: 0 }}>
                            {playerTwo.name} - Tennis Abstract Match History
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                            Paste recent match history from Tennis Abstract (10+ completed matches)
                          </Typography>
                          {playerTwoLoading && <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={28} /></Box>}
                          {playerTwoParseError && !playerTwoLoading && (
                            <Box><Alert severity="warning" sx={{ borderRadius: 2 }}>Can&apos;t parse the text, continue anyway!</Alert>
                            <Link component="button" variant="caption" onClick={() => { setPlayerTwoMatchHistory(""); setPlayerTwoDisplayData(null); setPlayerTwoParseError(false); }} sx={{ mt: 1, display: "block", cursor: "pointer" }}>Paste again</Link></Box>
                          )}
                          {!playerTwoDisplayData && !playerTwoLoading && !playerTwoParseError && (
                            <TextField multiline rows={6} fullWidth placeholder="Paste match history here..." value={playerTwoMatchHistory} onChange={(e) => setPlayerTwoMatchHistory(e.target.value)} onPaste={() => { setPlayerTwoLoading(true); setPlayerTwoParseError(false); }} sx={{ fontFamily: "monospace", fontSize: "0.75rem", flex: 1, "& .MuiOutlinedInput-root": { backgroundColor: "#FFFFFF" } }} />
                          )}
                          {playerTwoDisplayData && !playerTwoLoading && (
                            <Box sx={{ mt: 1, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                              <Typography variant="caption" sx={{ color: "#6B7280", mb: 1 }}>{playerTwo.name}: {playerTwoDisplayData.summary.total_rows} rows | Valid: {playerTwoDisplayData.summary.valid_matches} | Ignored: {playerTwoDisplayData.summary.ignored_rows}</Typography>
                              {playerTwoDisplayData.table_rows.length > 0 && <ParsedMatchHistoryTable data={playerTwoDisplayData} maxHeight={320} />}
                              <Link component="button" variant="caption" onClick={() => { setPlayerTwoMatchHistory(""); setPlayerTwoDisplayData(null); setPlayerTwoParseError(false); }} sx={{ mt: 1, cursor: "pointer", alignSelf: "flex-start" }}>Paste again</Link>
                            </Box>
                          )}
                        </Box>
                      </Grid>
                    </Grid>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: "center", fontSize: "0.8125rem" }}>
                      The pasted matches update the model&apos;s view of each player&apos;s recent form.
                      This allows the prediction to reflect what has happened since the original As At date.
                    </Typography>
                    </>
                  )}
                  
                  {activeTab === 1 && (
                    <Grid item xs={12}>
                      <Box sx={{ display: "flex", gap: 2, mt: 2, alignItems: "center", flexWrap: "wrap" }}>
                        <Button
                          variant="outlined"
                          size="medium"
                          onClick={handleReset}
                          sx={{
                            py: 1.25,
                            px: 2.5,
                            fontSize: "0.9375rem",
                            fontWeight: 500,
                            textTransform: "none",
                            borderRadius: 0,
                            borderColor: "#0A2540",
                            color: "#0A2540",
                            "&:hover": { 
                              backgroundColor: "#0A2540",
                              color: "#FFFFFF",
                              borderColor: "#0A2540",
                            },
                          }}
                        >
                          Reset
                        </Button>
                        <Button
                          variant="contained"
                          size="large"
                          onClick={handleAdvancedPredict}
                          disabled={!bothPlayersSelected || advancedMutation.isPending || !playerOneMatchHistory.trim() || !playerTwoMatchHistory.trim()}
                          sx={{
                            flex: 1,
                            minWidth: 200,
                            py: 1.5,
                            fontSize: "1rem",
                            fontWeight: 600,
                            textTransform: "none",
                            borderRadius: 0,
                            backgroundColor: "#0A2540",
                            color: "#FFFFFF",
                            "&:hover:not(:disabled)": {
                              backgroundColor: "#0A2540",
                            },
                            "&:disabled": {
                              backgroundColor: "#E3E8EF",
                              color: "#8898AA",
                            },
                          }}
                        >
                          {advancedMutation.isPending ? "Running Prediction..." : "Run Prediction"}
                        </Button>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block", fontSize: "0.75rem" }}>
                        This will generate a new prediction using the added match history.
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>
            </Stack>
          ) : (
            <>
              {/* Desktop: Tennis court layout */}
              {/* Player 1 - Left side of court */}
              <Box
                sx={{
                  position: "absolute",
                  left: { sm: "5%", md: "8%" },
                  top: "calc(50% - 20px)",
                  transform: "translateY(-50%)",
                  width: { sm: "35%", md: "30%" },
                  maxWidth: "300px",
                }}
              >
                <Typography 
                  variant="subtitle2" 
                  gutterBottom 
                  sx={{ 
                    mb: 2, 
                    fontWeight: 600, 
                    color: "#FFFFFF",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    textAlign: "left",
                  }}
                >
                  Player 1
                </Typography>
                <Box sx={{
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: "#FFFFFF",
                    borderRadius: "8px",
                    "& fieldset": {
                      borderColor: "#E3E8EF",
                      borderWidth: "1px",
                    },
                    "&:hover fieldset": {
                      borderColor: "#8898AA",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "#B8D4F0",
                      borderWidth: "2px",
                    },
                  },
                  "& .MuiInputLabel-root": {
                    color: "#6B7280",
                  },
                  "& .MuiInputLabel-root.Mui-focused": {
                    color: "#6B7280",
                  },
                  "& .MuiInputBase-input": {
                    color: "#0A2540",
                    fontSize: "0.875rem",
                  },
                }}>
                  <PlayerAutocomplete label="Type Player Name..." value={playerOne} onChange={setPlayerOne} />
                </Box>
              </Box>

              {/* Player 2 - Right side of court */}
              <Box
                sx={{
                  position: "absolute",
                  right: { sm: "5%", md: "8%" },
                  top: "calc(50% - 20px)",
                  transform: "translateY(-50%)",
                  width: { sm: "35%", md: "30%" },
                  maxWidth: "300px",
                }}
              >
                <Typography 
                  variant="subtitle2" 
                  gutterBottom 
                  sx={{ 
                    mb: 2, 
                    fontWeight: 600, 
                    color: "#FFFFFF",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    textAlign: "right",
                  }}
                >
                  Player 2
                </Typography>
                <Box sx={{
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: "#FFFFFF",
                    borderRadius: "8px",
                    "& fieldset": {
                      borderColor: "#E3E8EF",
                      borderWidth: "1px",
                    },
                    "&:hover fieldset": {
                      borderColor: "#8898AA",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "#B8D4F0",
                      borderWidth: "2px",
                    },
                  },
                  "& .MuiInputLabel-root": {
                    color: "#6B7280",
                  },
                  "& .MuiInputLabel-root.Mui-focused": {
                    color: "#6B7280",
                  },
                  "& .MuiInputBase-input": {
                    color: "#0A2540",
                    fontSize: "0.875rem",
                  },
                }}>
                  <PlayerAutocomplete label="Type Player Name..." value={playerTwo} onChange={setPlayerTwo} />
                </Box>
              </Box>
            </>
          )}

          {/* Match Parameters - Bottom of card (Desktop only) */}
          {!isMobile && (
          <Box
            sx={{
              position: "absolute",
              bottom: { sm: 55, md: 65 },
              left: "50%",
              transform: "translateX(-50%)",
              width: { sm: "80%", md: "70%" },
              maxWidth: "600px",
            }}
          >
            <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={4}>
                  <Box>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        display: "block", 
                        mb: 2, 
                        fontWeight: 600, 
                        color: "#FFFFFF",
                        fontSize: "1rem",
                      }}
                    >
                      Tournament Level
                    </Typography>
                    <Select
                      fullWidth
                      value={tournamentLevel}
                      onChange={(e) => setTournamentLevel(e.target.value)}
                      displayEmpty
                      size="medium"
                      sx={{
                        backgroundColor: "#FFFFFF",
                        color: "#0A2540",
                        borderRadius: "8px",
                        fontSize: "1rem",
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#E3E8EF",
                          borderWidth: "1px",
                        },
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#8898AA",
                        },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#B8D4F0",
                          borderWidth: "2px",
                        },
                        "& .MuiSelect-icon": {
                          color: "#425466",
                        },
                      }}
                      MenuProps={{
                        PaperProps: {
                          sx: {
                            backgroundColor: "#FFFFFF",
                            borderRadius: "8px",
                            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                            mt: 1,
                            "& .MuiMenuItem-root": {
                              color: "#0A2540",
                              fontSize: "1rem",
                              "&:hover": {
                                backgroundColor: "#F6F9FC",
                              },
                              "&.Mui-selected": {
                                backgroundColor: "#F0F7FF",
                                color: "#5A9BD5",
                                fontWeight: 500,
                              },
                            },
                          },
                        },
                      }}
                    >
                      <MenuItem value="ATP250">ATP 250</MenuItem>
                      <MenuItem value="ATP500">ATP 500</MenuItem>
                      <MenuItem value="ATP1000">ATP 1000</MenuItem>
                    </Select>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Box>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        display: "block", 
                        mb: 2, 
                        fontWeight: 600, 
                        color: "#FFFFFF",
                        fontSize: "1rem",
                      }}
                    >
                      Round
                    </Typography>
                    <Select 
                      fullWidth 
                      value={round} 
                      onChange={(e) => setRound(e.target.value)} 
                      displayEmpty 
                      size="medium"
                      sx={{
                        backgroundColor: "#FFFFFF",
                        color: "#0A2540",
                        borderRadius: "8px",
                        fontSize: "1rem",
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#E3E8EF",
                          borderWidth: "1px",
                        },
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#8898AA",
                        },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#B8D4F0",
                          borderWidth: "2px",
                        },
                        "& .MuiSelect-icon": {
                          color: "#425466",
                        },
                      }}
                      MenuProps={{
                        PaperProps: {
                          sx: {
                            backgroundColor: "#FFFFFF",
                            borderRadius: "8px",
                            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                            mt: 1,
                            "& .MuiMenuItem-root": {
                              color: "#0A2540",
                              fontSize: "1rem",
                              "&:hover": {
                                backgroundColor: "#F6F9FC",
                              },
                              "&.Mui-selected": {
                                backgroundColor: "#F0F7FF",
                                color: "#5A9BD5",
                                fontWeight: 500,
                              },
                            },
                          },
                        },
                      }}
                    >
                      {["R32", "R16", "QF", "SF", "F"].map((r) => (
                        <MenuItem key={r} value={r}>
                          {r}
                        </MenuItem>
                      ))}
                    </Select>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Box>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        display: "block", 
                        mb: 2, 
                        fontWeight: 600, 
                        color: "#FFFFFF",
                        fontSize: "1rem",
                      }}
                    >
                      Surface
                    </Typography>
                    <Select 
                      fullWidth 
                      value={surface} 
                      onChange={(e) => setSurface(e.target.value)} 
                      displayEmpty 
                      size="medium"
                      sx={{
                        backgroundColor: "#FFFFFF",
                        color: "#0A2540",
                        borderRadius: "8px",
                        fontSize: "1rem",
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#E3E8EF",
                          borderWidth: "1px",
                        },
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#8898AA",
                        },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#B8D4F0",
                          borderWidth: "2px",
                        },
                        "& .MuiSelect-icon": {
                          color: "#425466",
                        },
                      }}
                      MenuProps={{
                        PaperProps: {
                          sx: {
                            backgroundColor: "#FFFFFF",
                            borderRadius: "8px",
                            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                            mt: 1,
                            "& .MuiMenuItem-root": {
                              color: "#0A2540",
                              fontSize: "1rem",
                              "&:hover": {
                                backgroundColor: "#F6F9FC",
                              },
                              "&.Mui-selected": {
                                backgroundColor: "#F0F7FF",
                                color: "#5A9BD5",
                                fontWeight: 500,
                              },
                            },
                          },
                        },
                      }}
                    >
                      <MenuItem value="Hard">Hard</MenuItem>
                      <MenuItem value="Clay">Clay</MenuItem>
                      <MenuItem value="Grass">Grass</MenuItem>
                    </Select>
                  </Box>
                </Grid>

                {/* User entered match features: One box per player - paste area becomes parsed table in same space */}
                {activeTab === 1 && bothPlayersSelected && (
                  <>
                    <Grid item xs={12} sx={{ mt: 3 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: "center", fontSize: "0.875rem" }}>
                        Paste recent match history for each player below.
                        Public sources such as{" "}
                        <Link href="https://www.tennisabstract.com" target="_blank" rel="noopener noreferrer" sx={{ color: "#5A9BD5", fontWeight: 600 }}>
                          tennisabstract.com
                        </Link>{" "}
                        can be used for convenience.
                      </Typography>
                      <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ border: "1px solid rgba(255,255,255,0.4)", borderRadius: 2, p: 2, backgroundColor: "rgba(255,255,255,0.95)", minHeight: 140, display: "flex", flexDirection: "column", overflow: "visible" }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: "#FFFFFF", mt: 0, textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                          {playerOne.name} - Tennis Abstract Match History
                        </Typography>
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.85)", display: "block", mb: 1 }}>
                          Paste recent match history from Tennis Abstract (10+ completed matches)
                        </Typography>
                        {playerOneLoading && <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={28} /></Box>}
                        {playerOneParseError && !playerOneLoading && (
                          <Box><Alert severity="warning" sx={{ borderRadius: 2 }}>Can&apos;t parse the text, continue anyway!</Alert>
                          <Link component="button" variant="caption" onClick={() => { setPlayerOneMatchHistory(""); setPlayerOneDisplayData(null); setPlayerOneParseError(false); }} sx={{ mt: 1, display: "block", cursor: "pointer", color: "#5A9BD5" }}>Paste again</Link></Box>
                        )}
                        {!playerOneDisplayData && !playerOneLoading && !playerOneParseError && (
                          <TextField multiline rows={8} fullWidth placeholder="Paste match history here..." value={playerOneMatchHistory} onChange={(e) => setPlayerOneMatchHistory(e.target.value)} onPaste={() => { setPlayerOneLoading(true); setPlayerOneParseError(false); }} sx={{ fontFamily: "monospace", fontSize: "0.75rem", flex: 1, "& .MuiOutlinedInput-root": { backgroundColor: "#FFFFFF" } }} />
                        )}
                        {playerOneDisplayData && !playerOneLoading && (
                          <Box sx={{ mt: 1, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                            <Typography variant="caption" sx={{ color: "#6B7280", mb: 1 }}>{playerOne.name}: {playerOneDisplayData.summary.total_rows} rows | Valid: {playerOneDisplayData.summary.valid_matches} | Ignored: {playerOneDisplayData.summary.ignored_rows}</Typography>
                            {playerOneDisplayData.table_rows.length > 0 && <ParsedMatchHistoryTable data={playerOneDisplayData} maxHeight={320} />}
                            <Link component="button" variant="caption" onClick={() => { setPlayerOneMatchHistory(""); setPlayerOneDisplayData(null); setPlayerOneParseError(false); }} sx={{ mt: 1, cursor: "pointer", alignSelf: "flex-start", color: "#5A9BD5" }}>Paste again</Link>
                          </Box>
                        )}
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ border: "1px solid rgba(255,255,255,0.4)", borderRadius: 2, p: 2, backgroundColor: "rgba(255,255,255,0.95)", minHeight: 140, display: "flex", flexDirection: "column", overflow: "visible" }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: "#FFFFFF", mt: 0, textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                          {playerTwo.name} - Tennis Abstract Match History
                        </Typography>
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.85)", display: "block", mb: 1 }}>
                          Paste recent match history from Tennis Abstract (10+ completed matches)
                        </Typography>
                        {playerTwoLoading && <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={28} /></Box>}
                        {playerTwoParseError && !playerTwoLoading && (
                          <Box><Alert severity="warning" sx={{ borderRadius: 2 }}>Can&apos;t parse the text, continue anyway!</Alert>
                          <Link component="button" variant="caption" onClick={() => { setPlayerTwoMatchHistory(""); setPlayerTwoDisplayData(null); setPlayerTwoParseError(false); }} sx={{ mt: 1, display: "block", cursor: "pointer", color: "#5A9BD5" }}>Paste again</Link></Box>
                        )}
                        {!playerTwoDisplayData && !playerTwoLoading && !playerTwoParseError && (
                          <TextField multiline rows={8} fullWidth placeholder="Paste match history here..." value={playerTwoMatchHistory} onChange={(e) => setPlayerTwoMatchHistory(e.target.value)} onPaste={() => { setPlayerTwoLoading(true); setPlayerTwoParseError(false); }} sx={{ fontFamily: "monospace", fontSize: "0.75rem", flex: 1, "& .MuiOutlinedInput-root": { backgroundColor: "#FFFFFF" } }} />
                        )}
                        {playerTwoDisplayData && !playerTwoLoading && (
                          <Box sx={{ mt: 1, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                            <Typography variant="caption" sx={{ color: "#6B7280", mb: 1 }}>{playerTwo.name}: {playerTwoDisplayData.summary.total_rows} rows | Valid: {playerTwoDisplayData.summary.valid_matches} | Ignored: {playerTwoDisplayData.summary.ignored_rows}</Typography>
                            {playerTwoDisplayData.table_rows.length > 0 && <ParsedMatchHistoryTable data={playerTwoDisplayData} maxHeight={320} />}
                            <Link component="button" variant="caption" onClick={() => { setPlayerTwoMatchHistory(""); setPlayerTwoDisplayData(null); setPlayerTwoParseError(false); }} sx={{ mt: 1, cursor: "pointer", alignSelf: "flex-start", color: "#5A9BD5" }}>Paste again</Link>
                          </Box>
                        )}
                      </Box>
                    </Grid>
                      </Grid>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: "center", fontSize: "0.8125rem" }}>
                      The pasted matches update the model&apos;s view of each player&apos;s recent form.
                      This allows the prediction to reflect what has happened since the original As At date.
                    </Typography>
                    </Grid>
                  </>
                )}

                {activeTab === 1 && (
                  /* Predict Button - Current tab only; As At uses buttons below the card */
                  <Grid item xs={12}>
                    <Box sx={{ display: "flex", gap: 2, mt: 3, alignItems: "center", flexWrap: "wrap" }}>
                      <Button
                        variant="outlined"
                        size="medium"
                        onClick={handleReset}
                        sx={{
                          py: 1.5,
                          px: 3,
                          fontSize: "1rem",
                          fontWeight: 500,
                          textTransform: "none",
                          borderRadius: 0,
                          borderColor: "#0A2540",
                          color: "#0A2540",
                          "&:hover": { 
                            backgroundColor: "#0A2540",
                            color: "#FFFFFF",
                            borderColor: "#0A2540",
                          },
                        }}
                      >
                        Reset
                      </Button>
                      <Button
                        variant="contained"
                        size="large"
                        onClick={handleAdvancedPredict}
                        disabled={!bothPlayersSelected || advancedMutation.isPending || !playerOneMatchHistory.trim() || !playerTwoMatchHistory.trim()}
                        sx={{
                          flex: 1,
                          minWidth: 220,
                          py: 2,
                          px: 5,
                          fontSize: "1.125rem",
                          fontWeight: 600,
                          textTransform: "none",
                          borderRadius: 0,
                          backgroundColor: "#0A2540",
                          color: "#FFFFFF",
                          letterSpacing: "-0.01em",
                          "&:hover:not(:disabled)": {
                            backgroundColor: "#0A2540",
                          },
                          "&:disabled": {
                            backgroundColor: "#E3E8EF",
                            color: "#8898AA",
                          },
                        }}
                      >
                        {advancedMutation.isPending ? "Running Prediction..." : "Run Prediction"}
                      </Button>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block", textAlign: "center", fontSize: "0.75rem" }}>
                      This will generate a new prediction using the added match history.
                    </Typography>
                  </Grid>
                )}
              </Grid>
          </Box>
          )}
        </CardContent>
      </Card>

      {/* Predict buttons - bottom left (As At only; Current has buttons inside the card) */}
      {activeTab === 0 && (
        <>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
            <Button variant="outlined" size="medium" onClick={handleReset} sx={{ py: 1.25, px: 2.5, fontSize: "0.9375rem", fontWeight: 500, textTransform: "none", borderRadius: 0, borderColor: "#0A2540", color: "#0A2540", "&:hover": { backgroundColor: "#0A2540", color: "#FFFFFF", borderColor: "#0A2540" } }}>
              Reset
            </Button>
            <Button variant="contained" size="large" onClick={handlePredict} disabled={!bothPlayersSelected || mutation.isPending} sx={{ py: 1.5, fontSize: "1rem", fontWeight: 600, textTransform: "none", borderRadius: 0, backgroundColor: "#0A2540", color: "#FFFFFF", "&:hover:not(:disabled)": { backgroundColor: "#0A2540" } }}>
              {mutation.isPending ? "Generating Prediction..." : "Generate Prediction"}
            </Button>
          </Box>
          <Typography variant="caption" sx={{ display: "block", color: "text.secondary", fontSize: "0.75rem" }}>
            Matches played after the As At date are not included in this prediction.
          </Typography>
        </>
      )}

      {/* Prediction Results - PRIMARY OUTPUT - Appears at top */}
      {activeTab === 0 && !mutation.isPending && prediction && (
        <Box sx={{ mb: 6 }}>
          <PredictionResultCard prediction={prediction} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: "center", maxWidth: 600, mx: "auto", lineHeight: 1.6 }}>
            This probability reflects how the model rated each player at that time.
            Since then, new matches may have been played and form may have changed.
          </Typography>
          <Box sx={{ textAlign: "center", mt: 2 }}>
            <Link
              component={RouterLink}
              to="/advanced-inference"
              state={{ reset: true }}
              sx={{ color: "#5A9BD5", fontWeight: 600, textDecoration: "none", fontSize: "1rem", "&:hover": { textDecoration: "underline" } }}
            >
              Update this prediction using current match history →
            </Link>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: "0.8125rem" }}>
              Switch to Current to manually add recent matches and see how the prediction changes.
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 4, textAlign: "center", fontStyle: "italic" }}>
            As At predictions are fixed by date and will not change.
          </Typography>
        </Box>
      )}
      
      {activeTab === 1 && !advancedMutation.isPending && advancedPrediction && (
        <Box sx={{ mb: 6 }}>
        <Card elevation={0} sx={{ border: "3px solid #3D3D3D", borderRadius: 0 }}>
          <CardContent sx={{ p: { xs: 5, sm: 6, md: 7 } }}>
            <Typography 
              variant="h2" 
              fontWeight={800} 
              gutterBottom 
              sx={{ 
                color: "#3D3D3D", 
                mb: 6, 
                fontSize: { xs: "2rem", sm: "2.5rem", md: "3rem" },
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
              }}
            >
              Prediction Results
            </Typography>

            <Grid container spacing={3}>
              {/* As at 12/11/25 */}
              <Grid item xs={12} md={6}>
                <Box sx={{ border: "2px solid #3D3D3D", borderTop: "4px solid #000000" }}>
                  <Box sx={{ px: 4, py: 3, backgroundColor: "#000000" }}>
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        color: "#FFFFFF", 
                        fontWeight: 800, 
                        textTransform: "uppercase", 
                        letterSpacing: "0.1em", 
                        fontSize: "0.875rem" 
                      }}
                    >
                      As at 12/11/25
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, fontStyle: "italic" }}>
                        Uses temperature scaling (T=1.2) optimized for betting performance on Pinnacle odds.
                      </Typography>
                    </Typography>
                  </Box>
                  <Box sx={{ p: 4 }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        display: "block", 
                        color: "#3D3D3D", 
                        mb: 4, 
                        fontSize: "0.875rem",
                        lineHeight: 1.6,
                        fontWeight: 500,
                      }}
                    >
                      Frozen model, features as at this date (no pasted matches). Train 1990–2022, 2023 calibration; test 2024–2025 ~70%. Temperature scaling T≈0.72.
                    </Typography>
                    <Stack spacing={0}>
                      {[advancedPrediction.player_one, advancedPrediction.player_two].map((p, i) => {
                        const probs = advancedPrediction.standard_probabilities;
                        const pKey = i === 0 ? "player_one" : "player_two";
                        const isWinner = (pKey === "player_one" && probs.player_one > probs.player_two) || (pKey === "player_two" && probs.player_two > probs.player_one);
                        const pct = (probs[pKey as keyof typeof probs] * 100).toFixed(1);
                        return (
                          <Box 
                            key={p.id} 
                            sx={{ 
                              display: "flex", 
                              alignItems: "center", 
                              justifyContent: "space-between", 
                              py: 4, 
                              px: 0,
                              borderTop: i === 0 ? "none" : "2px solid #000000",
                            }}
                          >
                            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                              <Typography 
                                variant="h5" 
                                sx={{ 
                                  fontWeight: isWinner ? 800 : 600, 
                                  color: "#3D3D3D", 
                                  fontSize: "1.5rem",
                                  letterSpacing: "-0.02em",
                                  mb: isWinner ? 1.5 : 0,
                                }}
                              >
                                {p.name}
                              </Typography>
                              {isWinner && (
                                <Chip 
                                  label="Predicted Winner" 
                                  size="medium" 
                                  sx={{ 
                                    backgroundColor: "#3D3D3D", 
                                    color: "#FFFFFF", 
                                    fontWeight: 700, 
                                    fontSize: "0.8125rem", 
                                    height: 28,
                                    borderRadius: 0,
                                  }} 
                                />
                              )}
                            </Box>
                            <Box sx={{ textAlign: "right", minWidth: 120 }}>
                              <Typography 
                                variant="h2" 
                                sx={{ 
                                  fontWeight: 800, 
                                  color: "#3D3D3D", 
                                  lineHeight: 1,
                                  fontSize: "3rem",
                                  letterSpacing: "-0.03em",
                                  mb: 0.75,
                                }}
                              >
                                {pct}%
                              </Typography>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  color: "#3D3D3D", 
                                  fontWeight: 600, 
                                  fontSize: "0.8125rem", 
                                  textTransform: "uppercase",
                                  letterSpacing: "0.08em",
                                }}
                              >
                                Win Probability
                              </Typography>
                            </Box>
                          </Box>
                        );
                      })}
                    </Stack>
                  </Box>
                </Box>
              </Grid>

              {/* Current (User Entered Last 10 matches) */}
              <Grid item xs={12} md={6}>
                <Box sx={{ border: "2px solid #3D3D3D", borderTop: "4px solid #000000" }}>
                  <Box sx={{ px: 4, py: 3, backgroundColor: "#000000" }}>
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        color: "#FFFFFF", 
                        fontWeight: 800, 
                        textTransform: "uppercase", 
                        letterSpacing: "0.1em", 
                        fontSize: "0.875rem" 
                      }}
                    >
                      Current
                    </Typography>
                  </Box>
                  <Box sx={{ p: 4 }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        display: "block", 
                        color: "#3D3D3D", 
                        mb: 4, 
                        fontSize: "0.875rem",
                        lineHeight: 1.6,
                        fontWeight: 500,
                      }}
                    >
                      Uses your pasted last 10 matches to override temporal features; other features stay frozen.
                    </Typography>
                    <Stack spacing={0}>
                      {[advancedPrediction.player_one, advancedPrediction.player_two].map((p, i) => {
                        const probs = advancedPrediction.advanced_probabilities;
                        const pKey = i === 0 ? "player_one" : "player_two";
                        const isWinner = (pKey === "player_one" && probs.player_one > probs.player_two) || (pKey === "player_two" && probs.player_two > probs.player_one);
                        const pct = (probs[pKey as keyof typeof probs] * 100).toFixed(1);
                        return (
                          <Box 
                            key={p.id} 
                            sx={{ 
                              display: "flex", 
                              alignItems: "center", 
                              justifyContent: "space-between", 
                              py: 4, 
                              px: 0,
                              borderTop: i === 0 ? "none" : "2px solid #000000",
                            }}
                          >
                            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                              <Typography 
                                variant="h5" 
                                sx={{ 
                                  fontWeight: isWinner ? 800 : 600, 
                                  color: "#3D3D3D", 
                                  fontSize: "1.5rem",
                                  letterSpacing: "-0.02em",
                                  mb: isWinner ? 1.5 : 0,
                                }}
                              >
                                {p.name}
                              </Typography>
                              {isWinner && (
                                <Chip 
                                  label="Predicted Winner" 
                                  size="medium" 
                                  sx={{ 
                                    backgroundColor: "#3D3D3D", 
                                    color: "#FFFFFF", 
                                    fontWeight: 700, 
                                    fontSize: "0.8125rem", 
                                    height: 28,
                                    borderRadius: 0,
                                  }} 
                                />
                              )}
                            </Box>
                            <Box sx={{ textAlign: "right", minWidth: 120 }}>
                              <Typography 
                                variant="h2" 
                                sx={{ 
                                  fontWeight: 800, 
                                  color: "#3D3D3D", 
                                  lineHeight: 1,
                                  fontSize: "3rem",
                                  letterSpacing: "-0.03em",
                                  mb: 0.75,
                                }}
                              >
                                {pct}%
                              </Typography>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  color: "#3D3D3D", 
                                  fontWeight: 600, 
                                  fontSize: "0.8125rem", 
                                  textTransform: "uppercase",
                                  letterSpacing: "0.08em",
                                }}
                              >
                                Win Probability
                              </Typography>
                            </Box>
                          </Box>
                        );
                      })}
                    </Stack>
                  </Box>
                </Box>
              </Grid>

              {/* Probability Delta */}
              <Grid item xs={12}>
                <Box sx={{ p: 5, borderTop: "3px solid #3D3D3D", mt: 5 }}>
                  <Typography 
                    variant="subtitle1" 
                    fontWeight={700} 
                    gutterBottom
                    sx={{
                      color: "#3D3D3D",
                      fontSize: "0.9375rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      mb: 3,
                    }}
                  >
                    Probability Delta (User entered - As at 12/11/25)
                  </Typography>
                  <Typography 
                    variant="h1" 
                    fontWeight={800} 
                    sx={{
                      color: "#3D3D3D",
                      fontSize: "4rem",
                      letterSpacing: "-0.03em",
                      mb: 2,
                      lineHeight: 1,
                    }}
                  >
                    {advancedPrediction.probability_delta > 0 ? "+" : ""}{(advancedPrediction.probability_delta * 100).toFixed(2)}%
                  </Typography>
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      color: "#3D3D3D",
                      fontSize: "1rem",
                      lineHeight: 1.6,
                      fontWeight: 500,
                    }}
                  >
                    {advancedPrediction.probability_delta > 0
                      ? `User-entered features increase ${playerOne?.name}'s win probability`
                      : advancedPrediction.probability_delta < 0
                      ? `User-entered features decrease ${playerOne?.name}'s win probability`
                      : "No change in probability"}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: "center", maxWidth: 600, mx: "auto", lineHeight: 1.6 }}>
          Differences between this result and the As At prediction show how recent matches influence the model&apos;s assessment.
          Sometimes the probability shifts noticeably. Sometimes it barely moves. Both outcomes are meaningful.
        </Typography>
        <Box sx={{ textAlign: "center", mt: 2 }}>
          <Link
            component="button"
            onClick={() => setActiveTab(0)}
            sx={{ color: "#5A9BD5", fontWeight: 600, textDecoration: "none", fontSize: "1rem", "&:hover": { textDecoration: "underline" }, background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit" }}
          >
            ← View the original As At prediction
          </Link>
        </Box>
        </Box>
      )}

      {/* Loading Animation - Appears below results if still loading */}
      {(mutation.isPending || advancedMutation.isPending) && (
        <Box sx={{ mb: 6 }}>
          <PredictionLoadingAnimation
            playerOneName={playerOne?.name}
            playerTwoName={playerTwo?.name}
          />
        </Box>
      )}

      {/* Head-to-Head Section */}
      {bothPlayersSelected && (
        <H2HDisplay
          h2h={h2h.data ?? null}
          playerOneName={playerOne.name}
          playerTwoName={playerTwo.name}
          isLoading={h2h.isLoading}
        />
      )}

      {/* Player Summary Cards */}
      {bothPlayersSelected && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <PlayerSummaryCard title="Player 1" player={playerOne} />
          </Grid>
          <Grid item xs={12} md={6}>
            <PlayerSummaryCard title="Player 2" player={playerTwo} />
          </Grid>
        </Grid>
      )}

      {/* Recent Form Section */}
      {bothPlayersSelected && (
        <>
          <Box>
            <Typography 
              variant="h4" 
              fontWeight={600} 
              gutterBottom 
              sx={{ 
                mb: 2,
                color: "#0A2540",
              }}
            >
              Recent Form
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                mb: 4, 
                maxWidth: 900,
                color: "#425466",
                lineHeight: 1.5,
                fontSize: "0.875rem",
              }}
            >
              Performance analysis from each player's last 10 matches, showing wins, losses, opponents, and match context.
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <RecentFormCard title="Player 1 — Last 10 Matches" matches={playerOneHistory.data?.recent_matches ?? []} />
              </Grid>
              <Grid item xs={12} md={6}>
                <RecentFormCard title="Player 2 — Last 10 Matches" matches={playerTwoHistory.data?.recent_matches ?? []} />
              </Grid>
            </Grid>
          </Box>

          {/* Performance Graphs */}
          <Box>
            <Typography 
              variant="h4" 
              fontWeight={600} 
              gutterBottom 
              sx={{ 
                mb: 2,
                color: "#0A2540",
              }}
            >
              Performance Analysis
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                mb: 4, 
                maxWidth: 900,
                color: "#425466",
              }}
            >
              Visual analysis of recent performance and ranking trends. The graphs below show match-by-match performance against opponent strength, as well as monthly ranking progression over the past 12 months.
            </Typography>
            <Stack spacing={4}>
              <LastTenMatchesGraph
                playerOneName={playerOne?.name ?? "Player 1"}
                playerTwoName={playerTwo?.name ?? "Player 2"}
                playerOneMatches={playerOneHistory.data?.recent_matches ?? []}
                playerTwoMatches={playerTwoHistory.data?.recent_matches ?? []}
              />

              <MonthlyRankGraph
                playerOneName={playerOne?.name ?? "Player 1"}
                playerTwoName={playerTwo?.name ?? "Player 2"}
                playerOneMatches={playerOneHistoryForRank.data?.recent_matches ?? []}
                playerTwoMatches={playerTwoHistoryForRank.data?.recent_matches ?? []}
              />
            </Stack>
          </Box>

          {/* Model Building and Validation Info */}
          {prediction && (
            <Paper
              sx={{
                p: { xs: 3, sm: 4 },
                backgroundColor: "rgba(90, 155, 213, 0.05)",
                border: "1px solid rgba(90, 155, 213, 0.2)",
                borderRadius: 2,
                mt: 4,
              }}
            >
              <Typography
                variant="h6"
                fontWeight={700}
                sx={{
                  color: "#0A2540",
                  mb: 3,
                }}
              >
                How This Model Was Built and Validated
              </Typography>

              <Stack spacing={2} sx={{ mb: 4 }}>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  Train 1990–2022; 2023 holdout for early stopping, hyperparams, and calibration. No retraining after 2023.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  Test 2024–2025 out-of-sample; ~70% accuracy, stable across both years.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  Same model for Match prediction (As At + Current) and Backtesting page.
                </Typography>
              </Stack>

              <Typography
                variant="h6"
                fontWeight={700}
                sx={{
                  color: "#0A2540",
                  mb: 3,
                }}
              >
                How This Differs From the Tournament Predictions
              </Typography>

              <Stack spacing={2} sx={{ mb: 4 }}>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  Tournament predictions use the same frozen model; 2024/2025 runs are out-of-sample evaluation.
                </Typography>
              </Stack>

              <Typography
                variant="h6"
                fontWeight={700}
                sx={{
                  color: "#0A2540",
                  mb: 3,
                }}
              >
                Interpreting the Probabilities
              </Typography>

              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  Each match forecast shows the model's estimated probability of a player winning
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  Probabilities are well-calibrated: for example, a 70% probability roughly corresponds to winning 7 out of 10 similar matchups
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  Individual predictions may still seem surprising; the model is evaluated on aggregate, not single matches
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  Use these probabilities to compare matchups, not as a guarantee of outcome
                </Typography>
              </Stack>
            </Paper>
          )}
        </>
      )}

      {/* Empty State */}
      {!bothPlayersSelected && (
        <Paper
          elevation={0}
          sx={{
            p: 6,
            textAlign: "center",
            background: "#FFFFFF",
            border: "1px dashed #E3E8EF",
            borderRadius: "12px",
            transition: "all 0.2s ease",
            "&:hover": {
              borderColor: "#B8D4F0",
              backgroundColor: "#F6F9FC",
            },
          }}
        >
          <Typography 
            variant="h5" 
            gutterBottom 
            sx={{ 
              color: "#0A2540", 
              fontWeight: 600, 
              mb: 2,
            }}
          >
            Select two players to begin
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: "#425466", 
              maxWidth: 500, 
              mx: "auto",
            }}
          >
            Choose players from the search fields above to generate predictions and view detailed analysis
          </Typography>
        </Paper>
      )}
      </Stack>
    </Box>
  );
};

export default MatchPredictionPage;
