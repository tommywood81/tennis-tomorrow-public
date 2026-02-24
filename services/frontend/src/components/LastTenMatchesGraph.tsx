import { Card, CardContent, Typography, Box, useTheme, useMediaQuery } from "@mui/material";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
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

const LastTenMatchesGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  
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
    
    return {
      label: `M${idx + 1}`, // Keep simple label for axis
      xAxisLabel, // Full label with opponent info
      playerA_opponent: playerAOpponent,
      playerA_opponent_rank: playerAOpponentRank,
      playerA_opponent_label: playerAOpponentLabel,
      playerB_opponent: playerBOpponent,
      playerB_opponent_rank: playerBOpponentRank,
      playerB_opponent_label: playerBOpponentLabel,
      playerA_serve: playerOneMatch?.serve_pct != null ? playerOneMatch.serve_pct * 100 : null,
      playerA_return: playerOneMatch?.return_pct != null ? playerOneMatch.return_pct * 100 : null,
      playerB_serve: playerTwoMatch?.serve_pct != null ? playerTwoMatch.serve_pct * 100 : null,
      playerB_return: playerTwoMatch?.return_pct != null ? playerTwoMatch.return_pct * 100 : null,
      // Add win/loss indicators for custom dot rendering
      playerA_won: playerOneMatch?.winner ?? false,
      playerB_won: playerTwoMatch?.winner ?? false,
    };
  });

  return (
    <Card>
      <CardContent sx={{ touchAction: "pan-x pan-y pinch-zoom", p: { xs: 2, sm: 3 } }}>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          Last 10 Matches Performance
        </Typography>
        <Box 
          sx={{ 
            touchAction: "pan-x pan-y pinch-zoom", 
            overflowX: "auto", 
            overflowY: "hidden",
            WebkitOverflowScrolling: "touch", 
            width: "100%",
            position: "relative",
            "-webkit-overflow-scrolling": "touch"
          }}
        >
          <Box sx={{ minWidth: { xs: "700px", sm: "600px" }, width: { xs: "700px", sm: "100%" } }}>
          <ResponsiveContainer width={isMobile ? 700 : "100%"} height={isMobile ? 400 : 585}>
          <LineChart data={data} margin={{ top: 20, right: 20, left: isMobile ? 5 : 10, bottom: isMobile ? 80 : 120 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.1)" />
            <XAxis 
              dataKey="xAxisLabel" 
              tick={{ fill: "#1A1A1A", fontSize: isMobile ? 8 : 9 }}
              allowDuplicatedCategory={false}
              angle={-45}
              textAnchor="end"
              height={isMobile ? 80 : 120}
              interval={0}
            />
            <YAxis 
              domain={[0, 100]} 
              tick={{ fill: "#1A1A1A", fontSize: isMobile ? 10 : 12 }}
              width={isMobile ? 30 : 40}
            />
            {!isMobile ? (
              <Tooltip
                contentStyle={{ 
                  backgroundColor: "#1A1A1A", 
                  border: "1px solid rgba(90, 155, 213, 0.3)",
                  borderRadius: "6px",
                  color: "#FFFFFF",
                }}
                trigger="hover"
                formatter={(value, name) => {
                  if (value === null || value === undefined) return ["N/A", name];
                  return [`${Number(value).toFixed(1)}%`, name];
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
            ) : null}
            <Legend 
              wrapperStyle={{ paddingTop: "20px", color: "#1A1A1A" }}
              iconType="line"
            />
            {/* Player A - Blue colors */}
            <Line
              type="monotone"
              dataKey="playerA_serve"
              stroke="#5A9BD5"
              strokeWidth={3}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (!payload || payload.playerA_serve == null) {
                  return <circle cx={cx} cy={cy} r={0} fill="transparent" />;
                }
                const fill = payload.playerA_won ? "#5A9BD5" : "#6B7280"; // Blue for win, gray for loss
                return <circle cx={cx} cy={cy} r={5} fill={fill} stroke="#5A9BD5" strokeWidth={2} />;
              }}
              name={`${playerOneName} Serve %`}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="playerA_return"
              stroke="#7AB8E8"
              strokeWidth={3}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (!payload || payload.playerA_return == null) {
                  return <circle cx={cx} cy={cy} r={0} fill="transparent" />;
                }
                const fill = payload.playerA_won ? "#7AB8E8" : "#6B7280"; // Light blue for win, gray for loss
                return <circle cx={cx} cy={cy} r={5} fill={fill} stroke="#7AB8E8" strokeWidth={2} />;
              }}
              name={`${playerOneName} Return %`}
              connectNulls={false}
            />
            {/* Player B - Orange colors */}
            <Line
              type="monotone"
              dataKey="playerB_serve"
              stroke="#6B7280"
              strokeWidth={3}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (!payload || payload.playerB_serve == null) {
                  return <circle cx={cx} cy={cy} r={0} fill="transparent" />;
                }
                const fill = payload.playerB_won ? "#6B7280" : "#5A9BD5"; // Gray for win, blue for loss
                return <circle cx={cx} cy={cy} r={5} fill={fill} stroke="#6B7280" strokeWidth={2} />;
              }}
              name={`${playerTwoName} Serve %`}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="playerB_return"
              stroke="#9CA3AF"
              strokeWidth={3}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (!payload || payload.playerB_return == null) {
                  return <circle cx={cx} cy={cy} r={0} fill="transparent" />;
                }
                const fill = payload.playerB_won ? "#9CA3AF" : "#5A9BD5"; // Light gray for win, blue for loss
                return <circle cx={cx} cy={cy} r={5} fill={fill} stroke="#9CA3AF" strokeWidth={2} />;
              }}
              name={`${playerTwoName} Return %`}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default LastTenMatchesGraph;

