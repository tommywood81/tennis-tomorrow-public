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

const ExpectedVsActualGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  const calculateExpected = (matches: PlayerRecentMatch[]) => {
    const reversed = matches.slice().reverse().slice(0, 25);
    const results: Array<{ expected: number; actual: number; match: string }> = [];
    
    for (let i = 0; i < reversed.length; i++) {
      const priorMatches = reversed.slice(Math.max(0, i - 10), i);
      if (priorMatches.length === 0) continue;
      
      // Expected based on prior serve+return average
      const avgServe = priorMatches.reduce((sum, m) => sum + (m.serve_pct || 0), 0) / priorMatches.length;
      const avgReturn = priorMatches.reduce((sum, m) => sum + (m.return_pct || 0), 0) / priorMatches.length;
      const expected = ((avgServe + avgReturn) / 2) * 100;
      
      // Actual from current match
      const currentMatch = reversed[i];
      const actual = (currentMatch.serve_pct && currentMatch.return_pct)
        ? ((currentMatch.serve_pct + currentMatch.return_pct) / 2) * 100
        : null;
      
      if (actual !== null) {
        results.push({
          expected,
          actual,
          match: `M${i + 1}`,
        });
      }
    }
    return results;
  };

  const p1Data = calculateExpected(playerOneMatches).map(d => ({
    match: d.match,
    [`${playerOneName} Expected`]: d.expected,
    [`${playerOneName} Actual`]: d.actual,
    [`${playerOneName} Diff`]: d.actual - d.expected,
  }));

  const p2Data = calculateExpected(playerTwoMatches).map(d => ({
    match: d.match,
    [`${playerTwoName} Expected`]: d.expected,
    [`${playerTwoName} Actual`]: d.actual,
    [`${playerTwoName} Diff`]: d.actual - d.expected,
  }));

  const maxLength = Math.max(p1Data.length, p2Data.length);
  const combinedData: any[] = Array.from({ length: maxLength }, (_, idx) => {
    const p1: any = p1Data[idx];
    const p2: any = p2Data[idx];
    return {
      match: p1?.match || p2?.match || `M${idx + 1}`,
      [`${playerOneName} Expected`]: p1 ? p1[`${playerOneName} Expected`] : null,
      [`${playerOneName} Actual`]: p1 ? p1[`${playerOneName} Actual`] : null,
      [`${playerTwoName} Expected`]: p2 ? p2[`${playerTwoName} Expected`] : null,
      [`${playerTwoName} Actual`]: p2 ? p2[`${playerTwoName} Actual`] : null,
    };
  });

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Expected vs Actual Performance
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: "0.75rem" }}>
          Expected based on prior 10-match rolling average
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={combinedData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis dataKey="match" tick={{ fill: "#c5d0d9" }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#c5d0d9" }} label={{ value: "Combined %", angle: -90, position: "insideLeft", fill: "#c5d0d9" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              formatter={(value: any) => value !== null ? `${Number(value).toFixed(1)}%` : "N/A"}
            />
            <Legend />
            <Bar dataKey={`${playerOneName} Expected`} fill="#888" name={`${playerOneName} Expected`} />
            <Bar dataKey={`${playerOneName} Actual`} fill="#00a0b0" name={`${playerOneName} Actual`} />
            <Bar dataKey={`${playerTwoName} Expected`} fill="#888" name={`${playerTwoName} Expected`} />
            <Bar dataKey={`${playerTwoName} Actual`} fill="#ff6b35" name={`${playerTwoName} Actual`} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ExpectedVsActualGraph;

