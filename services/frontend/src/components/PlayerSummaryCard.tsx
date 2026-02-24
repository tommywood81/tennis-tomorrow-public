import { Box, Card, CardContent, Stack, Typography, Chip } from "@mui/material";
import { PlayerSummary } from "../api/types";

interface Props {
  title: string;
  player: PlayerSummary | null;
}

const PlayerSummaryCard = ({ title, player }: Props) => {
  if (!player) {
    return (
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Select a player to view details.
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
        <Box sx={{ position: "relative" }}>
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "4px",
              height: "100%",
              background: "#000000",
              borderRadius: "2px",
            }}
          />
          <Box sx={{ flex: 1, pl: 2.5 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
              {title}
            </Typography>
            <Typography variant="h5" fontWeight={700} gutterBottom sx={{ mb: 1.5 }}>
              {player.name}
            </Typography>
            <Stack spacing={1}>
              {player.last_rank && (
                <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                  <Chip
                    label={`Rank #${player.last_rank}`}
                    size="small"
                    color="primary"
                    sx={{ fontWeight: 600, height: 24 }}
                  />
                  {player.last_rank_date && (
                    <Typography variant="caption" color="text.secondary">
                      as of {new Date(player.last_rank_date).toLocaleDateString()}
                    </Typography>
                  )}
                </Stack>
              )}
              <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mt: 0.5 }}>
                {player.country && (
                  <Typography variant="body2" color="text.secondary">
                    <strong>Country:</strong> {player.country}
                  </Typography>
                )}
                {player.handedness && (
                  <Typography variant="body2" color="text.secondary">
                    <strong>Hand:</strong> {player.handedness}
                  </Typography>
                )}
                {player.height_cm && (
                  <Typography variant="body2" color="text.secondary">
                    <strong>Height:</strong> {player.height_cm} cm
                  </Typography>
                )}
              </Stack>
            </Stack>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default PlayerSummaryCard;
