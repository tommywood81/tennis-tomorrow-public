import { Card, CardContent, Typography } from "@mui/material";
import { ModelStatsResponse } from "../api/types";

interface Props {
  stats: ModelStatsResponse;
}

// Helper to create heatmap data from rank bucket accuracy
const createHeatmapData = (rankBucketData: ModelStatsResponse["rank_bucket_accuracy"]) => {
  const buckets = ["1-5", "6-10", "11-20", "21-50", "51-100", "101+"];
  const data: Array<{ player: string; opponent: string; accuracy: number; count: number }> = [];
  
  rankBucketData.forEach((item) => {
    data.push({
      player: item.player_rank_bucket,
      opponent: item.opponent_rank_bucket,
      accuracy: item.accuracy,
      count: item.sample_count,
    });
  });
  
  return { data, buckets };
};

// Helper to get color for heatmap cell based on accuracy
// Using blue gradient scale
const getAccuracyColor = (accuracy: number) => {
  if (accuracy >= 0.90) return "#E6F2FF"; // Very light blue - excellent (≥90%)
  if (accuracy >= 0.85) return "#CCE5FF"; // Light blue - very good (≥85%)
  if (accuracy >= 0.80) return "#99CCFF"; // Medium-light blue - good (≥80%)
  if (accuracy >= 0.75) return "#66B3FF"; // Medium blue - decent (≥75%)
  if (accuracy >= 0.70) return "#3399FF"; // Blue - below average (≥70%)
  if (accuracy >= 0.65) return "#0066CC"; // Hardcourt blue - poor (≥65%)
  if (accuracy >= 0.60) return "#0052A3"; // Dark blue - very poor (≥60%)
  return "#003D7A"; // Very dark blue - very poor (<60%)
};

