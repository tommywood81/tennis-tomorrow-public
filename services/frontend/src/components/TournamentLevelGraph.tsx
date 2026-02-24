import { Card, CardContent, Typography } from "@mui/material";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { PlayerRecentMatch } from "../api/types";

interface Props {
  playerOneName: string;
  playerTwoName: string;
  playerOneMatches: PlayerRecentMatch[];
  playerTwoMatches: PlayerRecentMatch[];
}

const TournamentLevelGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  const levels = ["ATP250", "ATP500", "ATP1000", "Grand Slam"];
  
  const levelData = levels.map((level) => {
    const p1Matches = playerOneMatches.filter((m) => {
      if (level === "Grand Slam") {
        return m.tourney?.includes("Australian Open") || 
               m.tourney?.includes("French Open") ||
               m.tourney?.includes("Wimbledon") ||
               m.tourney?.includes("US Open");
      }
      return m.tourney?.includes(level);
    });
    
    const p2Matches = playerTwoMatches.filter((m) => {
      if (level === "Grand Slam") {
        return m.tourney?.includes("Australian Open") || 
               m.tourney?.includes("French Open") ||
               m.tourney?.includes("Wimbledon") ||
               m.tourney?.includes("US Open");
      }
      return m.tourney?.includes(level);
    });
    
    const p1WinRate = p1Matches.length > 0
      ? (p1Matches.filter((m) => m.winner).length / p1Matches.length) * 100
      : 0;
    
    const p2WinRate = p2Matches.length > 0
      ? (p2Matches.filter((m) => m.winner).length / p2Matches.length) * 100
      : 0;
    
    return {
      level,
      [playerOneName]: p1WinRate,
      [playerTwoName]: p2WinRate,
    };
  });

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Tournament Level Performance
        </Typography>
        <ResponsiveContainer width="100%" height={350}>
          <RadarChart data={levelData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <PolarGrid stroke="rgba(255,255,255,0.2)" />
            <PolarAngleAxis dataKey="level" tick={{ fill: "#c5d0d9", fontSize: 12 }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#c5d0d9" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              formatter={(value: any) => [`${Number(value).toFixed(1)}%`, ""]}
            />
            <Radar
              name={playerOneName}
              dataKey={playerOneName}
              stroke="#00a0b0"
              fill="#00a0b0"
              fillOpacity={0.6}
            />
            <Radar
              name={playerTwoName}
              dataKey={playerTwoName}
              stroke="#ff6b35"
              fill="#ff6b35"
              fillOpacity={0.6}
            />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default TournamentLevelGraph;

