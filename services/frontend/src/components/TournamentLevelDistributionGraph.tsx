import { Card, CardContent, Typography } from "@mui/material";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { PlayerRecentMatch } from "../api/types";

interface Props {
  playerOneName: string;
  playerTwoName: string;
  playerOneMatches: PlayerRecentMatch[];
  playerTwoMatches: PlayerRecentMatch[];
}

const TournamentLevelDistributionGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  // Map tournament levels to readable names
  const levelMap: { [key: string]: string } = {
    "250": "ATP 250",
    "500": "ATP 500",
    "M": "Masters 1000",
    "G": "Grand Slam",
    "F": "ATP Finals",
    "C": "Challenger",
    "A": "ATP Cup",
    "D": "Davis Cup",
  };

  // Count matches by tournament level
  const countByLevel = (matches: PlayerRecentMatch[]) => {
    const counts: { [key: string]: number } = {};
    matches.forEach((match) => {
      // Try to extract tournament level from match data
      // This might need to be adjusted based on actual data structure
      const level = match.tourney?.includes("250")
        ? "250"
        : match.tourney?.includes("500")
        ? "500"
        : match.tourney?.includes("Masters")
        ? "M"
        : match.tourney?.includes("Grand Slam") || match.tourney?.includes("Wimbledon") || 
          match.tourney?.includes("US Open") || match.tourney?.includes("French Open") || 
          match.tourney?.includes("Australian Open")
        ? "G"
        : "M"; // Default to Masters
      counts[level] = (counts[level] || 0) + 1;
    });
    return counts;
  };

  const p1Counts = countByLevel(playerOneMatches);
  const p2Counts = countByLevel(playerTwoMatches);

  const allLevels = Array.from(new Set([...Object.keys(p1Counts), ...Object.keys(p2Counts)]));

  const p1Data = allLevels.map((level) => ({
    name: levelMap[level] || level,
    value: p1Counts[level] || 0,
  }));

  const p2Data = allLevels.map((level) => ({
    name: levelMap[level] || level,
    value: p2Counts[level] || 0,
  }));

  const COLORS = ["#00a0b0", "#ff6b35", "#00d4ff", "#c44569", "#f39c12", "#9b59b6", "#1abc9c"];

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Tournament Level Distribution
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Match distribution across tournament tiers
        </Typography>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div>
            <Typography variant="h6" sx={{ mb: 1, textAlign: "center" }}>
              {playerOneName}
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={p1Data.filter((d) => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {p1Data.filter((d) => d.value > 0).map((entry, index) => (
                    <Cell key={`cell-p1-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div>
            <Typography variant="h6" sx={{ mb: 1, textAlign: "center" }}>
              {playerTwoName}
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={p2Data.filter((d) => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {p2Data.filter((d) => d.value > 0).map((entry, index) => (
                    <Cell key={`cell-p2-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TournamentLevelDistributionGraph;

