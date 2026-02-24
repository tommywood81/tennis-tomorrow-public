import { Card, CardContent, Typography, Grid } from "@mui/material";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
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

const VolatilityBoxplotGraph = ({
  playerOneName,
  playerTwoName,
  playerOneMatches,
  playerTwoMatches,
}: Props) => {
  // Get last 10 matches only
  const getLast10 = (matches: PlayerRecentMatch[]) => {
    return matches.slice().reverse().slice(0, 10);
  };

  const p1Last10 = getLast10(playerOneMatches);
  const p2Last10 = getLast10(playerTwoMatches);

  // Calculate box plot statistics (Q1, Median, Q3, Min, Max, Mean, StdDev)
  const calculateBoxPlotStats = (values: number[]) => {
    if (values.length === 0) {
      return { min: 0, q1: 0, median: 0, q3: 0, max: 0, mean: 0, stdDev: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    
    const min = sorted[0];
    const max = sorted[n - 1];
    const mean = sorted.reduce((a, b) => a + b, 0) / n;
    
    // Calculate quartiles
    const q1Index = Math.floor(n * 0.25);
    const medianIndex = Math.floor(n * 0.5);
    const q3Index = Math.floor(n * 0.75);
    
    const q1 = sorted[q1Index];
    const median = sorted[medianIndex];
    const q3 = sorted[q3Index];
    
    // Calculate standard deviation
    const variance = sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    
    return { min, q1, median, q3, max, mean, stdDev };
  };

  const calculateStats = (matches: PlayerRecentMatch[]) => {
    const serveValues = matches
      .map((m) => m.serve_pct)
      .filter((v): v is number => v !== null && v !== undefined);
    const returnValues = matches
      .map((m) => m.return_pct)
      .filter((v): v is number => v !== null && v !== undefined);

    return {
      serve: calculateBoxPlotStats(serveValues),
      return: calculateBoxPlotStats(returnValues),
    };
  };

  const p1Stats = calculateStats(p1Last10);
  const p2Stats = calculateStats(p2Last10);

  // Prepare data for visualization - separate for serve and return
  const serveData = [
    {
      stat: "Serve %",
      [`${playerOneName} Mean`]: p1Stats.serve.mean * 100,
      [`${playerOneName} StdDev`]: p1Stats.serve.stdDev * 100,
      [`${playerOneName} Min`]: p1Stats.serve.min * 100,
      [`${playerOneName} Q1`]: p1Stats.serve.q1 * 100,
      [`${playerOneName} Median`]: p1Stats.serve.median * 100,
      [`${playerOneName} Q3`]: p1Stats.serve.q3 * 100,
      [`${playerOneName} Max`]: p1Stats.serve.max * 100,
      [`${playerTwoName} Mean`]: p2Stats.serve.mean * 100,
      [`${playerTwoName} StdDev`]: p2Stats.serve.stdDev * 100,
      [`${playerTwoName} Min`]: p2Stats.serve.min * 100,
      [`${playerTwoName} Q1`]: p2Stats.serve.q1 * 100,
      [`${playerTwoName} Median`]: p2Stats.serve.median * 100,
      [`${playerTwoName} Q3`]: p2Stats.serve.q3 * 100,
      [`${playerTwoName} Max`]: p2Stats.serve.max * 100,
    },
  ];

  const returnData = [
    {
      stat: "Return %",
      [`${playerOneName} Mean`]: p1Stats.return.mean * 100,
      [`${playerOneName} StdDev`]: p1Stats.return.stdDev * 100,
      [`${playerOneName} Min`]: p1Stats.return.min * 100,
      [`${playerOneName} Q1`]: p1Stats.return.q1 * 100,
      [`${playerOneName} Median`]: p1Stats.return.median * 100,
      [`${playerOneName} Q3`]: p1Stats.return.q3 * 100,
      [`${playerOneName} Max`]: p1Stats.return.max * 100,
      [`${playerTwoName} Mean`]: p2Stats.return.mean * 100,
      [`${playerTwoName} StdDev`]: p2Stats.return.stdDev * 100,
      [`${playerTwoName} Min`]: p2Stats.return.min * 100,
      [`${playerTwoName} Q1`]: p2Stats.return.q1 * 100,
      [`${playerTwoName} Median`]: p2Stats.return.median * 100,
      [`${playerTwoName} Q3`]: p2Stats.return.q3 * 100,
      [`${playerTwoName} Max`]: p2Stats.return.max * 100,
    },
  ];

  // Custom shape for box plots
  const BoxPlotBar = (props: any) => {
    const { x, y, width, payload, playerName, color, stats } = props;
    
    const offset = playerName === playerOneName ? -30 : 30;
    const xPos = x + offset;
    const boxWidth = 50; // Larger box width for better visibility
    
    // Calculate Y positions relative to mean (y is at mean position)
    // The chart Y-axis goes from 0 (bottom) to 100 (top), so we need to invert
    // y is the Y coordinate of the mean value on the chart
    const chartHeight = 400; // Approximate chart height
    const yScale = chartHeight / 100; // Scale factor
    
    // Calculate relative positions from mean
    const minY = y + (stats.mean - stats.min) * 100 * yScale / 100;
    const q1Y = y + (stats.mean - stats.q1) * 100 * yScale / 100;
    const medianY = y + (stats.mean - stats.median) * 100 * yScale / 100;
    const q3Y = y + (stats.mean - stats.q3) * 100 * yScale / 100;
    const maxY = y + (stats.mean - stats.max) * 100 * yScale / 100;
    const meanY = y;
    
    const boxHeight = Math.abs(q1Y - q3Y);
    const boxTop = Math.min(q1Y, q3Y);
    
    return (
      <g>
        {/* Whiskers */}
        <line x1={xPos} y1={minY} x2={xPos} y2={q3Y} stroke={color} strokeWidth={2} />
        <line x1={xPos} y1={q1Y} x2={xPos} y2={maxY} stroke={color} strokeWidth={2} />
        
        {/* Whisker caps */}
        <line x1={xPos - 8} y1={minY} x2={xPos + 8} y2={minY} stroke={color} strokeWidth={2} />
        <line x1={xPos - 8} y1={maxY} x2={xPos + 8} y2={maxY} stroke={color} strokeWidth={2} />
        
        {/* Box */}
        <rect
          x={xPos - boxWidth / 2}
          y={boxTop}
          width={boxWidth}
          height={boxHeight}
          fill={color}
          fillOpacity={0.6}
          stroke={color}
          strokeWidth={2}
        />
        
        {/* Median line */}
        <line
          x1={xPos - boxWidth / 2}
          y1={medianY}
          x2={xPos + boxWidth / 2}
          y2={medianY}
          stroke="#fff"
          strokeWidth={2}
        />
        
        {/* Mean point */}
        <circle cx={xPos} cy={meanY} r={5} fill="#fff" stroke={color} strokeWidth={2} />
        
        {/* StdDev label */}
        <text
          x={xPos + boxWidth / 2 + 10}
          y={meanY + 5}
          fill={color}
          fontSize={12}
          fontWeight="bold"
        >
          σ: {(stats.stdDev * 100).toFixed(2)}%
        </text>
      </g>
    );
  };

  // Render a single box plot chart
  const renderBoxPlotChart = (data: any[], statType: "serve" | "return", title: string) => {
    const p1StatsForType = statType === "serve" ? p1Stats.serve : p1Stats.return;
    const p2StatsForType = statType === "serve" ? p2Stats.serve : p2Stats.return;

    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {title} - Last 10 Matches
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Box plot showing distribution over the last 10 matches. Each box shows the interquartile range (Q1 to Q3), 
            median line, mean point (circle), and min/max whiskers. Standard deviation (σ) is labeled. 
            Lower volatility (smaller boxes) indicates more consistent performance.
          </Typography>
          <ResponsiveContainer width="100%" height={500}>
            <ComposedChart data={data} margin={{ top: 40, right: 120, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stat" />
              <YAxis 
                label={{ value: "Percentage (%)", angle: -90, position: "insideLeft" }}
                domain={[0, 100]}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length > 0) {
                    const data = payload[0].payload;
                    return (
                      <div style={{ backgroundColor: "#fff", padding: "10px", border: "1px solid #ccc" }}>
                        <p><strong>{data.stat}</strong></p>
                        <p>{playerOneName}:</p>
                        <ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
                          <li>Min: {data[`${playerOneName} Min`]?.toFixed(1)}%</li>
                          <li>Q1: {data[`${playerOneName} Q1`]?.toFixed(1)}%</li>
                          <li>Median: {data[`${playerOneName} Median`]?.toFixed(1)}%</li>
                          <li>Mean: {data[`${playerOneName} Mean`]?.toFixed(1)}%</li>
                          <li>Q3: {data[`${playerOneName} Q3`]?.toFixed(1)}%</li>
                          <li>Max: {data[`${playerOneName} Max`]?.toFixed(1)}%</li>
                          <li>StdDev: {data[`${playerOneName} StdDev`]?.toFixed(2)}%</li>
                        </ul>
                        <p>{playerTwoName}:</p>
                        <ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
                          <li>Min: {data[`${playerTwoName} Min`]?.toFixed(1)}%</li>
                          <li>Q1: {data[`${playerTwoName} Q1`]?.toFixed(1)}%</li>
                          <li>Median: {data[`${playerTwoName} Median`]?.toFixed(1)}%</li>
                          <li>Mean: {data[`${playerTwoName} Mean`]?.toFixed(1)}%</li>
                          <li>Q3: {data[`${playerTwoName} Q3`]?.toFixed(1)}%</li>
                          <li>Max: {data[`${playerTwoName} Max`]?.toFixed(1)}%</li>
                          <li>StdDev: {data[`${playerTwoName} StdDev`]?.toFixed(2)}%</li>
                        </ul>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend />
              <ReferenceLine y={50} stroke="#ccc" strokeDasharray="3 3" label="50% Baseline" />
              
              {/* Invisible bars to position box plots - Player 1 */}
              <Bar
                dataKey={`${playerOneName} Mean`}
                fill="transparent"
                shape={(props: any) => (
                  <BoxPlotBar {...props} playerName={playerOneName} color="#00bcd4" stats={p1StatsForType} />
                )}
              />
              
              {/* Invisible bars to position box plots - Player 2 */}
              <Bar
                dataKey={`${playerTwoName} Mean`}
                fill="transparent"
                shape={(props: any) => (
                  <BoxPlotBar {...props} playerName={playerTwoName} color="#ff6b6b" stats={p2StatsForType} />
                )}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        {renderBoxPlotChart(serveData, "serve", "Serve % Volatility")}
      </Grid>
      <Grid item xs={12} md={6}>
        {renderBoxPlotChart(returnData, "return", "Return % Volatility")}
      </Grid>
    </Grid>
  );
};

export default VolatilityBoxplotGraph;
