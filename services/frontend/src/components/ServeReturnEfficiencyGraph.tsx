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

const ServeReturnEfficiencyGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  const p1Data = playerOneMatches
    .slice()
    .reverse()
    .slice(0, 10)
    .map((match, idx) => ({
      x: match.serve_pct ? match.serve_pct * 100 : null,
      y: match.return_pct ? match.return_pct * 100 : null,
      match: `M${idx + 1}`,
      opponent: match.opponent,
      won: match.winner,
    }))
    .filter((d) => d.x !== null && d.y !== null);
  
  const p2Data = playerTwoMatches
    .slice()
    .reverse()
    .slice(0, 10)
    .map((match, idx) => ({
      x: match.serve_pct ? match.serve_pct * 100 : null,
      y: match.return_pct ? match.return_pct * 100 : null,
      match: `M${idx + 1}`,
      opponent: match.opponent,
      won: match.winner,
    }))
    .filter((d) => d.x !== null && d.y !== null);

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Serve vs Return Efficiency
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis
              type="number"
              dataKey="x"
              name="Serve %"
              domain={[0, 100]}
              tick={{ fill: "#c5d0d9" }}
              label={{ value: "Serve Win %", position: "insideBottom", offset: -5, fill: "#c5d0d9" }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Return %"
              domain={[0, 100]}
              tick={{ fill: "#c5d0d9" }}
              label={{ value: "Return Win %", angle: -90, position: "insideLeft", fill: "#c5d0d9" }}
            />
            <ReferenceLine x={65} stroke="#888" strokeDasharray="2 2" />
            <ReferenceLine y={35} stroke="#888" strokeDasharray="2 2" />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              cursor={{ strokeDasharray: "3 3" }}
              formatter={(value: any, name: string, props: any) => {
                if (name === "x") return [`${Number(value).toFixed(1)}%`, "Serve %"];
                if (name === "y") return [`${Number(value).toFixed(1)}%`, "Return %"];
                return [value, name];
              }}
              labelFormatter={(label, payload) => {
                const data = payload?.[0]?.payload;
                return data
                  ? `${data.match}: vs ${data.opponent} ${data.won ? "(W)" : "(L)"}`
                  : label;
              }}
            />
            <Legend />
            <Scatter name={playerOneName} data={p1Data} fill="#00a0b0">
              {p1Data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.won ? "#00ff00" : "#ff0000"} />
              ))}
            </Scatter>
            <Scatter name={playerTwoName} data={p2Data} fill="#ff6b35">
              {p2Data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.won ? "#00ff00" : "#ff0000"} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ServeReturnEfficiencyGraph;

