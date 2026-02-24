import { Grid, Card, CardContent, Typography, Box, Chip } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { Tournament } from "../api/types";

interface TournamentListProps {
  tournaments: Tournament[];
}

const TournamentList = ({ tournaments }: TournamentListProps) => {
  if (tournaments.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <Typography variant="body2" color="text.secondary">
          No tournaments available.
        </Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={3}>
      {tournaments.map((tournament) => (
        <Grid item xs={12} sm={6} md={4} key={tournament.tournament_id}>
          <Card
            component={RouterLink}
            to={`/tournament-evaluation/${tournament.tournament_id}`}
            sx={{
              textDecoration: "none",
              height: "100%",
              transition: "all 0.2s ease",
              "&:hover": {
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)",
                transform: "translateY(-2px)",
              },
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  {tournament.tournament_name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(tournament.start_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  -{" "}
                  {new Date(tournament.end_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                <Chip
                  label={tournament.surface}
                  size="small"
                  sx={{
                    backgroundColor: "rgba(90, 155, 213, 0.15)",
                    color: "#5A9BD5",
                    border: "1px solid rgba(90, 155, 213, 0.3)",
                    fontWeight: 600,
                    fontSize: "0.75rem",
                  }}
                />
                <Chip
                  label={`${tournament.rounds.reduce(
                    (sum, round) => sum + round.matches.length,
                    0
                  )} matches`}
                  size="small"
                  sx={{
                    backgroundColor: "rgba(0, 0, 0, 0.05)",
                    color: "text.secondary",
                    fontWeight: 600,
                    fontSize: "0.75rem",
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default TournamentList;

