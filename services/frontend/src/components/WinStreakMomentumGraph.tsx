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
  ReferenceLine,
  Cell,
} from "recharts";
import { PlayerRecentMatch } from "../api/types";

interface Props {
  playerOneName: string;
  playerTwoName: string;
  playerOneMatches: PlayerRecentMatch[];
  playerTwoMatches: PlayerRecentMatch[];
}

const WinStreakMomentumGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  const calculateStreaks = (matches: PlayerRecentMatch[]): number[] => {
    const reversed = matches.slice().reverse();
    const streaks: number[] = [];
    let currentStreak = 0;
    for (const match of reversed) {
      if (match.winner) {
        currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
      } else {
        currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
      }
      streaks.push(currentStreak);
    }
    return streaks.reverse();
  };

  const p1Streaks = calculateStreaks(playerOneMatches);
  const p2Streaks = calculateStreaks(playerTwoMatches);
  const maxLength = Math.max(p1Streaks.length, p2Streaks.length);
  
  const data = Array.from({ length: maxLength }, (_, idx) => ({
    match: `M${idx + 1}`,
    [`${playerOneName}`]: idx < p1Streaks.length ? p1Streaks[idx] : 0,
    [`${playerTwoName}`]: idx < p2Streaks.length ? p2Streaks[idx] : 0,
  }));

  const colors = {
    [playerOneName]: "#00a0b0",
    [playerTwoName]: "#ff6b35",
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Win/Loss Streak Momentum
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: "0.75rem" }}>
          Positive = Win streak, Negative = Loss streak
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis dataKey="match" tick={{ fill: "#c5d0d9" }} />
            <YAxis tick={{ fill: "#c5d0d9" }} label={{ value: "Streak", angle: -90, position: "insideLeft", fill: "#c5d0d9" }} />
            <ReferenceLine y={0} stroke="#888" strokeDasharray="2 2" />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              formatter={(value: any) => {
                const val = Number(value);
                return [`${val > 0 ? `+${val}` : val} ${val > 0 ? 'win' : val < 0 ? 'loss' : ''} streak`, ""];
              }}
            />
            <Legend />
            <Bar dataKey={playerOneName} fill={colors[playerOneName]} name={`${playerOneName} Streak`}>
              {data.map((entry, index) => {
                const val = Number(entry[playerOneName]);
                return (
                  <Cell key={`cell-${index}`} fill={val > 0 ? "#00ff00" : val < 0 ? "#ff0000" : colors[playerOneName]} />
                );
              })}
            </Bar>
            <Bar dataKey={playerTwoName} fill={colors[playerTwoName]} name={`${playerTwoName} Streak`}>
              {data.map((entry, index) => {
                const val = Number(entry[playerTwoName]);
                return (
                  <Cell key={`cell2-${index}`} fill={val > 0 ? "#00ff00" : val < 0 ? "#ff0000" : colors[playerTwoName]} />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default WinStreakMomentumGraph;

