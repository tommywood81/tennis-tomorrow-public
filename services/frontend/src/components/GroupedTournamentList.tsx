import { Box, Typography, Card, CardContent, Chip, Accordion, AccordionSummary, AccordionDetails, Grid } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Tournament } from "../api/types";

interface GroupedTournamentListProps {
  tournaments: Tournament[];
}

// Map tournament level codes to readable names
const getTournamentLevelName = (level: string | undefined): string => {
  const levelMap: { [key: string]: string } = {
    "G": "Grand Slam",
    "M": "ATP 1000",
    "500": "ATP 500/250",
    "250": "ATP 500/250",
    "A": "ATP 500/250", // ATP 500/250 are grouped together
  };
  return levelMap[level || ""] || "Other";
};

// Deduplicate tournaments by name and start date
const deduplicateTournaments = (tournaments: Tournament[]): Tournament[] => {
  const seen = new Set<string>();
  const unique: Tournament[] = [];
  
  tournaments.forEach((tournament) => {
    // Create a unique key from tournament name and start date
    const key = `${tournament.tournament_name}_${tournament.start_date}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(tournament);
    }
  });
  
  return unique;
};

// Group tournaments by level
const groupTournamentsByLevel = (tournaments: Tournament[]) => {
  // First deduplicate tournaments
  const uniqueTournaments = deduplicateTournaments(tournaments);
  
  const groups: { [key: string]: Tournament[] } = {
    "Grand Slam": [],
    "ATP 1000": [],
    "ATP 500/250": [],
  };

  uniqueTournaments.forEach((tournament) => {
    const level = tournament.tournament_level;
    if (level === "G") {
      groups["Grand Slam"].push(tournament);
    } else if (level === "M") {
      groups["ATP 1000"].push(tournament);
    } else if (level === "500" || level === "250" || level === "A") {
      groups["ATP 500/250"].push(tournament);
    }
  });

  // Sort tournaments within each group by date (newest first)
  Object.keys(groups).forEach((key) => {
    groups[key].sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
  });

  return groups;
};

const GroupedTournamentList = ({ tournaments }: GroupedTournamentListProps) => {
  if (tournaments.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <Typography variant="body2" color="text.secondary">
          No tournaments available.
        </Typography>
      </Box>
    );
  }

  const grouped = groupTournamentsByLevel(tournaments);
  const groupOrder = ["Grand Slam", "ATP 1000", "ATP 500/250"];

  return (
    <Box>
      {groupOrder.map((groupName) => {
        const groupTournaments = grouped[groupName];
        if (groupTournaments.length === 0) return null;

        return (
          <Accordion key={groupName} defaultExpanded sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6" fontWeight={700}>
                {groupName} ({groupTournaments.length} tournament{groupTournaments.length !== 1 ? "s" : ""})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                {groupTournaments.map((tournament) => (
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
                        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1 }}>
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
                        {tournament.accuracy !== undefined && (
                          <Typography
                            variant="body2"
                            sx={{
                              mt: 1,
                              fontWeight: 600,
                              color: "#0A2540",
                            }}
                          >
                            Accuracy: {(tournament.accuracy * 100).toFixed(2)}%
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
};

export default GroupedTournamentList;
