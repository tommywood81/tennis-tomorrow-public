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
  surface: string;
}

const SurfaceSpecificFormGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
  surface,
}: Props) => {
  const filterBySurface = (matches: PlayerRecentMatch[]) => {
    return matches.filter(m => m.surface === surface).slice().reverse().slice(0, 15);
  };

  const p1SurfaceMatches = filterBySurface(playerOneMatches);
  const p2SurfaceMatches = filterBySurface(playerTwoMatches);
  
  const calculateRolling = (matches: PlayerRecentMatch[], window: number) => {
    const results: number[] = [];
    for (let i = 0; i < matches.length; i++) {
      const windowMatches = matches.slice(Math.max(0, i - window + 1), i + 1);
      const wins = windowMatches.filter(m => m.winner).length;
      results.push(windowMatches.length > 0 ? (wins / windowMatches.length) * 100 : 0);
    }
    return results;
  };

  const p1Win3 = calculateRolling(p1SurfaceMatches, 3);
  const p1Win10 = calculateRolling(p1SurfaceMatches, 10);
  const p2Win3 = calculateRolling(p2SurfaceMatches, 3);
  const p2Win10 = calculateRolling(p2SurfaceMatches, 10);

  const maxLength = Math.max(p1Win3.length, p2Win3.length);
  const data = Array.from({ length: maxLength }, (_, idx) => ({
    match: `M${idx + 1}`,
    [`${playerOneName} 3-Match`]: idx < p1Win3.length ? p1Win3[idx] : null,
    [`${playerOneName} 10-Match`]: idx < p1Win10.length ? p1Win10[idx] : null,
    [`${playerTwoName} 3-Match`]: idx < p2Win3.length ? p2Win3[idx] : null,
    [`${playerTwoName} 10-Match`]: idx < p2Win10.length ? p2Win10[idx] : null,
  }));

  if (data.length === 0 || data.every(d => d[`${playerOneName} 3-Match`] === null && d[`${playerTwoName} 3-Match`] === null)) {
    return null;
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          {surface} Surface Form (Rolling Win %)
        </Typography>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis dataKey="match" tick={{ fill: "#c5d0d9" }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#c5d0d9" }} label={{ value: "Win Rate %", angle: -90, position: "insideLeft", fill: "#c5d0d9" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              formatter={(value: any) => value !== null ? `${Number(value).toFixed(1)}%` : "N/A"}
            />
            <Legend />
            <Bar dataKey={`${playerOneName} 3-Match`} fill="#00a0b0" name={`${playerOneName} 3-Match`} />
            <Bar dataKey={`${playerOneName} 10-Match`} fill="#00d4ff" name={`${playerOneName} 10-Match`} />
            <Bar dataKey={`${playerTwoName} 3-Match`} fill="#ff6b35" name={`${playerTwoName} 3-Match`} />
            <Bar dataKey={`${playerTwoName} 10-Match`} fill="#c44569" name={`${playerTwoName} 10-Match`} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default SurfaceSpecificFormGraph;

