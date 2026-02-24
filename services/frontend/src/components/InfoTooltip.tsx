import { Tooltip, IconButton } from "@mui/material";
import InfoIcon from "@mui/icons-material/InfoOutlined";

interface Props {
  title: string;
  placement?: "top" | "bottom" | "left" | "right";
}

const InfoTooltip = ({ title, placement = "top" }: Props) => {
  return (
    <Tooltip
      title={title}
      placement={placement}
      arrow
      componentsProps={{
        tooltip: {
          sx: {
            bgcolor: "#1A1A1A",
            color: "#FFFFFF",
            fontSize: "0.875rem",
            padding: "8px 12px",
            borderRadius: "6px",
            maxWidth: 300,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          },
        },
        arrow: {
          sx: {
            color: "#1A1A1A",
          },
        },
      }}
    >
      <IconButton
        size="small"
        sx={{
          p: 0.5,
          color: "rgba(0, 102, 204, 0.6)",
          "&:hover": {
            color: "#0066CC",
            backgroundColor: "rgba(0, 102, 204, 0.08)",
          },
          transition: "all 0.2s ease",
        }}
      >
        <InfoIcon sx={{ fontSize: "1rem" }} />
      </IconButton>
    </Tooltip>
  );
};

export default InfoTooltip;


