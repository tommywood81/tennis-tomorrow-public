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
  Cell,
} from "recharts";
import { PlayerRecentMatch } from "../api/types";

interface Props {
  playerOneName: string;
  playerTwoName: string;
  playerOneMatches: PlayerRecentMatch[];
  playerTwoMatches: PlayerRecentMatch[];
}

const RoundPerformanceGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  const rounds = ["R32", "R16", "QF", "SF", "F"];
  
  const roundData = rounds.map((round) => {
    const p1Matches = playerOneMatches.filter((m) => m.round === round);
    const p2Matches = playerTwoMatches.filter((m) => m.round === round);
    
    const p1Wins = p1Matches.filter((m) => m.winner).length;
    const p1WinRate = p1Matches.length > 0 ? (p1Wins / p1Matches.length) * 100 : null;
    
    const p2Wins = p2Matches.filter((m) => m.winner).length;
    const p2WinRate = p2Matches.length > 0 ? (p2Wins / p2Matches.length) * 100 : null;
    
    return {
      round,
      [`${playerOneName}`]: p1WinRate,
      [`${playerTwoName}`]: p2WinRate,
      p1Count: p1Matches.length,
      p2Count: p2Matches.length,
    };
  });

  const colors = {
    [playerOneName]: "#00a0b0",
    [playerTwoName]: "#ff6b35",
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Performance by Tournament Round
        </Typography>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={roundData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis dataKey="round" tick={{ fill: "#c5d0d9" }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#c5d0d9" }} label={{ value: "Win Rate %", angle: -90, position: "insideLeft", fill: "#c5d0d9" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              formatter={(value: any, name: string, props: any) => {
                if (value === null || value === undefined) return ["N/A", name];
                const count = name === playerOneName ? props.payload.p1Count : props.payload.p2Count;
                return [`${Number(value).toFixed(1)}% (${count} matches)`, name];
              }}
            />
            <Legend />
            <Bar dataKey={playerOneName} fill={colors[playerOneName]} name={`${playerOneName} Win Rate`} />
            <Bar dataKey={playerTwoName} fill={colors[playerTwoName]} name={`${playerTwoName} Win Rate`} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default RoundPerformanceGraph;

