import Papa from 'papaparse';

const SHEET_ID = '2PACX-1vRnGFgSOWvgvysshy6qPwgLpBp0C9-oIHOzGrtXC6LNwZfp9RSIXshzHoOn4hqpsFO-AKkmo9OR5wUA';

// Sheet GIDs - you may need to update these based on your actual sheet
const SHEETS = {
  scoreboard: 0,
  individuals: 1,
  dailyTracker: 2,
  activities: 3,
  teams: 4,
};

export async function fetchSheetData(gid: number = 0): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?gid=${gid}&single=true&output=csv`;

  try {
    const response = await fetch(url, { next: { revalidate: 60 } });
    const text = await response.text();

    const result = Papa.parse<string[]>(text, {
      skipEmptyLines: true,
    });

    return result.data;
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    return [];
  }
}

export interface TeamScore {
  activity: string;
  tempoTantrums: number;
  pointsPints: number;
}

export interface Activity {
  date: string;
  athlete: string;
  team: string;
  type: string;
  distance: number;
  points: number;
  title: string;
}

export interface DailyPoint {
  date: string;
  tempoTantrums: number;
  pointsPints: number;
  tempoTotal: number;
  pintsTotal: number;
}

export function parseScoreboard(data: string[][]): TeamScore[] {
  const scores: TeamScore[] = [];
  let lastActivityName = '';

  for (let i = 0; i < data.length; i++) {
    const row = data[i];

    // Track the activity name from rows that have values but don't end in "Pnts"
    // These are the raw data rows (e.g., "Road Run (km)", "Paddle Ski")
    if (row[1] && !row[1].includes('Pnts') && !row[1].includes('Total') && row[1].trim() !== '') {
      // Extract activity name, removing any units like "(km)" or "(m)"
      lastActivityName = row[1].replace(/\s*\([^)]*\)\s*/g, '').trim();
    }

    // When we find a "Pnts" row, use the last activity name we tracked
    if (row[1] && row[1].includes('Pnts') && !row[1].includes('Total')) {
      const tempoTantrums = parseFloat(row[2]) || 0;
      const pointsPints = parseFloat(row[3]) || 0;

      if ((tempoTantrums > 0 || pointsPints > 0) && lastActivityName) {
        // Check if we already have this activity (avoid duplicates)
        const existingIndex = scores.findIndex(s => s.activity === lastActivityName);
        if (existingIndex === -1) {
          scores.push({
            activity: lastActivityName,
            tempoTantrums,
            pointsPints,
          });
        }
      }
    }
  }

  return scores;
}

export function getTotals(data: string[][]): { tempoTantrums: number; pointsPints: number } {
  for (const row of data) {
    if (row[1] && row[1].includes('Total Pnts')) {
      return {
        tempoTantrums: parseFloat(row[2]) || 0,
        pointsPints: parseFloat(row[3]) || 0,
      };
    }
  }
  return { tempoTantrums: 0, pointsPints: 0 };
}

// Parse activities from the Strava Club Activities sheet
export function parseActivities(data: string[][]): Activity[] {
  if (data.length < 2) return [];

  const activities: Activity[] = [];
  // Skip header row, parse rest
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row.length >= 5) {
      activities.push({
        date: row[0] || '',
        athlete: row[1] || '',
        team: row[2] || '',
        type: row[3] || '',
        distance: parseFloat(row[4]) || 0,
        points: parseFloat(row[5]) || 0,
        title: row[6] || '',
      });
    }
  }

  return activities;
}

// Parse daily tracker data
export function parseDailyTracker(data: string[][]): DailyPoint[] {
  if (data.length < 2) return [];

  const dailyPoints: DailyPoint[] = [];
  let tempoRunningTotal = 0;
  let pintsRunningTotal = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] && row[0].match(/\d/)) {
      const tempoDaily = parseFloat(row[1]) || 0;
      const pintsDaily = parseFloat(row[2]) || 0;

      tempoRunningTotal += tempoDaily;
      pintsRunningTotal += pintsDaily;

      dailyPoints.push({
        date: row[0],
        tempoTantrums: tempoDaily,
        pointsPints: pintsDaily,
        tempoTotal: tempoRunningTotal,
        pintsTotal: pintsRunningTotal,
      });
    }
  }

  return dailyPoints;
}
