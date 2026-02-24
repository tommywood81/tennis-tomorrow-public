import { Card, CardContent, Typography } from "@mui/material";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { DetailedFeaturesResponse } from "../api/types";

interface Props {
  playerOneName: string;
  playerTwoName: string;
  playerOneFeatures?: DetailedFeaturesResponse | null;
  playerTwoFeatures?: DetailedFeaturesResponse | null;
}

const MultiFeatureRadarChart = ({
  playerOneName,
  playerTwoName,
  playerOneFeatures,
  playerTwoFeatures,
}: Props) => {
  if (!playerOneFeatures || !playerTwoFeatures) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Multi-Feature Comparison
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Select players to view feature comparison
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const p1Static = playerOneFeatures.static_features;
  const p2Static = playerTwoFeatures.static_features;

  // Normalize values to 0-1 range for radar chart (using min-max normalization)
  const normalizeValue = (value: number, min: number, max: number): number => {
    if (max === min) return 0.5;
    return (value - min) / (max - min);
  };

  // Define feature groups with their ranges for normalization
  const featureGroups = [
    {
      name: "Rank Norm",
      p1Key: "player_rank_norm",
      p2Key: "player_rank_norm",
      min: 0,
      max: 1,
      invert: false, // Higher is better (lower rank = higher norm)
    },
    {
      name: "Career Win %",
      p1Key: "career_win_pct",
      p2Key: "career_win_pct",
      min: 0,
      max: 1,
      invert: false,
    },
    {
      name: "Recent Serve",
      p1Key: "recent_weighted_serve",
      p2Key: "recent_weighted_serve",
      min: 0,
      max: 1,
      invert: false,
    },
    {
      name: "Recent Return",
      p1Key: "recent_weighted_return",
      p2Key: "recent_weighted_return",
      min: 0,
      max: 1,
      invert: false,
    },
    {
      name: "Recent Win %",
      p1Key: "recent_weighted_win_pct",
      p2Key: "recent_weighted_win_pct",
      min: 0,
      max: 1,
      invert: false,
    },
    {
      name: "Serve Slope",
      p1Key: "serve_slope_last3",
      p2Key: "serve_slope_last3",
      min: -0.2,
      max: 0.2,
      invert: false, // Positive = improving
    },
    {
      name: "Return Slope",
      p1Key: "return_slope_last3",
      p2Key: "return_slope_last3",
      min: -0.2,
      max: 0.2,
      invert: false,
    },
    {
      name: "H2H Win %",
      p1Key: "h2h_total_wins",
      p2Key: "h2h_total_wins",
      min: 0,
      max: Math.max(
        p1Static.h2h_total_matches || 1,
        p2Static.h2h_total_matches || 1,
        1
      ),
      invert: false,
      normalizeBy: (p1Static.h2h_total_matches || 1) > 0 ? p1Static.h2h_total_matches : 1,
      normalizeBy2: (p2Static.h2h_total_matches || 1) > 0 ? p2Static.h2h_total_matches : 1,
    },
    {
      name: "Streak",
      p1Key: "streak",
      p2Key: "streak",
      min: -10,
      max: 10,
      invert: false,
    },
  ];

  const data = featureGroups.map((group) => {
    let p1Value = p1Static[group.p1Key] ?? 0;
    let p2Value = p2Static[group.p2Key] ?? 0;

    // Special handling for H2H win percentage
    if (group.name === "H2H Win %") {
      const p1Total = p1Static.h2h_total_matches || 1;
      const p2Total = p2Static.h2h_total_matches || 1;
      p1Value = p1Total > 0 ? p1Value / p1Total : 0;
      p2Value = p2Total > 0 ? p2Value / p2Total : 0;
    }

    // Normalize to 0-1 range
    let p1Normalized = normalizeValue(p1Value, group.min, group.max);
    let p2Normalized = normalizeValue(p2Value, group.min, group.max);

    // Invert if needed
    if (group.invert) {
      p1Normalized = 1 - p1Normalized;
      p2Normalized = 1 - p2Normalized;
    }

    // Clamp to 0-1
    p1Normalized = Math.max(0, Math.min(1, p1Normalized));
    p2Normalized = Math.max(0, Math.min(1, p2Normalized));

    return {
      feature: group.name,
      [playerOneName]: p1Normalized,
      [playerTwoName]: p2Normalized,
      // Store raw values for tooltip
      [`${playerOneName}_raw`]: p1Value,
      [`${playerTwoName}_raw`]: p2Value,
    };
  });

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Multi-Feature Comparison
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Radar chart comparing key features (normalized 0-1 scale)
        </Typography>
        <ResponsiveContainer width="100%" height={500}>
          <RadarChart data={data} margin={{ top: 20, right: 80, bottom: 20, left: 80 }}>
            <PolarGrid />
            <PolarAngleAxis dataKey="feature" tick={{ fontSize: 12 }} />
            <PolarRadiusAxis angle={90} domain={[0, 1]} tick={{ fontSize: 10 }} />
            <Radar
              name={playerOneName}
              dataKey={playerOneName}
              stroke="#00bcd4"
              fill="#00bcd4"
              fillOpacity={0.6}
              strokeWidth={2}
            />
            <Radar
              name={playerTwoName}
              dataKey={playerTwoName}
              stroke="#ff6b6b"
              fill="#ff6b6b"
              fillOpacity={0.6}
              strokeWidth={2}
            />
            <Legend />
            <Tooltip
              formatter={(value: number, name: string, props: any) => {
                const rawKey = `${name}_raw`;
                const rawValue = props.payload[rawKey];
                return [
                  `${(value * 100).toFixed(1)}% (raw: ${typeof rawValue === "number" ? rawValue.toFixed(3) : rawValue})`,
                  name,
                ];
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default MultiFeatureRadarChart;

