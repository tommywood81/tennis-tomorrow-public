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

const WeightedVsRawStatsGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  // Calculate exponentially weighted average (simulating half_life=3.0)
  const calculateWeightedAverage = (values: number[], halfLife: number = 3.0) => {
    if (values.length === 0) return null;
    
    const weights: number[] = [];
    const maxWeight = Math.exp(0); // Weight for most recent match
    
    for (let i = 0; i < values.length; i++) {
      const age = values.length - 1 - i; // Age in matches
      const weight = Math.exp(-(age * Math.log(2)) / halfLife);
      weights.push(weight);
    }
    
    const sumWeights = weights.reduce((a, b) => a + b, 0);
    const weightedSum = values.reduce((sum, val, idx) => sum + val * weights[idx], 0);
    
    return weightedSum / sumWeights;
  };

  // Get last 10 matches (reversed to show oldest first)
  const playerOneReversed = playerOneMatches.slice().reverse().slice(0, 10);
  const playerTwoReversed = playerTwoMatches.slice().reverse().slice(0, 10);

  const maxLength = Math.min(10, Math.max(playerOneReversed.length, playerTwoReversed.length));

  const data = Array.from({ length: maxLength }, (_, idx) => {
    const p1Match = playerOneReversed[idx];
    const p2Match = playerTwoReversed[idx];

    // Calculate cumulative weighted average up to this point
    const p1ServePct = p1Match?.serve_pct != null ? p1Match.serve_pct * 100 : null;
    const p1ReturnPct = p1Match?.return_pct != null ? p1Match.return_pct * 100 : null;
    const p2ServePct = p2Match?.serve_pct != null ? p2Match.serve_pct * 100 : null;
    const p2ReturnPct = p2Match?.return_pct != null ? p2Match.return_pct * 100 : null;

    // Calculate weighted average up to current match
    const p1ServeHistory = playerOneReversed.slice(0, idx + 1)
      .map((m) => m?.serve_pct != null ? m.serve_pct * 100 : null)
      .filter((v) => v !== null) as number[];
    const p1ReturnHistory = playerOneReversed.slice(0, idx + 1)
      .map((m) => m?.return_pct != null ? m.return_pct * 100 : null)
      .filter((v) => v !== null) as number[];
    const p2ServeHistory = playerTwoReversed.slice(0, idx + 1)
      .map((m) => m?.serve_pct != null ? m.serve_pct * 100 : null)
      .filter((v) => v !== null) as number[];
    const p2ReturnHistory = playerTwoReversed.slice(0, idx + 1)
      .map((m) => m?.return_pct != null ? m.return_pct * 100 : null)
      .filter((v) => v !== null) as number[];

    const p1WeightedServe = calculateWeightedAverage(p1ServeHistory);
    const p1WeightedReturn = calculateWeightedAverage(p1ReturnHistory);
    const p2WeightedServe = calculateWeightedAverage(p2ServeHistory);
    const p2WeightedReturn = calculateWeightedAverage(p2ReturnHistory);

    // Simple average (raw)
    const p1RawServe = p1ServeHistory.length > 0
      ? p1ServeHistory.reduce((a, b) => a + b, 0) / p1ServeHistory.length
      : null;
    const p1RawReturn = p1ReturnHistory.length > 0
      ? p1ReturnHistory.reduce((a, b) => a + b, 0) / p1ReturnHistory.length
      : null;
    const p2RawServe = p2ServeHistory.length > 0
      ? p2ServeHistory.reduce((a, b) => a + b, 0) / p2ServeHistory.length
      : null;
    const p2RawReturn = p2ReturnHistory.length > 0
      ? p2ReturnHistory.reduce((a, b) => a + b, 0) / p2ReturnHistory.length
      : null;

    return {
      match: `M${idx + 1}`,
      playerA_raw_serve: p1RawServe,
      playerA_weighted_serve: p1WeightedServe,
      playerA_raw_return: p1RawReturn,
      playerA_weighted_return: p1WeightedReturn,
      playerB_raw_serve: p2RawServe,
      playerB_weighted_serve: p2WeightedServe,
      playerB_raw_return: p2RawReturn,
      playerB_weighted_return: p2WeightedReturn,
    };
  });

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Weighted vs Raw Stats (Exponential Decay)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Shows the impact of exponential decay weighting (half_life=3.0) - recent matches weighted more heavily
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis 
              dataKey="match"
              tick={{ fill: "#c5d0d9" }}
            />
            <YAxis 
              domain={[0, 100]}
              tick={{ fill: "#c5d0d9" }}
              label={{ value: "Percentage", angle: -90, position: "insideLeft", fill: "#c5d0d9" }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              formatter={(value: any) => value !== null ? `${value?.toFixed(1)}%` : "N/A"}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="playerA_raw_serve"
              stroke="#00a0b0"
              strokeWidth={2}
              strokeDasharray="5 5"
              name={`${playerOneName} Raw Serve`}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="playerA_weighted_serve"
              stroke="#00a0b0"
              strokeWidth={3}
              name={`${playerOneName} Weighted Serve`}
              dot={{ fill: "#00a0b0", r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="playerA_raw_return"
              stroke="#00d4ff"
              strokeWidth={2}
              strokeDasharray="5 5"
              name={`${playerOneName} Raw Return`}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="playerA_weighted_return"
              stroke="#00d4ff"
              strokeWidth={3}
              name={`${playerOneName} Weighted Return`}
              dot={{ fill: "#00d4ff", r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="playerB_raw_serve"
              stroke="#ff6b35"
              strokeWidth={2}
              strokeDasharray="5 5"
              name={`${playerTwoName} Raw Serve`}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="playerB_weighted_serve"
              stroke="#ff6b35"
              strokeWidth={3}
              name={`${playerTwoName} Weighted Serve`}
              dot={{ fill: "#ff6b35", r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="playerB_raw_return"
              stroke="#c44569"
              strokeWidth={2}
              strokeDasharray="5 5"
              name={`${playerTwoName} Raw Return`}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="playerB_weighted_return"
              stroke="#c44569"
              strokeWidth={3}
              name={`${playerTwoName} Weighted Return`}
              dot={{ fill: "#c44569", r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default WeightedVsRawStatsGraph;

