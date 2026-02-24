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

const MomentumTrendGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  const calculateMomentum = (matches: PlayerRecentMatch[]): Array<{ momentum: number; match: string }> => {
    const reversed = matches.slice().reverse().slice(0, 15);
    const results: Array<{ momentum: number; match: string }> = [];
    
    for (let i = 0; i < reversed.length; i++) {
      const last3 = reversed.slice(Math.max(0, i - 2), i + 1);
      const wins = last3.filter(m => m.winner).length;
      const avgServe = last3.reduce((sum, m) => sum + (m.serve_pct || 0), 0) / last3.length;
      const avgReturn = last3.reduce((sum, m) => sum + (m.return_pct || 0), 0) / last3.length;
      
      // Momentum = win rate + performance trend
      const winComponent = (wins / last3.length) * 50;
      const perfComponent = ((avgServe + avgReturn) / 2) * 50;
      const momentum = winComponent + perfComponent;
      
      results.push({ momentum, match: `M${i + 1}` });
    }
    return results.reverse();
  };

  const p1Momentum = calculateMomentum(playerOneMatches);
  const p2Momentum = calculateMomentum(playerTwoMatches);
  
  const maxLength = Math.max(p1Momentum.length, p2Momentum.length);
  const data = Array.from({ length: maxLength }, (_, idx) => ({
    match: p1Momentum[idx]?.match || p2Momentum[idx]?.match || `M${idx + 1}`,
    [`${playerOneName} Momentum`]: p1Momentum[idx]?.momentum || null,
    [`${playerTwoName} Momentum`]: p2Momentum[idx]?.momentum || null,
  }));

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Momentum Index (Last 3 Matches: Win Rate + Performance)
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis dataKey="match" tick={{ fill: "#c5d0d9" }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#c5d0d9" }} label={{ value: "Momentum", angle: -90, position: "insideLeft", fill: "#c5d0d9" }} />
            <ReferenceLine y={50} stroke="#888" strokeDasharray="2 2" />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              formatter={(value: any) => value !== null ? `${Number(value).toFixed(1)}` : "N/A"}
            />
            <Legend />
            <Line type="monotone" dataKey={`${playerOneName} Momentum`} stroke="#00a0b0" strokeWidth={3} dot={{ fill: "#00a0b0", r: 4 }} />
            <Line type="monotone" dataKey={`${playerTwoName} Momentum`} stroke="#ff6b35" strokeWidth={3} dot={{ fill: "#ff6b35", r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default MomentumTrendGraph;

