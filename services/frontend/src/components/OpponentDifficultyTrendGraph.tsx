import { Card, CardContent, Typography } from "@mui/material";
import {
  AreaChart,
  Area,
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

const OpponentDifficultyTrendGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  const calculateDifficulty = (matches: PlayerRecentMatch[]) => {
    const reversed = matches.slice().reverse().slice(0, 25);
    return reversed.map((match, idx) => {
      const oppRank = match.opponent_rank || 1000;
      // Lower rank = stronger = higher difficulty
      const difficulty = oppRank <= 100 ? (100 - oppRank) / 100 * 100 : 0;
      const winRate = match.winner ? 100 : 0;
      return {
        match: `M${idx + 1}`,
        difficulty,
        winRate,
        opponent: match.opponent,
      };
    });
  };

  const p1Data = calculateDifficulty(playerOneMatches);
  const p2Data = calculateDifficulty(playerTwoMatches);
  
  const maxLength = Math.max(p1Data.length, p2Data.length);
  const data = Array.from({ length: maxLength }, (_, idx) => ({
    match: p1Data[idx]?.match || p2Data[idx]?.match || `M${idx + 1}`,
    [`${playerOneName} Difficulty`]: p1Data[idx]?.difficulty || null,
    [`${playerTwoName} Difficulty`]: p2Data[idx]?.difficulty || null,
    [`${playerOneName} Result`]: p1Data[idx]?.winRate || null,
    [`${playerTwoName} Result`]: p2Data[idx]?.winRate || null,
  }));

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Opponent Difficulty Trend (Higher = Stronger Opponent)
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis dataKey="match" tick={{ fill: "#c5d0d9" }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#c5d0d9" }} label={{ value: "Difficulty Score", angle: -90, position: "insideLeft", fill: "#c5d0d9" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              formatter={(value: any, name: string) => {
                if (name.includes("Result")) {
                  return [value === 100 ? "Win" : "Loss", name];
                }
                return [`${Number(value).toFixed(1)}`, name];
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey={`${playerOneName} Difficulty`}
              stackId="1"
              stroke="#00a0b0"
              fill="#00a0b0"
              fillOpacity={0.6}
            />
            <Area
              type="monotone"
              dataKey={`${playerTwoName} Difficulty`}
              stackId="2"
              stroke="#ff6b35"
              fill="#ff6b35"
              fillOpacity={0.6}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default OpponentDifficultyTrendGraph;

