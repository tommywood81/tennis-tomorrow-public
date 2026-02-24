import { Box, Card, CardContent, Typography, CircularProgress } from "@mui/material";
import { styled, keyframes } from "@mui/material/styles";
import TennisTomorrowLogo from "./TennisTomorrowLogo";

// Smooth pulse animation for loading
const pulse = keyframes`
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.02);
  }
`;

// Gradient shimmer animation
const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

const ShimmerText = styled(Typography)(({ theme }) => ({
  background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 50%, ${theme.palette.primary.main} 100%)`,
  backgroundSize: "200% 100%",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  animation: `${shimmer} 2s ease-in-out infinite`,
  fontWeight: 600,
}));

const PulsingBox = styled(Box)({
  animation: `${pulse} 2s ease-in-out infinite`,
});

interface PredictionLoadingAnimationProps {
  playerOneName?: string;
  playerTwoName?: string;
}

const PredictionLoadingAnimation = ({
  playerOneName = "Player 1",
  playerTwoName = "Player 2",
}: PredictionLoadingAnimationProps) => {

  return (
    <Card
      sx={{
        background: "#E8F4FF",
        border: "1px solid #B8D4F0",
        boxShadow: "0 8px 32px rgba(90, 155, 213, 0.15)",
        overflow: "visible",
        position: "relative",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: "-100%",
          width: "100%",
          height: "100%",
          background: "linear-gradient(90deg, transparent, rgba(107, 114, 128, 0.1), transparent)",
          animation: `${shimmer} 3s ease-in-out infinite`,
        },
      }}
    >
      <CardContent sx={{ position: "relative", zIndex: 1, px: { xs: 2, sm: 3, md: 4 } }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            py: 5,
            gap: 3,
          }}
        >
          {/* Logo */}
          <PulsingBox>
            <TennisTomorrowLogo size="large" />
          </PulsingBox>

          {/* Loading indicator */}
          <CircularProgress
            size={48}
            thickness={4}
            sx={{
              color: "#6B7280",
              "& .MuiCircularProgress-circle": {
                strokeLinecap: "round",
              },
            }}
          />

          {/* Loading text */}
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="h6" sx={{ mb: 1, color: "#5A9BD5", fontWeight: 700 }}>
              Analysing Match Data...
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "#6B7B8A",
                maxWidth: 500,
                lineHeight: 1.6,
                mb: 3,
                fontWeight: 600,
              }}
            >
              Processing neural network predictions for{" "}
              <strong style={{ color: "#5A9BD5" }}>{playerOneName}</strong> vs{" "}
              <strong style={{ color: "#5A9BD5" }}>{playerTwoName}</strong>
            </Typography>
          </Box>

          {/* Progress steps */}
          <Box
            sx={{
              display: "flex",
              gap: 2,
              mt: 1,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {["Loading match history", "Computing features", "Running predictions"].map((step, i) => (
              <Box
                key={i}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 2,
                  py: 0.5,
                  borderRadius: 2,
                  backgroundColor: "rgba(90, 155, 213, 0.1)",
                  border: "1px solid rgba(90, 155, 213, 0.3)",
                }}
              >
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: "#5A9BD5",
                    animation: `${pulse} 1.5s ease-in-out infinite`,
                    animationDelay: `${i * 0.3}s`,
                  }}
                />
                <Typography variant="caption" sx={{ color: "#5A9BD5", fontWeight: 600 }}>
                  {step}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default PredictionLoadingAnimation;

