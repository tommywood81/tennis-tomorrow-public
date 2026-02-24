import { Card, CardContent, Typography } from "@mui/material";
import {
  LineChart,
  Line,
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

const OpponentRankNormalizedGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  // Normalize rank: 1 / (1 + rank) - this is opp_rank_norm_weighted feature
  const normalizeRank = (rank: number | undefined): number | null => {
    if (!rank || rank > 1000) return null;
    return 1 / (1 + rank); // Normalized: rank 1 = 0.5, rank 10 = 0.091, rank 100 = 0.01
  };

  const playerOneReversed = playerOneMatches.slice().reverse().slice(0, 10);
  const playerTwoReversed = playerTwoMatches.slice().reverse().slice(0, 10);

  const maxLength = Math.min(10, Math.max(playerOneReversed.length, playerTwoReversed.length));

  const data = Array.from({ length: maxLength }, (_, idx) => {
    const p1Match = playerOneReversed[idx];
    const p2Match = playerTwoReversed[idx];

    const p1OppRankNorm = normalizeRank(p1Match?.opponent_rank);
    const p2OppRankNorm = normalizeRank(p2Match?.opponent_rank);

    // Also include raw rank for context
    const p1RawRank = p1Match?.opponent_rank ?? null;
    const p2RawRank = p2Match?.opponent_rank ?? null;

    const p1Opponent = p1Match?.opponent || "";
    const p2Opponent = p2Match?.opponent || "";

    let xAxisLabel = `M${idx + 1}`;
    if (p1Opponent || p2Opponent) {
      const parts = [];
      if (p1Opponent && p1RawRank) parts.push(`P1: ${p1Opponent} (#${p1RawRank})`);
      if (p2Opponent && p2RawRank) parts.push(`P2: ${p2Opponent} (#${p2RawRank})`);
      if (parts.length > 0) xAxisLabel = parts.join(" | ");
    }

    return {
      match: `M${idx + 1}`,
      xAxisLabel,
      playerA_opp_rank_norm: p1OppRankNorm,
      playerB_opp_rank_norm: p2OppRankNorm,
      playerA_raw_rank: p1RawRank,
      playerB_raw_rank: p2RawRank,
      playerA_won: p1Match?.winner ? 1 : (p1Match ? 0 : null),
      playerB_won: p2Match?.winner ? 1 : (p2Match ? 0 : null),
    };
  });

  // Calculate average normalized rank
  const p1AvgNorm = data
    .map((d) => d.playerA_opp_rank_norm)
    .filter((v) => v !== null) as number[];
  const p2AvgNorm = data
    .map((d) => d.playerB_opp_rank_norm)
    .filter((v) => v !== null) as number[];

  const p1Avg = p1AvgNorm.length > 0 
    ? p1AvgNorm.reduce((a, b) => a + b, 0) / p1AvgNorm.length 
    : null;
  const p2Avg = p2AvgNorm.length > 0 
    ? p2AvgNorm.reduce((a, b) => a + b, 0) / p2AvgNorm.length 
    : null;

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Normalized Opponent Rank (Last 10 Matches)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Shows opponent quality using normalized rank (opp_rank_norm_weighted feature): 
          1/(1+rank). Higher value = stronger opponent. 
          {p1Avg !== null && (
            <span> Avg: {playerOneName} {p1Avg.toFixed(3)}, {playerTwoName} {p2Avg?.toFixed(3) || "N/A"}</span>
          )}
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 120 }}>
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
              domain={[0, 0.6]}
              tick={{ fill: "#c5d0d9" }}
              label={{ value: "Normalized Rank", angle: -90, position: "insideLeft", fill: "#c5d0d9" }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#0e1a1f", border: "1px solid rgba(255,255,255,0.1)" }}
              formatter={(value: any, name: string, props: any) => {
                if (name.includes("won")) {
                  return value === 1 ? "Win" : value === 0 ? "Loss" : "N/A";
                }
                if (name.includes("norm")) {
                  const rawRank = name.includes("playerA") 
                    ? props.payload.playerA_raw_rank 
                    : props.payload.playerB_raw_rank;
                  return [`${value?.toFixed(3)} (Rank #${rawRank})`, name];
                }
                return [value, name];
              }}
              labelFormatter={(label) => label}
            />
            <Legend />
            {p1Avg !== null && (
              <ReferenceLine 
                y={p1Avg} 
                stroke="#00a0b0" 
                strokeDasharray="3 3" 
                strokeOpacity={0.5}
                label={{ value: `${playerOneName} Avg`, position: "top", fill: "#00a0b0" }}
              />
            )}
            {p2Avg !== null && (
              <ReferenceLine 
                y={p2Avg} 
                stroke="#ff6b35" 
                strokeDasharray="3 3" 
                strokeOpacity={0.5}
                label={{ value: `${playerTwoName} Avg`, position: "top", fill: "#ff6b35" }}
              />
            )}
            <Line
              type="monotone"
              dataKey="playerA_opp_rank_norm"
              stroke="#00a0b0"
              strokeWidth={3}
              name={`${playerOneName} Opponent Strength`}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (payload.playerA_opp_rank_norm == null) return <circle cx={cx} cy={cy} r={0} fill="transparent" />;
                const fill = payload.playerA_won === 1 ? "#00ff00" : payload.playerA_won === 0 ? "#ff0000" : "#00a0b0";
                return <circle cx={cx} cy={cy} r={5} fill={fill} stroke="#00a0b0" strokeWidth={2} />;
              }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="playerB_opp_rank_norm"
              stroke="#ff6b35"
              strokeWidth={3}
              name={`${playerTwoName} Opponent Strength`}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (payload.playerB_opp_rank_norm == null) return <circle cx={cx} cy={cy} r={0} fill="transparent" />;
                const fill = payload.playerB_won === 1 ? "#00ff00" : payload.playerB_won === 0 ? "#ff0000" : "#ff6b35";
                return <circle cx={cx} cy={cy} r={5} fill={fill} stroke="#ff6b35" strokeWidth={2} />;
              }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default OpponentRankNormalizedGraph;

