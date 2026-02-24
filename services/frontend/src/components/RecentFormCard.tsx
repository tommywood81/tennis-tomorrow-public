import { Box, Card, CardContent, Chip, Stack, Typography, Paper, Divider } from "@mui/material";
import { PlayerRecentMatch } from "../api/types";

interface Props {
  title: string;
  matches: PlayerRecentMatch[];
}

const RecentFormCard = ({ title, matches }: Props) => {
  if (matches.length === 0) {
    return (
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No recent matches available
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
        },
      }}
    >
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom sx={{ mb: 2.5 }}>
          {title}
        </Typography>
        <Stack spacing={1.5}>
          {matches.map((match, idx) => (
            <Paper
              key={`${match.date}-${match.opponent}`}
              sx={{
                p: 2,
                background: match.winner 
                  ? "rgba(90, 155, 213, 0.08)" 
                  : "rgba(107, 114, 128, 0.08)",
                border: `1px solid ${match.winner ? "rgba(90, 155, 213, 0.2)" : "rgba(107, 114, 128, 0.2)"}`,
                borderRadius: 2,
                transition: "all 0.2s ease",
                "&:hover": {
                  transform: "translateX(4px)",
                  borderColor: match.winner ? "rgba(90, 155, 213, 0.4)" : "rgba(107, 114, 128, 0.4)",
                  background: match.winner 
                    ? "rgba(90, 155, 213, 0.12)" 
                    : "rgba(107, 114, 128, 0.12)",
                },
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2} flexWrap="wrap">
                <Box sx={{ flex: 1, minWidth: 200 }}>
                  <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap" mb={0.5}>
                    <Chip
                      label={match.winner ? "Win" : "Loss"}
                      size="small"
                      sx={{ 
                        fontWeight: 700, 
                        height: 24,
                        background: match.winner 
                          ? "rgba(90, 155, 213, 0.15)"
                          : "rgba(107, 114, 128, 0.15)",
                        color: match.winner ? "#5A9BD5" : "#6B7280",
                        border: `1px solid ${match.winner ? "rgba(90, 155, 213, 0.3)" : "rgba(107, 114, 128, 0.3)"}`,
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      {match.date}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                    vs {match.opponent}
                  </Typography>
                  {match.opponent_rank && (
                    <Typography variant="caption" color="text.secondary">
                      Opponent Rank: #{match.opponent_rank}
                    </Typography>
                  )}
                  {match.score && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, fontWeight: 500 }}>
                      Score: {match.score}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ textAlign: "right", minWidth: 140 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 600 }}>
                    Performance
                  </Typography>
                  <Stack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Serve:</strong> {((match.serve_pct ?? 0) * 100).toFixed(1)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Return:</strong> {((match.return_pct ?? 0) * 100).toFixed(1)}%
                    </Typography>
                  </Stack>
                </Box>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default RecentFormCard;
