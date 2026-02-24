import { Autocomplete, CircularProgress, TextField, Box, Typography } from "@mui/material";
import { debounce } from "@mui/material/utils";
import { useMemo, useState, useRef } from "react";
import { usePlayerSearch } from "../api/hooks";
import { PlayerSummary } from "../api/types";

interface Props {
  label: string;
  value: PlayerSummary | null;
  onChange: (player: PlayerSummary | null) => void;
}

const PlayerAutocomplete = ({ label, value, onChange }: Props) => {
  const debounced = useMemo(() => debounce((val: string) => setQuery(val), 300), []);
  const [query, setQuery] = useState("");
  const { data, isFetching } = usePlayerSearch(query);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (_: unknown, newValue: string) => {
    debounced(newValue);
  };

  const handleWrapperClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(".MuiOutlinedInput-root") || target.closest(".MuiAutocomplete-root")) {
      return;
    }
    const input = wrapperRef.current?.querySelector<HTMLInputElement>("input");
    input?.focus();
  };

  return (
    <Box
      ref={wrapperRef}
      onClick={handleWrapperClick}
      sx={{
        width: "100%",
        py: 1,
        px: 0,
        cursor: "text",
        borderRadius: 2,
      }}
    >
    <Autocomplete
      sx={{ 
        width: "100%",
        minWidth: 260,
        "& .MuiOutlinedInput-root": {
          borderRadius: 2,
          minHeight: 56,
          padding: "4px 14px",
          cursor: "text",
          "&:hover fieldset": {
            borderColor: "primary.main",
          },
          "& fieldset": {
            // Slightly thicker border makes the box easier to see and click
            borderWidth: "1px",
          },
        },
        "& .MuiInputBase-input": {
          padding: "14px 0",
          minHeight: 24,
        },
        "& .MuiAutocomplete-listbox": {
          padding: 0,
        },
        "& .MuiAutocomplete-option": {
          padding: "12px 16px",
          "&:hover": {
            backgroundColor: "rgba(30, 144, 255, 0.08)",
          },
          "&[aria-selected='true']": {
            backgroundColor: "rgba(30, 144, 255, 0.12)",
            "&:hover": {
              backgroundColor: "rgba(30, 144, 255, 0.16)",
            },
          },
        },
      }}
      options={data || []}
      getOptionLabel={(option) => option.name}
      loading={isFetching}
      value={value}
      onChange={(_, val) => onChange(val)}
      onInputChange={handleInputChange}
      filterOptions={(options) => options} // Disable client-side filtering - we do server-side filtering
      renderInput={(params) => (
        <TextField
          {...params}
          label={!value && !params.inputProps.value ? label : ""}
          variant="outlined"
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {isFetching ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
          sx={{
            "& .MuiInputLabel-root": {
              fontWeight: 500,
              color: "#5A9BD5",
              transform: "translate(14px, 18px) scale(1)",
              transition: "opacity 0.2s ease-in-out, transform 0.2s ease-in-out",
              "&.MuiInputLabel-shrink": {
                transform: "translate(14px, -9px) scale(0.75)",
                opacity: 0,
              },
            },
            "& .MuiInputBase-root.Mui-focused .MuiInputLabel-root": {
              opacity: 0,
            },
            "& .MuiInputBase-input:not(:placeholder-shown) ~ .MuiInputLabel-root": {
              opacity: 0,
            },
          }}
        />
      )}
      renderOption={(props, option) => (
        <Box
          component="li"
          {...props}
          key={option.id}
          sx={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            py: 0.5,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: "#0A2540",
              lineHeight: 1.5,
              fontSize: "0.875rem",
            }}
          >
            {option.name}
          </Typography>
          {option.last_rank && (
            <Typography
              variant="caption"
              sx={{
                color: "#8898AA",
                mt: 0.5,
                lineHeight: 1.4,
                fontSize: "0.75rem",
              }}
            >
              Rank #{option.last_rank} {option.country ? `• ${option.country}` : ""}
            </Typography>
          )}
        </Box>
      )}
      componentsProps={{
        paper: {
          sx: {
            mt: 1,
            borderRadius: 2,
            border: "1px solid rgba(0, 0, 0, 0.1)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            "& .MuiAutocomplete-listbox": {
              padding: 0,
            },
          },
        },
      }}
    />
    </Box>
  );
};

export default PlayerAutocomplete;
