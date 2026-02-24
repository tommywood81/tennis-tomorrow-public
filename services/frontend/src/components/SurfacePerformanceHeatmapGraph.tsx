import { Card, CardContent, Typography } from "@mui/material";
import { PlayerRecentMatch } from "../api/types";

interface Props {
  playerOneName: string;
  playerTwoName: string;
  playerOneMatches: PlayerRecentMatch[];
  playerTwoMatches: PlayerRecentMatch[];
}

const SurfacePerformanceHeatmapGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  // Calculate win % by surface
  const calculateWinPercent = (matches: PlayerRecentMatch[], surface: string) => {
    const surfaceMatches = matches.filter((m) => m.surface === surface);
    if (surfaceMatches.length === 0) return null;
    const wins = surfaceMatches.filter((m) => m.winner).length;
    return (wins / surfaceMatches.length) * 100;
  };

  const surfaces = ["Hard", "Clay", "Grass"];
  const data = surfaces.map((surface) => ({
    surface,
    playerA_win_pct: calculateWinPercent(playerOneMatches, surface),
    playerB_win_pct: calculateWinPercent(playerTwoMatches, surface),
    playerA_matches: playerOneMatches.filter((m) => m.surface === surface).length,
    playerB_matches: playerTwoMatches.filter((m) => m.surface === surface).length,
  }));

  // Color intensity based on win %
  const getColorIntensity = (winPct: number | null): string => {
    if (winPct === null) return "#444";
    if (winPct >= 70) return "#000000"; // Black for high win percentage
    if (winPct >= 60) return "#4A4A4A"; // Dark gray
    if (winPct >= 50) return "#0066CC"; // Hardcourt blue
    if (winPct >= 40) return "#ff7f00"; // Orange
    return "#ff0000"; // Red
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Surface Performance Heatmap
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Win % by surface - Career statistics
        </Typography>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          {data.map((item) => (
            <div
              key={item.surface}
              style={{
                padding: "20px",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <Typography variant="h6" sx={{ mb: 2, color: "#c5d0d9" }}>
                {item.surface}
              </Typography>
              <div style={{ marginBottom: "12px" }}>
                <Typography variant="caption" color="text.secondary">
                  {playerOneName}
                </Typography>
                <div
                  style={{
                    height: "40px",
                    backgroundColor: getColorIntensity(item.playerA_win_pct),
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: "4px",
                  }}
                >
                  <Typography variant="h6" sx={{ color: "#000", fontWeight: "bold" }}>
                    {item.playerA_win_pct !== null
                      ? `${item.playerA_win_pct.toFixed(1)}%`
                      : "N/A"}
                  </Typography>
                </div>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                  {item.playerA_matches} matches
                </Typography>
              </div>
              <div>
                <Typography variant="caption" color="text.secondary">
                  {playerTwoName}
                </Typography>
                <div
                  style={{
                    height: "40px",
                    backgroundColor: getColorIntensity(item.playerB_win_pct),
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: "4px",
                  }}
                >
                  <Typography variant="h6" sx={{ color: "#000", fontWeight: "bold" }}>
                    {item.playerB_win_pct !== null
                      ? `${item.playerB_win_pct.toFixed(1)}%`
                      : "N/A"}
                  </Typography>
                </div>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                  {item.playerB_matches} matches
                </Typography>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default SurfacePerformanceHeatmapGraph;

