import { Card, CardContent, Typography } from "@mui/material";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { H2HResponse } from "../api/types";

interface Props {
  h2hData: H2HResponse;
  playerOneName: string;
  playerTwoName: string;
}

const H2HTimelineGraph = ({ h2hData, playerOneName, playerTwoName }: Props) => {
  // Build cumulative win count over time
  const timelineData = h2hData.recent_meetings
    .slice()
    .reverse()
    .map((meeting, idx, arr) => {
      const prevMatches = arr.slice(0, idx);
      const p1Wins = prevMatches.filter((m) => m.winner === playerOneName).length;
      const p2Wins = prevMatches.filter((m) => m.winner === playerTwoName).length;
      
      const currentP1Win = meeting.winner === playerOneName ? 1 : 0;
      const currentP2Win = meeting.winner === playerTwoName ? 1 : 0;
      
      return {
        match: idx + 1,
        date: new Date(meeting.date).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        surface: meeting.surface || "Unknown",
        round: meeting.round || "Unknown",
        [`${playerOneName} Wins`]: p1Wins + currentP1Win,
        [`${playerTwoName} Wins`]: p2Wins + currentP2Win,
        winner: meeting.winner,
      };
    });

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Head-to-Head Timeline
        </Typography>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={timelineData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#c5d0d9", fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis tick={{ fill: "#c5d0d9" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              labelFormatter={(label, payload) => {
                const data = payload?.[0]?.payload;
                return data
                  ? `${data.date} - ${data.surface} (${data.round})`
                  : label;
              }}
            />
            <ReferenceLine y={timelineData.length / 2} stroke="#888" strokeDasharray="2 2" />
            <Legend />
            <Line
              type="monotone"
              dataKey={`${playerOneName} Wins`}
              stroke="#00a0b0"
              strokeWidth={3}
              dot={{ fill: "#00a0b0", r: 4 }}
              name={`${playerOneName} Cumulative Wins`}
            />
            <Line
              type="monotone"
              dataKey={`${playerTwoName} Wins`}
              stroke="#ff6b35"
              strokeWidth={3}
              dot={{ fill: "#ff6b35", r: 4 }}
              name={`${playerTwoName} Cumulative Wins`}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default H2HTimelineGraph;

