/**
 * Displays backend-parsed match history as a comma-separated table.
 * Uses formatted_line from the API response (no client-side parsing).
 */

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from "@mui/material";
import type { DisplayParsingResponse } from "../api/types";

interface ParsedMatchHistoryTableProps {
  data: DisplayParsingResponse;
  maxHeight?: number;
}

export default function ParsedMatchHistoryTable({ data, maxHeight = 400 }: ParsedMatchHistoryTableProps) {
  if (!data.table_rows.length) return null;

  return (
    <TableContainer
      component={Paper}
      sx={{
        maxHeight: { xs: 280, sm: 320, md: maxHeight },
        overflow: "auto",
        overflowX: "auto",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        width: "100%",
        border: "1px solid #5A9BD5",
        borderRadius: 1,
        boxShadow: "0 1px 3px rgba(90, 155, 213, 0.2)",
      }}
    >
      <Table size="small" stickyHeader sx={{ minWidth: 260, "& .MuiTableCell-root": { py: 0.5, px: { xs: 0.75, sm: 1 } } }}>
        <TableHead>
          <TableRow>
            <TableCell
              sx={{
                fontWeight: 600,
                bgcolor: "#5A9BD5",
                color: "#fff",
                fontSize: "0.7rem",
                py: 0.75,
                px: 1,
                position: "sticky",
                top: 0,
                zIndex: 1,
                borderBottom: "1px solid #4A8BC5",
              }}
            >
              Match (comma-separated)
            </TableCell>
            <TableCell
              sx={{
                fontWeight: 600,
                bgcolor: "#5A9BD5",
                color: "#fff",
                fontSize: "0.7rem",
                py: 0.75,
                px: 1,
                position: "sticky",
                top: 0,
                zIndex: 1,
                borderBottom: "1px solid #4A8BC5",
              }}
            >
              Status
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.table_rows.map((row, rowIdx) => (
            <TableRow
              key={row.row_index}
              sx={{
                bgcolor: row.is_ignored
                  ? "rgba(255, 0, 0, 0.06)"
                  : rowIdx % 2 === 0
                    ? "#FFFFFF"
                    : "#F0F7FF",
                "&:hover": {
                  bgcolor: row.is_ignored ? "rgba(255, 0, 0, 0.1)" : "#E3F2FD",
                },
              }}
            >
              <TableCell
                sx={{
                  fontFamily: "monospace",
                  fontSize: "0.7rem",
                  py: 0.5,
                  px: 1,
                  color: "#0A2540",
                  borderBottom: "1px solid #E3E8EF",
                  wordBreak: "break-word",
                }}
              >
                {row.formatted_line ?? (row.fields?.join(", ") ?? "-")}
              </TableCell>
              <TableCell sx={{ py: 0.5, px: 1, borderBottom: "1px solid #E3E8EF" }}>
                {row.is_ignored ? (
                  <Chip
                    label={row.ignore_reasons.join(", ") || "Ignored"}
                    size="small"
                    color="error"
                    variant="outlined"
                    sx={{ fontSize: "0.65rem" }}
                  />
                ) : (
                  <Chip label="Valid" size="small" color="success" variant="outlined" sx={{ fontSize: "0.65rem" }} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
