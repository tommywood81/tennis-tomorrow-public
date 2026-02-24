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

const OpponentAdjustedServeReturnGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  // Process matches with opponent rank color gradient
  const processMatches = (matches: PlayerRecentMatch[]) => {
    const reversed = matches.slice().reverse().slice(0, 10);
    return reversed.map((match, idx) => {
      const opponentRank = match.opponent_rank ?? 1000;
      // Color gradient: dark = elite (rank 1-10), light = weak (rank 100+)
      const rankNormalized = Math.min(1, opponentRank / 100); // Normalize to 0-1
      const colorIntensity = Math.max(0.3, 1 - rankNormalized); // Darker for lower ranks
      const color = `rgba(0, 0, 0, ${colorIntensity})`;
      
      // Calculate opponent-adjusted performance
      // Adjusted = (Serve + Return) / 2 * (1 / Opponent Rank)
      const servePct = match.serve_pct ?? 0;
      const returnPct = match.return_pct ?? 0;
      const avgPerformance = (servePct + returnPct) / 2;
      const opponentAdjustment = opponentRank > 0 ? 1 / opponentRank : 0;
      const adjustedPerformance = avgPerformance * opponentAdjustment * 100; // Scale for visibility
      
      return {
        match: idx + 1,
        servePct: servePct * 100,
        returnPct: returnPct * 100,
        adjustedPerformance,
        opponentRank,
        color,
        opponent: match.opponent,
        won: match.winner,
      };
    });
  };

  const p1Data = processMatches(playerOneMatches);
  const p2Data = processMatches(playerTwoMatches);

  // Combine for display
  const maxLength = Math.max(p1Data.length, p2Data.length);
  const data = Array.from({ length: maxLength }, (_, idx) => ({
    match: `M${idx + 1}`,
    p1Serve: p1Data[idx]?.servePct ?? null,
    p1Return: p1Data[idx]?.returnPct ?? null,
    p1Adjusted: p1Data[idx]?.adjustedPerformance ?? null,
    p1Opponent: p1Data[idx]?.opponent ?? "",
    p1Rank: p1Data[idx]?.opponentRank ?? null,
    p2Serve: p2Data[idx]?.servePct ?? null,
    p2Return: p2Data[idx]?.returnPct ?? null,
    p2Adjusted: p2Data[idx]?.adjustedPerformance ?? null,
    p2Opponent: p2Data[idx]?.opponent ?? "",
    p2Rank: p2Data[idx]?.opponentRank ?? null,
  }));

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Serve vs Return Trajectory (Opponent-Adjusted)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Serve % and Return % over last 10 matches. Darker markers = stronger opponents. Adjusted performance accounts for opponent quality.
        </Typography>
        <ResponsiveContainer width="100%" height={500}>
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="match" 
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              label={{ value: "Percentage (%)", angle: -90, position: "insideLeft" }}
              domain={[0, 100]}
            />
            <Tooltip
              formatter={(value: any, name: string) => {
                if (value === null || value === undefined) return "N/A";
                return `${value.toFixed(1)}%`;
              }}
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) {
                  const data = payload[0].payload;
                  return (
                    <div>
                      <div>{label}</div>
                      {data.p1Opponent && (
                        <div style={{ fontSize: "0.85em", color: "#888" }}>
                          {playerOneName}: vs {data.p1Opponent} (Rank #{data.p1Rank})
                        </div>
                      )}
                      {data.p2Opponent && (
                        <div style={{ fontSize: "0.85em", color: "#888" }}>
                          {playerTwoName}: vs {data.p2Opponent} (Rank #{data.p2Rank})
                        </div>
                      )}
                    </div>
                  );
                }
                return label;
              }}
            />
            <Legend />
            <ReferenceLine y={50} stroke="#ccc" strokeDasharray="3 3" label="50% Baseline" />
            <Line
              type="monotone"
              dataKey="p1Serve"
              name={`${playerOneName} Serve %`}
              stroke="#00bcd4"
              strokeWidth={2}
              dot={{ r: 5 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="p1Return"
              name={`${playerOneName} Return %`}
              stroke="#00bcd4"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 5 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="p2Serve"
              name={`${playerTwoName} Serve %`}
              stroke="#ff6b6b"
              strokeWidth={2}
              dot={{ r: 5 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="p2Return"
              name={`${playerTwoName} Return %`}
              stroke="#ff6b6b"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 5 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default OpponentAdjustedServeReturnGraph;

