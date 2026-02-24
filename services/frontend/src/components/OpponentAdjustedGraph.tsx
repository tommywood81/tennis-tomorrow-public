import { Card, CardContent, Typography } from "@mui/material";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { PlayerRecentMatch } from "../api/types";

interface Props {
  playerOneName: string;
  playerTwoName: string;
  playerOneMatches: PlayerRecentMatch[];
  playerTwoMatches: PlayerRecentMatch[];
}

const OpponentAdjustedGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  // Reverse both arrays to show most recent matches first, then take up to 10
  const playerOneReversed = playerOneMatches.slice().reverse().slice(0, 10);
  const playerTwoReversed = playerTwoMatches.slice().reverse().slice(0, 10);
  
  // Find the maximum number of matches to display (up to 10)
  const maxLength = Math.min(10, Math.max(playerOneReversed.length, playerTwoReversed.length));
  
  // Build combined data array with all four metrics aligned by match index
  // Both players' stats will appear at the same x-axis position
  const data = Array.from({ length: maxLength }, (_, idx) => {
    const playerOneMatch = playerOneReversed[idx];
    const playerTwoMatch = playerTwoReversed[idx];
    
    // Create labels with opponent names and ranks
    const playerAOpponent = playerOneMatch?.opponent || "";
    const playerAOpponentRank = playerOneMatch?.opponent_rank;
    const playerAOpponentLabel = playerAOpponentRank 
      ? `${playerAOpponent} (#${playerAOpponentRank})` 
      : playerAOpponent;
    
    const playerBOpponent = playerTwoMatch?.opponent || "";
    const playerBOpponentRank = playerTwoMatch?.opponent_rank;
    const playerBOpponentLabel = playerBOpponentRank 
      ? `${playerBOpponent} (#${playerBOpponentRank})` 
      : playerBOpponent;
    
    // Create a combined label for the X-axis showing both opponents
    let xAxisLabel = `M${idx + 1}`;
    if (playerAOpponent || playerBOpponent) {
      const parts = [];
      if (playerAOpponentLabel) parts.push(`P1: ${playerAOpponentLabel}`);
      if (playerBOpponentLabel) parts.push(`P2: ${playerBOpponentLabel}`);
      if (parts.length > 0) {
        xAxisLabel = parts.join(" | ");
      }
    }
    
    // Calculate adjustment amounts (raw - adjusted = opponent ability removed)
    // Positive adjustment = faced strong opponent, negative = faced weak opponent
    const playerARawServe = playerOneMatch?.serve_pct != null ? playerOneMatch.serve_pct * 100 : null;
    const playerARawReturn = playerOneMatch?.return_pct != null ? playerOneMatch.return_pct * 100 : null;
    const playerAAdjServe = playerOneMatch?.opponent_adjusted_serve_pct != null ? playerOneMatch.opponent_adjusted_serve_pct * 100 : null;
    const playerAAdjReturn = playerOneMatch?.opponent_adjusted_return_pct != null ? playerOneMatch.opponent_adjusted_return_pct * 100 : null;
    
    const playerBRawServe = playerTwoMatch?.serve_pct != null ? playerTwoMatch.serve_pct * 100 : null;
    const playerBRawReturn = playerTwoMatch?.return_pct != null ? playerTwoMatch.return_pct * 100 : null;
    const playerBAdjServe = playerTwoMatch?.opponent_adjusted_serve_pct != null ? playerTwoMatch.opponent_adjusted_serve_pct * 100 : null;
    const playerBAdjReturn = playerTwoMatch?.opponent_adjusted_return_pct != null ? playerTwoMatch.opponent_adjusted_return_pct * 100 : null;
    
    // Adjustment = raw - adjusted (how much opponent quality affected the stat)
    const playerAServeAdjustment = (playerARawServe != null && playerAAdjServe != null) 
      ? playerARawServe - playerAAdjServe 
      : null;
    const playerAReturnAdjustment = (playerARawReturn != null && playerAAdjReturn != null)
      ? playerARawReturn - playerAAdjReturn
      : null;
    const playerBServeAdjustment = (playerBRawServe != null && playerBAdjServe != null)
      ? playerBRawServe - playerBAdjServe
      : null;
    const playerBReturnAdjustment = (playerBRawReturn != null && playerBAdjReturn != null)
      ? playerBRawReturn - playerBAdjReturn
      : null;
    
    return {
      label: `M${idx + 1}`, // Keep simple label for axis
      xAxisLabel, // Full label with opponent info
      playerA_opponent: playerAOpponent,
      playerA_opponent_rank: playerAOpponentRank,
      playerA_opponent_label: playerAOpponentLabel,
      playerB_opponent: playerBOpponent,
      playerB_opponent_rank: playerBOpponentRank,
      playerB_opponent_label: playerBOpponentLabel,
      // Show adjustment amounts (difference between raw and adjusted)
      playerA_serve_adj: playerAServeAdjustment,
      playerA_return_adj: playerAReturnAdjustment,
      playerB_serve_adj: playerBServeAdjustment,
      playerB_return_adj: playerBReturnAdjustment,
      // Keep raw values for tooltip reference
      playerA_raw_serve: playerARawServe,
      playerA_raw_return: playerARawReturn,
      playerA_adj_serve: playerAAdjServe,
      playerA_adj_return: playerAAdjReturn,
      playerB_raw_serve: playerBRawServe,
      playerB_raw_return: playerBRawReturn,
      playerB_adj_serve: playerBAdjServe,
      playerB_adj_return: playerBAdjReturn,
      // Add win/loss indicators
      playerA_won: playerOneMatch?.winner ?? false,
      playerB_won: playerTwoMatch?.winner ?? false,
    };
  });

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Opponent Quality Adjustment (Raw - Adjusted)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: "0.75rem" }}>
          Shows how much opponent quality affected performance. Positive = faced strong opponent, Negative = faced weak opponent.
        </Typography>
        <ResponsiveContainer width="100%" height={450}>
          <BarChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 120 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
            <XAxis 
              dataKey="xAxisLabel" 
              tick={{ fill: "#c5d0d9", fontSize: 9 }}
              angle={-45}
              textAnchor="end"
              height={120}
              interval={0}
            />
            <YAxis 
              tick={{ fill: "#c5d0d9" }}
              label={{ value: "Adjustment (%)", angle: -90, position: "insideLeft", fill: "#c5d0d9" }}
            />
            <ReferenceLine y={0} stroke="#888" strokeDasharray="2 2" />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              formatter={(value: any, name: string, props: any) => {
                if (value === null || value === undefined) return ["N/A", name];
                const sign = Number(value) >= 0 ? "+" : "";
                const payload = props.payload;
                let details = "";
                
                if (name.includes("Serve")) {
                  if (name.includes(playerOneName)) {
                    details = `\nRaw: ${payload.playerA_raw_serve?.toFixed(1) || "N/A"}% → Adj: ${payload.playerA_adj_serve?.toFixed(1) || "N/A"}%`;
                  } else {
                    details = `\nRaw: ${payload.playerB_raw_serve?.toFixed(1) || "N/A"}% → Adj: ${payload.playerB_adj_serve?.toFixed(1) || "N/A"}%`;
                  }
                } else {
                  if (name.includes(playerOneName)) {
                    details = `\nRaw: ${payload.playerA_raw_return?.toFixed(1) || "N/A"}% → Adj: ${payload.playerA_adj_return?.toFixed(1) || "N/A"}%`;
                  } else {
                    details = `\nRaw: ${payload.playerB_raw_return?.toFixed(1) || "N/A"}% → Adj: ${payload.playerB_adj_return?.toFixed(1) || "N/A"}%`;
                  }
                }
                
                return [`${sign}${Number(value).toFixed(1)}%${details}`, name];
              }}
              labelFormatter={(label, payload) => {
                if (!payload || payload.length === 0) return label;
                const data = payload[0]?.payload;
                if (!data) return label;
                
                const parts = [];
                if (data.playerA_opponent_label) {
                  parts.push(`${playerOneName}: vs ${data.playerA_opponent_label}`);
                }
                if (data.playerB_opponent_label) {
                  parts.push(`${playerTwoName}: vs ${data.playerB_opponent_label}`);
                }
                return parts.length > 0 ? parts.join(" | ") : label;
              }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: "20px" }}
            />
            {/* Player A - Bold colors that go together (teal/cyan theme) */}
            <Bar
              dataKey="playerA_serve_adj"
              fill="#00a0b0"
              name={`${playerOneName} Serve Adjustment`}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="playerA_return_adj"
              fill="#00d4ff"
              name={`${playerOneName} Return Adjustment`}
              radius={[4, 4, 0, 0]}
            />
            {/* Player B - Opposite colors that work with scheme (coral/magenta) */}
            <Bar
              dataKey="playerB_serve_adj"
              fill="#ff6b35"
              name={`${playerTwoName} Serve Adjustment`}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="playerB_return_adj"
              fill="#c44569"
              name={`${playerTwoName} Return Adjustment`}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default OpponentAdjustedGraph;

