import {
  Button,
  Card,
  CardContent,
  Chip,
  Link,
  Stack,
  Typography,
  Box,
  TextField,
  Grid,
  CircularProgress,
  Select,
  MenuItem,
} from "@mui/material";
import { useState, useEffect, useRef } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import PlayerAutocomplete from "../components/PlayerAutocomplete";
import { fetchAdvancedPrediction, parseMatchHistoryForDisplay } from "../api/hooks";
import { PlayerSummary, AdvancedPredictionResponse, DisplayParsingResponse } from "../api/types";
import ParsedMatchHistoryTable from "../components/ParsedMatchHistoryTable";

const AdvancedInferencePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [playerOne, setPlayerOne] = useState<PlayerSummary | null>(null);
  const [playerTwo, setPlayerTwo] = useState<PlayerSummary | null>(null);
  const [playerOneMatchHistory, setPlayerOneMatchHistory] = useState("");
  const [playerTwoMatchHistory, setPlayerTwoMatchHistory] = useState("");
  const [tournamentLevel, setTournamentLevel] = useState("ATP1000");
  const [round, setRound] = useState("QF");
  const [surface, setSurface] = useState("Hard");
  const [advancedPrediction, setAdvancedPrediction] = useState<AdvancedPredictionResponse | null>(null);

  const handleReset = () => {
    setPlayerOne(null);
    setPlayerTwo(null);
    setPlayerOneMatchHistory("");
    setPlayerTwoMatchHistory("");
    setTournamentLevel("ATP1000");
    setRound("QF");
    setSurface("Hard");
    setAdvancedPrediction(null);
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
    if (location.pathname === "/advanced-inference" && location.state?.reset) {
      handleReset();
      navigate(".", { replace: true, state: {} });
    }
  }, [location.pathname, location.state]);
  
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

  const advancedMutation = useMutation({
    mutationFn: fetchAdvancedPrediction,
    onSuccess: (data) => setAdvancedPrediction(data),
    onError: (error: any) => {
      console.error("Advanced prediction error:", error);
      alert(`Prediction failed: ${error.response?.data?.detail || error.message || "Unknown error"}`);
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

  const MIN_MATCH_HISTORY_LENGTH = 30;
  const bothPlayersSelected = playerOne && playerTwo;

  const p1Len = playerOneMatchHistory.trim().length;
  const p2Len = playerTwoMatchHistory.trim().length;
  const matchHistoryInvalid = !!(bothPlayersSelected && (p1Len < MIN_MATCH_HISTORY_LENGTH || p2Len < MIN_MATCH_HISTORY_LENGTH));

  const handleAdvancedPredict = () => {
    if (!playerOne || !playerTwo) return;
    const p1 = playerOneMatchHistory.trim();
    const p2 = playerTwoMatchHistory.trim();
    if (!p1 || !p2 || p1.length < MIN_MATCH_HISTORY_LENGTH || p2.length < MIN_MATCH_HISTORY_LENGTH) return;

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

  return (
    <Box sx={{ maxWidth: { xs: "100%", sm: "1000px", md: "1200px" }, mx: "auto", px: { xs: 1.5, sm: 2.5, md: 3 }, py: { xs: 2, sm: 3, md: 4 }, pt: { xs: 12, sm: 14, md: 16 }, width: "100%", boxSizing: "border-box" }}>
      <Stack spacing={{ xs: 3, sm: 4, md: 4 }}>
        {/* Header */}
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom sx={{ color: "#0A2540", fontSize: { xs: "1.5rem", sm: "1.75rem", md: "2rem" } }}>
            Current Prediction
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 2, fontWeight: 600, fontSize: { xs: "0.9375rem", sm: "1rem", md: "1.125rem" } }}>
            End to End ML ATP Tour prediction calibrated to odds
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            This prediction page uses the same calibrated model with each player&apos;s 10 most recent matches, letting you see how form and win chances shift as new results come in.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The inference pipeline is the same one the As At prediction uses; the only difference is recent match data is used instead of the match data up to the As At point in time.
          </Typography>
        </Box>

        {/* Player Selection */}
        <Card elevation={0} sx={{ border: "4px solid #0066CC", borderRadius: 2, backgroundColor: "#FFFFFF" }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: "#0066CC", mb: 2, fontSize: "1.125rem" }}>
              Player Selection
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4, fontSize: "0.875rem", lineHeight: 1.6 }}>
              Select two players, then paste each player&apos;s match history below.
            </Typography>
            
            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom fontWeight={600} sx={{ color: "#0A2540", mb: 1.5 }}>
                  Player One
                </Typography>
                <Box sx={{ width: "100%", "& .MuiOutlinedInput-root": { backgroundColor: "#FFFFFF" }, "& .MuiInputLabel-root": { color: "#0066CC !important" }, "& .MuiInputBase-input": { color: "#0A2540" } }}>
                  <PlayerAutocomplete
                    label="Type Player Name..."
                    value={playerOne}
                    onChange={setPlayerOne}
                  />
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom fontWeight={600} sx={{ color: "#0A2540", mb: 1.5 }}>
                  Player Two
                </Typography>
                <Box sx={{ width: "100%", "& .MuiOutlinedInput-root": { backgroundColor: "#FFFFFF" }, "& .MuiInputLabel-root": { color: "#0066CC !important" }, "& .MuiInputBase-input": { color: "#0A2540" } }}>
                  <PlayerAutocomplete
                    label="Type Player Name..."
                    value={playerTwo}
                    onChange={setPlayerTwo}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" gutterBottom fontWeight={600} sx={{ color: "#0A2540", mb: 1.5 }}>
                  Tournament Level
                </Typography>
                <Select
                  fullWidth
                  value={tournamentLevel}
                  onChange={(e) => setTournamentLevel(e.target.value)}
                  displayEmpty
                  size="small"
                  sx={{ backgroundColor: "#FFFFFF", "& .MuiSelect-select": { color: "#0A2540" } }}
                >
                  <MenuItem value="ATP250">ATP 250</MenuItem>
                  <MenuItem value="ATP500">ATP 500</MenuItem>
                  <MenuItem value="ATP1000">ATP 1000</MenuItem>
                </Select>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" gutterBottom fontWeight={600} sx={{ color: "#0A2540", mb: 1.5 }}>
                  Round
                </Typography>
                <Select
                  fullWidth
                  value={round}
                  onChange={(e) => setRound(e.target.value)}
                  displayEmpty
                  size="small"
                  sx={{ backgroundColor: "#FFFFFF", "& .MuiSelect-select": { color: "#0A2540" } }}
                >
                  {["R32", "R16", "QF", "SF", "F"].map((r) => (
                    <MenuItem key={r} value={r}>
                      {r}
                    </MenuItem>
                  ))}
                </Select>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" gutterBottom fontWeight={600} sx={{ color: "#0A2540", mb: 1.5 }}>
                  Surface
                </Typography>
                <Select
                  fullWidth
                  value={surface}
                  onChange={(e) => setSurface(e.target.value)}
                  displayEmpty
                  size="small"
                  sx={{ backgroundColor: "#FFFFFF", "& .MuiSelect-select": { color: "#0A2540" } }}
                >
                  <MenuItem value="Hard">Hard</MenuItem>
                  <MenuItem value="Clay">Clay</MenuItem>
                  <MenuItem value="Grass">Grass</MenuItem>
                </Select>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Match History Input */}
        {bothPlayersSelected && (
          <Card elevation={0} sx={{ border: "4px solid #0066CC", borderRadius: 2, backgroundColor: "#FFFFFF", overflow: "hidden" }}>
            <CardContent sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: "0.875rem", lineHeight: 1.6 }}>
                Paste recent match history for each player below.
                Public sources such as{" "}
                <Link href="https://www.tennisabstract.com" target="_blank" rel="noopener noreferrer" sx={{ color: "#5A9BD5", fontWeight: 600, "&:hover": { color: "#0066CC" } }}>
                  tennisabstract.com
                </Link>{" "}
                can be used for convenience.
              </Typography>
              
              <Grid container spacing={4}>
                {/* Player 1: one box - paste area becomes parsed table in same space */}
                <Grid item xs={12} md={6}>
                  <Box sx={{ border: "1px solid #E3E8EF", borderRadius: 2, p: 2, backgroundColor: "#FAFAFA", minHeight: 140, display: "flex", flexDirection: "column", overflow: "visible" }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {playerOne.name} - Tennis Abstract Match History
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                      Paste recent match history from Tennis Abstract (10+ completed matches)
                    </Typography>
                    {playerOneLoading && <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={28} /></Box>}
                    {!playerOneDisplayData && !playerOneLoading && (
                      <>
                        <TextField multiline rows={8} fullWidth placeholder="Paste match history here..." value={playerOneMatchHistory} onChange={(e) => setPlayerOneMatchHistory(e.target.value)} onPaste={() => { setPlayerOneLoading(true); setPlayerOneParseError(false); }} sx={{ fontFamily: "monospace", fontSize: "0.875rem", flex: 1, "& .MuiOutlinedInput-root": { backgroundColor: "#FFFFFF" } }} />
                        {playerOneParseError && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block", fontSize: "0.8125rem" }}>
                            We couldn&apos;t format this match history for display, but it can still be used for the prediction.
                          </Typography>
                        )}
                      </>
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
                {/* Player 2: one box - paste area becomes parsed table in same space */}
                <Grid item xs={12} md={6}>
                  <Box sx={{ border: "1px solid #E3E8EF", borderRadius: 2, p: 2, backgroundColor: "#FAFAFA", minHeight: 140, display: "flex", flexDirection: "column", overflow: "visible" }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {playerTwo.name} - Tennis Abstract Match History
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                      Paste recent match history from Tennis Abstract (10+ completed matches)
                    </Typography>
                    {playerTwoLoading && <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={28} /></Box>}
                    {!playerTwoDisplayData && !playerTwoLoading && (
                      <>
                        <TextField multiline rows={8} fullWidth placeholder="Paste match history here..." value={playerTwoMatchHistory} onChange={(e) => setPlayerTwoMatchHistory(e.target.value)} onPaste={() => { setPlayerTwoLoading(true); setPlayerTwoParseError(false); }} sx={{ fontFamily: "monospace", fontSize: "0.875rem", flex: 1, "& .MuiOutlinedInput-root": { backgroundColor: "#FFFFFF" } }} />
                        {playerTwoParseError && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block", fontSize: "0.8125rem" }}>
                            We couldn&apos;t format this match history for display, but it can still be used for the prediction.
                          </Typography>
                        )}
                      </>
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
              <Typography variant="body2" color="text.secondary" sx={{ mt: 4, fontSize: "0.8125rem", lineHeight: 1.6 }}>
                The pasted matches update the model&apos;s view of each player&apos;s recent form.
                This allows the prediction to reflect what has happened since the original As At date.
              </Typography>

              {/* Predict Button */}
              <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap", mt: 4 }}>
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
                  disabled={!bothPlayersSelected || advancedMutation.isPending || matchHistoryInvalid}
                  sx={{
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
                  }}
                >
                  {advancedMutation.isPending ? "Running Prediction..." : "Run Prediction (Current)"}
                </Button>
              </Box>
              {matchHistoryInvalid ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2, fontSize: "0.8125rem" }}>
                  Please paste at least a few lines of match history for each player.
                </Typography>
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2, fontSize: "0.75rem" }}>
                  This will generate a new prediction using the added match history.
                </Typography>
              )}
            </CardContent>
          </Card>
        )}

        {/* Results - PRIMARY OUTPUT - Appears at top */}
        {advancedPrediction && !advancedMutation.isPending && (
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
                        Uses frozen model features as at this date (no user-entered match history).
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

                {/* Current (user-entered) */}
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
                        ? `User-entered features increase ${playerOne?.name || "Player One"}'s win probability`
                        : advancedPrediction.probability_delta < 0
                        ? `User-entered features decrease ${playerOne?.name || "Player One"}'s win probability`
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
              component={RouterLink}
              to="/"
              state={{ reset: true }}
              sx={{ color: "#5A9BD5", fontWeight: 600, textDecoration: "none", fontSize: "1rem", "&:hover": { textDecoration: "underline" } }}
            >
              ← View the original As At prediction
            </Link>
          </Box>
          </Box>
        )}
      </Stack>
    </Box>
  );
};

export default AdvancedInferencePage;
