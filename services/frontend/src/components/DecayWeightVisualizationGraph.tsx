import { Card, CardContent, Typography } from "@mui/material";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface Props {
  playerOneName: string;
  playerTwoName: string;
}

const DecayWeightVisualizationGraph = ({ playerOneName, playerTwoName }: Props) => {
  // Calculate exponential decay weights with half_life=3.0
  const seqLen = 10;
  const halfLife = 3.0;
  
  const calculateDecayWeights = () => {
    const weights: number[] = [];
    for (let i = 0; i < seqLen; i++) {
      const age = seqLen - 1 - i; // Age in matches (0 = most recent)
      const weight = Math.exp(-(age * Math.log(2)) / halfLife);
      weights.push(weight);
    }
    
    // Normalize weights to sum to 1
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map((w) => (w / sum) * 100); // Convert to percentage
  };

  const weights = calculateDecayWeights();
  
  const data = Array.from({ length: seqLen }, (_, idx) => ({
    match: `M${idx + 1}`,
    weight: weights[idx],
    matchAge: seqLen - 1 - idx, // Age in matches
  }));

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Exponential Decay Weight Visualization
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Shows how recency weighting (half_life=3.0) emphasizes recent matches. Most recent match (M10) has the highest weight.
        </Typography>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
            <defs>
              <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00a0b0" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#00a0b0" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis 
              dataKey="match"
              tick={{ fill: "#c5d0d9" }}
              label={{ value: "Match (M10 = Most Recent)", position: "insideBottom", offset: -5, fill: "#c5d0d9" }}
            />
            <YAxis 
              domain={[0, 25]}
              tick={{ fill: "#c5d0d9" }}
              label={{ value: "Weight %", angle: -90, position: "insideLeft", fill: "#c5d0d9" }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              formatter={(value: any) => [`${value?.toFixed(2)}%`, "Weight"]}
              labelFormatter={(label, payload) => {
                const data = payload?.[0]?.payload;
                return `${label} (Age: ${data?.matchAge} matches ago)`;
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="weight"
              stroke="#00a0b0"
              fill="url(#colorWeight)"
              name="Decay Weight %"
              strokeWidth={3}
            />
            <ReferenceLine y={10} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" />
          </AreaChart>
        </ResponsiveContainer>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          Note: Each match's contribution to weighted averages decreases exponentially with age.
          After 3 matches, the weight halves (half_life=3.0).
        </Typography>
      </CardContent>
    </Card>
  );
};

export default DecayWeightVisualizationGraph;

