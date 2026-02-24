import { Card, CardContent, Typography } from "@mui/material";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Bar,
  ComposedChart,
} from "recharts";
import { PlayerRecentMatch } from "../api/types";

interface Props {
  playerOneName: string;
  playerTwoName: string;
  playerOneMatches: PlayerRecentMatch[];
  playerTwoMatches: PlayerRecentMatch[];
}

const DaysSincePreviousMatchGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  // Calculate days since each match (from match date to today)
  const calculateDaysSinceMatches = (matches: PlayerRecentMatch[]): { days: number; match: PlayerRecentMatch }[] => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // Sort matches by date (most recent first)
    const sortedMatches = matches.slice().sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });
    
    // Take last 6 matches and calculate days since each
    return sortedMatches.slice(0, 6).map((match) => {
      const matchDate = new Date(match.date);
      matchDate.setHours(0, 0, 0, 0);
      
      if (!isNaN(matchDate.getTime())) {
        const diff = Math.floor((now.getTime() - matchDate.getTime()) / (1000 * 60 * 60 * 24));
        return { days: Math.max(0, diff), match };
      }
      return { days: 0, match };
    });
  };
  
  const p1Data = calculateDaysSinceMatches(playerOneMatches);
  const p2Data = calculateDaysSinceMatches(playerTwoMatches);
  
  // Find the maximum number of matches to display (up to 6)
  const maxLength = Math.min(6, Math.max(p1Data.length, p2Data.length));
  
  const data = Array.from({ length: maxLength }, (_, idx) => {
    const p1Entry = p1Data[idx];
    const p2Entry = p2Data[idx];
    
    const p1Match = p1Entry?.match;
    const p2Match = p2Entry?.match;
    
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
      playerA_days: p1Entry?.days ?? null,
      playerB_days: p2Entry?.days ?? null,
      playerA_won: p1Match?.winner ? 1 : (p1Match ? 0 : null),
      playerB_won: p2Match?.winner ? 1 : (p2Match ? 0 : null),
    };
  });

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Days Since Previous Match (Rest Period)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Shows how many days have passed since each player's last 6 matches. Higher values indicate more time since that match.
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
              domain={[0, "dataMax + 5"]}
              tick={{ fill: "#c5d0d9" }}
              label={{ value: "Days", angle: -90, position: "insideLeft", fill: "#c5d0d9" }}
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
                return value !== null ? [`${value} days`, name] : ["N/A", name];
              }}
              labelFormatter={(label) => label}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="playerA_days"
              stroke="#00a0b0"
              strokeWidth={3}
              name={`${playerOneName} Days Rest`}
              dot={{ fill: "#00a0b0", r: 4 }}
              connectNulls={false}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="playerB_days"
              stroke="#ff6b35"
              strokeWidth={3}
              name={`${playerTwoName} Days Rest`}
              dot={{ fill: "#ff6b35", r: 4 }}
              connectNulls={false}
            />
            <Bar
              yAxisId="right"
              dataKey="playerA_won"
              fill="#00ff00"
              name={`${playerOneName} Win/Loss`}
              opacity={0.4}
            />
            <Bar
              yAxisId="right"
              dataKey="playerB_won"
              fill="#ff0000"
              name={`${playerTwoName} Win/Loss`}
              opacity={0.4}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default DaysSincePreviousMatchGraph;

