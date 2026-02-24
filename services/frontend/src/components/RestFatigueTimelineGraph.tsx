import { Card, CardContent, Typography } from "@mui/material";
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { PlayerRecentMatch } from "../api/types";

interface Props {
  playerOneName: string;
  playerTwoName: string;
  playerOneMatches: PlayerRecentMatch[];
  playerTwoMatches: PlayerRecentMatch[];
}

const RestFatigueTimelineGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  // Calculate days since previous match and rolling average
  const processMatches = (matches: PlayerRecentMatch[]) => {
    const reversed = matches.slice().reverse().slice(0, 10);
    const processed: any[] = [];
    
    for (let i = 0; i < reversed.length; i++) {
      const match = reversed[i];
      const prevMatch = i > 0 ? reversed[i - 1] : null;
      
      let daysRest = 0;
      if (prevMatch) {
        const currentDate = new Date(match.date);
        const prevDate = new Date(prevMatch.date);
        daysRest = Math.floor((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      }
      
      // Calculate rolling 3-match average serve/return performance
      let rollingAvgServe = null;
      let rollingAvgReturn = null;
      if (i >= 2) {
        const last3 = reversed.slice(Math.max(0, i - 2), i + 1);
        const serveValues = last3.map(m => m.serve_pct).filter(v => v !== null && v !== undefined) as number[];
        const returnValues = last3.map(m => m.return_pct).filter(v => v !== null && v !== undefined) as number[];
        
        if (serveValues.length > 0) {
          rollingAvgServe = serveValues.reduce((a, b) => a + b, 0) / serveValues.length;
        }
        if (returnValues.length > 0) {
          rollingAvgReturn = returnValues.reduce((a, b) => a + b, 0) / returnValues.length;
        }
      }
      
      processed.push({
        match: i + 1,
        date: match.date,
        daysRest,
        won: match.winner,
        servePct: match.serve_pct ?? null,
        returnPct: match.return_pct ?? null,
        rollingAvgServe,
        rollingAvgReturn,
        color: match.winner ? "#000000" : "#FF8C42",
      });
    }
    
    return processed;
  };

  const p1Data = processMatches(playerOneMatches);
  const p2Data = processMatches(playerTwoMatches);

  // Combine for display
  const data = Array.from({ length: Math.max(p1Data.length, p2Data.length) }, (_, idx) => ({
    match: idx + 1,
    p1: p1Data[idx] || null,
    p2: p2Data[idx] || null,
  }));

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Rest & Fatigue Timeline (Last 10 Matches)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Days rest between matches (scatter) + Rolling 3-match average serve/return performance (lines). Black = win, Orange = loss.
        </Typography>
        <ResponsiveContainer width="100%" height={500}>
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="match" 
              label={{ value: "Match Number", position: "insideBottom", offset: -5 }}
            />
            <YAxis 
              yAxisId="rest"
              label={{ value: "Days Rest", angle: -90, position: "insideLeft" }}
              domain={[0, "dataMax + 5"]}
            />
            <YAxis 
              yAxisId="performance"
              orientation="right"
              label={{ value: "Serve/Return %", angle: 90, position: "insideRight" }}
              domain={[0, 1]}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length > 0) {
                  const data = payload[0].payload;
                  return (
                    <div style={{ backgroundColor: "#fff", padding: "10px", border: "1px solid #ccc" }}>
                      <p><strong>Match {data.match}</strong></p>
                      {data.p1 && (
                        <div>
                          <p style={{ color: data.p1.color }}>
                            {playerOneName}: {data.p1.daysRest} days rest
                            {data.p1.won ? " ✓ WIN" : " ✗ LOSS"}
                          </p>
                          {data.p1.rollingAvgServe !== null && (
                            <p>Rolling Avg: Serve {data.p1.rollingAvgServe.toFixed(3)}, Return {data.p1.rollingAvgReturn?.toFixed(3)}</p>
                          )}
                        </div>
                      )}
                      {data.p2 && (
                        <div>
                          <p style={{ color: data.p2.color }}>
                            {playerTwoName}: {data.p2.daysRest} days rest
                            {data.p2.won ? " ✓ WIN" : " ✗ LOSS"}
                          </p>
                          {data.p2.rollingAvgServe !== null && (
                            <p>Rolling Avg: Serve {data.p2.rollingAvgServe.toFixed(3)}, Return {data.p2.rollingAvgReturn?.toFixed(3)}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            {/* Days Rest Scatter - Player 1 */}
            <Scatter
              yAxisId="rest"
              name={`${playerOneName} Days Rest`}
              data={p1Data.map(d => ({ match: d.match, daysRest: d.daysRest, color: d.color }))}
              fill="#00bcd4"
              shape={(props: any) => {
                const { cx, cy, payload } = props;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={6}
                    fill={payload.color || "#00bcd4"}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                );
              }}
            />
            {/* Days Rest Scatter - Player 2 */}
            <Scatter
              yAxisId="rest"
              name={`${playerTwoName} Days Rest`}
              data={p2Data.map(d => ({ match: d.match, daysRest: d.daysRest, color: d.color }))}
              fill="#ff6b6b"
              shape={(props: any) => {
                const { cx, cy, payload } = props;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={6}
                    fill={payload.color || "#ff6b6b"}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                );
              }}
            />
            {/* Rolling Average Lines */}
            <Line
              yAxisId="performance"
              type="monotone"
              dataKey="p1.rollingAvgServe"
              name={`${playerOneName} Rolling Avg Serve`}
              stroke="#00bcd4"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
            <Line
              yAxisId="performance"
              type="monotone"
              dataKey="p2.rollingAvgServe"
              name={`${playerTwoName} Rolling Avg Serve`}
              stroke="#ff6b6b"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default RestFatigueTimelineGraph;

