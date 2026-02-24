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

const FormVolatilityGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  const calculateVolatility = (matches: PlayerRecentMatch[], window: number = 10) => {
    const reversed = matches.slice().reverse();
    const volatility: number[] = [];
    
    for (let i = window - 1; i < reversed.length; i++) {
      const windowMatches = reversed.slice(i - window + 1, i + 1);
      const servePcts = windowMatches
        .map(m => m.serve_pct)
        .filter(p => p !== null && p !== undefined);
      const returnPcts = windowMatches
        .map(m => m.return_pct)
        .filter(p => p !== null && p !== undefined);
      
      if (servePcts.length > 1 && returnPcts.length > 1) {
        // Calculate standard deviation of combined performance
        const combined = servePcts.map((s, idx) => (s || 0) + (returnPcts[idx] || 0));
        const mean = combined.reduce((a, b) => a + b, 0) / combined.length;
        const variance = combined.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / combined.length;
        const stdDev = Math.sqrt(variance);
        // Convert to volatility score (0-100 scale)
        const volatilityScore = Math.min(100, (stdDev * 200));
        volatility.push(volatilityScore);
      } else {
        volatility.push(0);
      }
    }
    
    // Pad beginning with nulls
    const padded = Array(window - 1).fill(null).concat(volatility);
    return padded.reverse();
  };

  const calculateFormRating = (matches: PlayerRecentMatch[]) => {
    const reversed = matches.slice().reverse();
    const ratings: number[] = [];
    
    for (let i = 0; i < reversed.length; i++) {
      const windowMatches = reversed.slice(Math.max(0, i - 9), i + 1);
      const wins = windowMatches.filter(m => m.winner).length;
      const total = windowMatches.length;
      const winRate = total > 0 ? (wins / total) * 100 : 0;
      
      // Factor in opponent quality
      const avgOppRank = windowMatches
        .map(m => m.opponent_rank || 1000)
        .reduce((a, b) => a + b, 0) / windowMatches.length;
      const qualityAdjustment = Math.max(0, (1000 - avgOppRank) / 10);
      
      // Factor in serve/return consistency
      const servePcts = windowMatches.map(m => m.serve_pct || 0).filter(p => p > 0);
      const returnPcts = windowMatches.map(m => m.return_pct || 0).filter(p => p > 0);
      const avgServe = servePcts.length > 0 ? servePcts.reduce((a, b) => a + b, 0) / servePcts.length : 0;
      const avgReturn = returnPcts.length > 0 ? returnPcts.reduce((a, b) => a + b, 0) / returnPcts.length : 0;
      const performanceScore = ((avgServe + avgReturn) / 2) * 100;
      
      // Combined rating (0-100)
      const rating = Math.min(100, winRate * 0.4 + qualityAdjustment * 0.3 + performanceScore * 0.3);
      ratings.push(rating);
    }
    
    return ratings.reverse();
  };

  const p1Volatility = calculateVolatility(playerOneMatches);
  const p2Volatility = calculateVolatility(playerTwoMatches);
  const p1FormRating = calculateFormRating(playerOneMatches);
  const p2FormRating = calculateFormRating(playerTwoMatches);
  
  const maxLength = Math.max(playerOneMatches.length, playerTwoMatches.length);
  const data = Array.from({ length: maxLength }, (_, idx) => ({
    match: `M${idx + 1}`,
    [`${playerOneName} Volatility`]: p1Volatility[idx] || null,
    [`${playerTwoName} Volatility`]: p2Volatility[idx] || null,
    [`${playerOneName} Form Rating`]: p1FormRating[idx] || null,
    [`${playerTwoName} Form Rating`]: p2FormRating[idx] || null,
  }));

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Form Volatility & Rating
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Volatility (consistency) and form rating over recent matches (lower volatility = more consistent)
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="match" />
            <YAxis 
              label={{ value: "Score", angle: -90, position: "insideLeft" }}
              domain={[0, 100]}
            />
            <Tooltip />
            <Legend />
            <ReferenceLine y={50} stroke="#888" strokeDasharray="3 3" />
            <Line 
              type="monotone" 
              dataKey={`${playerOneName} Volatility`} 
              stroke="#00bcd4" 
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 5"
            />
            <Line 
              type="monotone" 
              dataKey={`${playerTwoName} Volatility`} 
              stroke="#ff6b6b" 
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 5"
            />
            <Line 
              type="monotone" 
              dataKey={`${playerOneName} Form Rating`} 
              stroke="#00bcd4" 
              strokeWidth={3}
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey={`${playerTwoName} Form Rating`} 
              stroke="#ff6b6b" 
              strokeWidth={3}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default FormVolatilityGraph;

