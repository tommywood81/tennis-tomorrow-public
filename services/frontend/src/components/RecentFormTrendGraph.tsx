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
  ReferenceLine,
} from "recharts";
import { PlayerRecentMatch } from "../api/types";

interface Props {
  playerOneName: string;
  playerTwoName: string;
  playerOneMatches: PlayerRecentMatch[];
  playerTwoMatches: PlayerRecentMatch[];
}

const RecentFormTrendGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  const p1Reversed = playerOneMatches.slice().reverse().slice(0, 10);
  const p2Reversed = playerTwoMatches.slice().reverse().slice(0, 10);
  const maxLength = Math.min(10, Math.max(p1Reversed.length, p2Reversed.length));
  
  const formData = Array.from({ length: maxLength }, (_, idx) => {
    const p1Slice = p1Reversed.slice(0, idx + 1);
    const p2Slice = p2Reversed.slice(0, idx + 1);
    
    const p1Wins = p1Slice.filter((m) => m.winner).length;
    const p1WinRate = (p1Wins / p1Slice.length) * 100;
    
    const p2Wins = p2Slice.filter((m) => m.winner).length;
    const p2WinRate = (p2Wins / p2Slice.length) * 100;
    
    return {
      match: `M${idx + 1}`,
      [`${playerOneName} Win Rate`]: p1WinRate,
      [`${playerTwoName} Win Rate`]: p2WinRate,
    };
  });

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Recent Form Trend (Rolling Win Rate)
        </Typography>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={formData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis dataKey="match" tick={{ fill: "#c5d0d9" }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#c5d0d9" }} label={{ value: "Win Rate %", angle: -90, position: "insideLeft", fill: "#c5d0d9" }} />
            <ReferenceLine y={50} stroke="#888" strokeDasharray="2 2" />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              formatter={(value: any) => [`${Number(value).toFixed(1)}%`, ""]}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey={`${playerOneName} Win Rate`}
              stroke="#00a0b0"
              strokeWidth={3}
              dot={{ fill: "#00a0b0", r: 5 }}
            />
            <Line
              type="monotone"
              dataKey={`${playerTwoName} Win Rate`}
              stroke="#ff6b35"
              strokeWidth={3}
              dot={{ fill: "#ff6b35", r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default RecentFormTrendGraph;

