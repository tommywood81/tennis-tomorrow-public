import { Card, CardContent, Typography, Box } from "@mui/material";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { PredictionResponse } from "../api/types";

interface Props {
  prediction: PredictionResponse | null;
}

const PredictionProbabilityGraph = ({ prediction }: Props) => {
  if (!prediction) return null;

  const data = [
    {
      name: prediction.player_one.name,
      value: prediction.probabilities.player_one * 100,
      color: "#5A9BD5",
    },
    {
      name: prediction.player_two.name,
      value: prediction.probabilities.player_two * 100,
      color: "#7AB8E8",
    },
  ];

  return (
    <Card>
      <CardContent sx={{ touchAction: "pan-x pan-y pinch-zoom" }}>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          Prediction Probabilities
        </Typography>
        <Box sx={{ touchAction: "pan-x pan-y pinch-zoom", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
              outerRadius={100}
              fill="#5A9BD5"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ 
                backgroundColor: "#1A1A1A", 
                border: "1px solid rgba(90, 155, 213, 0.3)",
                borderRadius: "6px",
                color: "#FFFFFF",
              }}
              formatter={(value: any) => `${Number(value).toFixed(2)}%`}
            />
            <Legend wrapperStyle={{ color: "#1A1A1A" }} />
          </PieChart>
        </ResponsiveContainer>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Confidence: {(prediction.insights.confidence * 100).toFixed(1)}%
        </Typography>
      </CardContent>
    </Card>
  );
};

export default PredictionProbabilityGraph;

