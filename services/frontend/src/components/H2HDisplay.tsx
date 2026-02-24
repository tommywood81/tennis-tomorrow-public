import { Card, CardContent, Typography, Box, Chip, Stack, Divider, Paper } from "@mui/material";
import { H2HResponse } from "../api/types";
import { CircularProgress } from "@mui/material";

interface Props {
  h2h: H2HResponse | null | undefined;
  playerOneName: string;
  playerTwoName: string;
  isLoading?: boolean;
}

const H2HDisplay = ({ h2h, playerOneName, playerTwoName, isLoading }: Props) => {
  if (isLoading) {
    return (
      <Card
        sx={{
          background: "#FFFFFF",
          border: "1px solid rgba(0, 0, 0, 0.1)",
        }}
      >
        <CardContent sx={{ p: 3, textAlign: "center" }}>
          <CircularProgress size={24} sx={{ mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            Loading head-to-head data...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (!h2h || h2h.total_matches === 0) {
    return (
      <Card
        sx={{
          background: "#FFFFFF",
          border: "1px solid rgba(0, 0, 0, 0.1)",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box mb={2}>
            <Typography variant="h6" fontWeight={700}>
              Head-to-Head
            </Typography>
          </Box>
          <Paper
            sx={{
              p: 2,
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px dashed rgba(255, 255, 255, 0.1)",
              textAlign: "center",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              No previous matches found (since 2018)
            </Typography>
          </Paper>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2, textAlign: "center", fontStyle: "italic" }}>
            Showing match-ups since 2018
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const playerOneWinPct = h2h.total_matches > 0 
    ? ((h2h.player_one_wins / h2h.total_matches) * 100).toFixed(1)
    : "0.0";
  const playerTwoWinPct = h2h.total_matches > 0
    ? ((h2h.player_two_wins / h2h.total_matches) * 100).toFixed(1)
    : "0.0";

  return (
    <Card>
      <CardContent sx={{ p: 5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={2}>
          <Typography variant="h6" fontWeight={700}>
            Head-to-Head
          </Typography>
          <Chip
            label={`${h2h.total_matches} Matches`}
            size="small"
            color="primary"
            sx={{ fontWeight: 600 }}
          />
        </Stack>

        <Stack spacing={3}>
          {/* Overall Record */}
          <Paper
            sx={{
              p: 3,
              background: "rgba(0, 0, 0, 0.05)",
              border: "1px solid rgba(0, 0, 0, 0.1)",
              borderRadius: 2,
            }}
          >
            <Stack direction="row" spacing={3} alignItems="center" justifyContent="space-between" flexWrap="wrap">
              <Box sx={{ flex: 1, minWidth: 140, textAlign: "center" }}>
                <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: "block", fontWeight: 600, mb: 1 }}>
                  {playerOneName}
                </Typography>
                <Typography variant="h3" fontWeight={800} color="primary.main">
                  {h2h.player_one_wins}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                  {playerOneWinPct}%
                </Typography>
              </Box>
              <Typography variant="h5" color="text.secondary" sx={{ fontWeight: 700, px: 2 }}>
                vs
              </Typography>
              <Box sx={{ flex: 1, minWidth: 140, textAlign: "center" }}>
                <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: "block", fontWeight: 600, mb: 1 }}>
                  {playerTwoName}
                </Typography>
                <Typography variant="h3" fontWeight={800} color="primary.main">
                  {h2h.player_two_wins}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                  {playerTwoWinPct}%
                </Typography>
              </Box>
            </Stack>
          </Paper>

          {/* All Previous Matches */}
          {h2h.recent_meetings && h2h.recent_meetings.length > 0 && (
            <>
              <Divider />
              <Box sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <Typography variant="subtitle2" fontWeight={700} color="text.secondary" gutterBottom sx={{ mb: 2 }}>
                  All Previous Matches
                </Typography>
                <Stack spacing={1.5} sx={{ minWidth: "fit-content" }}>
                  {h2h.recent_meetings.map((meeting, idx) => (
                    <Paper
                      key={idx}
                      sx={{
                        p: 2,
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: 2,
                        transition: "all 0.2s ease",
                        "&:hover": {
                          background: "rgba(255, 255, 255, 0.05)",
                          borderColor: "rgba(0, 0, 0, 0.2)",
                        },
                        minWidth: "fit-content",
                      }}
                    >
                      <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 2, minWidth: { xs: "500px", sm: "auto" } }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          {new Date(meeting.date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </Typography>
                        <Box sx={{ display: "flex", justifyContent: "center" }}>
                          {meeting.score ? (
                            <Chip
                              label={meeting.score}
                              size="medium"
                              color={meeting.winner === playerOneName ? "primary" : "secondary"}
                              sx={{ 
                                height: 28, 
                                fontSize: "0.75rem", 
                                fontWeight: 700,
                                px: 1,
                              }}
                            />
                          ) : (
                            <Chip
                              label={meeting.winner === playerOneName ? playerOneName : playerTwoName}
                              size="medium"
                              color={meeting.winner === playerOneName ? "primary" : "secondary"}
                              sx={{ height: 28, fontSize: "0.75rem", fontWeight: 600 }}
                            />
                          )}
                        </Box>
                        <Stack direction="row" gap={1.5} alignItems="center" justifyContent="flex-end" flexWrap="wrap">
                          {meeting.surface && (
                            <Chip
                              label={meeting.surface}
                              size="small"
                              sx={{
                                height: 24,
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                background: meeting.surface === "Hard" 
                                  ? "rgba(90, 155, 213, 0.15)" 
                                  : meeting.surface === "Clay"
                                  ? "rgba(139, 69, 19, 0.15)"
                                  : "rgba(34, 139, 34, 0.15)",
                                color: meeting.surface === "Hard"
                                  ? "#5A9BD5"
                                  : meeting.surface === "Clay"
                                  ? "#8B4513"
                                  : "#228B22",
                                border: `1px solid ${
                                  meeting.surface === "Hard"
                                    ? "rgba(90, 155, 213, 0.3)"
                                    : meeting.surface === "Clay"
                                    ? "rgba(139, 69, 19, 0.3)"
                                    : "rgba(34, 139, 34, 0.3)"
                                }`,
                              }}
                            />
                          )}
                          {meeting.round && (
                            <Chip
                              label={meeting.round}
                              size="small"
                              sx={{
                                height: 24,
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                background: "rgba(0, 0, 0, 0.08)",
                                color: "primary.main",
                              }}
                            />
                          )}
                          {meeting.tournament && (
                            <Typography variant="caption" color="text.secondary" sx={{ textAlign: "right", fontWeight: 500 }}>
                              {meeting.tournament}
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            </>
          )}
        </Stack>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 3, textAlign: "center", fontStyle: "italic" }}>
          Showing match-ups since 2018
        </Typography>
      </CardContent>
    </Card>
  );
};

export default H2HDisplay;
