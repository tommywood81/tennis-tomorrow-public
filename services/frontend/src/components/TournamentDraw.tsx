import { Box, Typography, Stack, IconButton, useMediaQuery, useTheme } from "@mui/material";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import { useState, useEffect, useRef } from "react";
import { Tournament, TournamentMatch } from "../api/types";
import MatchNode from "./MatchNode";

interface TournamentDrawProps {
  tournament: Tournament;
}

// Helper to build bracket structure from rounds
const buildBracket = (rounds: Tournament["rounds"]) => {
  // Group matches by round and build bracket structure
  const bracketRounds: { round: string; matches: TournamentMatch[] }[] = [];

  // Process rounds in order: R128, R64, R32, R16, QF, SF, F
  const roundOrder = ["R128", "R64", "R32", "R16", "QF", "SF", "F"];
  
  for (const roundName of roundOrder) {
    const roundData = rounds.find((r) => r.round_name === roundName);
    if (roundData && roundData.matches.length > 0) {
      bracketRounds.push({
        round: roundName,
        matches: roundData.matches,
      });
    }
  }

  return bracketRounds;
};

// Helper to determine if prediction was correct
const isPredictionCorrect = (match: TournamentMatch): boolean => {
  const predictedWinner =
    match.predicted_probability_player_one >
    match.predicted_probability_player_two
      ? "player_one"
      : "player_two";
  return predictedWinner === match.actual_winner;
};

