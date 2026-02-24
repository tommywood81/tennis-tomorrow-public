import { Card, CardContent, Typography } from "@mui/material";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { PlayerRecentMatch } from "../api/types";

interface Props {
  playerOneName: string;
  playerTwoName: string;
  playerOneMatches: PlayerRecentMatch[];
  playerTwoMatches: PlayerRecentMatch[];
}

const PerformanceVsOpponentQualityGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  const processData = (matches: PlayerRecentMatch[], playerName: string) => {
    return matches
      .slice()
      .reverse()
      .slice(0, 25)
      .map((match) => {
        const combined = (match.serve_pct && match.return_pct)
          ? ((match.serve_pct + match.return_pct) / 2) * 100
          : null;
        const oppRank = match.opponent_rank || 999;
        return {
          rank: oppRank === 999 ? 200 : oppRank,
          performance: combined,
          won: match.winner,
          opponent: match.opponent,
          playerName,
        };
      })
      .filter(d => d.performance !== null);
  };

  const p1Data = processData(playerOneMatches, playerOneName);
  const p2Data = processData(playerTwoMatches, playerTwoName);

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Performance vs Opponent Quality
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis
              type="number"
              dataKey="rank"
              name="Opponent Rank"
              domain={[0, 200]}
              reversed
              tick={{ fill: "#c5d0d9" }}
              label={{ value: "Opponent Rank (Lower=Better)", position: "insideBottom", offset: -5, fill: "#c5d0d9" }}
            />
            <YAxis
              type="number"
              dataKey="performance"
              name="Performance"
              domain={[0, 100]}
              tick={{ fill: "#c5d0d9" }}
              label={{ value: "Combined Serve+Return %", angle: -90, position: "insideLeft", fill: "#c5d0d9" }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              cursor={{ strokeDasharray: "3 3" }}
              formatter={(value: any, name: string, props: any) => {
                if (name === "rank") return [`#${value}`, "Opponent Rank"];
                if (name === "performance") return [`${Number(value).toFixed(1)}%`, "Performance"];
                return [value, name];
              }}
              labelFormatter={(label, payload) => {
                const data = payload?.[0]?.payload;
                return data ? `${data.playerName}: vs ${data.opponent} (${data.won ? "W" : "L"})` : label;
              }}
            />
            <Legend />
            <Scatter name={playerOneName} data={p1Data} fill="#00a0b0">
              {p1Data.map((entry, index) => (
                <Cell key={`cell-p1-${index}`} fill={entry.won ? "#00ff00" : "#ff0000"} />
              ))}
            </Scatter>
            <Scatter name={playerTwoName} data={p2Data} fill="#ff6b35">
              {p2Data.map((entry, index) => (
                <Cell key={`cell-p2-${index}`} fill={entry.won ? "#00ff00" : "#ff0000"} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default PerformanceVsOpponentQualityGraph;

