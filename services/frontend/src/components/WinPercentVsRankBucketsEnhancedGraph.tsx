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
} from "recharts";
import { PlayerRecentMatch } from "../api/types";

interface Props {
  playerOneName: string;
  playerTwoName: string;
  playerOneMatches: PlayerRecentMatch[];
  playerTwoMatches: PlayerRecentMatch[];
}

const WinPercentVsRankBucketsEnhancedGraph = ({
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
    { label: "100+", min: 101, max: 2000 },
  ];

  // Calculate win % for each bucket (career + recent)
  const calculateWinPercent = (matches: PlayerRecentMatch[], bucket: { min: number; max: number }) => {
    const bucketMatches = matches.filter(
      (m) => m.opponent_rank !== null && m.opponent_rank !== undefined && m.opponent_rank >= bucket.min && m.opponent_rank <= bucket.max
    );
    
    if (bucketMatches.length === 0) return null;
    
    const wins = bucketMatches.filter((m) => m.winner).length;
    return (wins / bucketMatches.length) * 100;
  };

  // Calculate for last 10 matches (recent)
  const p1Recent = playerOneMatches.slice().reverse().slice(0, 10);
  const p2Recent = playerTwoMatches.slice().reverse().slice(0, 10);

  // Calculate for all matches (career)
  const p1Career = playerOneMatches;
  const p2Career = playerTwoMatches;

  const data = rankBuckets.map((bucket) => {
    const p1RecentWinPct = calculateWinPercent(p1Recent, bucket);
    const p1CareerWinPct = calculateWinPercent(p1Career, bucket);
    const p2RecentWinPct = calculateWinPercent(p2Recent, bucket);
    const p2CareerWinPct = calculateWinPercent(p2Career, bucket);

    return {
      bucket: bucket.label,
      [`${playerOneName} Recent`]: p1RecentWinPct,
      [`${playerOneName} Career`]: p1CareerWinPct,
      [`${playerTwoName} Recent`]: p2RecentWinPct,
      [`${playerTwoName} Career`]: p2CareerWinPct,
    };
  });

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Win % vs Opponent Rank Buckets (Career + Recent)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Win percentage against different opponent rank ranges. Recent = last 10 matches, Career = all available matches.
        </Typography>
        <ResponsiveContainer width="100%" height={500}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="bucket" />
            <YAxis 
              label={{ value: "Win Percentage (%)", angle: -90, position: "insideLeft" }}
              domain={[0, 100]}
            />
            <Tooltip
              formatter={(value: any) => {
                if (value === null || value === undefined) return "N/A";
                return `${value.toFixed(1)}%`;
              }}
            />
            <Legend />
            <Bar dataKey={`${playerOneName} Recent`} fill="#00bcd4" />
            <Bar dataKey={`${playerOneName} Career`} fill="#0097a7" />
            <Bar dataKey={`${playerTwoName} Recent`} fill="#ff6b6b" />
            <Bar dataKey={`${playerTwoName} Career`} fill="#d32f2f" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default WinPercentVsRankBucketsEnhancedGraph;

