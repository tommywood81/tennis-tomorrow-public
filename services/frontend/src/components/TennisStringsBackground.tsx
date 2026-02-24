import { Box } from "@mui/material";
import { useEffect, useRef } from "react";

const TennisStringsBackground = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        const scrolled = window.pageYOffset;
        // Parallax effect: background moves slower (0.3x speed)
        containerRef.current.style.transform = `translateY(${scrolled * 0.3}px)`;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "2000vh", // Very large height to cover entire page with parallax
        minHeight: "100vh",
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        background: "#FAFAFA",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          // Horizontal strings (main strings) - 80% less visible with 3D shading
          // Tennis ball orange color (#FF8C42) with gradient for 3D effect
          // Light source from top-left: darker bottom, lighter top
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 13px,
              rgba(255, 140, 66, 0.024) 13px,
              rgba(255, 140, 66, 0.024) 14px,
              rgba(255, 140, 66, 0.036) 14px,
              rgba(255, 140, 66, 0.045) 15px,
              rgba(255, 140, 66, 0.045) 19px,
              rgba(255, 140, 66, 0.036) 20px,
              rgba(255, 140, 66, 0.024) 20px,
              rgba(255, 140, 66, 0.024) 21px,
              transparent 21px,
              transparent 60px
            )
          `,
          backgroundSize: "100% 60px",
          backgroundPosition: "0 0",
          // Very subtle 3D shadow effect - horizontal strings cast shadow downward
          filter: "drop-shadow(0 0.2px 0.2px rgba(0, 0, 0, 0.02)) drop-shadow(0 -0.1px 0.1px rgba(255, 255, 255, 0.04))",
          transform: "translateZ(0)",
          willChange: "transform",
        },
        "&::after": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          // Vertical strings (cross strings) - 80% less visible with 3D shading
          // Slightly darker orange to show they're behind horizontal strings
          // Light source from top-left: darker right, lighter left
          backgroundImage: `
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 13px,
              rgba(255, 140, 66, 0.021) 13px,
              rgba(255, 140, 66, 0.021) 14px,
              rgba(255, 140, 66, 0.033) 14px,
              rgba(255, 140, 66, 0.042) 15px,
              rgba(255, 140, 66, 0.042) 19px,
              rgba(255, 140, 66, 0.033) 20px,
              rgba(255, 140, 66, 0.021) 20px,
              rgba(255, 140, 66, 0.021) 21px,
              transparent 21px,
              transparent 60px
            )
          `,
          backgroundSize: "60px 100%",
          backgroundPosition: "0 0",
          // Very subtle 3D effect: vertical strings appear slightly behind horizontal
          filter: "drop-shadow(0.2px 0 0.2px rgba(0, 0, 0, 0.015)) drop-shadow(-0.1px 0 0.1px rgba(255, 255, 255, 0.03))",
          transform: "translateZ(-0.5px)",
          willChange: "transform",
        },
      }}
    />
  );
};

export default TennisStringsBackground;

