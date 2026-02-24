import { Card, CardContent, Typography, Box } from "@mui/material";
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

const HistoricalPredictionGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  // Simulate model predictions based on serve/return stats
  // In a real implementation, this would use actual model predictions
  const p1Reversed = playerOneMatches.slice().reverse().slice(0, 10);
  const p2Reversed = playerTwoMatches.slice().reverse().slice(0, 10);
  const maxLength = Math.min(10, Math.max(p1Reversed.length, p2Reversed.length));
  
  const historicalData = Array.from({ length: maxLength }, (_, idx) => {
    const p1Match = p1Reversed[idx];
    const p2Match = p2Reversed[idx];
    
    // Simple heuristic: if player has better combined serve+return %, they're favored
    const p1Serve = p1Match?.serve_pct || 0.5;
    const p1Return = p1Match?.return_pct || 0.5;
    const p1Combined = (p1Serve + p1Return) / 2;
    
    const p2Serve = p2Match?.serve_pct || 0.5;
    const p2Return = p2Match?.return_pct || 0.5;
    const p2Combined = (p2Serve + p2Return) / 2;
    
    // Estimated win probability based on combined stats
    const p1WinProb = (p1Combined / (p1Combined + p2Combined)) * 100;
    const p2WinProb = 100 - p1WinProb;
    
    return {
      match: `M${idx + 1}`,
      [`${playerOneName} Est. Win %`]: p1Match ? p1WinProb : null,
      [`${playerTwoName} Est. Win %`]: p2Match ? p2WinProb : null,
      p1Actual: p1Match?.winner ? 100 : 0,
      p2Actual: p2Match?.winner ? 100 : 0,
    };
  });

  return (
    <Card>
      <CardContent sx={{ touchAction: "pan-x pan-y pinch-zoom" }}>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          Historical Match Predictions (Estimated)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: "0.75rem" }}>
          Based on serve/return stats. Dotted lines show actual results.
        </Typography>
        <Box sx={{ touchAction: "pan-x pan-y pinch-zoom", overflowX: "auto", WebkitOverflowScrolling: "touch", minWidth: 400 }}>
          <ResponsiveContainer width="100%" height={350}>
          <LineChart data={historicalData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.1)" />
            <XAxis dataKey="match" tick={{ fill: "#1A1A1A" }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#1A1A1A" }} label={{ value: "Win Probability %", angle: -90, position: "insideLeft", fill: "#1A1A1A" }} />
            <ReferenceLine y={50} stroke="rgba(0, 0, 0, 0.2)" strokeDasharray="2 2" />
            <Tooltip
              contentStyle={{ 
                backgroundColor: "#1A1A1A", 
                border: "1px solid rgba(90, 155, 213, 0.3)",
                borderRadius: "6px",
                color: "#FFFFFF",
              }}
              formatter={(value: any, name: string) => {
                if (value === null || value === undefined) return ["N/A", name];
                return [`${Number(value).toFixed(1)}%`, name];
              }}
            />
            <Legend wrapperStyle={{ color: "#1A1A1A" }} />
            <Line
              type="monotone"
              dataKey={`${playerOneName} Est. Win %`}
              stroke="#5A9BD5"
              strokeWidth={3}
              dot={{ fill: "#5A9BD5", r: 5 }}
            />
            <Line
              type="monotone"
              dataKey={`${playerTwoName} Est. Win %`}
              stroke="#7AB8E8"
              strokeWidth={3}
              dot={{ fill: "#7AB8E8", r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="p1Actual"
              stroke="#5A9BD5"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name={`${playerOneName} Actual (100=W, 0=L)`}
            />
            <Line
              type="monotone"
              dataKey="p2Actual"
              stroke="#7AB8E8"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name={`${playerTwoName} Actual (100=W, 0=L)`}
            />
          </LineChart>
        </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
};

export default HistoricalPredictionGraph;

