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

const OpponentQualityDistributionGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  const getRankBucket = (rank?: number): string => {
    if (!rank) return "Unranked";
    if (rank <= 10) return "Top 10";
    if (rank <= 20) return "11-20";
    if (rank <= 50) return "21-50";
    if (rank <= 100) return "51-100";
    return "100+";
  };
  
  const buckets = ["Top 10", "11-20", "21-50", "51-100", "100+", "Unranked"];
  
  const distributionData = buckets.map((bucket) => {
    const p1Matches = playerOneMatches.filter((m) => getRankBucket(m.opponent_rank) === bucket);
    const p2Matches = playerTwoMatches.filter((m) => getRankBucket(m.opponent_rank) === bucket);
    
    const p1WinRate = p1Matches.length > 0
      ? (p1Matches.filter((m) => m.winner).length / p1Matches.length) * 100
      : null;
    
    const p2WinRate = p2Matches.length > 0
      ? (p2Matches.filter((m) => m.winner).length / p2Matches.length) * 100
      : null;
    
    return {
      bucket,
      [`${playerOneName}`]: p1WinRate,
      [`${playerTwoName}`]: p2WinRate,
      p1Count: p1Matches.length,
      p2Count: p2Matches.length,
    };
  });

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Win Rate vs Opponent Rank Buckets
        </Typography>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={distributionData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis dataKey="bucket" tick={{ fill: "#c5d0d9" }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#c5d0d9" }} label={{ value: "Win Rate %", angle: -90, position: "insideLeft", fill: "#c5d0d9" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              formatter={(value: any, name: string, props: any) => {
                if (value === null || value === undefined) return ["N/A", name];
                const count = name === playerOneName ? props.payload.p1Count : props.payload.p2Count;
                return [`${Number(value).toFixed(1)}% (${count} matches)`, name];
              }}
            />
            <Legend />
            <Bar dataKey={playerOneName} fill="#00a0b0" name={`${playerOneName} Win Rate`} />
            <Bar dataKey={playerTwoName} fill="#ff6b35" name={`${playerTwoName} Win Rate`} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default OpponentQualityDistributionGraph;

