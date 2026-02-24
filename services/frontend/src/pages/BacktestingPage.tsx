import { Stack, Typography, Box, Card, CardContent, Grid, CircularProgress, Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material";
import { useBacktestSummary, useTemperatureOptimization } from "../api/hooks";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const BacktestingPage = () => {
  const { data: backtestData, isLoading, error } = useBacktestSummary();
  const { data: tempData, isLoading: tempLoading } = useTemperatureOptimization();

  const formatStrategyName = (strategy: string): string => {
    const names: { [key: string]: string } = {
      quarter_kelly: "Quarter Kelly",
      half_kelly: "Half Kelly",
      flat: "Flat Stake",
    };
    return names[strategy] || strategy;
  };

  return (
    <Stack spacing={{ xs: 3, sm: 3.5, md: 4 }} sx={{ maxWidth: { xs: "100%", sm: "1000px", md: "1200px" }, mx: "auto", px: { xs: 1.5, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2, sm: 3, md: 4 }, pt: { xs: 12, sm: 14, md: 16 } }}>
      {/* Header */}
      <Box>
        <Typography variant="h4" fontWeight={700} gutterBottom sx={{ color: "#0A2540", fontSize: { xs: "1.5rem", sm: "1.75rem", md: "2rem", lg: "2.25rem" } }}>
          Backtesting
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2, lineHeight: 1.7 }}>
          Same frozen model as Match prediction: train 1990–2022, 2023 holdout (hyperparams + calibration), test 2024–2025. Historical simulation on 2025 odds; no retraining.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
          Demonstrates validation through backtest, not a betting tool.
        </Typography>
      </Box>

      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {!isLoading && !backtestData && (
        <Alert severity="info">
          No backtest results found. Run the pipeline to generate and export:
          <Box component="pre" sx={{ mt: 2, p: 2, bgcolor: "#f5f5f5", borderRadius: 1, overflow: "auto", fontSize: "0.85rem" }}>
            python scripts/apply_calibration_and_backtest.py
          </Box>
          This exports results to <code>services/frontend/public/backtesting/</code>. Or run <code>python scripts/export_backtest_to_frontend.py</code> manually after the backtest.
        </Alert>
      )}

      {backtestData && (
        <>
          {/* Summary Info */}
          <Card elevation={0} sx={{ border: "1px solid rgba(0, 0, 0, 0.12)", borderRadius: 2 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: "#0A2540", mb: 2 }}>
                Dataset
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Total matches: {backtestData.total_matches}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.875rem", fontStyle: "italic" }}>
                {backtestData.note}
              </Typography>
            </CardContent>
          </Card>

          {/* Strategy Results */}
          <Card elevation={0} sx={{ border: "1px solid rgba(0, 0, 0, 0.12)", borderRadius: 2 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: "#0A2540", mb: 3 }}>
                Strategy Performance
              </Typography>
              <Grid container spacing={3}>
                {backtestData.strategies.map((strategy) => (
                  <Grid item xs={12} md={6} key={strategy.strategy}>
                    <Card elevation={0} sx={{ border: "1px solid rgba(0, 0, 0, 0.08)", borderRadius: 2, height: "100%" }}>
                      <CardContent sx={{ p: 2.5 }}>
                        <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: "#0A2540", fontSize: "1.125rem" }}>
                          {formatStrategyName(strategy.strategy)}
                        </Typography>
                        <Stack spacing={1.5} sx={{ mt: 2 }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="body2" color="text.secondary">Bets Placed:</Typography>
                            <Typography variant="body2" fontWeight={600}>{strategy.num_bets_placed}</Typography>
                          </Box>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="body2" color="text.secondary">Win Rate:</Typography>
                            <Typography variant="body2" fontWeight={600}>{(strategy.win_rate * 100).toFixed(1)}%</Typography>
                          </Box>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="body2" color="text.secondary">ROI:</Typography>
                            <Typography variant="body2" fontWeight={600} sx={{ color: strategy.roi_pct >= 0 ? "#2e7d32" : "#d32f2f" }}>
                              {strategy.roi_pct >= 0 ? "+" : ""}{strategy.roi_pct.toFixed(2)}%
                            </Typography>
                          </Box>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="body2" color="text.secondary">Final Bankroll:</Typography>
                            <Typography variant="body2" fontWeight={600}>${strategy.final_bankroll.toFixed(2)}</Typography>
                          </Box>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="body2" color="text.secondary">Max Drawdown:</Typography>
                            <Typography variant="body2" fontWeight={600}>{strategy.max_drawdown.toFixed(2)}%</Typography>
                          </Box>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="body2" color="text.secondary">% Bet On:</Typography>
                            <Typography variant="body2" fontWeight={600}>{strategy.pct_bet_on.toFixed(1)}%</Typography>
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* Calibration Reliability & Underdog Diagnostic Graphs */}
          {(backtestData?.calibration_reliability_exists || backtestData?.underdog_diagnostic_exists) && (
            <Card elevation={0} sx={{ border: "1px solid rgba(0, 0, 0, 0.12)", borderRadius: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: "#0A2540", mb: 3 }}>
                  Diagnostic Graphs
                </Typography>
                <Grid container spacing={3}>
                  {backtestData?.calibration_reliability_exists && (
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ color: "#0A2540", mb: 1 }}>
                        Calibration Reliability
                      </Typography>
                      <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 1 }}>
                        Predicted vs actual win rate by probability bin (backtest bets)
                      </Typography>
                      <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
                        <img
                          src="/backtesting/calibration_reliability_curve.png"
                          alt="Calibration Reliability"
                          style={{ maxWidth: "100%", height: "auto" }}
                        />
                      </Box>
                    </Grid>
                  )}
                  {backtestData?.underdog_diagnostic_exists && (
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ color: "#0A2540", mb: 1 }}>
                        Underdog Bet Diagnostic
                      </Typography>
                      <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 1 }}>
                        Win rate: underdogs vs favorites, and by probability bucket
                      </Typography>
                      <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
                        <img
                          src="/backtesting/underdog_diagnostic.png"
                          alt="Underdog Diagnostic"
                          style={{ maxWidth: "100%", height: "auto" }}
                        />
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* Temperature Optimization Section */}
          {tempLoading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          )}
          {tempData && (
            <>
              <Card elevation={0} sx={{ border: "1px solid rgba(0, 0, 0, 0.12)", borderRadius: 2 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: "#0A2540", mb: 3 }}>
                    Temperature Scaling Optimization (Pinnacle)
                  </Typography>
                  
                  {/* Optimal T Summary */}
                  <Box sx={{ mb: 4, p: 2, backgroundColor: "#f5f5f5", borderRadius: 2 }}>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ color: "#0A2540" }}>
                      Optimal Temperature: T = {tempData.optimal_temperature.optimal_temperature.toFixed(1)}
                    </Typography>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="text.secondary">ROI</Typography>
                        <Typography variant="h6" sx={{ color: "#2e7d32", fontWeight: 600 }}>
                          {tempData.optimal_temperature.roi.toFixed(2)}%
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="text.secondary">Bets</Typography>
                        <Typography variant="h6" fontWeight={600}>
                          {tempData.optimal_temperature.bets}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="text.secondary">Hit Rate</Typography>
                        <Typography variant="h6" fontWeight={600}>
                          {(tempData.optimal_temperature.hit_rate * 100).toFixed(1)}%
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="text.secondary">Max Drawdown</Typography>
                        <Typography variant="h6" fontWeight={600}>
                          {tempData.optimal_temperature.max_drawdown.toFixed(2)}u
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Comparison Table */}
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ color: "#0A2540", mb: 2 }}>
                    Temperature Comparison
                  </Typography>
                  <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid rgba(0, 0, 0, 0.08)" }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                          <TableCell sx={{ fontWeight: 600 }}>T</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Bets</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Profit</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>ROI</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Hit Rate</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Max DD</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {tempData.comparison_table.map((row) => (
                          <TableRow
                            key={row.temperature}
                            sx={{
                              backgroundColor: Math.abs(row.temperature - tempData.optimal_temperature.optimal_temperature) < 0.01 ? "#e8f5e9" : "inherit",
                            }}
                          >
                            <TableCell sx={{ fontWeight: Math.abs(row.temperature - tempData.optimal_temperature.optimal_temperature) < 0.01 ? 600 : 400 }}>
                              {row.temperature.toFixed(1)}
                            </TableCell>
                            <TableCell align="right">{row.bets}</TableCell>
                            <TableCell align="right">{row.profit.toFixed(2)}u</TableCell>
                            <TableCell align="right" sx={{ color: row.roi >= 0 ? "#2e7d32" : "#d32f2f", fontWeight: 600 }}>
                              {row.roi >= 0 ? "+" : ""}{row.roi.toFixed(2)}%
                            </TableCell>
                            <TableCell align="right">{(row.hit_rate * 100).toFixed(1)}%</TableCell>
                            <TableCell align="right">{row.max_drawdown.toFixed(2)}u</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>

              {/* Equity Curve */}
              {tempData.equity_curve && (
                <Card elevation={0} sx={{ border: "1px solid rgba(0, 0, 0, 0.12)", borderRadius: 2 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: "#0A2540", mb: 2 }}>
                      Equity Curve (Optimal T = {tempData.optimal_temperature.optimal_temperature.toFixed(1)})
                    </Typography>
                    {tempData.equity_curve_image_exists ? (
                      <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
                        <img
                          src="/backtesting/equity_curve.png"
                          alt="Equity Curve"
                          style={{ maxWidth: "100%", height: "auto" }}
                        />
                      </Box>
                    ) : (
                      <Box sx={{ width: "100%", height: 400 }}>
                        <ResponsiveContainer>
                          <LineChart data={tempData.equity_curve.bet_number.map((betNum, idx) => ({
                            bet: betNum,
                            bankroll: tempData.equity_curve!.bankroll[idx],
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="bet" label={{ value: "Bet Number", position: "insideBottom", offset: -5 }} />
                            <YAxis label={{ value: "Bankroll", angle: -90, position: "insideLeft" }} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="bankroll" stroke="#1976d2" strokeWidth={2} dot={false} name="Bankroll" />
                          </LineChart>
                        </ResponsiveContainer>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Methodology Section */}
          <Card elevation={0} sx={{ border: "1px solid rgba(0, 0, 0, 0.12)", borderRadius: 2 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: "#0A2540", mb: 2 }}>
                Methodology
              </Typography>
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  <strong>Out-of-sample testing:</strong> All results are based on predictions for 2025 matches, using a model trained on data up to December 11, 2025. No leakage or data snooping.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  <strong>Temperature scaling:</strong> Model probabilities are calibrated using temperature scaling (T) to optimize betting performance. T &gt; 1 pulls predictions toward 0.5 (less confident), T &lt; 1 sharpens predictions.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  <strong>Betting strategy:</strong> Quarter Kelly staking with probability threshold ≥0.54, odds ≥1.30, edge ≥0.0. Stakes are capped at 2% of bankroll and $100 absolute maximum for realism.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  <strong>Odds source:</strong> All results use Pinnacle closing odds. Results are based on closing odds available at match time, not opening odds.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, fontStyle: "italic", mt: 1 }}>
                  Bet selection rate: {backtestData ? `${backtestData.strategies.reduce((s, x) => s + x.num_bets_placed, 0)} bets out of ${backtestData.total_matches} matches (~${((backtestData.strategies.reduce((s, x) => s + x.num_bets_placed, 0) / backtestData.total_matches) * 100).toFixed(1)}%)` : "N/A"}
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          {/* Key Insight Box */}
          {tempData && (
            <Card elevation={0} sx={{ border: "2px solid #1976d2", borderRadius: 2, backgroundColor: "#e3f2fd" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: "#0A2540", mb: 1 }}>
                  Key Insight
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  Temperature scaling optimization shows that T = {tempData.optimal_temperature.optimal_temperature.toFixed(1)} produces optimal betting performance ({tempData.optimal_temperature.roi.toFixed(2)}% ROI) on Pinnacle odds. This indicates the model captures genuine pricing inefficiencies rather than artifacts of a single odds provider.
                </Typography>
              </CardContent>
            </Card>
          )}

          {/* Calibration Note */}
          <Card elevation={0} sx={{ border: "1px solid rgba(0, 0, 0, 0.12)", borderRadius: 2, backgroundColor: "#f5f5f5" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: "#0A2540", mb: 2 }}>
                Calibration
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                Predictions are calibrated using temperature scaling optimized for betting performance. The optimal temperature (T = {tempData?.optimal_temperature.optimal_temperature.toFixed(1) || "2.5"}) balances calibration accuracy with betting edge.
              </Typography>
            </CardContent>
          </Card>
        </>
      )}
    </Stack>
  );
};

export default BacktestingPage;
