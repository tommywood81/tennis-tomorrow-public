import { Card, CardContent, Typography } from "@mui/material";
import {
  LineChart,
  Line,
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

const OpponentRankTrendGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  const p1Reversed = playerOneMatches.slice().reverse().slice(0, 25);
  const p2Reversed = playerTwoMatches.slice().reverse().slice(0, 25);
  const maxLength = Math.max(p1Reversed.length, p2Reversed.length);
  
  const data = Array.from({ length: maxLength }, (_, idx) => ({
    match: `M${idx + 1}`,
    [`${playerOneName} Opponent Rank`]: p1Reversed[idx]?.opponent_rank || null,
    [`${playerTwoName} Opponent Rank`]: p2Reversed[idx]?.opponent_rank || null,
    [`${playerOneName} Result`]: p1Reversed[idx]?.winner ? "W" : (p1Reversed[idx] ? "L" : null),
    [`${playerTwoName} Result`]: p2Reversed[idx]?.winner ? "W" : (p2Reversed[idx] ? "L" : null),
  }));

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Opponent Rank Trends (Lower = Stronger)
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis dataKey="match" tick={{ fill: "#c5d0d9" }} />
            <YAxis reversed domain={[0, 200]} tick={{ fill: "#c5d0d9" }} label={{ value: "Rank", angle: -90, position: "insideLeft", fill: "#c5d0d9" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              formatter={(value: any, name: string, props: any) => {
                if (name.includes("Result")) return [value, name];
                return [value !== null ? `#${value}` : "Unranked", name];
              }}
            />
            <Legend />
            <Line type="monotone" dataKey={`${playerOneName} Opponent Rank`} stroke="#00a0b0" strokeWidth={3} dot={{ fill: "#00a0b0", r: 4 }} />
            <Line type="monotone" dataKey={`${playerTwoName} Opponent Rank`} stroke="#ff6b35" strokeWidth={3} dot={{ fill: "#ff6b35", r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default OpponentRankTrendGraph;

