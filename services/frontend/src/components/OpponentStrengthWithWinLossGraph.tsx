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

const OpponentStrengthWithWinLossGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  // Process last 10 matches - reverse to show oldest first (most recent at end)
  const playerOneReversed = playerOneMatches.slice().reverse().slice(0, 10);
  const playerTwoReversed = playerTwoMatches.slice().reverse().slice(0, 10);
  
  const maxLength = Math.min(10, Math.max(playerOneReversed.length, playerTwoReversed.length));
  
  // Calculate opponent strength: inverse of rank (lower rank = stronger)
  const calculateOpponentStrength = (rank: number | undefined): number => {
    if (!rank || rank > 1000) return 0;
    return 1 / (1 + rank); // Normalized: rank 1 = 0.5, rank 10 = 0.091, rank 100 = 0.01
  };
  
  const data = Array.from({ length: maxLength }, (_, idx) => {
    const p1Match = playerOneReversed[idx];
    const p2Match = playerTwoReversed[idx];
    
    const p1OppStrength = calculateOpponentStrength(p1Match?.opponent_rank);
    const p2OppStrength = calculateOpponentStrength(p2Match?.opponent_rank);
    
    // Create labels
    const p1Opponent = p1Match?.opponent || "";
    const p1Rank = p1Match?.opponent_rank;
    const p1Label = p1Rank ? `${p1Opponent} (#${p1Rank})` : p1Opponent;
    
    const p2Opponent = p2Match?.opponent || "";
    const p2Rank = p2Match?.opponent_rank;
    const p2Label = p2Rank ? `${p2Opponent} (#${p2Rank})` : p2Opponent;
    
    let xAxisLabel = `M${idx + 1}`;
    if (p1Opponent || p2Opponent) {
      const parts = [];
      if (p1Label) parts.push(`P1: ${p1Label}`);
      if (p2Label) parts.push(`P2: ${p2Label}`);
      if (parts.length > 0) xAxisLabel = parts.join(" | ");
    }
    
    return {
      match: `M${idx + 1}`,
      xAxisLabel,
      playerA_opp_strength: p1OppStrength,
      playerB_opp_strength: p2OppStrength,
      playerA_won: p1Match?.winner ? 1 : (p1Match ? 0 : null),
      playerB_won: p2Match?.winner ? 1 : (p2Match ? 0 : null),
      playerA_opponent: p1Opponent,
      playerA_opponent_rank: p1Rank,
      playerB_opponent: p2Opponent,
      playerB_opponent_rank: p2Rank,
    };
  });

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Opponent Strength Trend (Last 10 Matches)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Shows opponent quality (normalized rank) with win/loss indicators
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 120 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis 
              dataKey="xAxisLabel"
              tick={{ fill: "#c5d0d9", fontSize: 9 }}
              angle={-45}
              textAnchor="end"
              height={120}
              interval={0}
            />
            <YAxis 
              yAxisId="left"
              domain={[0, 0.6]}
              tick={{ fill: "#c5d0d9" }}
              label={{ value: "Opponent Strength", angle: -90, position: "insideLeft", fill: "#c5d0d9" }}
            />
            <YAxis 
              yAxisId="right"
              domain={[0, 1.1]}
              orientation="right"
              tick={{ fill: "#c5d0d9" }}
              label={{ value: "Win/Loss", angle: 90, position: "insideRight", fill: "#c5d0d9" }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              formatter={(value: any, name: string) => {
                if (name.includes("won")) {
                  return value === 1 ? "Win" : value === 0 ? "Loss" : "N/A";
                }
                return [value?.toFixed(3), name];
              }}
              labelFormatter={(label) => label}
            />
            <Legend />
            <ReferenceLine yAxisId="left" y={0} stroke="rgba(255,255,255,0.3)" />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="playerA_opp_strength"
              stroke="#00a0b0"
              strokeWidth={3}
              name={`${playerOneName} Opponent Strength`}
              dot={{ fill: "#00a0b0", r: 4 }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="playerB_opp_strength"
              stroke="#ff6b35"
              strokeWidth={3}
              name={`${playerTwoName} Opponent Strength`}
              dot={{ fill: "#ff6b35", r: 4 }}
            />
            <Bar
              yAxisId="right"
              dataKey="playerA_won"
              fill="#00ff00"
              name={`${playerOneName} Win/Loss`}
              opacity={0.6}
            />
            <Bar
              yAxisId="right"
              dataKey="playerB_won"
              fill="#ff0000"
              name={`${playerTwoName} Win/Loss`}
              opacity={0.6}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default OpponentStrengthWithWinLossGraph;

