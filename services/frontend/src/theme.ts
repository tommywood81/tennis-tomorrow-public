import { createTheme, responsiveFontSizes } from "@mui/material/styles";

// Clean modern theme with hardcourt blue accents
const colors = {
  // Background colors
  white: "#FFFFFF",
  background: "#F5F5F5", // Very light gray background
  paper: "#FFFFFF",
  subtleGray: "#F8F9FA", // Very subtle gray for backgrounds
  
  // Text colors
  textPrimary: "#1A1A1A",
  textSecondary: "rgba(26, 26, 26, 0.7)",
  textMuted: "rgba(26, 26, 26, 0.55)",
  
  // Hardcourt blue
  yellow: "#0066CC", // Hardcourt blue
  yellowLight: "#3385E6",
  yellowDark: "#0052A3",
  yellowBackground: "rgba(0, 102, 204, 0.1)",
  yellowLightBackground: "rgba(0, 102, 204, 0.05)",
  
  // Solid black - Mailchimp-inspired
  black: "#000000", // Solid black
  blackLight: "#1A1A1A",
  blackDark: "#000000",
  blackBackground: "rgba(0, 0, 0, 0.05)",
  blackLightBackground: "rgba(0, 0, 0, 0.02)",
  
  // Accent colors
  orange: "#FF6B35", // Vibrant accent
  orangeLight: "#FF8C5A",
  orangeDark: "#E55A2B",
  orangeBackground: "rgba(255, 107, 53, 0.08)",
  
  // Borders and dividers - very subtle
  border: "rgba(0, 0, 0, 0.1)", // Subtle black borders
  divider: "rgba(0, 0, 0, 0.08)", // Very subtle dividers
  
  // Status colors
  success: "#10B981",
  error: "#EF4444",
  warning: "#FF8C42", // Using orange for warning
  info: "#000000", // Black for info
};

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: colors.yellow, // Hardcourt blue
      light: colors.yellowLight,
      dark: colors.yellowDark,
      contrastText: colors.white, // White text on blue
    },
    secondary: {
      main: colors.textPrimary,
      light: colors.textSecondary,
      dark: "#000000",
      contrastText: colors.white,
    },
    success: {
      main: colors.success,
      light: "#34D399",
      dark: "#059669",
    },
    error: {
      main: colors.error,
      light: "#F87171",
      dark: "#DC2626",
    },
    warning: {
      main: colors.warning,
      light: "#FBBF24",
      dark: "#D97706",
    },
    info: {
      main: colors.info,
      light: colors.blackLight,
      dark: colors.blackDark,
    },
    background: {
      default: colors.background, // Clean light gray background
      paper: colors.paper, // Pure white cards
    },
    text: {
      primary: colors.textPrimary, // Black text
      secondary: colors.textSecondary, // Muted text
    },
    divider: colors.divider, // Subtle dividers
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif",
    // Base font size: 16px (1rem)
    // Typographic scale: 0.75, 0.875, 1, 1.125, 1.25, 1.5, 2, 2.5, 3
    h1: {
      fontWeight: 700,
      letterSpacing: "-0.02em",
      lineHeight: 1.2,
      color: colors.textPrimary,
      fontSize: "3rem", // 48px
    },
    h2: {
      fontWeight: 700,
      letterSpacing: "-0.02em",
      lineHeight: 1.25,
      color: colors.textPrimary,
      fontSize: "2.5rem", // 40px
    },
    h3: {
      fontWeight: 600,
      letterSpacing: "-0.01em",
      lineHeight: 1.3,
      color: colors.textPrimary,
      fontSize: "2rem", // 32px
    },
    h4: {
      fontWeight: 600,
      letterSpacing: "-0.01em",
      lineHeight: 1.35,
      color: colors.textPrimary,
      fontSize: "1.5rem", // 24px
    },
    h5: {
      fontWeight: 600,
      letterSpacing: "0em",
      lineHeight: 1.4,
      color: colors.textPrimary,
      fontSize: "1.25rem", // 20px
    },
    h6: {
      fontWeight: 600,
      letterSpacing: "0em",
      lineHeight: 1.5,
      color: colors.textPrimary,
      fontSize: "1.125rem", // 18px
    },
    subtitle1: {
      fontWeight: 500,
      letterSpacing: "0em",
      lineHeight: 1.5,
      color: colors.textPrimary,
      fontSize: "1rem", // 16px
    },
    subtitle2: {
      fontWeight: 600,
      letterSpacing: "0em",
      lineHeight: 1.5,
      color: colors.textPrimary,
      fontSize: "0.875rem", // 14px
    },
    body1: {
      fontWeight: 400,
      letterSpacing: "0em",
      lineHeight: 1.6,
      color: colors.textPrimary,
      fontSize: "1rem", // 16px
    },
    body2: {
      fontWeight: 400,
      letterSpacing: "0em",
      lineHeight: 1.6,
      color: colors.textSecondary,
      fontSize: "0.875rem", // 14px
    },
    button: {
      fontWeight: 600,
      textTransform: "none",
      letterSpacing: "0em",
      fontSize: "0.9375rem", // 15px - slightly larger for buttons
    },
    caption: {
      fontWeight: 400,
      letterSpacing: "0.01em",
      color: colors.textMuted,
      fontSize: "0.75rem", // 12px
    },
    overline: {
      fontWeight: 600,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      fontSize: "0.75rem", // 12px
      lineHeight: 1.5,
    },
  },
  shape: {
    borderRadius: 6, // Subtle rounded corners like Mailchimp
  },
  spacing: 8, // Base spacing unit
  shadows: [
    "none",
    "0 1px 3px rgba(0, 0, 0, 0.12)",
    "0 2px 6px rgba(0, 0, 0, 0.15)",
    "0 4px 12px rgba(0, 0, 0, 0.18)",
    "0 8px 24px rgba(0, 0, 0, 0.2)",
    "0 12px 32px rgba(0, 0, 0, 0.22)",
    "0 16px 48px rgba(0, 0, 0, 0.24)",
    "0 24px 64px rgba(0, 0, 0, 0.26)",
    "0 32px 80px rgba(0, 0, 0, 0.28)",
    "0 48px 96px rgba(0, 0, 0, 0.3)",
    "0 64px 128px rgba(0, 0, 0, 0.32)",
    "0 80px 160px rgba(0, 0, 0, 0.34)",
    "0 96px 192px rgba(0, 0, 0, 0.36)",
    "0 112px 224px rgba(0, 0, 0, 0.38)",
    "0 128px 256px rgba(0, 0, 0, 0.4)",
    "0 144px 288px rgba(0, 0, 0, 0.42)",
    "0 160px 320px rgba(0, 0, 0, 0.44)",
    "0 176px 352px rgba(0, 0, 0, 0.46)",
    "0 192px 384px rgba(0, 0, 0, 0.48)",
    "0 208px 416px rgba(0, 0, 0, 0.5)",
    "0 224px 448px rgba(0, 0, 0, 0.52)",
    "0 240px 480px rgba(0, 0, 0, 0.54)",
    "0 256px 512px rgba(0, 0, 0, 0.56)",
    "0 272px 544px rgba(0, 0, 0, 0.58)",
    "0 288px 576px rgba(0, 0, 0, 0.6)",
  ],
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          background: colors.paper,
          border: `1px solid ${colors.border}`,
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          transition: "all 0.2s ease",
          position: "relative",
          overflow: "hidden",
          border: `1px solid ${colors.border}`,
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          "&:hover": {
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          padding: "10px 24px",
          fontWeight: 600,
          letterSpacing: "0em",
          textTransform: "none",
          transition: "all 0.2s ease",
          fontSize: "0.9375rem",
        },
        contained: {
          boxShadow: "0 2px 4px rgba(0, 102, 204, 0.3)",
          background: colors.yellow,
          color: colors.white,
          fontWeight: 600,
          "&:hover": {
            boxShadow: "0 4px 8px rgba(0, 102, 204, 0.4)",
            background: colors.yellowDark,
          },
        },
        outlined: {
          borderWidth: "1px",
          borderColor: colors.border,
          "&:hover": {
            borderColor: colors.yellow,
            background: colors.yellowLightBackground,
          },
        },
        text: {
          "&:hover": {
            background: colors.yellowLightBackground,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 10,
          height: "32px",
          fontSize: "0.8125rem",
          letterSpacing: "0.02em",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 6,
            transition: "all 0.2s ease",
            "& fieldset": {
              borderColor: colors.border,
              borderWidth: "1px",
            },
            "&:hover fieldset": {
              borderColor: colors.yellow,
            },
            "&.Mui-focused fieldset": {
              borderColor: colors.yellow,
              borderWidth: "2px",
            },
          },
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: {
          background: colors.paper,
          border: `1px solid ${colors.border}`,
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        },
      },
    },
  },
});

// Scale typography with viewport for better readability on all screen sizes
export default responsiveFontSizes(theme);
