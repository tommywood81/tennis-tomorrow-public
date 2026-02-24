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
} from "recharts";
import { PlayerRecentMatch } from "../api/types";

interface Props {
  playerOneName: string;
  playerTwoName: string;
  playerOneMatches: PlayerRecentMatch[];
  playerTwoMatches: PlayerRecentMatch[];
}

const DifficultyOfRecentOpponentsGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  // Process matches for bubble chart
  const processMatches = (matches: PlayerRecentMatch[], playerName: string) => {
    const reversed = matches.slice().reverse().slice(0, 10);
    return reversed.map((match, idx) => {
      const opponentRank = match.opponent_rank ?? 1000;
      const opponentQuality = opponentRank > 0 ? 1 / opponentRank : 0; // Higher quality = lower rank
      const bubbleSize = Math.max(50, Math.min(300, opponentQuality * 10000)); // Scale for visibility
      
      return {
        match: idx + 1,
        opponentRank,
        opponentQuality,
        bubbleSize,
        won: match.winner,
        opponent: match.opponent,
        color: match.winner ? "#000000" : "#FF8C42", // Black for wins, warm orange for losses
      };
    });
  };

  const p1Data = processMatches(playerOneMatches, playerOneName);
  const p2Data = processMatches(playerTwoMatches, playerTwoName);

  // Combine data for display
  const data = Array.from({ length: Math.max(p1Data.length, p2Data.length) }, (_, idx) => ({
    match: idx + 1,
    p1: p1Data[idx] || null,
    p2: p2Data[idx] || null,
  }));

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Difficulty of Recent Opponents (Last 10 Matches)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Bubble size = opponent quality (1/rank). Black = win, Orange = loss. Lower rank (top of chart) = stronger opponent.
        </Typography>
        <ResponsiveContainer width="100%" height={500}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              type="number" 
              dataKey="match" 
              name="Match" 
              domain={[0.5, 10.5]}
              label={{ value: "Match Number", position: "insideBottom", offset: -5 }}
            />
            <YAxis 
              type="number" 
              dataKey="opponentRank" 
              name="Opponent Rank" 
              domain={[1, 200]}
              reversed
              label={{ value: "Opponent Rank (Lower = Stronger)", angle: -90, position: "insideLeft" }}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length > 0) {
                  const data = payload[0].payload;
                  return (
                    <div style={{ backgroundColor: "#fff", padding: "10px", border: "1px solid #ccc" }}>
                      <p><strong>Match {data.match}</strong></p>
                      {data.p1 && (
                        <div>
                          <p style={{ color: data.p1.color, fontWeight: "bold" }}>
                            {playerOneName}: vs {data.p1.opponent} (Rank #{data.p1.opponentRank})
                            {data.p1.won ? " ✓ WIN" : " ✗ LOSS"}
                          </p>
                        </div>
                      )}
                      {data.p2 && (
                        <div>
                          <p style={{ color: data.p2.color, fontWeight: "bold" }}>
                            {playerTwoName}: vs {data.p2.opponent} (Rank #{data.p2.opponentRank})
                            {data.p2.won ? " ✓ WIN" : " ✗ LOSS"}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            <Scatter
              name={playerOneName}
              data={p1Data.map(d => ({ match: d.match, opponentRank: d.opponentRank, color: d.color, bubbleSize: d.bubbleSize }))}
              fill="#00bcd4"
              shape={(props: any) => {
                const { cx, cy, payload } = props;
                const r = Math.sqrt((payload.bubbleSize || 100) / Math.PI);
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={payload.color || "#00bcd4"}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                );
              }}
            />
            <Scatter
              name={playerTwoName}
              data={p2Data.map(d => ({ match: d.match, opponentRank: d.opponentRank, color: d.color, bubbleSize: d.bubbleSize }))}
              fill="#ff6b6b"
              shape={(props: any) => {
                const { cx, cy, payload } = props;
                const r = Math.sqrt((payload.bubbleSize || 100) / Math.PI);
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={payload.color || "#ff6b6b"}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default DifficultyOfRecentOpponentsGraph;

