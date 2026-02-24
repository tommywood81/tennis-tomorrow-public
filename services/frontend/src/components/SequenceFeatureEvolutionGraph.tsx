import { Card, CardContent, Typography, Box, ToggleButton, ToggleButtonGroup } from "@mui/material";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useState } from "react";
import { DetailedFeaturesResponse } from "../api/types";

interface Props {
  playerOneName: string;
  playerTwoName: string;
  playerOneFeatures?: DetailedFeaturesResponse | null;
  playerTwoFeatures?: DetailedFeaturesResponse | null;
}

const SequenceFeatureEvolutionGraph = ({
  playerOneName,
  playerTwoName,
  playerOneFeatures,
  playerTwoFeatures,
}: Props) => {
  const [selectedFeature, setSelectedFeature] = useState<string>("serve_pct_weighted");

  if (!playerOneFeatures || !playerTwoFeatures) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Sequence Feature Evolution
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Select players to view feature evolution over last 10 matches
          </Typography>
        </CardContent>
      </Card>
    );
  }

  // Key features to visualize (numeric features that evolve over time)
  const availableFeatures = [
    { key: "serve_pct_weighted", label: "Serve % (Weighted)" },
    { key: "return_pct_weighted", label: "Return % (Weighted)" },
    { key: "opp_rank_norm_weighted", label: "Opponent Rank Norm (Weighted)" },
    { key: "opp_strength_weighted", label: "Opponent Strength (Weighted)" },
    { key: "days_since_prev_weighted", label: "Days Since Prev (Weighted)" },
    { key: "decay_weight", label: "Decay Weight" },
  ];

  // Build data array - reverse to show most recent matches first
  // sequence_features is a dict, so we need to extract arrays for the selected feature
  const p1Historical = playerOneFeatures.historical_matches.slice().reverse();
  const p2Historical = playerTwoFeatures.historical_matches.slice().reverse();
  
  // Get sequence feature arrays for the selected feature
  const p1FeatureArray = playerOneFeatures.sequence_features[selectedFeature] || [];
  const p2FeatureArray = playerTwoFeatures.sequence_features[selectedFeature] || [];
  
  // Reverse to show most recent first
  const p1Sequence = p1FeatureArray.slice().reverse();
  const p2Sequence = p2FeatureArray.slice().reverse();

  const maxLength = Math.max(p1Sequence.length, p2Sequence.length);

  const data = Array.from({ length: maxLength }, (_, idx) => {
    const p1Match = p1Historical[idx];
    const p2Match = p2Historical[idx];
    const p1Seq = p1Sequence[idx];
    const p2Seq = p2Sequence[idx];

    // Create match labels
    const p1Label = p1Match
      ? `M${idx + 1}: ${p1Match.opponent}${p1Match.won ? " (W)" : " (L)"}`
      : `M${idx + 1}`;
    const p2Label = p2Match
      ? `M${idx + 1}: ${p2Match.opponent}${p2Match.won ? " (W)" : " (L)"}`
      : `M${idx + 1}`;

    return {
      match: `M${idx + 1}`,
      p1Label,
      p2Label,
      [`${playerOneName}`]: p1Seq ?? null,
      [`${playerTwoName}`]: p2Seq ?? null,
    };
  });

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Sequence Feature Evolution
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Track how key sequence features evolve over the last 10 matches
        </Typography>

        <Box sx={{ mb: 2 }}>
          <ToggleButtonGroup
            value={selectedFeature}
            exclusive
            onChange={(_, value) => value && setSelectedFeature(value)}
            size="small"
            sx={{ flexWrap: "wrap", gap: 1 }}
          >
            {availableFeatures.map((feat) => (
              <ToggleButton key={feat.key} value={feat.key}>
                {feat.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="match"
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              label={{ value: availableFeatures.find((f) => f.key === selectedFeature)?.label || "Value", angle: -90, position: "insideLeft" }}
            />
            <Tooltip
              formatter={(value: any) => {
                if (value === null || value === undefined) return "N/A";
                return typeof value === "number" ? value.toFixed(3) : value;
              }}
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) {
                  const p1Label = payload[0].payload.p1Label;
                  const p2Label = payload[0].payload.p2Label;
                  return (
                    <div>
                      <div>{label}</div>
                      <div style={{ fontSize: "0.85em", color: "#888" }}>{p1Label}</div>
                      <div style={{ fontSize: "0.85em", color: "#888" }}>{p2Label}</div>
                    </div>
                  );
                }
                return label;
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey={playerOneName}
              stroke="#00bcd4"
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey={playerTwoName}
              stroke="#ff6b6b"
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default SequenceFeatureEvolutionGraph;

