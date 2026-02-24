import { Card, CardContent, Typography } from "@mui/material";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { PlayerRecentMatch } from "../api/types";

interface Props {
  playerOneName: string;
  playerTwoName: string;
  playerOneMatches: PlayerRecentMatch[];
  playerTwoMatches: PlayerRecentMatch[];
}

const CareerPerformanceByRoundGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  // Define round order (early to late)
  const roundOrder = ["R128", "R64", "R32", "R16", "QF", "SF", "F"];
  
  // Calculate win % per round for each player
  const calculateWinPercent = (matches: PlayerRecentMatch[], round: string) => {
    const roundMatches = matches.filter((m) => m.round === round);
    
    if (roundMatches.length === 0) return null;
    
    const wins = roundMatches.filter((m) => m.winner).length;
    return (wins / roundMatches.length) * 100;
  };
  
  const data = roundOrder.map((round) => {
    const p1WinPct = calculateWinPercent(playerOneMatches, round);
    const p2WinPct = calculateWinPercent(playerTwoMatches, round);
    
    return {
      round,
      playerA_win_pct: p1WinPct,
      playerB_win_pct: p2WinPct,
      playerA_matches: playerOneMatches.filter((m) => m.round === round).length,
      playerB_matches: playerTwoMatches.filter((m) => m.round === round).length,
    };
  }).filter((d) => d.playerA_matches > 0 || d.playerB_matches > 0); // Only show rounds with matches

  const COLORS = ["#00a0b0", "#ff6b35"];

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Career Performance by Tournament Round
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Win percentage at each tournament stage
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis 
              dataKey="round"
              tick={{ fill: "#c5d0d9" }}
            />
            <YAxis 
              domain={[0, 100]}
              tick={{ fill: "#c5d0d9" }}
              label={{ value: "Win %", angle: -90, position: "insideLeft", fill: "#c5d0d9" }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              formatter={(value: any, name: string, props: any) => {
                if (value === null || value === undefined) {
                  return ["N/A", name];
                }
                const matchCount = name.includes("playerA") ? props.payload.playerA_matches : props.payload.playerB_matches;
                return [`${value?.toFixed(1)}% (${matchCount} matches)`, name];
              }}
            />
            <Legend />
            <Bar
              dataKey="playerA_win_pct"
              name={`${playerOneName} Win %`}
              fill="#00a0b0"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-a-${index}`} fill={entry.playerA_win_pct !== null ? "#00a0b0" : "#666"} opacity={entry.playerA_win_pct !== null ? 1 : 0.3} />
              ))}
            </Bar>
            <Bar
              dataKey="playerB_win_pct"
              name={`${playerTwoName} Win %`}
              fill="#ff6b35"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-b-${index}`} fill={entry.playerB_win_pct !== null ? "#ff6b35" : "#666"} opacity={entry.playerB_win_pct !== null ? 1 : 0.3} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default CareerPerformanceByRoundGraph;

