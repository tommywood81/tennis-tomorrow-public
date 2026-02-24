import { Box, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

// Tech AI Logo Container
const TechLogoContainer = styled(Box)(({ theme }) => ({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, rgba(0, 102, 204, 0.08), rgba(0, 102, 204, 0.03))",
  borderRadius: "12px",
  padding: "9px",
  border: "1px solid rgba(0, 102, 204, 0.15)",
  boxShadow: "0 4px 12px rgba(0, 102, 204, 0.1)",
}));


const LogoContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "15px",
  position: "relative",
}));

const LogoText = styled(Typography)(({ theme }) => ({
  fontSize: "56px",
  fontFamily: "'Orbitron', sans-serif",
  fontWeight: 700,
  letterSpacing: "0.05em",
  color: "#0066CC",
  lineHeight: 1.1,
  position: "relative",
  "&::after": {
    content: '""',
    position: "absolute",
    bottom: "-4px",
    left: 0,
    width: "100%",
    height: "3px",
    background: "linear-gradient(90deg, #0066CC 0%, transparent 100%)",
    borderRadius: "2px",
  },
}));

const SubtitleText = styled(Typography)(({ theme }) => ({
  fontSize: "0.875rem",
  color: "#0066CC",
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  fontFamily: "'JetBrains Mono', monospace",
}));

interface TennisTomorrowLogoProps {
  size?: "small" | "medium" | "large";
  showSubtitle?: boolean;
}

// Base sizes reduced by 25%
const TennisTomorrowLogo = ({ size = "large", showSubtitle = false }: TennisTomorrowLogoProps) => {
  const logoSize = size === "small" ? "52px" : size === "large" ? "75px" : "64px";
  const textSize = size === "small" ? "26px" : size === "large" ? "45px" : "34px";
  const subtitleSize = size === "small" ? "0.66rem" : size === "large" ? "0.83rem" : "0.75rem";

  return (
    <Box>
      <LogoContainer>
        <TechLogoContainer>
          <Box
            component="img"
            src="/TennisTomorrowLogo.png"
            alt="Tennis Tomorrow Logo"
            sx={{
              width: logoSize,
              height: logoSize,
              objectFit: "contain",
              filter: "drop-shadow(0 2px 8px rgba(0, 102, 204, 0.2))",
            }}
            onError={(e) => {
              // Try different case variations if needed
              const img = e.target as HTMLImageElement;
              if (img.src.endsWith('.png')) {
                img.src = '/TennisTomorrowLogo.PNG';
              } else if (img.src.endsWith('.PNG')) {
                img.src = '/TennisTomorrowLogo.png';
              }
            }}
          />
        </TechLogoContainer>
        <Box>
          <LogoText sx={{ fontSize: textSize }}>Tennis Tomorrow</LogoText>
          {showSubtitle && (
            <SubtitleText sx={{ fontSize: subtitleSize, mt: 0.5 }}>
              Neural Network Powered Prediction Engine
            </SubtitleText>
          )}
        </Box>
      </LogoContainer>
    </Box>
  );
};

export default TennisTomorrowLogo;
