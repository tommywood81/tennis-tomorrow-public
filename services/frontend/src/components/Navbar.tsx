import { AppBar, Box, Button, Toolbar, IconButton, Drawer, List, ListItem, ListItemButton, useMediaQuery, useTheme } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { useState, useRef, useLayoutEffect } from "react";
import TennisTomorrowLogo from "./TennisTomorrowLogo";

const HARDCOURT_BLUE = "#0066CC";

const Navbar = () => {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const navItems = [
    { label: "Match prediction (As At)", path: "/" },
    { label: "Inference - Current", path: "/advanced-inference" },
    { label: "Model Card", path: "/model-card" },
    { label: "Tournament Evaluation", path: "/tournament-evaluation" },
    { label: "Backtesting", path: "/backtesting" },
  ];

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    if (path === "/tournament-evaluation") return location.pathname.startsWith("/tournament-evaluation");
    return location.pathname === path;
  };

  const drawer = (
    <Box sx={{ textAlign: "center", pt: { xs: 8, sm: 10 } }}>
      <List>
        {navItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              component={RouterLink}
              to={item.path}
              state={item.path === "/" || item.path === "/advanced-inference" ? { reset: true } : undefined}
              onClick={handleDrawerToggle}
              selected={isActive(item.path)}
              sx={{
                justifyContent: "center",
                py: 2,
                color: isActive(item.path) ? HARDCOURT_BLUE : "#6B7280",
                fontWeight: isActive(item.path) ? 700 : 500,
                borderBottom: isActive(item.path) ? `2px solid ${HARDCOURT_BLUE}` : "none",
                "&.Mui-selected": {
                  backgroundColor: "rgba(0, 102, 204, 0.06)",
                  "&:hover": {
                    backgroundColor: "rgba(0, 102, 204, 0.1)",
                  },
                },
              }}
            >
              {item.label}
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  const navContainerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, visible: false });

  useLayoutEffect(() => {
    const activeIndex = navItems.findIndex((item) => isActive(item.path));
    if (activeIndex === -1 || !navContainerRef.current) {
      setIndicator((p) => ({ ...p, visible: false }));
      return;
    }
    const container = navContainerRef.current;
    const items = container.querySelectorAll("[data-nav-item]");
    const activeEl = items[activeIndex] as HTMLElement;
    if (!activeEl) return;
    const cr = container.getBoundingClientRect();
    const ir = activeEl.getBoundingClientRect();
    setIndicator({
      left: ir.left - cr.left,
      width: ir.width,
      visible: true,
    });
  }, [location.pathname]);

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          background: "#FFFFFF !important",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #4A4A4A !important",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1300,
          width: "100%",
        }}
      >
        <Toolbar sx={{ 
          justifyContent: "space-between", 
          alignItems: "center",
          maxWidth: { xs: "100%", sm: "1400px", md: "1600px" }, 
          mx: "auto", 
          width: "100%", 
          py: { xs: 0.75, sm: 1.5, md: 2 },
          px: { xs: 1, sm: 2, md: 3, lg: 4 },
          minHeight: { xs: "56px !important", sm: "72px !important", md: "80px !important" },
        }}>
          <TennisTomorrowLogo size={isMobile ? "small" : "large"} showSubtitle={!isMobile} />
          {isMobile ? (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ 
                color: "#3D3D3D",
                "&:hover": {
                  backgroundColor: "rgba(61, 61, 61, 0.08)",
                },
              }}
            >
              <MenuIcon />
            </IconButton>
          ) : (
            <Box
              ref={navContainerRef}
              display="flex"
              gap={1}
              sx={{
                position: "relative",
                alignItems: "center",
              }}
            >
              {navItems.map((item) => (
                <Button
                  key={item.path}
                  data-nav-item
                  component={RouterLink}
                  to={item.path}
                  state={item.path === "/" || item.path === "/advanced-inference" ? { reset: true } : undefined}
                  variant="text"
                  sx={{
                    px: { sm: 2, md: 2.5 },
                    py: 1.25,
                    fontWeight: 600,
                    fontSize: { xs: "0.8125rem", sm: "0.9375rem", md: "1rem" },
                    letterSpacing: "0.02em",
                    textTransform: "none",
                    color: isActive(item.path) ? HARDCOURT_BLUE : "#6B7280",
                    background: "transparent",
                    borderRadius: 0,
                    minWidth: "auto",
                    "&:hover": {
                      background: "transparent",
                      color: isActive(item.path) ? HARDCOURT_BLUE : "#4A4A4A",
                    },
                  }}
                >
                  {item.label}
                </Button>
              ))}
              {/* Sliding underline – baseline offset, animates like a rally */}
              {indicator.visible && (
                <Box
                  sx={{
                    position: "absolute",
                    left: 0,
                    bottom: 4,
                    height: 2,
                    width: indicator.width,
                    transform: `translateX(${indicator.left}px)`,
                    backgroundColor: HARDCOURT_BLUE,
                    borderRadius: 1,
                    transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                />
              )}
            </Box>
          )}
        </Toolbar>
      </AppBar>
      <Box component="nav">
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: "block", md: "none" },
            zIndex: 1400, // Higher than AppBar (1300) to ensure it's on top
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: 240,
              backgroundColor: "#FFFFFF",
              borderRight: "1px solid #E3E8EF",
              zIndex: 1400,
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>
    </>
  );
};

export default Navbar;
