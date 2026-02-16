// Team configuration for the Burbs Challenge

export const TEAMS = {
  TEMPO_TANTRUMS: 'Tempo Tantrums',
  POINTS_PINTS: 'Points & Pints',
} as const;

export type TeamName = typeof TEAMS[keyof typeof TEAMS];

// Athlete name to team mapping
// Names should match how they appear in Strava (first name + last initial typically)
export const ATHLETE_TEAMS: Record<string, TeamName> = {
  // Tempo Tantrums
  'richard c.': TEAMS.TEMPO_TANTRUMS,
  'michael m.': TEAMS.TEMPO_TANTRUMS,
  'pete s.': TEAMS.TEMPO_TANTRUMS,
  'brett s.': TEAMS.TEMPO_TANTRUMS,
  'robert a.': TEAMS.TEMPO_TANTRUMS,
  'robbie t.': TEAMS.TEMPO_TANTRUMS,
  'steven h.': TEAMS.TEMPO_TANTRUMS,
  'keith s.': TEAMS.TEMPO_TANTRUMS,

  // Points & Pints
  'pierre c.': TEAMS.POINTS_PINTS,
  'pete h.': TEAMS.POINTS_PINTS,
  'matt m.': TEAMS.POINTS_PINTS,
  'dylan h.': TEAMS.POINTS_PINTS,
  'lisle kenneth c.': TEAMS.POINTS_PINTS,
  'ad s.': TEAMS.POINTS_PINTS,
  'geoffrey w.': TEAMS.POINTS_PINTS,
  'graeme b.': TEAMS.POINTS_PINTS,
  'chris g.': TEAMS.POINTS_PINTS,
};

// Get team for an athlete name (case-insensitive)
export function getAthleteTeam(athleteName: string): TeamName | null {
  const normalizedName = athleteName.toLowerCase().trim();
  return ATHLETE_TEAMS[normalizedName] || null;
}

// Get all athletes for a team
export function getTeamAthletes(team: TeamName): string[] {
  return Object.entries(ATHLETE_TEAMS)
    .filter(([, t]) => t === team)
    .map(([name]) => name);
}
