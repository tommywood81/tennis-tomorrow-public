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
  Cell,
} from "recharts";
import { PlayerRecentMatch } from "../api/types";

interface Props {
  playerOneName: string;
  playerTwoName: string;
  playerOneMatches: PlayerRecentMatch[];
  playerTwoMatches: PlayerRecentMatch[];
}

const SimilarRankOpponentsGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  // Define rank buckets
  const rankBuckets = [
    { label: "Top 5", min: 1, max: 5 },
    { label: "6-10", min: 6, max: 10 },
    { label: "11-20", min: 11, max: 20 },
    { label: "21-50", min: 21, max: 50 },
    { label: "51-100", min: 51, max: 100 },
    { label: "100+", min: 101, max: 1000 },
  ];

  const calculateWinRateByBucket = (matches: PlayerRecentMatch[]) => {
    const bucketStats = rankBuckets.map((bucket) => ({
      label: bucket.label,
      matches: 0,
      wins: 0,
      winRate: 0,
    }));

    matches.forEach((match) => {
      if (match.opponent_rank) {
        const bucket = rankBuckets.find(
          (b) => match.opponent_rank! >= b.min && match.opponent_rank! <= b.max
        );
        if (bucket) {
          const idx = rankBuckets.indexOf(bucket);
          bucketStats[idx].matches += 1;
          if (match.winner) {
            bucketStats[idx].wins += 1;
          }
        }
      }
    });

    bucketStats.forEach((stat) => {
      stat.winRate = stat.matches > 0 ? (stat.wins / stat.matches) * 100 : 0;
    });

    return bucketStats;
  };

  const p1Stats = calculateWinRateByBucket(playerOneMatches);
  const p2Stats = calculateWinRateByBucket(playerTwoMatches);

  const data = rankBuckets.map((bucket, idx) => ({
    bucket: bucket.label,
    [`${playerOneName} Win %`]: p1Stats[idx].winRate,
    [`${playerTwoName} Win %`]: p2Stats[idx].winRate,
    [`${playerOneName} Matches`]: p1Stats[idx].matches,
    [`${playerTwoName} Matches`]: p2Stats[idx].matches,
  }));

  const COLORS = {
    playerOne: "#00bcd4",
    playerTwo: "#ff6b6b",
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Win Rate vs Rank-Bucketed Opponents
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Performance against opponents grouped by ranking buckets
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="bucket" />
            <YAxis 
              label={{ value: "Win Rate (%)", angle: -90, position: "insideLeft" }}
              domain={[0, 100]}
            />
            <Tooltip 
              formatter={(value: any, name: string, props: any) => {
                if (name.includes("Win %")) {
                  return `${value.toFixed(1)}%`;
                }
                return `${value} matches`;
              }}
              contentStyle={{ backgroundColor: "#fff", border: "1px solid #ccc" }}
            />
            <Legend />
            <Bar 
              dataKey={`${playerOneName} Win %`} 
              fill={COLORS.playerOne}
              name={`${playerOneName} Win %`}
            />
            <Bar 
              dataKey={`${playerTwoName} Win %`} 
              fill={COLORS.playerTwo}
              name={`${playerTwoName} Win %`}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default SimilarRankOpponentsGraph;

