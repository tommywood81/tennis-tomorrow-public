/**
 * Test: when user pastes match history, the frontend sends a POST to /api/predict/parse-display.
 * Verifies the request is actually made (backend is known to work from direct curl test).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdvancedInferencePage from "./AdvancedInferencePage";
import api from "../api/client";

vi.mock("../api/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockApi = api as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

const FAKE_PLAYERS = [
  { id: "k1", name: "Nick Kyrgios" },
  { id: "k2", name: "Thanasi Kokkinakis" },
];

const FAKE_PARSE_RESPONSE = {
  table_rows: [],
  summary: { total_rows: 0, valid_matches: 0, ignored_rows: 0, has_header: false },
};

const SAMPLE_MATCH_HISTORY =
  "04-Jan-2026\tBrisbane\tHard\tR32\t670\t58\tAleksandar Kovacevic [USA] d. (WC)Kyrgios\t6-3 6-4";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/advanced-inference"]}>
        <Routes>
          <Route path="/advanced-inference" element={<AdvancedInferencePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("parse-display API request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockResolvedValue({ data: { results: FAKE_PLAYERS } });
    mockApi.post.mockResolvedValue({ data: FAKE_PARSE_RESPONSE });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends POST to /predict/parse-display when user pastes match history", async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();

    // Select player 1
    const combos = screen.getAllByRole("combobox");
    await user.click(combos[0]);
    await user.keyboard("Ky");
    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());
    const opt1 = await screen.findByRole("option", { name: /Nick Kyrgios/i });
    await user.click(opt1);

    // Select player 2
    await user.click(combos[1]);
    await user.keyboard("Ko");
    await waitFor(() => expect(mockApi.get.mock.calls.length).toBeGreaterThan(1));
    const opt2 = await screen.findByRole("option", { name: /Thanasi Kokkinakis/i });
    await user.click(opt2);

    // Match history boxes appear when both players selected
    const textareas = await screen.findAllByPlaceholderText("Paste match history here...");
    expect(textareas.length).toBeGreaterThanOrEqual(1);

    // Paste into first match history box
    await user.click(textareas[0]);
    await user.paste(SAMPLE_MATCH_HISTORY);

    // Wait for debounce (200ms) + a small buffer
    await waitFor(
      () => {
        const parseCalls = mockApi.post.mock.calls.filter(
          (call) => typeof call[0] === "string" && String(call[0]).includes("parse-display")
        );
        expect(parseCalls.length).toBeGreaterThanOrEqual(1);
        expect(parseCalls[0][1]).toEqual({ match_history_text: SAMPLE_MATCH_HISTORY });
      },
      { timeout: 500 }
    );
  });
});
