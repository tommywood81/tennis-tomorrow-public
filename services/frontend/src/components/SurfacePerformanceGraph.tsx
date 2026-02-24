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

const SurfacePerformanceGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  const surfaces = ["Hard", "Clay", "Grass"];
  
  const surfaceData = surfaces.map((surface) => {
    const p1Matches = playerOneMatches.filter((m) => m.surface === surface);
    const p2Matches = playerTwoMatches.filter((m) => m.surface === surface);
    
    const p1Wins = p1Matches.filter((m) => m.winner).length;
    const p1WinRate = p1Matches.length > 0 ? (p1Wins / p1Matches.length) * 100 : 0;
    
    const p2Wins = p2Matches.filter((m) => m.winner).length;
    const p2WinRate = p2Matches.length > 0 ? (p2Wins / p2Matches.length) * 100 : 0;
    
    const p1ServeAvg = p1Matches.length > 0
      ? p1Matches.reduce((sum, m) => sum + (m.serve_pct || 0) * 100, 0) / p1Matches.length
      : null;
    
    const p2ServeAvg = p2Matches.length > 0
      ? p2Matches.reduce((sum, m) => sum + (m.serve_pct || 0) * 100, 0) / p2Matches.length
      : null;
    
    return {
      surface,
      [`${playerOneName} Win %`]: p1WinRate,
      [`${playerTwoName} Win %`]: p2WinRate,
      [`${playerOneName} Serve %`]: p1ServeAvg,
      [`${playerTwoName} Serve %`]: p2ServeAvg,
      p1Matches: p1Matches.length,
      p2Matches: p2Matches.length,
    };
  });

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Surface Performance (Recent Matches)
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={surfaceData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis dataKey="surface" tick={{ fill: "#c5d0d9" }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#c5d0d9" }} label={{ value: "%", angle: -90, position: "insideLeft", fill: "#c5d0d9" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              formatter={(value: any, name: string, props: any) => {
                if (value === null || value === undefined) return ["N/A", name];
                const matches = name.includes(playerOneName) ? props.payload.p1Matches : props.payload.p2Matches;
                return [`${Number(value).toFixed(1)}% (${matches} matches)`, name];
              }}
            />
            <Legend />
            <Bar dataKey={`${playerOneName} Win %`} fill="#00a0b0" name={`${playerOneName} Win Rate`} />
            <Bar dataKey={`${playerTwoName} Win %`} fill="#ff6b35" name={`${playerTwoName} Win Rate`} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default SurfacePerformanceGraph;

