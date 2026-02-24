import { Box, Typography, Paper, Tooltip } from "@mui/material";
import { useState } from "react";
import { TournamentMatch } from "../api/types";
import MatchDetails from "./MatchDetails";

interface MatchNodeProps {
  match: TournamentMatch;
  round: string;
  isCorrect: boolean;
}

const MatchNode = ({ match, round, isCorrect }: MatchNodeProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    setShowDetails(true);
  };

  const handleClose = () => {
    setShowDetails(false);
    setAnchorEl(null);
  };

  // Subtle colors for correct/incorrect indicators
  const correctColor = "rgba(16, 185, 129, 0.15)"; // Subtle green background
  const incorrectColor = "rgba(239, 68, 68, 0.15)"; // Subtle red background
  const correctBorder = "rgba(16, 185, 129, 0.4)"; // Subtle green border
  const incorrectBorder = "rgba(239, 68, 68, 0.4)"; // Subtle red border

  return (
    <>
      <Paper
        elevation={0}
        onClick={handleClick}
        sx={{
          p: 0.75,
          width: 65,  // Half of current size: 108 * 0.5 ≈ 54, but make slightly wider for readability
          cursor: "pointer",
          backgroundColor: isCorrect ? correctColor : incorrectColor,
          border: `1px solid ${isCorrect ? correctBorder : incorrectBorder}`,
          borderRadius: 0.5, // Less rounded for sharper corners
          transition: "all 0.2s ease",
          "&:hover": {
            borderWidth: "2px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          },
        }}
      >
        <Box sx={{ mb: 0.25 }}>
          <Typography
            variant="caption"
            sx={{
              fontSize: "0.6rem",
              fontWeight: 600,
              color: "text.secondary",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {round}
          </Typography>
        </Box>
        <Box sx={{ mb: 0.5 }}>
          <Typography
            variant="body2"
            sx={{
              fontSize: "0.7rem",
              fontWeight: 600,
              color: "text.primary",
              lineHeight: 1.3,
              mb: 0.25,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {match.player_one.name}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontSize: "0.7rem",
              fontWeight: 600,
              color: "text.primary",
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {match.player_two.name}
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mt: 0.5,
            pt: 0.5,
            borderTop: "1px solid rgba(0, 0, 0, 0.1)",
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontSize: "0.6rem",
              fontWeight: 600,
              color: isCorrect ? "rgba(16, 185, 129, 0.9)" : "rgba(239, 68, 68, 0.9)",
            }}
          >
            {isCorrect ? "✓" : "✗"}
          </Typography>
        </Box>
      </Paper>
      {showDetails && (
        <MatchDetails
          match={match}
          round={round}
          isCorrect={isCorrect}
          anchorEl={anchorEl}
          onClose={handleClose}
        />
      )}
    </>
  );
};

export default MatchNode;

