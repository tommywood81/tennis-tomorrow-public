import { Box, Typography, Stack, Card, CardContent, Paper, Button, CircularProgress, Tabs, Tab, Grid } from "@mui/material";
import { Link as RouterLink, useParams } from "react-router-dom";
import GroupedTournamentList from "../components/GroupedTournamentList";
import TournamentDraw from "../components/TournamentDraw";
import { useTournaments, useTournament } from "../api/hooks";
import { useState } from "react";

const TournamentEvaluationPage = () => {
  const { tournamentId } = useParams<{ tournamentId?: string }>();
  const [selectedYear, setSelectedYear] = useState<"2024" | "2025">("2025");
  const yearNum = parseInt(selectedYear);
  const { data: tournaments, isLoading: isLoadingTournaments, isError: tournamentsError } = useTournaments(yearNum);
  const { data: tournament, isLoading: isLoadingTournament } = useTournament(tournamentId || null, yearNum);

  // Hardcoded metrics from run_pro_level_final_training (train 1990–2022, 2023 holdout, test 2024–2025)
  const METRICS_2024 = { accuracy: 0.6978, auc: 0.7791, brier: 0.1947, logLoss: 0.5735 };
  const METRICS_2025 = { accuracy: 0.7076, auc: 0.7696, brier: 0.1979, logLoss: 0.5795 };
  const metrics = selectedYear === "2024" ? METRICS_2024 : METRICS_2025;

  // If tournamentId is provided, show the draw for that tournament
  if (tournamentId) {
    if (isLoadingTournament) {
      return (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px", px: { xs: 2, sm: 3, md: 4 }, py: 4 }}>
          <CircularProgress />
          <Typography variant="body2" sx={{ ml: 2 }}>Loading tournament...</Typography>
        </Box>
      );
    }
    
    if (!tournament) {
      return (
        <Stack spacing={4} sx={{ px: { xs: 2, sm: 3, md: 4 }, py: 4, pt: { xs: 12, sm: 14, md: 16 } }}>
          <Box>
            <Typography variant="h4" fontWeight={700} gutterBottom sx={{ fontSize: { xs: "1.5rem", sm: "1.75rem", md: "2rem", lg: "2.25rem" } }}>
              Tournament Not Found
            </Typography>
            <Button component={RouterLink} to="/tournament-evaluation" sx={{ mt: 2 }}>
              ← Back to Tournament List
            </Button>
          </Box>
        </Stack>
      );
    }

    return (
      <Stack spacing={4} sx={{ px: { xs: 2, sm: 3, md: 4 }, py: 4, pt: { xs: 12, sm: 14, md: 16 } }}>
        <Box>
          <Button
            component={RouterLink}
            to="/tournament-evaluation"
            sx={{ mb: 2 }}
          >
            ← Back to Tournament List
          </Button>
          <Typography variant="h4" fontWeight={700} gutterBottom sx={{ fontSize: { xs: "1.5rem", sm: "1.75rem", md: "2rem", lg: "2.25rem" } }}>
            {tournament.tournament_name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {new Date(tournament.start_date).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
            })}{" "}
            -{" "}
            {new Date(tournament.end_date).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            {" · "}
            {tournament.surface}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: "italic" }}>
            Click a match to see details
          </Typography>
        </Box>

        <Card>
          <CardContent sx={{ 
            p: 0, 
            height: { xs: "70vh", sm: "75vh", md: "calc(100vh - 200px)" }, 
            minHeight: { xs: "500px", sm: "600px" },
            overflow: "auto",
            overflowX: "auto",
            overflowY: "auto",
          }}>
            <TournamentDraw tournament={tournament} />
          </CardContent>
        </Card>
      </Stack>
    );
  }

  return (
    <Stack spacing={{ xs: 3, sm: 3.5, md: 4 }} sx={{ px: { xs: 1.5, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2, sm: 3, md: 4 }, pt: { xs: 12, sm: 14, md: 16 } }}>
      {/* Page Title & Framing */}
      <Box>
        <Typography variant="h4" fontWeight={700} gutterBottom sx={{ fontSize: { xs: "1.5rem", sm: "1.75rem", md: "2rem", lg: "2.25rem" } }}>
          Tournament Evaluation (Retrospective)
        </Typography>
        
        {/* Stats Card with Tabs */}
        <Card sx={{ mt: 3, mb: 3 }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Tabs
                value={selectedYear === "2024" ? 0 : 1}
                onChange={(_, newValue) => setSelectedYear(newValue === 0 ? "2024" : "2025")}
                sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
              >
                <Tab label="2024 Test Set" />
                <Tab label="2025 Test Set" />
              </Tabs>
              
              <Paper
                sx={{
                  p: 2.5,
                  mb: 3,
                  backgroundColor: "rgba(90, 155, 213, 0.05)",
                  border: "1px solid rgba(90, 155, 213, 0.2)",
                }}
              >
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  These tournament predictions were generated using only data available before the season began.
                  This allows the model's out-of-sample generalisation to be evaluated; rapid player improvements after that point may appear more conservative here.
                </Typography>
              </Paper>
              
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Match-Level Accuracy
                  </Typography>
                  <Typography variant="h5" fontWeight={700} sx={{ color: "#0A2540", fontSize: { xs: "1.25rem", sm: "1.375rem", md: "1.5rem", lg: "1.625rem" } }}>
                    {(metrics.accuracy * 100).toFixed(2)}%
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    AUC-ROC
                  </Typography>
                  <Typography variant="h5" fontWeight={700} sx={{ color: "#0A2540", fontSize: { xs: "1.25rem", sm: "1.375rem", md: "1.5rem", lg: "1.625rem" } }}>
                    {metrics.auc.toFixed(3)}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Brier Score
                  </Typography>
                  <Typography variant="h5" fontWeight={700} sx={{ color: "#0A2540", fontSize: { xs: "1.25rem", sm: "1.375rem", md: "1.5rem", lg: "1.625rem" } }}>
                    {metrics.brier.toFixed(3)}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Log Loss
                  </Typography>
                  <Typography variant="h5" fontWeight={700} sx={{ color: "#0A2540", fontSize: { xs: "1.25rem", sm: "1.375rem", md: "1.5rem", lg: "1.625rem" } }}>
                    {metrics.logLoss.toFixed(3)}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
              
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, lineHeight: 1.7 }}>
              Same frozen model for both years: train 1990–2022, 2023 holdout (calibration), test 2024–2025.
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Tournament List */}
      <Box>
        <Typography variant="h6" fontWeight={700} gutterBottom sx={{ mb: 3 }}>
          Tournaments
        </Typography>
        {isLoadingTournaments ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2 }}>Loading tournaments...</Typography>
          </Box>
        ) : tournamentsError && selectedYear === "2024" ? (
          <Paper sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              2024 tournament cache not found. Both 2024 and 2025 caches are created by the same pipeline.
            </Typography>
            <Typography variant="caption" component="pre" sx={{ display: "block", textAlign: "left", bgcolor: "#f5f5f5", p: 2, borderRadius: 1, overflow: "auto" }}>
              python scripts/run_pro_level_final_training.py
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
              This writes tournament_predictions_pro_level_2024_*.json and tournament_predictions_pro_level_2025_*.json to experiments/results/
            </Typography>
          </Paper>
        ) : tournaments && tournaments.length > 0 ? (
          <GroupedTournamentList tournaments={tournaments} />
        ) : (
          <Paper sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              No tournaments found for {selectedYear}.
            </Typography>
          </Paper>
        )}
      </Box>
    </Stack>
  );
};

export default TournamentEvaluationPage;

