import { Card, CardContent, Typography, Box, useTheme, useMediaQuery } from "@mui/material";
import {
  LineChart,
  Line,
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

const MonthlyRankGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const calculateMonthlyRanks = (matches: PlayerRecentMatch[]) => {
    const monthlyRanks: Map<string, { rank: number; date: Date }[]> = new Map();
    
    // Sort matches by date (most recent first)
    const sortedMatches = matches.slice().sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });
    
    const now = new Date();
    const monthsAgo = new Date(now);
    monthsAgo.setMonth(monthsAgo.getMonth() - 12);
    monthsAgo.setDate(1); // Set to first day of month for consistent comparison
    monthsAgo.setHours(0, 0, 0, 0);
    
    // Group matches by month, keeping track of date for sorting
    sortedMatches.forEach((match) => {
      const matchDate = new Date(match.date);
      matchDate.setHours(0, 0, 0, 0);
      
      if (matchDate >= monthsAgo && match.player_rank !== null && match.player_rank !== undefined) {
        const monthKey = `${matchDate.getFullYear()}-${String(matchDate.getMonth() + 1).padStart(2, '0')}`;
        const existing = monthlyRanks.get(monthKey) || [];
        existing.push({ rank: match.player_rank, date: matchDate });
        monthlyRanks.set(monthKey, existing);
      }
    });
    
    // Generate all months for the last 12 months
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.push(monthKey);
    }
    
    // Use most recent rank in each month, forward-fill if no data
    let lastRank: number | null = null;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return months.map((month) => {
      const rankEntries = monthlyRanks.get(month);
      if (rankEntries && rankEntries.length > 0) {
        // Sort by date descending (most recent first) and take the first one
        rankEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
        lastRank = rankEntries[0].rank;
      }
      
      // Format: "Jan 24" or "Jan 25"
      const [year, monthNum] = month.split('-');
      const monthIndex = parseInt(monthNum, 10) - 1;
      const shortYear = year.substring(2);
      const monthLabel = `${monthNames[monthIndex]} ${shortYear}`;
      
      return {
        month: monthLabel,
        rank: lastRank,
      };
    });
  };

  const p1Ranks = calculateMonthlyRanks(playerOneMatches);
  const p2Ranks = calculateMonthlyRanks(playerTwoMatches);
  
  const data = p1Ranks.map((p1, idx) => ({
    month: p1.month,
    [playerOneName]: p1.rank,
    [playerTwoName]: p2Ranks[idx]?.rank || null,
  }));
  
  // Calculate domain for Y-axis, with fallback if no data
  const allRanks = [
    ...p1Ranks.map(r => r.rank).filter((r): r is number => r !== null),
    ...p2Ranks.map(r => r.rank).filter((r): r is number => r !== null),
  ];
  const minRank = allRanks.length > 0 ? Math.min(...allRanks) : 1;
  const maxRank = allRanks.length > 0 ? Math.max(...allRanks) : 100;
  const yAxisDomain = allRanks.length > 0 
    ? ['dataMin - 10', 'dataMax + 10'] 
    : [1, 100];

  return (
    <Card>
      <CardContent sx={{ touchAction: "pan-x pan-y pinch-zoom", p: { xs: 2, sm: 3 } }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Monthly Rank Trends (Last 12 Months)
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Player ranking over the last 12 months (lower is better)
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
          <Box sx={{ minWidth: { xs: "600px", sm: "400px" }, width: { xs: "600px", sm: "100%" } }}>
          <ResponsiveContainer width={isMobile ? 600 : "100%"} height={isMobile ? 350 : 400}>
          <LineChart data={data} margin={{ top: 5, right: isMobile ? 10 : 30, left: isMobile ? 5 : 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.1)" />
            <XAxis 
              dataKey="month" 
              tick={{ fill: "#1A1A1A", fontSize: isMobile ? 10 : 12 }}
            />
            <YAxis 
              label={{ value: "Rank", angle: -90, position: "insideLeft", fill: "#1A1A1A" }}
              reversed
              domain={yAxisDomain}
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
                formatter={(value: any) => {
                  if (value === null || value === undefined) return "N/A";
                  return `#${Math.round(value)}`;
                }}
              />
            ) : null}
            <Legend 
              wrapperStyle={{ color: "#1A1A1A" }}
            />
            <Line 
              type="monotone" 
              dataKey={playerOneName} 
              stroke="#5A9BD5" 
              strokeWidth={2}
              dot={{ r: 4, fill: "#5A9BD5" }}
              connectNulls={false}
            />
            <Line 
              type="monotone" 
              dataKey={playerTwoName} 
              stroke="#6B7280" 
              strokeWidth={2}
              dot={{ r: 4, fill: "#6B7280" }}
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

export default MonthlyRankGraph;

