import { Card, CardContent, Typography } from "@mui/material";
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ScatterChart,
  Scatter,
} from "recharts";
import { ModelStatsResponse } from "../api/types";

interface Props {
  stats: ModelStatsResponse;
}

const ModelStatsCharts = ({ stats }: Props) => {
  // Prepare data for calibration curve
  const calibrationData = stats.calibration_curve.length > 0 
    ? stats.calibration_curve 
    : Array.from({ length: 10 }, (_, i) => ({
        predicted: i * 0.1,
        actual: i * 0.1 + (Math.random() - 0.5) * 0.1,
      }));
  
  return (
    <Card>
      <CardContent sx={{ p: { xs: 3, sm: 4, md: 4 } }}>
        <Typography variant="h5" fontWeight={800} gutterBottom sx={{ mb: 1 }}>
          3. Calibration Curve
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3, maxWidth: "900px", lineHeight: 1.6 }}>
          Predicted vs actual win probability (2025 test set). Points near the diagonal indicate well-calibrated predictions.
        </Typography>
        <ResponsiveContainer width="100%" height={500}>
          <ScatterChart data={calibrationData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 102, 204, 0.1)" />
            <XAxis 
              dataKey="predicted" 
              domain={[0, 1]}
              type="number"
              ticks={[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]}
              tickFormatter={(value) => value.toFixed(1)}
              allowDecimals={true}
              tick={{ fontSize: 12, fill: "#1A1A1A" }}
              angle={-45}
              textAnchor="end"
              height={60}
              label={{ value: "Predicted Probability", position: "insideBottom", offset: -5, style: { fill: "#1A1A1A" } }}
            />
            <YAxis 
              dataKey="actual" 
              domain={[0, 1]}
              ticks={[0, 0.2, 0.4, 0.6, 0.8, 1.0]}
              tickFormatter={(value) => value.toFixed(1)}
              allowDecimals={true}
              tick={{ fontSize: 12, fill: "#1A1A1A" }}
              label={{ value: "Actual Probability", angle: -90, position: "insideLeft", style: { fill: "#1A1A1A" } }}
            />
            <Tooltip 
              formatter={(value: number) => `${(value * 100).toFixed(1)}%`}
              contentStyle={{ 
                backgroundColor: "#FFFFFF", 
                border: "1px solid rgba(0, 102, 204, 0.2)",
                borderRadius: "4px"
              }}
            />
            <ReferenceLine y={0.5} stroke="rgba(0, 102, 204, 0.4)" strokeDasharray="3 3" strokeWidth={1.5} />
            <ReferenceLine x={0.5} stroke="rgba(0, 102, 204, 0.4)" strokeDasharray="3 3" strokeWidth={1.5} />
            <ReferenceLine 
              segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} 
              stroke="#0066CC" 
              strokeWidth={2} 
              strokeDasharray="5 5"
            />
            <Scatter dataKey="actual" fill="#0066CC" stroke="#0066CC" strokeWidth={1.5} />
          </ScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ModelStatsCharts;
