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

const CombinedServeReturnTrendGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  const p1Reversed = playerOneMatches.slice().reverse().slice(0, 25);
  const p2Reversed = playerTwoMatches.slice().reverse().slice(0, 25);
  const maxLength = Math.max(p1Reversed.length, p2Reversed.length);
  
  const data = Array.from({ length: maxLength }, (_, idx) => {
    const p1Match = p1Reversed[idx];
    const p2Match = p2Reversed[idx];
    
    const p1Combined = (p1Match?.serve_pct && p1Match?.return_pct) 
      ? ((p1Match.serve_pct + p1Match.return_pct) / 2) * 100 
      : null;
    const p2Combined = (p2Match?.serve_pct && p2Match?.return_pct)
      ? ((p2Match.serve_pct + p2Match.return_pct) / 2) * 100
      : null;
    
    return {
      match: `M${idx + 1}`,
      [`${playerOneName} Combined`]: p1Combined,
      [`${playerTwoName} Combined`]: p2Combined,
    };
  });

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Combined Serve+Return Win % Trend
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis dataKey="match" tick={{ fill: "#c5d0d9" }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#c5d0d9" }} label={{ value: "Combined %", angle: -90, position: "insideLeft", fill: "#c5d0d9" }} />
            <ReferenceLine y={50} stroke="#888" strokeDasharray="2 2" />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              formatter={(value: any) => value !== null ? `${Number(value).toFixed(1)}%` : "N/A"}
            />
            <Legend />
            <Line type="monotone" dataKey={`${playerOneName} Combined`} stroke="#00a0b0" strokeWidth={3} dot={{ fill: "#00a0b0", r: 3 }} />
            <Line type="monotone" dataKey={`${playerTwoName} Combined`} stroke="#ff6b35" strokeWidth={3} dot={{ fill: "#ff6b35", r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default CombinedServeReturnTrendGraph;

