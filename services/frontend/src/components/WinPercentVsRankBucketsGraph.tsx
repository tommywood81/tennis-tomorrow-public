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

const WinPercentVsRankBucketsGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  // Define rank buckets
  const rankBuckets = [
    { label: "Top 10", min: 1, max: 10 },
    { label: "11-25", min: 11, max: 25 },
    { label: "26-50", min: 26, max: 50 },
    { label: "51-100", min: 51, max: 100 },
    { label: "101+", min: 101, max: 1000 },
  ];
  
  // Calculate win % per bucket for each player
  const calculateWinPercent = (matches: PlayerRecentMatch[], minRank: number, maxRank: number) => {
    const bucketMatches = matches.filter(
      (m) => m.opponent_rank && m.opponent_rank >= minRank && m.opponent_rank <= maxRank
    );
    
    if (bucketMatches.length === 0) return null;
    
    const wins = bucketMatches.filter((m) => m.winner).length;
    return (wins / bucketMatches.length) * 100;
  };
  
  const data = rankBuckets.map((bucket) => {
    const p1WinPct = calculateWinPercent(playerOneMatches, bucket.min, bucket.max);
    const p2WinPct = calculateWinPercent(playerTwoMatches, bucket.min, bucket.max);
    
    return {
      bucket: bucket.label,
      playerA_win_pct: p1WinPct,
      playerB_win_pct: p2WinPct,
      playerA_matches: playerOneMatches.filter(
        (m) => m.opponent_rank && m.opponent_rank >= bucket.min && m.opponent_rank <= bucket.max
      ).length,
      playerB_matches: playerTwoMatches.filter(
        (m) => m.opponent_rank && m.opponent_rank >= bucket.min && m.opponent_rank <= bucket.max
      ).length,
    };
  });

  const COLORS = ["#00a0b0", "#ff6b35", "#00d4ff", "#c44569", "#f39c12"];

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Win % vs Opponent Rank Buckets (Career)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Performance against opponents by ranking tier
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis 
              dataKey="bucket"
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

export default WinPercentVsRankBucketsGraph;

