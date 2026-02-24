import { Card, CardContent, LinearProgress, Stack, Typography } from "@mui/material";
import { StoryMetric } from "../api/types";

interface Props {
  metrics: StoryMetric[];
  playerOneName: string;
  playerTwoName: string;
}

const StoryMatchupCharts = ({ metrics, playerOneName, playerTwoName }: Props) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          Story of the Matchup
        </Typography>
        <Stack spacing={2}>
          {metrics.map((metric) => (
            <Stack key={metric.label} spacing={1}>
              <Typography variant="body2" color="text.secondary">
                {metric.label}
              </Typography>
              {["win %"].includes(metric.unit ?? "") ? (
                <>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" minWidth={80}>
                      {playerOneName}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={(metric.player_one_value ?? 0) * 100}
                      sx={{ flex: 1, height: 8, borderRadius: 4, "& .MuiLinearProgress-bar": { backgroundColor: "#0066CC" } }}
                    />
                    <Typography variant="caption">{((metric.player_one_value ?? 0) * 100).toFixed(1)}%</Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" minWidth={80}>
                      {playerTwoName}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={(metric.player_two_value ?? 0) * 100}
                      sx={{ flex: 1, height: 8, borderRadius: 4, "& .MuiLinearProgress-bar": { backgroundColor: "#3385E6" } }}
                    />
                    <Typography variant="caption">{((metric.player_two_value ?? 0) * 100).toFixed(1)}%</Typography>
                  </Stack>
                </>
              ) : (
                <Stack direction="row" spacing={2}>
                  <Typography variant="body2">
                    {playerOneName}: <strong>{(metric.player_one_value ?? 0).toFixed(2)}</strong>
                  </Typography>
                  <Typography variant="body2">
                    {playerTwoName}: <strong>{(metric.player_two_value ?? 0).toFixed(2)}</strong>
                  </Typography>
                </Stack>
              )}
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default StoryMatchupCharts;
