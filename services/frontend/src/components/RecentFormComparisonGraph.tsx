import { Card, CardContent, Typography } from "@mui/material";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { PlayerRecentMatch } from "../api/types";

interface Props {
  playerOneName: string;
  playerTwoName: string;
  playerOneMatches: PlayerRecentMatch[];
  playerTwoMatches: PlayerRecentMatch[];
}

const RecentFormComparisonGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  const calculateMetrics = (matches: PlayerRecentMatch[]) => {
    const recent = matches.slice().reverse().slice(0, 10);
    const wins = recent.filter(m => m.winner).length;
    const avgServe = recent.reduce((sum, m) => sum + (m.serve_pct || 0), 0) / recent.length;
    const avgReturn = recent.reduce((sum, m) => sum + (m.return_pct || 0), 0) / recent.length;
    const avgOppRank = recent.reduce((sum, m) => sum + (m.opponent_rank || 1000), 0) / recent.length;
    const top10Wins = recent.filter(m => m.winner && (m.opponent_rank || 1000) <= 10).length;
    
    return {
      winRate: (wins / recent.length) * 100,
      serveAvg: avgServe * 100,
      returnAvg: avgReturn * 100,
      oppQuality: Math.max(0, 100 - (avgOppRank / 20)), // Inverse: better opp = higher score
      top10Wins: (top10Wins / Math.max(1, recent.filter(m => (m.opponent_rank || 1000) <= 10).length)) * 100,
    };
  };

  const p1Metrics = calculateMetrics(playerOneMatches);
  const p2Metrics = calculateMetrics(playerTwoMatches);

  const data = [
    { metric: "Win Rate", [playerOneName]: p1Metrics.winRate, [playerTwoName]: p2Metrics.winRate },
    { metric: "Serve Avg", [playerOneName]: p1Metrics.serveAvg, [playerTwoName]: p2Metrics.serveAvg },
    { metric: "Return Avg", [playerOneName]: p1Metrics.returnAvg, [playerTwoName]: p2Metrics.returnAvg },
    { metric: "Opp Quality", [playerOneName]: p1Metrics.oppQuality, [playerTwoName]: p2Metrics.oppQuality },
    { metric: "Top 10 Wins", [playerOneName]: p1Metrics.top10Wins, [playerTwoName]: p2Metrics.top10Wins },
  ];

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Recent Form Comparison (Last 10 Matches)
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <RadarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <PolarGrid stroke="rgba(255,255,255,0.2)" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: "#c5d0d9", fontSize: 12 }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#c5d0d9" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              formatter={(value: any) => `${Number(value).toFixed(1)}%`}
            />
            <Radar
              name={playerOneName}
              dataKey={playerOneName}
              stroke="#00a0b0"
              fill="#00a0b0"
              fillOpacity={0.6}
            />
            <Radar
              name={playerTwoName}
              dataKey={playerTwoName}
              stroke="#ff6b35"
              fill="#ff6b35"
              fillOpacity={0.6}
            />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default RecentFormComparisonGraph;

