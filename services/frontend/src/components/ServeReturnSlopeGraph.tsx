import { Card, CardContent, Typography } from "@mui/material";
import {
  ComposedChart,
  Line,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
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

const ServeReturnSlopeGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  // Calculate slope over last 3 matches (serve_slope_last3, return_slope_last3)
  const calculateSlope = (values: number[]) => {
    if (values.length < 2) return null;
    
    // Simple linear regression slope
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i + 1); // [1, 2, 3]
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  };

  const playerOneReversed = playerOneMatches.slice().reverse().slice(0, 10);
  const playerTwoReversed = playerTwoMatches.slice().reverse().slice(0, 10);

  const maxLength = Math.min(10, Math.max(playerOneReversed.length, playerTwoReversed.length));

  const data = Array.from({ length: maxLength }, (_, idx) => {
    // Get last 3 matches up to this point
    const p1Last3 = playerOneReversed.slice(Math.max(0, idx - 2), idx + 1)
      .map((m) => m?.serve_pct != null ? m.serve_pct * 100 : null)
      .filter((v) => v !== null) as number[];
    const p1ReturnLast3 = playerOneReversed.slice(Math.max(0, idx - 2), idx + 1)
      .map((m) => m?.return_pct != null ? m.return_pct * 100 : null)
      .filter((v) => v !== null) as number[];
    
    const p2Last3 = playerTwoReversed.slice(Math.max(0, idx - 2), idx + 1)
      .map((m) => m?.serve_pct != null ? m.serve_pct * 100 : null)
      .filter((v) => v !== null) as number[];
    const p2ReturnLast3 = playerTwoReversed.slice(Math.max(0, idx - 2), idx + 1)
      .map((m) => m?.return_pct != null ? m.return_pct * 100 : null)
      .filter((v) => v !== null) as number[];

    const p1ServeSlope = calculateSlope(p1Last3);
    const p1ReturnSlope = calculateSlope(p1ReturnLast3);
    const p2ServeSlope = calculateSlope(p2Last3);
    const p2ReturnSlope = calculateSlope(p2ReturnLast3);

    // Current values
    const p1Serve = playerOneReversed[idx]?.serve_pct != null 
      ? playerOneReversed[idx].serve_pct * 100 : null;
    const p1Return = playerOneReversed[idx]?.return_pct != null 
      ? playerOneReversed[idx].return_pct * 100 : null;
    const p2Serve = playerTwoReversed[idx]?.serve_pct != null 
      ? playerTwoReversed[idx].serve_pct * 100 : null;
    const p2Return = playerTwoReversed[idx]?.return_pct != null 
      ? playerTwoReversed[idx].return_pct * 100 : null;

    return {
      match: `M${idx + 1}`,
      playerA_serve: p1Serve,
      playerA_return: p1Return,
      playerA_serve_slope: p1ServeSlope,
      playerA_return_slope: p1ReturnSlope,
      playerB_serve: p2Serve,
      playerB_return: p2Return,
      playerB_serve_slope: p2ServeSlope,
      playerB_return_slope: p2ReturnSlope,
    };
  });

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Serve/Return Slope Trend (Last 3 Matches)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Shows recent form trend: positive slope = improving, negative = declining. 
          Calculated over last 3 matches (serve_slope_last3, return_slope_last3 feature).
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis 
              dataKey="match"
              tick={{ fill: "#c5d0d9" }}
            />
            <YAxis 
              yAxisId="left"
              domain={[0, 100]}
              tick={{ fill: "#c5d0d9" }}
              label={{ value: "Serve/Return %", angle: -90, position: "insideLeft", fill: "#c5d0d9" }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              tick={{ fill: "#c5d0d9" }}
              label={{ value: "Slope (trend)", angle: 90, position: "insideRight", fill: "#c5d0d9" }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              formatter={(value: any, name: string) => {
                if (name.includes("slope")) {
                  return value !== null ? [`${value?.toFixed(2)} %/match`, name] : ["N/A", name];
                }
                return value !== null ? [`${value?.toFixed(1)}%`, name] : ["N/A", name];
              }}
            />
            <Legend />
            <ReferenceLine yAxisId="right" y={0} stroke="rgba(255,255,255,0.5)" strokeDasharray="3 3" />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="playerA_serve"
              stroke="#00a0b0"
              strokeWidth={2}
              name={`${playerOneName} Serve %`}
              dot={{ fill: "#00a0b0", r: 3 }}
              connectNulls={false}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="playerA_return"
              stroke="#00d4ff"
              strokeWidth={2}
              name={`${playerOneName} Return %`}
              dot={{ fill: "#00d4ff", r: 3 }}
              connectNulls={false}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="playerB_serve"
              stroke="#ff6b35"
              strokeWidth={2}
              name={`${playerTwoName} Serve %`}
              dot={{ fill: "#ff6b35", r: 3 }}
              connectNulls={false}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="playerB_return"
              stroke="#c44569"
              strokeWidth={2}
              name={`${playerTwoName} Return %`}
              dot={{ fill: "#c44569", r: 3 }}
              connectNulls={false}
            />
            <Bar
              yAxisId="right"
              dataKey="playerA_serve_slope"
              fill="#00a0b0"
              opacity={0.5}
              name={`${playerOneName} Serve Slope`}
            />
            <Bar
              yAxisId="right"
              dataKey="playerA_return_slope"
              fill="#00d4ff"
              opacity={0.5}
              name={`${playerOneName} Return Slope`}
            />
            <Bar
              yAxisId="right"
              dataKey="playerB_serve_slope"
              fill="#ff6b35"
              opacity={0.5}
              name={`${playerTwoName} Serve Slope`}
            />
            <Bar
              yAxisId="right"
              dataKey="playerB_return_slope"
              fill="#c44569"
              opacity={0.5}
              name={`${playerTwoName} Return Slope`}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ServeReturnSlopeGraph;

