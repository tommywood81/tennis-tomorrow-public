import { Card, CardContent, Stack, Typography } from "@mui/material";
import { StoryMetric } from "../api/types";

interface Props {
  totalMatches: number;
  playerOneWins: number;
  playerTwoWins: number;
  surfaceBreakdown: StoryMetric[];
  playerOneName: string;
  playerTwoName: string;
}

const H2HSummaryPanel = ({
  totalMatches,
  playerOneWins,
  playerTwoWins,
  surfaceBreakdown,
  playerOneName,
  playerTwoName,
}: Props) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1">Head-to-Head</Typography>
        <Typography variant="h4" sx={{ mt: 1 }}>
          {playerOneName} {playerOneWins} - {playerTwoWins} {playerTwoName}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {totalMatches} matches played
        </Typography>
        <Stack spacing={1} mt={2}>
          {surfaceBreakdown.map((surface) => (
            <Typography key={surface.label} variant="body2">
              {surface.label}: {surface.player_one_value ?? 0} - {surface.player_two_value ?? 0}
            </Typography>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default H2HSummaryPanel;


