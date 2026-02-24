import { Box, Card, CardContent, Stack, Typography, Paper, Chip, List, ListItem, ListItemText } from "@mui/material";
import { PredictionResponse } from "../api/types";
import { useMemo } from "react";

interface Props {
  prediction: PredictionResponse | null;
}

const PredictionResultCard = ({ prediction }: Props) => {
  if (!prediction) {
    return (
      <Card
        elevation={0}
        sx={{
          background: "#FFFFFF",
          border: "1px solid #E3E8EF",
          borderRadius: "16px",
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 4, md: 5 }, textAlign: "center" }}>
          <Typography variant="h5" gutterBottom sx={{ color: "#0A2540", fontWeight: 600, mb: 2, fontSize: "1.25rem", letterSpacing: "-0.01em" }}>
            No Prediction Available
          </Typography>
          <Typography variant="body2" sx={{ color: "#425466", lineHeight: 1.5, fontSize: "0.875rem" }}>
            Select two players and click "Generate Prediction" to see the AI-powered forecast.
          </Typography>
        </CardContent>
      </Card>
    );
  }
  const { player_one, player_two, probabilities, insights } = prediction;

  // Determine predicted winner
  const predictedWinner = probabilities.player_one > probabilities.player_two ? player_one : player_two;
  const winnerProbability = probabilities.player_one > probabilities.player_two 
    ? probabilities.player_one 
    : probabilities.player_two;

  // Calculate betting odds from probabilities (odds = 1 / probability)
  const oddsOne = insights.betting_odds_player_one ?? (1 / Math.max(probabilities.player_one, 0.01));
  const oddsTwo = insights.betting_odds_player_two ?? (1 / Math.max(probabilities.player_two, 0.01));

  // Use gradient-based feature importance from backend (proper feature importance)
  const topFeatures = useMemo(() => {
    if (!prediction.features?.feature_importance || prediction.features.feature_importance.length === 0) {
      return [];
    }
    
    // Backend already provides top 20 features sorted by importance with categories
    const importanceList = prediction.features.feature_importance;
    
    // Normalize so percentages sum to 100% for display
    const totalImportance = importanceList.reduce((sum, f) => sum + f.importance, 0);
    if (totalImportance === 0) return [];
    
    // Group by category
    const groupedByCategory: { [key: string]: typeof importanceList } = {};
    importanceList.forEach(f => {
      const category = f.category || "Other";
      if (!groupedByCategory[category]) {
        groupedByCategory[category] = [];
      }
      groupedByCategory[category].push(f);
    });
    
    // Sort categories by their max importance
    const categoryOrder = Object.keys(groupedByCategory).sort((a, b) => {
      const maxA = Math.max(...groupedByCategory[a].map(f => f.importance));
      const maxB = Math.max(...groupedByCategory[b].map(f => f.importance));
      return maxB - maxA;
    });
    
    // Flatten back to list with category info, normalized so they sum to 100%
    return importanceList.map(f => ({
      feature: f.feature,
      displayName: f.display_name || f.feature,
      category: f.category || "Other",
      normalizedImportance: (f.importance / totalImportance) * 100,
      rawImportance: f.importance,
    }));
  }, [prediction.features]);
  
  // Group features by category for display
  const featuresByCategory = useMemo(() => {
    const grouped: { [key: string]: typeof topFeatures } = {};
    topFeatures.forEach(f => {
      if (!grouped[f.category]) {
        grouped[f.category] = [];
      }
      grouped[f.category].push(f);
    });
    return grouped;
  }, [topFeatures]);
  
  const categoryOrder = useMemo(() => {
    return Object.keys(featuresByCategory).sort((a, b) => {
      const maxA = Math.max(...featuresByCategory[a].map(f => f.normalizedImportance));
      const maxB = Math.max(...featuresByCategory[b].map(f => f.normalizedImportance));
      return maxB - maxA;
    });
  }, [featuresByCategory]);

  return (
        <Card
        elevation={0}
        sx={{
          background: "#FFFFFF",
          border: "3px solid #3D3D3D",
          borderRadius: 0,
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 4, md: 5 } }}>
          <Box mb={{ xs: 5, sm: 6, md: 7 }}>
            <Typography 
              variant="h2" 
              fontWeight={800}
              sx={{
                color: "#3D3D3D",
                letterSpacing: "-0.03em",
                fontSize: { xs: "2rem", sm: "2.5rem", md: "3rem" },
                lineHeight: 1.1,
              }}
            >
              Prediction Results
            </Typography>
          </Box>

          <Stack spacing={4}>
          {/* Match Prediction Card - Stripe/ATP style */}
          <Box
            sx={{
              border: "2px solid #3D3D3D",
              borderTop: "4px solid #3D3D3D",
            }}
          >
            {/* Header */}
            <Box
              sx={{
                backgroundColor: "#3D3D3D",
                px: { xs: 4, sm: 5 },
                py: { xs: 3, sm: 3.5 },
              }}
            >
              <Typography 
                variant="subtitle1" 
                sx={{ 
                  color: "#FFFFFF", 
                  fontWeight: 800, 
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  fontSize: { xs: "0.8125rem", sm: "0.875rem", md: "0.9375rem" },
                }}
              >
                Match Prediction
              </Typography>
            </Box>

            {/* Explanation */}
            <Box sx={{ px: { xs: 4, sm: 5 }, pt: 3, pb: 0 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: "#3D3D3D", 
                  fontSize: "0.875rem",
                  lineHeight: 1.6,
                  fontWeight: 500,
                }}
              >
                Frozen model, features as at selected date (no user-entered match history).
              </Typography>
            </Box>

            {/* Content */}
            <Box sx={{ p: { xs: 4, sm: 5 }, overflowX: "auto" }}>
              <Stack spacing={0}>
                {/* Player 1 Row */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    py: 4,
                    px: 0,
                    borderTop: "2px solid #3D3D3D",
                    minWidth: "fit-content",
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0, mr: { xs: 2, sm: 3, md: 4 }, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                    <Typography 
                      variant="h5" 
                      sx={{ 
                        fontWeight: probabilities.player_one > probabilities.player_two ? 800 : 600,
                        color: "#3D3D3D",
                        mb: probabilities.player_one > probabilities.player_two ? 1.5 : 0,
                        fontSize: { xs: "1.25rem", sm: "1.375rem", md: "1.5rem" },
                        letterSpacing: "-0.02em",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        width: "100%",
                      }}
                    >
                      {player_one.name}
                    </Typography>
                    {probabilities.player_one > probabilities.player_two && (
                      <Chip
                        label="Predicted Winner"
                        size="medium"
                        sx={{
                          backgroundColor: "#3D3D3D",
                          color: "#FFFFFF",
                          fontWeight: 700,
                          fontSize: "0.8125rem",
                          height: 28,
                          borderRadius: 0,
                          "& .MuiChip-label": {
                            px: 2,
                            whiteSpace: "nowrap",
                          },
                        }}
                      />
                    )}
                  </Box>
                  <Box sx={{ textAlign: "right", minWidth: { xs: 72, sm: 100, md: 120 }, flexShrink: 0 }}>
                    <Typography 
                      variant="h2" 
                      sx={{ 
                        fontWeight: 800,
                        color: "#3D3D3D",
                        lineHeight: 1,
                        mb: 0.75,
                        fontSize: { xs: "2rem", sm: "2.5rem", md: "3rem" },
                        letterSpacing: "-0.03em",
                      }}
                    >
                      {(probabilities.player_one * 100).toFixed(1)}%
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: "#3D3D3D",
                        fontWeight: 600,
                        fontSize: "0.8125rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      Win Probability
                    </Typography>
                  </Box>
                </Box>

                {/* Player 2 Row */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    py: 4,
                    px: 0,
                    borderTop: "2px solid #3D3D3D",
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0, mr: { xs: 2, sm: 3, md: 4 }, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                    <Typography 
                      variant="h5" 
                      sx={{ 
                        fontWeight: probabilities.player_two > probabilities.player_one ? 800 : 600,
                        color: "#3D3D3D",
                        mb: probabilities.player_two > probabilities.player_one ? 1.5 : 0,
                        fontSize: { xs: "1.25rem", sm: "1.375rem", md: "1.5rem" },
                        letterSpacing: "-0.02em",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        width: "100%",
                      }}
                    >
                      {player_two.name}
                    </Typography>
                    {probabilities.player_two > probabilities.player_one && (
                      <Chip
                        label="Predicted Winner"
                        size="medium"
                        sx={{
                          backgroundColor: "#3D3D3D",
                          color: "#FFFFFF",
                          fontWeight: 700,
                          fontSize: "0.8125rem",
                          height: 28,
                          borderRadius: 0,
                          "& .MuiChip-label": {
                            px: 2,
                            whiteSpace: "nowrap",
                          },
                        }}
                      />
                    )}
                  </Box>
                  <Box sx={{ textAlign: "right", minWidth: { xs: 72, sm: 100, md: 120 }, flexShrink: 0 }}>
                    <Typography 
                      variant="h2" 
                      sx={{ 
                        fontWeight: 800,
                        color: "#3D3D3D",
                        lineHeight: 1,
                        mb: 0.75,
                        fontSize: { xs: "2rem", sm: "2.5rem", md: "3rem" },
                        letterSpacing: "-0.03em",
                      }}
                    >
                      {(probabilities.player_two * 100).toFixed(1)}%
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: "#3D3D3D",
                        fontWeight: 600,
                        fontSize: "0.8125rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      Win Probability
                    </Typography>
                  </Box>
                </Box>
              </Stack>
            </Box>
          </Box>
          
          {/* Model Update Date */}
          <Box sx={{ textAlign: "center", mt: -2, mb: 2 }}>
            <Typography 
              variant="caption" 
              sx={{ 
                color: "#6B7280",
                fontSize: "0.75rem",
                fontStyle: "italic",
              }}
            >
              One model: train 1990–2022, 2023 frozen; no retraining after 2023.
            </Typography>
          </Box>
          
          {/* Betting Odds */}
          <Box
            sx={{
              p: 5,
              border: "2px solid #3D3D3D",
              borderTop: "3px solid #3D3D3D",
            }}
          >
            <Typography 
              variant="subtitle2" 
              fontWeight={700} 
              gutterBottom 
              sx={{ 
                mb: 3,
                color: "#5A9BD5",
                fontSize: "0.875rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Model Estimated Odds
            </Typography>
            <Stack 
              direction={{ xs: "column", sm: "row" }} 
              spacing={4} 
              alignItems="center" 
              justifyContent="center"
            >
              <Box sx={{ textAlign: "center", flex: 1, maxWidth: 200 }}>
                <Typography 
                  variant="body1" 
                  display="block" 
                  gutterBottom 
                  sx={{ 
                    fontWeight: 600,
                    color: "#3D3D3D",
                    mb: 3,
                    fontSize: "1rem",
                  }}
                >
                  {player_one.name}
                </Typography>
                <Typography 
                  variant="h2" 
                  fontWeight={800} 
                  sx={{
                    color: "#3D3D3D",
                    fontSize: { xs: "2.5rem", md: "3.5rem" },
                    letterSpacing: "-0.03em",
                  }}
                >
                  {oddsOne.toFixed(2)}x
                </Typography>
              </Box>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 700,
                  color: "#3D3D3D",
                  fontSize: "1rem",
                }}
              >
                vs
              </Typography>
              <Box sx={{ textAlign: "center", flex: 1, maxWidth: 200 }}>
                <Typography 
                  variant="body1" 
                  display="block" 
                  gutterBottom 
                  sx={{ 
                    fontWeight: 600,
                    color: "#3D3D3D",
                    mb: 3,
                    fontSize: "1rem",
                  }}
                >
                  {player_two.name}
                </Typography>
                <Typography 
                  variant="h2" 
                  fontWeight={800} 
                  sx={{
                    color: "#3D3D3D",
                    fontSize: { xs: "2.5rem", md: "3.5rem" },
                    letterSpacing: "-0.03em",
                  }}
                >
                  {oddsTwo.toFixed(2)}x
                </Typography>
              </Box>
            </Stack>
          </Box>
          
          {/* Top 20 Feature Importance */}
          {topFeatures.length > 0 && (
            <Box 
              sx={{ 
                p: { xs: 3, sm: 4, md: 5 }, 
                border: "2px solid #3D3D3D",
                borderTop: "3px solid #3D3D3D",
              }}
            >
              <Typography 
                variant="subtitle1" 
                fontWeight={800} 
                gutterBottom 
                sx={{ 
                  mb: 3,
                  color: "#3D3D3D",
                  fontSize: "0.875rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                Model Decision Factors
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  mb: 4,
                  color: "#425466",
                  lineHeight: 1.6,
                  fontSize: "0.875rem",
                  fontWeight: 400,
                }}
              >
                Feature importance calculated using gradient-based methods (similar to SHAP values), measuring each feature's 
                contribution to the prediction. Temporal sequence features from the player's recent match history have been 
                aggregated and grouped by category for clearer interpretation. Percentages represent relative contribution 
                to the model's decision.
              </Typography>
              
              {categoryOrder.map((category) => {
                const categoryFeatures = featuresByCategory[category];
                
                return (
                  <Box key={category} sx={{ mb: 4 }}>
                    <Typography 
                      variant="body1" 
                      fontWeight={800}
                      sx={{ 
                        mb: 3,
                        color: "#3D3D3D",
                        fontSize: "0.875rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                      }}
                    >
                      {category}
                    </Typography>
                    <List dense sx={{ py: 0 }}>
                      {categoryFeatures.map((item, idx) => {
                        return (
                          <ListItem key={idx} sx={{ px: 0, py: 1.5 }}>
                            <Box
                              sx={{
                                width: "4px",
                                height: "4px",
                                borderRadius: "50%",
                                background: "#0A2540",
                                mr: 2,
                                mt: 0.5,
                                flexShrink: 0,
                              }}
                            />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                                <Typography 
                                  variant="body1" 
                                  sx={{ 
                                    fontWeight: 700,
                                    color: "#3D3D3D",
                                    fontSize: "0.9375rem",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {item.displayName}
                                </Typography>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    color: "#3D3D3D",
                                    fontSize: "0.875rem",
                                    fontWeight: 700,
                                    ml: 2,
                                  }}
                                >
                                  {item.normalizedImportance.toFixed(1)}%
                                </Typography>
                              </Box>
                              <Box
                                sx={{
                                  width: "100%",
                                  height: "3px",
                                  backgroundColor: "#E3E8EF",
                                  overflow: "hidden",
                                }}
                              >
                                <Box
                                  sx={{
                                    width: `${item.normalizedImportance}%`,
                                    height: "100%",
                                    backgroundColor: "#3D3D3D",
                                    transition: "width 0.3s ease",
                                  }}
                                />
                              </Box>
                            </Box>
                          </ListItem>
                        );
                      })}
                    </List>
                  </Box>
                );
              })}
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default PredictionResultCard;