const RankBucketAccuracyHeatmap = ({ stats }: Props) => {
  const { data: heatmapData, buckets: rankBuckets } = createHeatmapData(stats.rank_bucket_accuracy);

  return (
    <Card>
      <CardContent sx={{ p: { xs: 3, sm: 4, md: 4 } }}>
        <Typography variant="h5" fontWeight={800} gutterBottom sx={{ mb: 1 }}>
          1. Accuracy Heatmap by Rank Buckets
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3, maxWidth: "900px", lineHeight: 1.6 }}>
          Accuracy by rank bucket matchup (2025 test set). Each match counted once after averaging dual-perspective predictions.
        </Typography>
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {/* Header row */}
            <div style={{ display: "grid", gridTemplateColumns: "100px repeat(6, 1fr)", gap: "4px", marginBottom: "4px" }}>
              <div style={{ fontWeight: "bold", textAlign: "center" }}>Player\Opponent</div>
              {rankBuckets.map(bucket => (
                <div key={bucket} style={{ fontWeight: "bold", textAlign: "center", fontSize: "0.85rem" }}>
                  {bucket}
                </div>
              ))}
            </div>
            {/* Data rows */}
            {rankBuckets.map(playerBucket => (
              <div key={playerBucket} style={{ display: "grid", gridTemplateColumns: "100px repeat(6, 1fr)", gap: "4px" }}>
                <div style={{ fontWeight: "bold", textAlign: "right", paddingRight: "8px" }}>{playerBucket}</div>
                {rankBuckets.map(oppBucket => {
                  const cellData = heatmapData.find(d => d.player === playerBucket && d.opponent === oppBucket);
                  const accuracy = cellData?.accuracy || 0;
                  const count = cellData?.count || 0;
                  const isSmallSample = count > 0 && count < 30; // Flag cells with < 30 matches as potentially unreliable
                  const isVerySmallSample = count > 0 && count < 10; // Flag cells with < 10 matches as unreliable
                  return (
                    <div
                      key={`${playerBucket}-${oppBucket}`}
                        style={{
                        backgroundColor: getAccuracyColor(accuracy),
                        color: accuracy > 0.70 ? "#1A1A1A" : "#FFFFFF", // Dark text on light blue, white text on dark blue
                        border: `2px solid ${isVerySmallSample ? "#FF6B6B" : isSmallSample ? "#FFA500" : accuracy > 0.70 ? "rgba(0, 102, 204, 0.2)" : "rgba(0, 102, 204, 0.4)"}`, // Red border for very small, orange for small
                        padding: "8px",
                        textAlign: "center",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                        minHeight: "40px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        cursor: count > 0 ? "pointer" : "default",
                        opacity: count > 0 ? 1 : 0.3,
                        position: "relative",
                      }}
                      title={count > 0 ? `Accuracy: ${(accuracy * 100).toFixed(1)}% | Matches: ${count}${isVerySmallSample ? " (Very small sample - unreliable)" : isSmallSample ? " (Small sample - use caution)" : ""}` : "No matches"}
                    >
                      {count > 0 ? (
                        <>
                          <div>{(accuracy * 100).toFixed(1)}%</div>
                          <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                            ({count})
                            {isVerySmallSample && <span style={{ color: "#FF6B6B", fontWeight: "bold" }}> ⚠</span>}
                            {isSmallSample && !isVerySmallSample && <span style={{ color: "#FFA500", fontWeight: "bold" }}> ⚠</span>}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: "0.75rem" }}>N/A</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
          Color scale: Very Light Blue (≥90%) • Light Blue (≥85%) • Medium-Light Blue (≥80%) • Medium Blue (≥75%) • 
          Blue (≥70%) • Hardcourt Blue (≥65%) • Dark Blue (≥60%) • Very Dark Blue (&lt;60%)
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          Sample size warnings: <span style={{ color: "#FF6B6B", fontWeight: "bold" }}>⚠ Red border</span> = &lt;10 matches (unreliable), 
          <span style={{ color: "#FFA500", fontWeight: "bold" }}> ⚠ Orange border</span> = &lt;30 matches (use caution)
        </Typography>
        <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div style={{ width: "16px", height: "16px", backgroundColor: "#E6F2FF", borderRadius: "2px", border: "1px solid rgba(0, 102, 204, 0.2)" }}></div>
            <Typography variant="caption">≥90%</Typography>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div style={{ width: "16px", height: "16px", backgroundColor: "#CCE5FF", borderRadius: "2px", border: "1px solid rgba(0, 102, 204, 0.2)" }}></div>
            <Typography variant="caption">≥85%</Typography>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div style={{ width: "16px", height: "16px", backgroundColor: "#99CCFF", borderRadius: "2px", border: "1px solid rgba(0, 102, 204, 0.2)" }}></div>
            <Typography variant="caption">≥80%</Typography>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div style={{ width: "16px", height: "16px", backgroundColor: "#66B3FF", borderRadius: "2px", border: "1px solid rgba(0, 102, 204, 0.2)" }}></div>
            <Typography variant="caption">≥75%</Typography>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div style={{ width: "16px", height: "16px", backgroundColor: "#3399FF", borderRadius: "2px", border: "1px solid rgba(0, 102, 204, 0.2)" }}></div>
            <Typography variant="caption">≥70%</Typography>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div style={{ width: "16px", height: "16px", backgroundColor: "#0066CC", borderRadius: "2px", border: "1px solid rgba(0, 102, 204, 0.3)" }}></div>
            <Typography variant="caption">≥65%</Typography>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div style={{ width: "16px", height: "16px", backgroundColor: "#0052A3", borderRadius: "2px", border: "1px solid rgba(0, 102, 204, 0.3)" }}></div>
            <Typography variant="caption">≥60%</Typography>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div style={{ width: "16px", height: "16px", backgroundColor: "#003D7A", borderRadius: "2px", border: "1px solid rgba(0, 102, 204, 0.3)" }}></div>
            <Typography variant="caption">&lt;60%</Typography>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RankBucketAccuracyHeatmap;

