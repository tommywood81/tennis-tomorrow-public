import {
  Box,
  Typography,
  Paper,
  Popover,
  Divider,
  Stack,
  Chip,
} from "@mui/material";
import { TournamentMatch } from "../api/types";

interface MatchDetailsProps {
  match: TournamentMatch;
  round: string;
  isCorrect: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

const MatchDetails = ({
  match,
  round,
  isCorrect,
  anchorEl,
  onClose,
}: MatchDetailsProps) => {
  const open = Boolean(anchorEl);
  const predictedWinner =
    match.predicted_probability_player_one >
    match.predicted_probability_player_two
      ? match.player_one
      : match.player_two;
  const actualWinner =
    match.actual_winner === "player_one"
      ? match.player_one
      : match.player_two;

  const topFeatures = match.top_features?.slice(0, 3) || [];

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "center",
      }}
      transformOrigin={{
        vertical: "top",
        horizontal: "center",
      }}
      PaperProps={{
        sx: {
          mt: 1,
          maxWidth: 400,
          p: 3,
        },
      }}
    >
      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            Match Details
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {round} · {match.surface}
          </Typography>
        </Box>

        <Divider />

        <Box>
          <Typography variant="caption" fontWeight={600} color="text.secondary">
            Players
          </Typography>
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              {match.player_one.name}
            </Typography>
            <Typography variant="body2">vs</Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {match.player_two.name}
            </Typography>
          </Box>
        </Box>

        <Divider />

        <Box>
          <Typography variant="caption" fontWeight={600} color="text.secondary" gutterBottom>
            Model Prediction
          </Typography>
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Predicted Winner: <strong>{predictedWinner.name}</strong>
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              {match.player_one.name}:{" "}
              {(match.predicted_probability_player_one * 100).toFixed(1)}%
            </Typography>
            <Typography variant="body2">
              {match.player_two.name}:{" "}
              {(match.predicted_probability_player_two * 100).toFixed(1)}%
            </Typography>
          </Box>
        </Box>

        <Divider />

        <Box>
          <Typography variant="caption" fontWeight={600} color="text.secondary" gutterBottom>
            Actual Outcome
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Winner: <strong>{actualWinner.name}</strong>
          </Typography>
          <Chip
            label={isCorrect ? "Correct Prediction" : "Incorrect Prediction"}
            size="small"
            sx={{
              mt: 1,
              backgroundColor: isCorrect
                ? "rgba(16, 185, 129, 0.15)"
                : "rgba(239, 68, 68, 0.15)",
              color: isCorrect
                ? "rgba(16, 185, 129, 0.9)"
                : "rgba(239, 68, 68, 0.9)",
              border: `1px solid ${
                isCorrect
                  ? "rgba(16, 185, 129, 0.4)"
                  : "rgba(239, 68, 68, 0.4)"
              }`,
              fontWeight: 600,
              fontSize: "0.75rem",
            }}
          />
        </Box>

        {topFeatures.length > 0 && (
          <>
            <Divider />
            <Box>
              <Typography
                variant="caption"
                fontWeight={600}
                color="text.secondary"
                gutterBottom
              >
                Top Contributing Features
              </Typography>
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                {topFeatures.map((feature, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography variant="body2" sx={{ fontSize: "0.8125rem" }}>
                      {feature.display_name || feature.feature}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        fontWeight: 600,
                      }}
                    >
                      {feature.importance.toFixed(3)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </>
        )}
      </Stack>
    </Popover>
  );
};

export default MatchDetails;

