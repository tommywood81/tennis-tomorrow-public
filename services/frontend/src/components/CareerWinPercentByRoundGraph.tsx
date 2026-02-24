import { Card, CardContent, Typography } from "@mui/material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { PlayerRecentMatch } from "../api/types";

interface Props {
  playerOneName: string;
  playerTwoName: string;
  playerOneMatches: PlayerRecentMatch[];
  playerTwoMatches: PlayerRecentMatch[];
}

const CareerWinPercentByRoundGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  // Filter for hardcourt only (model validated on hardcourt predictions)
  const hardcourtMatches = (matches: PlayerRecentMatch[]) => {
    return matches.filter((m) => m.surface === "Hard");
  };

  // Define rounds
  const rounds = ["R1", "R2", "R3", "R16", "QF", "SF", "F"];

  // Calculate win % by round
  const calculateWinPercentByRound = (matches: PlayerRecentMatch[], roundName: string) => {
    const roundMatches = matches.filter((m) => m.round === roundName);
    if (roundMatches.length === 0) return null;
    
    const wins = roundMatches.filter((m) => m.winner).length;
    return (wins / roundMatches.length) * 100;
  };

  const p1Hardcourt = hardcourtMatches(playerOneMatches);
  const p2Hardcourt = hardcourtMatches(playerTwoMatches);

  const data = rounds.map((round) => {
    const p1WinPct = calculateWinPercentByRound(p1Hardcourt, round);
    const p2WinPct = calculateWinPercentByRound(p2Hardcourt, round);

    return {
      round,
      [`${playerOneName}`]: p1WinPct,
      [`${playerTwoName}`]: p2WinPct,
    };
  });

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Career Win % by Round (Hardcourt)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Win percentage at each tournament round on hardcourt surfaces. The model was trained on all surfaces but rigorously tested on hardcourt predictions only. Clay and grass court predictions are beyond the scope of this project. Shows if players are "early-round bullies" or clutch in later rounds.
        </Typography>
        <ResponsiveContainer width="100%" height={500}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="round" />
            <YAxis 
              label={{ value: "Win Percentage (%)", angle: -90, position: "insideLeft" }}
              domain={[0, 100]}
            />
            <Tooltip
              formatter={(value: any) => {
                if (value === null || value === undefined) return "N/A";
                return `${value.toFixed(1)}%`;
              }}
            />
            <Legend />
            <Bar dataKey={playerOneName} fill="#00bcd4" />
            <Bar dataKey={playerTwoName} fill="#ff6b6b" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default CareerWinPercentByRoundGraph;

