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

const OpponentStrengthCorrelationGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  const processData = (matches: PlayerRecentMatch[], playerName: string) => {
    return matches
      .slice()
      .reverse()
      .slice(0, 10)
      .map((match) => {
        const opponentRank = match.opponent_rank;
        const servePct = match.serve_pct ? match.serve_pct * 100 : null;
        const returnPct = match.return_pct ? match.return_pct * 100 : null;
        const combined = servePct !== null && returnPct !== null ? (servePct + returnPct) / 2 : null;
        
        return {
          rank: opponentRank || 999, // Use high rank for unranked
          performance: combined,
          won: match.winner,
          opponent: match.opponent,
          playerName,
        };
      })
      .filter((d) => d.performance !== null);
  };

  const p1Data = processData(playerOneMatches, playerOneName);
  const p2Data = processData(playerTwoMatches, playerTwoName);

  // Invert rank so lower rank (better) is on the right
  const invertRank = (rank: number) => rank === 999 ? 0 : 200 - rank;

  const processedP1 = p1Data.map((d) => ({
    x: invertRank(d.rank),
    y: d.performance!,
    won: d.won,
    opponent: d.opponent,
    rank: d.rank,
    playerName: d.playerName,
  }));

  const processedP2 = p2Data.map((d) => ({
    x: invertRank(d.rank),
    y: d.performance!,
    won: d.won,
    opponent: d.opponent,
    rank: d.rank,
    playerName: d.playerName,
  }));

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Opponent Strength vs Performance
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: "0.75rem" }}>
          Higher rank (better opponent) on right. Black = Win, Orange = Loss
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis
              type="number"
              dataKey="x"
              name="Opponent Strength"
              domain={[0, 200]}
              tick={{ fill: "#c5d0d9" }}
              label={{ value: "Opponent Strength (Lower Rank → Right)", position: "insideBottom", offset: -5, fill: "#c5d0d9" }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Performance"
              domain={[0, 100]}
              tick={{ fill: "#c5d0d9" }}
              label={{ value: "Combined Serve+Return %", angle: -90, position: "insideLeft", fill: "#c5d0d9" }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              cursor={{ strokeDasharray: "3 3" }}
              formatter={(value: any, name: string, props: any) => {
                if (name === "x") {
                  const rank = props.payload.rank;
                  return [rank === 999 ? "Unranked" : `Rank #${rank}`, "Opponent"];
                }
                if (name === "y") return [`${Number(value).toFixed(1)}%`, "Performance"];
                return [value, name];
              }}
              labelFormatter={(label, payload) => {
                const data = payload?.[0]?.payload;
                return data ? `${data.playerName}: vs ${data.opponent} (${data.won ? "W" : "L"})` : label;
              }}
            />
            <Legend />
            <Scatter name={playerOneName} data={processedP1} fill="#00a0b0">
              {processedP1.map((entry, index) => (
                <Cell key={`cell-p1-${index}`} fill={entry.won ? "#000000" : "#FF8C42"} />
              ))}
            </Scatter>
            <Scatter name={playerTwoName} data={processedP2} fill="#ff6b35">
              {processedP2.map((entry, index) => (
                <Cell key={`cell-p2-${index}`} fill={entry.won ? "#000000" : "#FF8C42"} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default OpponentStrengthCorrelationGraph;

