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

const RollingServeStatsGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  const calculateRollingAvg = (matches: PlayerRecentMatch[], window: number, stat: 'serve_pct' | 'return_pct'): number[] => {
    const reversed = matches.slice().reverse();
    const results: number[] = [];
    for (let i = 0; i < reversed.length; i++) {
      const windowMatches = reversed.slice(Math.max(0, i - window + 1), i + 1);
      const validMatches = windowMatches.filter(m => m[stat] !== null && m[stat] !== undefined);
      if (validMatches.length > 0) {
        const avg = validMatches.reduce((sum, m) => sum + (m[stat] || 0), 0) / validMatches.length;
        results.push(avg * 100);
      } else {
        results.push(null as any);
      }
    }
    return results.reverse();
  };

  const p1Serve3 = calculateRollingAvg(playerOneMatches, 3, 'serve_pct');
  const p1Serve10 = calculateRollingAvg(playerOneMatches, 10, 'serve_pct');
  const p1Serve25 = calculateRollingAvg(playerOneMatches, 25, 'serve_pct');
  const p2Serve3 = calculateRollingAvg(playerTwoMatches, 3, 'serve_pct');
  const p2Serve10 = calculateRollingAvg(playerTwoMatches, 10, 'serve_pct');
  const p2Serve25 = calculateRollingAvg(playerTwoMatches, 25, 'serve_pct');

  const maxLength = Math.max(p1Serve3.length, p2Serve3.length);
  const data = Array.from({ length: maxLength }, (_, idx) => ({
    match: `M${idx + 1}`,
    [`${playerOneName} 3-Match`]: idx < p1Serve3.length ? p1Serve3[idx] : null,
    [`${playerOneName} 10-Match`]: idx < p1Serve10.length ? p1Serve10[idx] : null,
    [`${playerOneName} 25-Match`]: idx < p1Serve25.length ? p1Serve25[idx] : null,
    [`${playerTwoName} 3-Match`]: idx < p2Serve3.length ? p2Serve3[idx] : null,
    [`${playerTwoName} 10-Match`]: idx < p2Serve10.length ? p2Serve10[idx] : null,
    [`${playerTwoName} 25-Match`]: idx < p2Serve25.length ? p2Serve25[idx] : null,
  }));

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Rolling Serve Win % (3/10/25 Match Windows)
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis dataKey="match" tick={{ fill: "#c5d0d9" }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#c5d0d9" }} label={{ value: "Serve Win %", angle: -90, position: "insideLeft", fill: "#c5d0d9" }} />
            <ReferenceLine y={65} stroke="#888" strokeDasharray="2 2" />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              formatter={(value: any) => value !== null ? `${Number(value).toFixed(1)}%` : "N/A"}
            />
            <Legend />
            <Line type="monotone" dataKey={`${playerOneName} 3-Match`} stroke="#00a0b0" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey={`${playerOneName} 10-Match`} stroke="#00a0b0" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey={`${playerOneName} 25-Match`} stroke="#00a0b0" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            <Line type="monotone" dataKey={`${playerTwoName} 3-Match`} stroke="#ff6b35" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey={`${playerTwoName} 10-Match`} stroke="#ff6b35" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey={`${playerTwoName} 25-Match`} stroke="#ff6b35" strokeWidth={2} strokeDasharray="5 5" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default RollingServeStatsGraph;

