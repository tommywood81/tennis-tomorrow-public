import { Card, CardContent, Typography, Box } from "@mui/material";
import {
  ResponsiveContainer,
  Cell,
} from "recharts";
import { DetailedFeaturesResponse } from "../api/types";

interface Props {
  playerOneName: string;
  playerTwoName: string;
  playerOneFeatures?: DetailedFeaturesResponse | null;
  playerTwoFeatures?: DetailedFeaturesResponse | null;
}

const FeatureCorrelationHeatmap = ({
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
            Feature Correlation Heatmap
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Select players to view feature correlations
          </Typography>
        </CardContent>
      </Card>
    );
  }

  // Get static feature names and values
  const featureNames = Object.keys(playerOneFeatures.static_features || {});
  const p1Features = playerOneFeatures.static_features;
  const p2Features = playerTwoFeatures.static_features;

  // Calculate correlation matrix
  // For this visualization, we'll show correlation between features across both players
  // We'll create a dataset with both players' features and calculate Pearson correlation
  const calculateCorrelation = (x: number[], y: number[]): number => {
    if (x.length !== y.length) return 0;
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return 0;
    return numerator / denominator;
  };

  // Build correlation matrix
  const correlationMatrix: number[][] = [];
  const featureLabels: string[] = featureNames.map((name: string) => {
    // Make labels more readable
    return name
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l: string) => l.toUpperCase())
      .replace(/Pct/g, "%")
      .replace(/Norm/g, "Norm")
      .replace(/H2h/g, "H2H")
      .replace(/Prev/g, "Prev");
  });

  for (let i = 0; i < featureNames.length; i++) {
    correlationMatrix[i] = [];
    for (let j = 0; j < featureNames.length; j++) {
      if (i === j) {
        correlationMatrix[i][j] = 1.0; // Perfect correlation with itself
      } else {
        // Use both players' values to calculate correlation
        const featureI = [
          p1Features[featureNames[i]] ?? 0,
          p2Features[featureNames[i]] ?? 0,
        ];
        const featureJ = [
          p1Features[featureNames[j]] ?? 0,
          p2Features[featureNames[j]] ?? 0,
        ];
        correlationMatrix[i][j] = calculateCorrelation(featureI, featureJ);
      }
    }
  }

  // Color scale for correlation values
  const getColor = (value: number): string => {
    // Red for negative, white for zero, black for positive
    if (value < 0) {
      const intensity = Math.min(1, Math.abs(value));
      return `rgb(${255}, ${255 - intensity * 200}, ${255 - intensity * 200})`;
    } else if (value > 0) {
      const intensity = Math.min(1, value);
      return `rgb(${255 - intensity * 200}, ${255 - intensity * 200}, ${255})`;
    }
    return "rgb(255, 255, 255)";
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Feature Correlation Heatmap
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Correlation between static features (computed from both players' values)
        </Typography>
        <Box sx={{ overflowX: "auto", overflowY: "auto", maxHeight: "600px" }}>
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              fontSize: "0.75rem",
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    position: "sticky",
                    left: 0,
                    backgroundColor: "#fff",
                    zIndex: 10,
                    padding: "8px",
                    textAlign: "left",
                    border: "1px solid #ddd",
                    minWidth: "150px",
                  }}
                >
                  Feature
                </th>
                {featureLabels.map((label, idx) => (
                  <th
                    key={idx}
                    style={{
                      padding: "8px",
                      textAlign: "center",
                      border: "1px solid #ddd",
                      minWidth: "80px",
                      fontSize: "0.75rem",
                      writingMode: "vertical-rl",
                      textOrientation: "mixed",
                    }}
                    title={label}
                  >
                    {label.length > 15 ? label.substring(0, 15) + "..." : label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {featureLabels.map((label, i) => (
                <tr key={i}>
                  <td
                    style={{
                      position: "sticky",
                      left: 0,
                      backgroundColor: "#fff",
                      zIndex: 9,
                      padding: "8px",
                      border: "1px solid #ddd",
                      fontWeight: "bold",
                      fontSize: "0.75rem",
                    }}
                    title={label}
                  >
                    {label.length > 20 ? label.substring(0, 20) + "..." : label}
                  </td>
                  {correlationMatrix[i].map((corr, j) => (
                    <td
                      key={j}
                      style={{
                        backgroundColor: getColor(corr),
                        padding: "8px",
                        textAlign: "center",
                        border: "1px solid #ddd",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                      }}
                      title={`${featureLabels[i]} vs ${featureLabels[j]}: ${corr.toFixed(3)}`}
                    >
                      {corr.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
        <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                width: "20px",
                height: "20px",
                backgroundColor: "rgb(55, 55, 255)",
                border: "1px solid #ddd",
              }}
            />
            <Typography variant="caption">Strong Positive</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                width: "20px",
                height: "20px",
                backgroundColor: "rgb(255, 255, 255)",
                border: "1px solid #ddd",
              }}
            />
            <Typography variant="caption">No Correlation</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                width: "20px",
                height: "20px",
                backgroundColor: "rgb(255, 55, 55)",
                border: "1px solid #ddd",
              }}
            />
            <Typography variant="caption">Strong Negative</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default FeatureCorrelationHeatmap;

