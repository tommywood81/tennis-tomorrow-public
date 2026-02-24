import { Card, CardContent, Typography, Box, Grid } from "@mui/material";
import { ModelStatsResponse } from "../api/types";

interface Props {
  stats: ModelStatsResponse;
}

const ConfusionMatrixChart = ({ stats }: Props) => {
  const { true_positive, true_negative, false_positive, false_negative } =
    stats.confusion_matrix;

  const total = true_positive + true_negative + false_positive + false_negative;

  // Check if data is available
  const hasData = total > 0;

  // Calculate metrics
  // Use accuracy from API (match-level from full_validation) instead of calculating from confusion matrix
  // Frozen model: ~70% accuracy on 2024–2025 test
  const accuracy = stats.accuracy || (total > 0 ? (true_positive + true_negative) / total : 0);
  const precision =
    true_positive + false_positive > 0
      ? true_positive / (true_positive + false_positive)
      : 0;
  const recall =
    true_positive + false_negative > 0
      ? true_positive / (true_positive + false_negative)
      : 0;
  const specificity =
    true_negative + false_positive > 0
      ? true_negative / (true_negative + false_positive)
      : 0;

  const cellStyle = (value: number, isDiagonal: boolean) => ({
    padding: "20px 16px",
    textAlign: "center" as const,
    backgroundColor: isDiagonal ? "rgba(0, 102, 204, 0.15)" : "rgba(0, 0, 0, 0.05)",
    border: isDiagonal ? "2px solid #0066CC" : "1px solid rgba(0, 0, 0, 0.15)",
    borderRadius: "8px",
    transition: "all 0.2s ease",
  });

  const valueStyle = {
    fontSize: "1.75rem", // 28px
    fontWeight: 800 as const,
    color: "#1A1A1A",
    lineHeight: 1.2,
  };

  const labelStyle = {
    fontSize: "0.6875rem", // 11px
    color: "#1A1A1A",
    marginTop: "8px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  };

  const percentageStyle = {
    fontSize: "0.8125rem", // 13px
    color: "#666",
    marginTop: "6px",
    fontWeight: 500,
  };

  return (
    <Card>
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h5" fontWeight={800} gutterBottom sx={{ mb: 1 }}>
          2. Confusion Matrix
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 4, maxWidth: "900px", lineHeight: 1.7 }}>
          Prediction outcomes on 2025 test set. Each match counted once after averaging dual-perspective predictions.
        </Typography>

        {!hasData ? (
          <Box mt={3}>
            <Typography variant="body2" color="text.secondary">
              Confusion matrix data is not yet computed. This requires per-match
              predictions with actual outcomes to be calculated during model evaluation.
            </Typography>
          </Box>
        ) : (
          <>
            <Grid container spacing={4} mt={1}>
              {/* Confusion Matrix Table */}
              <Grid item xs={12} md={6}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ mb: 3, color: "#1A1A1A" }}>
                    Confusion Matrix
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr", gap: 2 }}>
                    {/* Header row */}
                    <Box></Box>
                    <Box sx={{ textAlign: "center" }}>
                      <Typography variant="overline" sx={{ color: "#1A1A1A", fontWeight: 700 }}>
                        Predicted: Win
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: "center" }}>
                      <Typography variant="overline" sx={{ color: "#1A1A1A", fontWeight: 700 }}>
                        Predicted: Loss
                      </Typography>
                    </Box>

                    {/* Actual: Win row */}
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", pr: 2 }}>
                      <Typography variant="overline" sx={{ color: "#1A1A1A", fontWeight: 700 }}>
                        Actual: Win
                      </Typography>
                    </Box>
                    <Box>
                      <Box sx={cellStyle(true_positive, true)}>
                        <Box sx={valueStyle}>{true_positive}</Box>
                        <Box sx={labelStyle}>True Positive</Box>
                        <Box sx={percentageStyle}>
                          {total > 0
                            ? ((true_positive / total) * 100).toFixed(1)
                            : 0}
                          %
                        </Box>
                      </Box>
                    </Box>
                    <Box>
                      <Box sx={cellStyle(false_negative, false)}>
                        <Box sx={valueStyle}>{false_negative}</Box>
                        <Box sx={labelStyle}>False Negative</Box>
                        <Box sx={percentageStyle}>
                          {total > 0
                            ? ((false_negative / total) * 100).toFixed(1)
                            : 0}
                          %
                        </Box>
                      </Box>
                    </Box>

                    {/* Actual: Loss row */}
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", pr: 2 }}>
                      <Typography variant="overline" sx={{ color: "#1A1A1A", fontWeight: 700 }}>
                        Actual: Loss
                      </Typography>
                    </Box>
                    <Box>
                      <Box sx={cellStyle(false_positive, false)}>
                        <Box sx={valueStyle}>{false_positive}</Box>
                        <Box sx={labelStyle}>False Positive</Box>
                        <Box sx={percentageStyle}>
                          {total > 0
                            ? ((false_positive / total) * 100).toFixed(1)
                            : 0}
                          %
                        </Box>
                      </Box>
                    </Box>
                    <Box>
                      <Box sx={cellStyle(true_negative, true)}>
                        <Box sx={valueStyle}>{true_negative}</Box>
                        <Box sx={labelStyle}>True Negative</Box>
                        <Box sx={percentageStyle}>
                          {total > 0
                            ? ((true_negative / total) * 100).toFixed(1)
                            : 0}
                          %
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Grid>

              {/* Metrics */}
              <Grid item xs={12} md={6}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ mb: 3, color: "#1A1A1A" }}>
                    Derived Metrics
                  </Typography>
                  <Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Box
                          sx={{
                            p: 3,
                            backgroundColor: "rgba(0, 102, 204, 0.15)",
                            borderRadius: "8px",
                            textAlign: "center",
                            border: "2px solid #0066CC",
                          }}
                        >
                          <Typography variant="h4" fontWeight={800} sx={{ color: "#1A1A1A" }}>
                            {(accuracy * 100).toFixed(2)}%
                          </Typography>
                          <Typography variant="subtitle2" sx={{ color: "#1A1A1A", fontWeight: 700, mt: 0.5 }}>
                            Accuracy
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#666", mt: 1, display: "block" }}>
                            (TP + TN) / Total
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#666", mt: 0.5, fontStyle: "italic", display: "block" }}>
                            (2025 test set)
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12}>
                        <Box
                          sx={{
                            p: 2.5,
                            backgroundColor: "rgba(0, 0, 0, 0.03)",
                            borderRadius: "8px",
                            textAlign: "center",
                            border: "1px solid rgba(0, 0, 0, 0.15)",
                          }}
                        >
                          <Typography variant="h5" fontWeight={800} sx={{ color: "#1A1A1A" }}>
                            {total.toLocaleString()}
                          </Typography>
                          <Typography variant="subtitle2" sx={{ color: "#1A1A1A", fontWeight: 600, mt: 0.5 }}>
                            Total Matches
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#666", mt: 0.5 }}>
                            (averaged predictions)
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box
                          sx={{
                            p: 2,
                            backgroundColor: "rgba(0, 0, 0, 0.03)",
                            borderRadius: "8px",
                            textAlign: "center",
                            border: "1px solid rgba(0, 0, 0, 0.15)",
                          }}
                        >
                          <Typography variant="h6" fontWeight={800} sx={{ color: "#1A1A1A" }}>
                            {(precision * 100).toFixed(1)}%
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#1A1A1A", fontWeight: 600, display: "block", mt: 0.5 }}>
                            Precision
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#666", mt: 0.5 }}>
                            TP / (TP + FP)
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box
                          sx={{
                            p: 2,
                            backgroundColor: "rgba(0, 0, 0, 0.03)",
                            borderRadius: "8px",
                            textAlign: "center",
                            border: "1px solid rgba(0, 0, 0, 0.15)",
                          }}
                        >
                          <Typography variant="h6" fontWeight={800} sx={{ color: "#1A1A1A" }}>
                            {(recall * 100).toFixed(1)}%
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#1A1A1A", fontWeight: 600, display: "block", mt: 0.5 }}>
                            Recall
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#666", mt: 0.5 }}>
                            TP / (TP + FN)
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box
                          sx={{
                            p: 2,
                            backgroundColor: "rgba(0, 0, 0, 0.03)",
                            borderRadius: "8px",
                            textAlign: "center",
                            border: "1px solid rgba(0, 0, 0, 0.15)",
                          }}
                        >
                          <Typography variant="h6" fontWeight={800} sx={{ color: "#1A1A1A" }}>
                            {(specificity * 100).toFixed(1)}%
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#1A1A1A", fontWeight: 600, display: "block", mt: 0.5 }}>
                            Specificity
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#666", mt: 0.5 }}>
                            TN / (TN + FP)
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                </Box>
              </Grid>
            </Grid>

            <Box mt={4} sx={{ 
              p: 2.5, 
              backgroundColor: "rgba(0, 0, 0, 0.03)", 
              borderRadius: "8px",
              border: "1px solid rgba(0, 0, 0, 0.1)",
            }}>
              <Typography variant="body2" sx={{ color: "#1A1A1A", lineHeight: 1.7 }}>
                <strong style={{ color: "#1A1A1A" }}>Interpretation:</strong> Blue cells (diagonal) represent
                correct predictions. Gray cells (off-diagonal) represent errors. This
                helps identify if the model tends to predict favourites too often
                (high FP) or misses underdog wins (high FN).
              </Typography>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ConfusionMatrixChart;