const TournamentDraw = ({ tournament }: TournamentDrawProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [zoom, setZoom] = useState(0.5); // Default to half size
  const bracketRounds = buildBracket(tournament.rounds);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPinchDistanceRef = useRef<number | null>(null);
  
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.1, 2.0)); // Max zoom 2x
  };
  
  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.1, 0.2)); // Min zoom 0.2x
  };

  // Calculate distance between two touch points
  const getPinchDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Handle pinch-to-zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let initialZoom = zoom;

    const handleTouchStart = (e: TouchEvent) => {
      // Only handle touches within this container
      if (!container.contains(e.target as Node)) return;
      
      // Stop propagation to prevent AppLayout from preventing default
      e.stopPropagation();
      
      if (e.touches.length === 2) {
        // Store initial zoom and pinch distance
        initialZoom = zoom;
        lastPinchDistanceRef.current = getPinchDistance(e.touches[0], e.touches[1]);
      } else {
        lastPinchDistanceRef.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Only handle touches within this container
      if (!container.contains(e.target as Node)) return;
      
      // Stop propagation to allow two-finger scrolling/zooming
      e.stopPropagation();
      
      if (e.touches.length === 2 && lastPinchDistanceRef.current !== null) {
        // Prevent default to allow pinch-to-zoom
        e.preventDefault();
        
        const currentDistance = getPinchDistance(e.touches[0], e.touches[1]);
        const distanceChange = currentDistance / lastPinchDistanceRef.current;
        
        // Update zoom based on pinch distance change
        const newZoom = Math.max(0.2, Math.min(2.0, initialZoom * distanceChange));
        setZoom(newZoom);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Only handle touches within this container
      if (!container.contains(e.target as Node)) return;
      
      // Stop propagation
      e.stopPropagation();
      lastPinchDistanceRef.current = null;
    };

    // Use capture phase to intercept events before AppLayout's document-level handlers
    container.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: false, capture: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: false, capture: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [zoom]);

  if (bracketRounds.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <Typography variant="body2" color="text.secondary">
          No match data available for this tournament.
        </Typography>
      </Box>
    );
  }

  // Calculate match positions for knockout tree layout
  // Round 0: Fixed spacing (index-based)
  // Round r+1: Each match positioned at midpoint between its two parents from round r
  const calculateAllMatchPositions = () => {
    const allPositions: Map<number, Map<number, number>> = new Map();
    const fixedSpacing = 150; // Spacing for round 0 matches
    
    // Round 0 (first round): Use fixed spacing with index-based positioning
    if (bracketRounds.length === 0) return allPositions;
    
    const round0Matches = bracketRounds[0].matches;
    const round0Positions = new Map<number, number>();
    
    if (round0Matches.length > 0) {
      const totalHeight = (round0Matches.length - 1) * fixedSpacing;
      const startOffset = -totalHeight / 2;
      
      round0Matches.forEach((_, idx) => {
        round0Positions.set(idx, startOffset + idx * fixedSpacing);
      });
    }
    allPositions.set(0, round0Positions);
    
    // For each subsequent round, calculate positions based on parent matches
    for (let roundIdx = 1; roundIdx < bracketRounds.length; roundIdx++) {
      const roundMatches = bracketRounds[roundIdx].matches;
      const roundPositions = new Map<number, number>();
      const parentPositions = allPositions.get(roundIdx - 1)!;
      
      // Each match in this round is fed by two matches from the previous round
      // Match i in round r is fed by matches (2*i) and (2*i + 1) from round r-1
      roundMatches.forEach((_, matchIdx) => {
        const parent1Idx = matchIdx * 2;
        const parent2Idx = matchIdx * 2 + 1;
        
        const parent1Top = parentPositions.get(parent1Idx);
        const parent2Top = parentPositions.get(parent2Idx);
        
        if (parent1Top !== undefined && parent2Top !== undefined) {
          // Position child match at midpoint between its two parents
          const childTop = (parent1Top + parent2Top) / 2;
          roundPositions.set(matchIdx, childTop);
        } else if (parent1Top !== undefined) {
          // Only one parent exists (odd number of matches in previous round)
          roundPositions.set(matchIdx, parent1Top);
        }
      });
      
      allPositions.set(roundIdx, roundPositions);
    }
    
    return allPositions;
  };

  // Calculate total height needed for bracket (based on round 0)
  const getTotalHeight = () => {
    if (bracketRounds.length === 0) return 400;
    
    const firstRound = bracketRounds[0];
    if (firstRound.matches.length === 0) return 400;
    
    const fixedSpacing = 150;
    const totalHeight = (firstRound.matches.length - 1) * fixedSpacing;
    return totalHeight + 120; // Add padding
  };
  
  const allPositions = calculateAllMatchPositions();

  const totalHeight = getTotalHeight();
  const gapBetweenRounds = 80; // Match the gap in the flex layout
  const estimatedWidth = bracketRounds.length > 0 
    ? bracketRounds.length * (75 + gapBetweenRounds) - gapBetweenRounds // Sum of round widths + gaps
    : 800;
  
  return (
    <Box
      ref={containerRef}
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "auto", // Always show scrollbars
        overflowX: "scroll",
        overflowY: "scroll",
        touchAction: "pan-x pan-y pinch-zoom", // Allow pinch-to-zoom and two-finger scrolling
        WebkitOverflowScrolling: "touch",
      }}
    >
      {/* Zoom Controls - Sticky in top right */}
      <Box
        sx={{
          position: "sticky",
          top: 8,
          float: "right",
          clear: "both",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: { xs: 0.5, sm: 1 },
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          borderRadius: 1,
          padding: { xs: 0.75, sm: 0.5 },
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
          marginBottom: 1,
          width: "fit-content",
        }}
      >
        <IconButton
          onClick={handleZoomIn}
          size={isMobile ? "medium" : "small"}
          disabled={zoom >= 2.0}
          sx={{ 
            padding: { xs: 1, sm: 0.5 },
            minWidth: { xs: "44px", sm: "auto" },
            minHeight: { xs: "44px", sm: "auto" },
          }}
        >
          <ZoomInIcon fontSize={isMobile ? "medium" : "small"} />
        </IconButton>
        <IconButton
          onClick={handleZoomOut}
          size={isMobile ? "medium" : "small"}
          disabled={zoom <= 0.2}
          sx={{ 
            padding: { xs: 1, sm: 0.5 },
            minWidth: { xs: "44px", sm: "auto" },
            minHeight: { xs: "44px", sm: "auto" },
          }}
        >
          <ZoomOutIcon fontSize={isMobile ? "medium" : "small"} />
        </IconButton>
      </Box>
      
      {/* Wrapper to account for scaled dimensions */}
      <Box
        sx={{
          width: `${estimatedWidth * zoom}px`,
          height: `${totalHeight * zoom}px`,
          position: "relative",
        }}
      >
        {/* Zoomed Container */}
        <Box
          sx={{
            py: 3,
            px: 2,
            position: "absolute",
            top: 0,
            left: 0,
            minHeight: `${totalHeight}px`,
            minWidth: "max-content",
            width: "max-content",
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center",
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              gap: 80, // Increased gap between rounds to create more equilateral triangle shape
              position: "relative",
              minWidth: "fit-content",
              alignItems: "flex-start",
              height: "100%",
            }}
          >
          {bracketRounds.map((roundData, roundIdx) => {
            const totalRounds = bracketRounds.length;
            const roundPositions = allPositions.get(roundIdx);
            
            return (
            <Box
              key={roundData.round}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
                minWidth: 75,
                flexShrink: 0,
              }}
            >
                <Typography
                  variant="caption"
                  fontWeight={600}
                  sx={{
                    mb: 1,
                    color: "#5A9BD5",
                    textAlign: "center",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontSize: "0.7rem",
                  }}
                >
                  {roundData.round}
                </Typography>
                
                {/* Match container */}
                <Box
                  sx={{
                    position: "relative",
                    width: "100%",
                    height: `${getTotalHeight()}px`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {roundData.matches.map((match, matchIdx) => {
                    const top = roundPositions?.get(matchIdx);
                    if (top === undefined) return null;
                    
                    return (
                      <Box
                        key={match.match_id}
                        sx={{
                          position: "absolute",
                          top: `calc(50% + ${top}px)`,
                          left: "50%",
                          transform: "translate(-50%, -50%)",
                          zIndex: 10,
                        }}
                      >
                        <MatchNode
                          match={match}
                          round={roundData.round}
                          isCorrect={isPredictionCorrect(match)}
                        />
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            );
          })}
        </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default TournamentDraw;

