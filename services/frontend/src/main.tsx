import React from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { RouterProvider, createBrowserRouter, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppLayout from "./pages/AppLayout";
import MatchPredictionPage from "./pages/MatchPredictionPage";
import AdvancedInferencePage from "./pages/AdvancedInferencePage";
import ModelCardPage from "./pages/ModelCardPage";
import TournamentEvaluationPage from "./pages/TournamentEvaluationPage";
import BacktestingPage from "./pages/BacktestingPage";
import theme from "./theme";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <MatchPredictionPage /> }, // Inference page is the default landing page
      { path: "advanced-inference", element: <AdvancedInferencePage /> },
      { path: "model-card", element: <ModelCardPage /> },
      { path: "tournament-evaluation", element: <TournamentEvaluationPage /> },
      { path: "tournament-evaluation/:tournamentId", element: <TournamentEvaluationPage /> },
      { path: "backtesting", element: <BacktestingPage /> },
      { path: "*", element: <Navigate to="/" replace /> }, // Redirect any unknown paths to inference page
    ],
  },
]);

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);


