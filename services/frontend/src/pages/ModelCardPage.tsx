import { Stack, Typography, Box, Card, CardContent, Divider } from "@mui/material";

const ModelCardPage = () => {
  return (
    <Stack spacing={{ xs: 3, sm: 3.5, md: 4 }} sx={{ maxWidth: { xs: "100%", sm: "800px", md: "900px" }, mx: "auto", px: { xs: 1.5, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2, sm: 3, md: 4 }, pt: { xs: 12, sm: 14, md: 16 } }}>
      {/* Header */}
      <Box>
        <Typography variant="h4" fontWeight={700} gutterBottom sx={{ color: "#0A2540", fontSize: { xs: "1.5rem", sm: "1.75rem", md: "2rem", lg: "2.25rem" } }}>
          Model Card
        </Typography>
      </Box>

      {/* Model name */}
      <Card elevation={0} sx={{ border: "1px solid rgba(0, 0, 0, 0.12)", borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.1em" }}>
            Model name
          </Typography>
          <Typography variant="h6" fontWeight={600} sx={{ mt: 1, mb: 2, color: "#0A2540" }}>
            ATP Match Win Probability Model (LSTM)
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.1em" }}>
            Model version
          </Typography>
          <Typography variant="body1" sx={{ mt: 1, color: "#0A2540" }}>
            Frozen Dec 2023 — train 1990–2022, calibrate on 2023; one model used consistently for inference and backtesting.
          </Typography>
        </CardContent>
      </Card>

      {/* Model summary */}
      <Card elevation={0} sx={{ border: "1px solid rgba(0, 0, 0, 0.12)", borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: "#0A2540", mb: 2 }}>
            Model summary
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: 2 }}>
            Sequence-based LSTM trained on ATP matches (1990–2022) to estimate pre-match win probabilities.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: 2 }}>
            2023 is used strictly as a temporal holdout for early stopping, hyperparameter selection, and temperature calibration.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: 2 }}>
            Final evaluation is performed on fully unseen 2024–2025 data.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            The system is designed for reproducibility, strict temporal validation (forward-chaining), and deployment without retraining.
          </Typography>
        </CardContent>
      </Card>

      {/* Intended use */}
      <Card elevation={0} sx={{ border: "1px solid rgba(0, 0, 0, 0.12)", borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: "#0A2540", mb: 2 }}>
            Intended use
          </Typography>
          <Typography component="ul" variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, pl: 3, m: 0 }}>
            <li>Pre-match win probability estimation for ATP matches</li>
            <li>Retrospective inspection of predictions and error patterns</li>
            <li>Demonstration of production-grade, time-aware modelling practices</li>
          </Typography>
        </CardContent>
      </Card>

      {/* Out of scope */}
      <Card elevation={0} sx={{ border: "1px solid rgba(0, 0, 0, 0.12)", borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: "#0A2540", mb: 2 }}>
            Out of scope / non-goals
          </Typography>
          <Typography component="ul" variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, pl: 3, m: 0 }}>
            <li>Injury-, illness-, or news-aware prediction</li>
            <li>Live, in-play modelling</li>
            <li>Betting, wagering, or financial decision-making</li>
          </Typography>
        </CardContent>
      </Card>

      {/* Training data */}
      <Card elevation={0} sx={{ border: "1px solid rgba(0, 0, 0, 0.12)", borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: "#0A2540", mb: 2 }}>
            Training data
          </Typography>
          <Typography component="ul" variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, pl: 3, m: 0 }}>
            <li>Train: 1990–2022</li>
            <li>Holdout: 2023 (no test leakage)</li>
            <li>Test: 2024–2025</li>
            <li>ATP 250, 500, Masters 1000, Grand Slams</li>
            <li>Surfaces: hard, clay, grass (explicit feature)</li>
            <li>Only pre-match information used</li>
          </Typography>
        </CardContent>
      </Card>

      {/* Evaluation methodology */}
      <Card elevation={0} sx={{ border: "1px solid rgba(0, 0, 0, 0.12)", borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: "#0A2540", mb: 2 }}>
            Evaluation methodology
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: 3 }}>
            Match outcomes are temporally dependent, so all evaluation follows strict temporal validation (forward-chaining) to reflect real-world deployment.
          </Typography>
          
          <Typography variant="subtitle2" fontWeight={600} sx={{ color: "#0A2540", mt: 3, mb: 1 }}>
            Evaluation phases
          </Typography>
          <Box sx={{ overflowX: "auto", mt: 2, mb: 3, WebkitOverflowScrolling: "touch" }}>
            <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid rgba(0, 0, 0, 0.12)", fontWeight: 600, fontSize: "0.875rem", color: "#0A2540" }}>Phase</th>
                <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid rgba(0, 0, 0, 0.12)", fontWeight: 600, fontSize: "0.875rem", color: "#0A2540" }}>Train</th>
                <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid rgba(0, 0, 0, 0.12)", fontWeight: 600, fontSize: "0.875rem", color: "#0A2540" }}>Validate</th>
                <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid rgba(0, 0, 0, 0.12)", fontWeight: 600, fontSize: "0.875rem", color: "#0A2540" }}>Test</th>
                <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid rgba(0, 0, 0, 0.12)", fontWeight: 600, fontSize: "0.875rem", color: "#0A2540" }}>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "8px", borderBottom: "1px solid rgba(0, 0, 0, 0.08)", fontSize: "0.875rem", color: "#666" }}>Hyperparameter tuning</td>
                <td style={{ padding: "8px", borderBottom: "1px solid rgba(0, 0, 0, 0.08)", fontSize: "0.875rem", color: "#666" }}>1990–2022</td>
                <td style={{ padding: "8px", borderBottom: "1px solid rgba(0, 0, 0, 0.08)", fontSize: "0.875rem", color: "#666" }}>2023</td>
                <td style={{ padding: "8px", borderBottom: "1px solid rgba(0, 0, 0, 0.08)", fontSize: "0.875rem", color: "#666" }}>—</td>
                <td style={{ padding: "8px", borderBottom: "1px solid rgba(0, 0, 0, 0.08)", fontSize: "0.875rem", color: "#666" }}>Architecture & hyperparams frozen</td>
              </tr>
              <tr>
                <td style={{ padding: "8px", borderBottom: "1px solid rgba(0, 0, 0, 0.08)", fontSize: "0.875rem", color: "#666" }}>Frozen model (inference + backtest)</td>
                <td style={{ padding: "8px", borderBottom: "1px solid rgba(0, 0, 0, 0.08)", fontSize: "0.875rem", color: "#666" }}>1990–2022</td>
                <td style={{ padding: "8px", borderBottom: "1px solid rgba(0, 0, 0, 0.08)", fontSize: "0.875rem", color: "#666" }}>2023 (early stop + calibration)</td>
                <td style={{ padding: "8px", borderBottom: "1px solid rgba(0, 0, 0, 0.08)", fontSize: "0.875rem", color: "#666" }}>2024–2025</td>
                <td style={{ padding: "8px", borderBottom: "1px solid rgba(0, 0, 0, 0.08)", fontSize: "0.875rem", color: "#666" }}>One model, no retraining after 2023</td>
              </tr>
            </tbody>
          </Box>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mt: 2 }}>
            All metrics are produced from a single frozen model under strict temporal validation — with no retraining, leakage, or post-hoc adjustment.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mt: 2 }}>
            The same probability outputs are used directly for backtesting, ensuring consistency between predictive performance and decision-based evaluation.
          </Typography>
        </CardContent>
      </Card>

      {/* Performance summary */}
      <Card elevation={0} sx={{ border: "1px solid rgba(0, 0, 0, 0.12)", borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: "#0A2540", mb: 2 }}>
            Performance summary
          </Typography>
          <Typography component="ul" variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, pl: 3, m: 0 }}>
            <li>Match accuracy (2024–2025 OOS): ~70%</li>
            <li>AUC-ROC: ~0.77</li>
            <li>Brier score: ~0.19–0.20 (temperature scaled, T ≈ 0.72 on 2023)</li>
            <li>Baseline (higher-ranked player): ~64%</li>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mt: 2 }}>
            Performance is stable across both out-of-sample years using the same frozen model.
          </Typography>
          <Typography variant="subtitle2" fontWeight={600} sx={{ color: "#0A2540", mt: 3, mb: 1 }}>
            Generalisation claim
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: 2 }}>
            The model demonstrates stable performance on unseen future data (2024–2025), providing evidence of generalisation under strict temporal constraints.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            While future performance cannot be guaranteed, this setup reflects how the model would have behaved if deployed prior to those periods.
          </Typography>
        </CardContent>
      </Card>

      {/* Model design */}
      <Card elevation={0} sx={{ border: "1px solid rgba(0, 0, 0, 0.12)", borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: "#0A2540", mb: 2 }}>
            Model design
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: 2 }}>
            Sequence-based LSTM operating on fixed-length player history windows (~10 prior matches), ordered chronologically. Exponential decay is applied so recent form is weighted more heavily.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: 2 }}>
            Static contextual features include ranking, career performance, tournament context, round, and surface.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: 2 }}>
            No player identifiers or embeddings — the model learns patterns, not names.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: 2 }}>
            Dual-perspective inference (Player A vs B and B vs A), with outputs combined via softmax to remove positional bias.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            The architecture is intentionally simple, making it auditable and deployable while still capturing temporal form dynamics.
          </Typography>
        </CardContent>
      </Card>

      {/* Data integrity & leakage prevention */}
      <Card elevation={0} sx={{ border: "1px solid rgba(0, 0, 0, 0.12)", borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: "#0A2540", mb: 2 }}>
            Data integrity & leakage prevention
          </Typography>
          <Typography component="ul" variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, pl: 3, m: 0 }}>
            <li>All features use information available strictly before match start</li>
            <li>Player sequences are constructed chronologically</li>
            <li>Training, validation, and inference pipelines share identical feature logic</li>
            <li>Dedicated tests ensure no future information enters sequences</li>
            <li>Random seeds fixed for reproducibility</li>
          </Typography>
        </CardContent>
      </Card>

      {/* Known limitations */}
      <Card elevation={0} sx={{ border: "1px solid rgba(0, 0, 0, 0.12)", borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: "#0A2540", mb: 2 }}>
            Known limitations
          </Typography>
          <Typography component="ul" variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, pl: 3, m: 0 }}>
            <li>Injuries and sudden form changes are not directly observable</li>
            <li>Predictions are less reliable for players with limited match history</li>
            <li>Retirements and walkovers are out-of-distribution</li>
            <li>Surface-specific performance may vary due to data density and player specialisation</li>
          </Typography>
        </CardContent>
      </Card>

      {/* Operational notes */}
      <Card elevation={0} sx={{ border: "1px solid rgba(0, 0, 0, 0.12)", borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: "#0A2540", mb: 2 }}>
            Operational notes
          </Typography>
          <Typography component="ul" variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, pl: 3, m: 0 }}>
            <li>CPU inference, sub-second latency (FastAPI + Docker)</li>
            <li>Model and calibration frozen; no periodic retraining</li>
            <li>Feature logic versioned and aligned with training pipeline</li>
          </Typography>
        </CardContent>
      </Card>

      {/* Future work */}
      <Card elevation={0} sx={{ border: "1px solid rgba(0, 0, 0, 0.12)", borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: "#0A2540", mb: 2 }}>
            Future work
          </Typography>

          <Typography variant="subtitle2" fontWeight={600} sx={{ color: "#0A2540", mt: 2, mb: 1 }}>
            Model & data drift
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: 2 }}>
            Introduce monitoring to track prediction drift over time by comparing model outputs with realised outcomes.
          </Typography>

          <Typography variant="subtitle2" fontWeight={600} sx={{ color: "#0A2540", mt: 2, mb: 1 }}>
            Grand Slam format support
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            Incorporate best-of-five indicators and optional Grand Slam–specific inference to reflect differing match dynamics.
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  );
};

export default ModelCardPage;
