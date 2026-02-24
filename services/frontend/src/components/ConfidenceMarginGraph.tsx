import { Card, CardContent, Typography } from "@mui/material";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { PredictionResponse } from "../api/types";

interface Props {
  prediction: PredictionResponse | null;
}

const ConfidenceMarginGraph = ({ prediction }: Props) => {
  if (!prediction || prediction.insights.expected_margin === undefined) return null;

  const data = [
    {
      confidence: prediction.insights.confidence * 100,
      margin: prediction.insights.expected_margin,
      player: prediction.probabilities.player_one > 0.5 ? prediction.player_one.name : prediction.player_two.name,
    },
  ];

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          Model Confidence vs Expected Margin
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.1)" />
            <XAxis
              type="number"
              dataKey="confidence"
              name="Confidence"
              domain={[50, 100]}
              tick={{ fill: "#1A1A1A" }}
              label={{ value: "Confidence %", position: "insideBottom", offset: -5, fill: "#1A1A1A" }}
            />
            <YAxis
              type="number"
              dataKey="margin"
              name="Expected Margin"
              tick={{ fill: "#1A1A1A" }}
              label={{ value: "Expected Games", angle: -90, position: "insideLeft", fill: "#1A1A1A" }}
            />
            <ReferenceLine x={70} stroke="rgba(0, 0, 0, 0.2)" strokeDasharray="2 2" />
            <ReferenceLine y={0} stroke="rgba(0, 0, 0, 0.2)" strokeDasharray="2 2" />
            <Tooltip
              contentStyle={{ 
                backgroundColor: "#1A1A1A", 
                border: "1px solid rgba(0, 102, 204, 0.3)",
                borderRadius: "6px",
                color: "#FFFFFF",
              }}
              cursor={{ strokeDasharray: "3 3", stroke: "#0066CC" }}
              formatter={(value: any, name: string) => {
                if (name === "confidence") return [`${Number(value).toFixed(1)}%`, "Confidence"];
                if (name === "margin") return [`${Number(value).toFixed(1)} games`, "Expected Margin"];
                return [value, name];
              }}
              labelFormatter={(label, payload) => {
                const data = payload?.[0]?.payload;
                return data ? `Predicted Winner: ${data.player}` : label;
              }}
            />
            <Scatter name="Prediction" data={data} fill="#0066CC">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="#0066CC" />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {prediction.insights.score_descriptor}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default ConfidenceMarginGraph;

