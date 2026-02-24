import { Card, CardContent, Typography } from "@mui/material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { H2HResponse } from "../api/types";

interface Props {
  h2hData: H2HResponse;
  playerOneName: string;
  playerTwoName: string;
}

const SurfaceH2HGraph = ({ h2hData, playerOneName, playerTwoName }: Props) => {
  const surfaceData = h2hData.surface_breakdown.map((surface) => ({
    surface: surface.label,
    [playerOneName]: surface.player_one_value || 0,
    [playerTwoName]: surface.player_two_value || 0,
  }));

  if (surfaceData.length === 0) return null;

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Head-to-Head by Surface
        </Typography>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={surfaceData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis dataKey="surface" tick={{ fill: "#c5d0d9" }} />
            <YAxis tick={{ fill: "#c5d0d9" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              formatter={(value: any) => [value, "Wins"]}
            />
            <Legend />
            <Bar dataKey={playerOneName} fill="#00a0b0" name={`${playerOneName} Wins`} />
            <Bar dataKey={playerTwoName} fill="#ff6b35" name={`${playerTwoName} Wins`} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default SurfaceH2HGraph;

