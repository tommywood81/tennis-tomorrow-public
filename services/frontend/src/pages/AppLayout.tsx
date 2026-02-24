import { Box } from "@mui/material";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import TopBanner from "../components/TopBanner";

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Scroll to top when route changes
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    
    // Prevent two-finger swipe navigation (browser back/forward gestures)
    // Block popstate events that would trigger navigation via gestures
    const handlePopState = (e: PopStateEvent) => {
      // Push state back to current location to prevent navigation
      window.history.pushState(null, '', location.pathname + location.search);
      // The navigation is effectively blocked
    };
    
    // Push current state to history stack
    window.history.pushState(null, '', location.pathname + location.search);
    
    // Listen for popstate (triggered by browser back/forward gestures and back button)
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [location.pathname, location.search]);
  
  useEffect(() => {
    // Prevent two-finger touch gestures on mobile/tablet that trigger navigation
    const preventTwoFinger = (e: TouchEvent) => {
      // Block any two-finger touches that might trigger navigation
      if (e.touches.length === 2) {
        e.preventDefault();
      }
    };
    
    // Add touch event listeners to prevent two-finger swipe navigation
    document.addEventListener('touchstart', preventTwoFinger, { passive: false });
    document.addEventListener('touchmove', preventTwoFinger, { passive: false });
    
    return () => {
      document.removeEventListener('touchstart', preventTwoFinger);
      document.removeEventListener('touchmove', preventTwoFinger);
    };
  }, []);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "#D9D9D9",
        overflowX: "hidden",
      }}
    >
      <Navbar />
      <Box
        sx={{
          mt: { xs: "56px", sm: "72px", md: "80px" }, // Account for fixed navbar height (responsive)
        }}
      >
        <TopBanner />
        <Box
          component="main"
          sx={{
            p: { xs: 1.5, sm: 2.5, md: 3, lg: 4 },
            maxWidth: { xs: "100%", sm: "1000px", md: "1200px", lg: "1400px" },
            mx: "auto",
            width: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            minHeight: "calc(100vh - 200px)",
            position: "relative",
            animation: "fadeIn 0.4s ease-in",
            "@keyframes fadeIn": {
              from: { opacity: 0 },
              to: { opacity: 1 },
            },
          }}
        >
          <Outlet />
        </Box>
        <Footer />
      </Box>
    </Box>
  );
};

export default AppLayout;
