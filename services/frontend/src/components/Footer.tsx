import { Box, Typography, Link } from "@mui/material";

const Footer = () => {
  return (
    <Box
      component="footer"
      sx={{
        mt: 8,
        pt: 0,
        pb: 4,
        backgroundColor: "#FFFFFF",
      }}
    >
      {/* Blue accent bar at top of footer */}
      <Box
        sx={{
          height: "4px",
          background: "linear-gradient(90deg, #0066CC 0%, #3399FF 50%, #0066CC 100%)",
          mb: 5,
        }}
      />
      <Box
        sx={{
          maxWidth: "1600px",
          mx: "auto",
          px: { xs: 2, sm: 3, md: 6 },
          boxSizing: "border-box",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", md: "center" },
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="body2" sx={{ color: "#0066CC", fontWeight: 700, letterSpacing: "0.01em" }}>
              © 2025 Thomas Wood. All rights reserved.
            </Typography>
            <Typography variant="body2" sx={{ color: "#3D3D3D", mt: 1 }}>
              <Link href="https://www.linkedin.com/in/thomaswood81" target="_blank" rel="noopener noreferrer" sx={{ color: "#0066CC", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                www.linkedin.com/in/thomaswood81
              </Link>
              {" | "}
              <Link href="mailto:thomaswood.g@gmail.com" sx={{ color: "#0066CC", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                thomaswood.g@gmail.com
              </Link>
            </Typography>
            <Typography variant="caption" sx={{ color: "#3D3D3D", mt: 2, display: "block", fontSize: "0.75rem", lineHeight: 1.5 }}>
              Historical match data was sourced from publicly available sources, including Tennis Abstract. Thank you Jeff Sackman.
            </Typography>
          </Box>
          <Box sx={{ maxWidth: { xs: "100%", md: "60%" } }}>
            <Typography
              variant="caption"
              sx={{
                fontSize: "0.75rem",
                lineHeight: 1.7,
                display: "block",
                color: "#3D3D3D",
                fontWeight: 500,
                letterSpacing: "0.01em",
              }}
            >
              Disclaimer: This service is provided for informational purposes only. 
              Thomas Wood makes no representations or warranties regarding the accuracy, 
              reliability, or suitability of the predictions or data provided. Users assume 
              full responsibility for any decisions made based on this information. 
              Thomas Wood shall not be liable for any losses, damages, or consequences 
              arising from the use of this service.
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Footer;

