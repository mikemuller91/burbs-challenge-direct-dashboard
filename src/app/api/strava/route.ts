import { NextResponse } from 'next/server';
import { fetchAllClubActivities, getAthleteDisplayName, StravaActivity } from '@/lib/strava';
import { calculatePoints, getActivityCategories, POINTS_CONFIG, ELEVATION_ELIGIBLE_TYPES, ELEVATION_POINTS_PER_1000M } from '@/lib/points';
import { getAthleteTeam, TEAMS, TeamName } from '@/lib/teams';
import { getActivityDates, getStoredActivities, saveActivities, setLastSync, getLastSync, StoredActivity } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Generate a unique ID for an activity based on its properties
 * Since Strava Club Activities API doesn't return activity IDs
 * Uses a counter map to handle duplicate activities (same name, type, distance)
 */
function generateActivityId(
  activity: StravaActivity,
  athleteName: string,
  usedIds: Map<string, number>
): string {
  const str = `${athleteName}|${activity.name}|${activity.distance}|${activity.sport_type || activity.type}`;
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const baseId = Math.abs(hash).toString();

  // Track how many times this base ID has been used
  const count = usedIds.get(baseId) || 0;
  usedIds.set(baseId, count + 1);

  // Append suffix for duplicates
  return count === 0 ? baseId : `${baseId}_${count}`;
}

/**
 * Check if a date string is in February 2026 (the challenge month)
 */
function isFebruaryActivity(dateStr: string): boolean {
  if (dateStr === 'Unknown') return false;
  // Date format is YYYY-MM-DD
  return dateStr.startsWith('2026-02');
}

/**
 * Convert a Strava activity to a StoredActivity
 */
function stravaToStoredActivity(
  stravaActivity: StravaActivity,
  activityId: string,
  date: string
): StoredActivity {
  return {
    id: activityId,
    athleteFirstname: stravaActivity.athlete.firstname,
    athleteLastname: stravaActivity.athlete.lastname,
    name: stravaActivity.name,
    type: stravaActivity.type,
    sport_type: stravaActivity.sport_type,
    distance: stravaActivity.distance,
    total_elevation_gain: stravaActivity.total_elevation_gain,
    date,
    storedAt: new Date().toISOString(),
  };
}

/**
 * Convert a StoredActivity back to StravaActivity format for processing
 */
function storedToStravaActivity(stored: StoredActivity): StravaActivity {
  return {
    id: 0, // Not used
    athlete: {
      firstname: stored.athleteFirstname,
      lastname: stored.athleteLastname,
    },
    name: stored.name,
    type: stored.type,
    sport_type: stored.sport_type,
    distance: stored.distance,
    total_elevation_gain: stored.total_elevation_gain,
    start_date: '',
    start_date_local: stored.date !== 'Unknown' ? `${stored.date}T00:00:00Z` : '',
    moving_time: 0,
    elapsed_time: 0,
  };
}

/**
 * Sync activities from Strava and merge with stored activities
 * Returns the merged list of all activities
 */
async function syncAndMergeActivities(storedDates: Record<string, string>): Promise<{
  activities: StravaActivity[];
  storedActivityMap: Map<string, StoredActivity>;
  syncedCount: number;
}> {
  // Fetch from Strava
  const stravaActivities = await fetchAllClubActivities();

  // Get existing stored activities
  const existingStored = await getStoredActivities();
  const storedActivityMap = new Map<string, StoredActivity>();

  // Index existing stored activities by ID, but update dates from storedDates if available
  // This ensures manually entered dates take precedence
  for (const stored of existingStored) {
    // If there's a manually entered date in storedDates, use it
    const manualDate = storedDates[stored.id];
    if (manualDate && manualDate !== stored.date) {
      stored.date = manualDate;
    }
    storedActivityMap.set(stored.id, stored);
  }

  // Track used IDs for generating new IDs
  const usedIds = new Map<string, number>();

  // First pass: generate IDs for all Strava activities to detect duplicates
  const stravaWithIds: { activity: StravaActivity; id: string }[] = [];
  for (const activity of stravaActivities) {
    const athleteName = getAthleteDisplayName(activity);
    const id = generateActivityId(activity, athleteName, usedIds);
    stravaWithIds.push({ activity, id });
  }

  // Convert new Strava activities to StoredActivity format
  const newStoredActivities: StoredActivity[] = [];
  for (const { activity, id } of stravaWithIds) {
    // Get date: prefer manual date, then existing stored date, then Strava, then Unknown
    const existingStored = storedActivityMap.get(id);
    const date = storedDates[id]
      || existingStored?.date
      || (activity.start_date_local ? activity.start_date_local.split('T')[0] : null)
      || 'Unknown';

    const storedActivity = stravaToStoredActivity(activity, id, date);
    newStoredActivities.push(storedActivity);
    storedActivityMap.set(id, storedActivity);
  }

  // Save merged activities (this updates all activities with correct dates)
  await saveActivities(newStoredActivities);
  await setLastSync();

  // Convert all stored activities to StravaActivity format for processing
  const allActivities: StravaActivity[] = [];
  for (const stored of storedActivityMap.values()) {
    allActivities.push(storedToStravaActivity(stored));
  }

  return {
    activities: allActivities,
    storedActivityMap,
    syncedCount: stravaActivities.length,
  };
}

interface ProcessedActivity {
  id: string;
  date: string;
  athlete: string;
  team: string;
  type: string;
  normalizedType: string;
  distance: number; // km
  elevation: number; // meters
  points: number;
  elevationPoints: number;
  totalPoints: number;
  title: string;
}

interface TeamScore {
  activity: string;
  tempoTantrums: number;
  pointsPints: number;
}

interface IndividualStats {
  name: string;
  team: string;
  totalPoints: number;
  activities: Record<string, { distance: number; points: number }>;
  elevation: number;
  elevationPoints: number;
}

interface DailyPoint {
  date: string;
  tempoTantrums: number;
  pointsPints: number;
  tempoTotal: number;
  pintsTotal: number;
}

interface DashboardData {
  activities: ProcessedActivity[];
  scoreboard: TeamScore[];
  totals: { tempoTantrums: number; pointsPints: number };
  individuals: IndividualStats[];
  dailyTracker: DailyPoint[];
  lastUpdated: string;
}

// Structure to track cumulative raw values (before floor rounding)
interface DailyCumulativeData {
  distances: Map<string, { tempoKm: number; pintsKm: number }>;
  elevation: { tempoMeters: number; pintsMeters: number };
  workouts: { tempoCount: number; pintsCount: number };
}

// Calculate team points from cumulative data
function calculateTeamPoints(data: DailyCumulativeData): { tempo: number; pints: number } {
  let tempoPoints = 0;
  let pintsPoints = 0;

  // Distance-based points
  for (const [activityType, distances] of data.distances.entries()) {
    const config = POINTS_CONFIG[activityType];
    if (config?.perKm) {
      tempoPoints += Math.floor(distances.tempoKm * config.perKm);
      pintsPoints += Math.floor(distances.pintsKm * config.perKm);
    }
  }

  // Workout points
  tempoPoints += data.workouts.tempoCount * 6;
  pintsPoints += data.workouts.pintsCount * 6;

  // Elevation points
  tempoPoints += Math.floor(data.elevation.tempoMeters / 1000) * ELEVATION_POINTS_PER_1000M;
  pintsPoints += Math.floor(data.elevation.pintsMeters / 1000) * ELEVATION_POINTS_PER_1000M;

  return { tempo: tempoPoints, pints: pintsPoints };
}

function processActivities(storedActivities: StoredActivity[]): DashboardData {
  const activities: ProcessedActivity[] = [];
  const individualMap = new Map<string, IndividualStats>();

  // Track cumulative distances (km) by activity type and team
  const distanceMap = new Map<string, { tempoKm: number; pintsKm: number }>();
  // Track cumulative elevation (meters) by team
  const elevationTotals = { tempoMeters: 0, pintsMeters: 0 };
  // Track workout counts by team
  const workoutCounts = { tempoCount: 0, pintsCount: 0 };

  // For daily tracker: track raw cumulative data per date
  const dailyRawData = new Map<string, {
    distances: Map<string, { tempoKm: number; pintsKm: number }>;
    elevation: { tempoMeters: number; pintsMeters: number };
    workouts: { tempoCount: number; pintsCount: number };
  }>();

  // Initialize distance map with all activity categories
  for (const category of getActivityCategories()) {
    distanceMap.set(category, { tempoKm: 0, pintsKm: 0 });
  }

  // Process each stored activity
  for (const stored of storedActivities) {
    const athleteName = `${stored.athleteFirstname} ${stored.athleteLastname ? stored.athleteLastname.charAt(0) + '.' : ''}`.trim();
    const team = getAthleteTeam(athleteName);

    if (!team) {
      // Skip activities from athletes not in either team
      continue;
    }

    const { activityPoints, elevationPoints, totalPoints, normalizedType } = calculatePoints(
      stored.sport_type || stored.type,
      stored.distance || 0,
      stored.total_elevation_gain || 0
    );

    const distanceKm = stored.distance / 1000;

    // Activity already has an ID and date from storage
    const activityId = stored.id;
    const dateStr = stored.date;

    // Create processed activity
    const processed: ProcessedActivity = {
      id: activityId,
      date: dateStr,
      athlete: athleteName,
      team,
      type: stored.sport_type || stored.type,
      normalizedType,
      distance: Math.round(distanceKm * 100) / 100,
      elevation: Math.round(stored.total_elevation_gain || 0),
      points: activityPoints,
      elevationPoints,
      totalPoints,
      title: stored.name,
    };
    activities.push(processed);

    // Only count February activities for scoring
    const isFebruary = isFebruaryActivity(dateStr);

    if (isFebruary) {
      // Skip "Other" activities (Hike, Walk, Tennis, Golf, etc.) - they get 0 points
      if (normalizedType === 'Other') {
        // Don't count for team scoring
      } else if (normalizedType === 'Workout') {
        // Count workouts instead of distance
        if (team === TEAMS.TEMPO_TANTRUMS) {
          workoutCounts.tempoCount += 1;
        } else {
          workoutCounts.pintsCount += 1;
        }
      } else if (distanceMap.has(normalizedType)) {
        // Accumulate distance in km
        const current = distanceMap.get(normalizedType)!;
        if (team === TEAMS.TEMPO_TANTRUMS) {
          current.tempoKm += distanceKm;
        } else {
          current.pintsKm += distanceKm;
        }
      }

      // Accumulate elevation (only for eligible types)
      if (ELEVATION_ELIGIBLE_TYPES.includes(normalizedType)) {
        if (team === TEAMS.TEMPO_TANTRUMS) {
          elevationTotals.tempoMeters += stored.total_elevation_gain || 0;
        } else {
          elevationTotals.pintsMeters += stored.total_elevation_gain || 0;
        }
      }

      // Update individual stats (still track individual contributions)
      if (!individualMap.has(athleteName)) {
        individualMap.set(athleteName, {
          name: athleteName,
          team,
          totalPoints: 0,
          activities: {},
          elevation: 0,
          elevationPoints: 0,
        });
      }
      const individual = individualMap.get(athleteName)!;
      individual.totalPoints += totalPoints;
      // Only accumulate elevation from eligible activity types (Road Run, Trail Run, Cycle, MTB)
      if (ELEVATION_ELIGIBLE_TYPES.includes(normalizedType)) {
        individual.elevation += stored.total_elevation_gain || 0;
      }
      individual.elevationPoints += elevationPoints;

      if (!individual.activities[normalizedType]) {
        individual.activities[normalizedType] = { distance: 0, points: 0 };
      }
      individual.activities[normalizedType].distance += distanceKm;
      individual.activities[normalizedType].points += activityPoints;

      // Track raw data for daily tracker (will calculate points from cumulative values)
      if (!dailyRawData.has(dateStr)) {
        dailyRawData.set(dateStr, {
          distances: new Map(getActivityCategories().map(cat => [cat, { tempoKm: 0, pintsKm: 0 }])),
          elevation: { tempoMeters: 0, pintsMeters: 0 },
          workouts: { tempoCount: 0, pintsCount: 0 },
        });
      }
      const dailyData = dailyRawData.get(dateStr)!;

      if (normalizedType === 'Other') {
        // Don't track
      } else if (normalizedType === 'Workout') {
        if (team === TEAMS.TEMPO_TANTRUMS) {
          dailyData.workouts.tempoCount += 1;
        } else {
          dailyData.workouts.pintsCount += 1;
        }
      } else if (dailyData.distances.has(normalizedType)) {
        const dist = dailyData.distances.get(normalizedType)!;
        if (team === TEAMS.TEMPO_TANTRUMS) {
          dist.tempoKm += distanceKm;
        } else {
          dist.pintsKm += distanceKm;
        }
      }

      if (ELEVATION_ELIGIBLE_TYPES.includes(normalizedType)) {
        if (team === TEAMS.TEMPO_TANTRUMS) {
          dailyData.elevation.tempoMeters += stored.total_elevation_gain || 0;
        } else {
          dailyData.elevation.pintsMeters += stored.total_elevation_gain || 0;
        }
      }
    }
  }

  // Now calculate team points from cumulative distances using Math.floor()
  const scoreboard: TeamScore[] = [];

  // Process distance-based activities
  for (const [activityType, distances] of distanceMap.entries()) {
    const config = POINTS_CONFIG[activityType];
    if (config?.perKm && (distances.tempoKm > 0 || distances.pintsKm > 0)) {
      scoreboard.push({
        activity: activityType,
        tempoTantrums: Math.floor(distances.tempoKm * config.perKm),
        pointsPints: Math.floor(distances.pintsKm * config.perKm),
      });
    }
  }

  // Add workout points (6 points per workout)
  if (workoutCounts.tempoCount > 0 || workoutCounts.pintsCount > 0) {
    scoreboard.push({
      activity: 'Workout',
      tempoTantrums: workoutCounts.tempoCount * 6,
      pointsPints: workoutCounts.pintsCount * 6,
    });
  }

  // Add elevation points (6 points per 1000m, floor of cumulative total)
  // Elevation: 6 points per complete 1000m (e.g., 1455m = 1 complete 1000m = 6 points)
  const tempoElevationPoints = Math.floor(elevationTotals.tempoMeters / 1000) * ELEVATION_POINTS_PER_1000M;
  const pintsElevationPoints = Math.floor(elevationTotals.pintsMeters / 1000) * ELEVATION_POINTS_PER_1000M;
  if (tempoElevationPoints > 0 || pintsElevationPoints > 0) {
    scoreboard.push({
      activity: 'Elevation',
      tempoTantrums: tempoElevationPoints,
      pointsPints: pintsElevationPoints,
    });
  }

  // Calculate totals
  const totals = {
    tempoTantrums: scoreboard.reduce((sum, s) => sum + s.tempoTantrums, 0),
    pointsPints: scoreboard.reduce((sum, s) => sum + s.pointsPints, 0),
  };

  // Convert individuals to array and recalculate all points from cumulative values
  const individuals = Array.from(individualMap.values())
    .map((ind) => {
      // Recalculate activity points from cumulative distances
      let totalActivityPoints = 0;
      const recalculatedActivities: Record<string, { distance: number; points: number }> = {};

      for (const [activityType, data] of Object.entries(ind.activities)) {
        const config = POINTS_CONFIG[activityType];
        let points = 0;
        if (config?.perKm) {
          // Points from cumulative distance: floor(distance) * rate for 1pt/km activities
          // or floor(distance * rate) for fractional rates
          points = Math.floor(data.distance * config.perKm);
        } else if (config?.perWorkout) {
          // Workouts: keep the accumulated count * 6
          points = data.points; // This was already calculated correctly per workout
        }
        recalculatedActivities[activityType] = { distance: data.distance, points };
        totalActivityPoints += points;
      }

      // Calculate elevation points from cumulative elevation (6 per complete 1000m)
      const calculatedElevationPoints = Math.floor(ind.elevation / 1000) * ELEVATION_POINTS_PER_1000M;

      return {
        ...ind,
        activities: recalculatedActivities,
        elevationPoints: calculatedElevationPoints,
        totalPoints: totalActivityPoints + calculatedElevationPoints,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);

  // Convert daily tracker using cumulative values with proper floor rounding
  const sortedDates = Array.from(dailyRawData.keys()).sort();

  // Running cumulative data
  const cumulativeData: DailyCumulativeData = {
    distances: new Map(getActivityCategories().map(cat => [cat, { tempoKm: 0, pintsKm: 0 }])),
    elevation: { tempoMeters: 0, pintsMeters: 0 },
    workouts: { tempoCount: 0, pintsCount: 0 },
  };

  let prevTempoTotal = 0;
  let prevPintsTotal = 0;

  const dailyTracker: DailyPoint[] = sortedDates.map((date) => {
    const dailyData = dailyRawData.get(date)!;

    // Add this day's raw data to cumulative totals
    for (const [activityType, dist] of dailyData.distances.entries()) {
      const cumDist = cumulativeData.distances.get(activityType)!;
      cumDist.tempoKm += dist.tempoKm;
      cumDist.pintsKm += dist.pintsKm;
    }
    cumulativeData.elevation.tempoMeters += dailyData.elevation.tempoMeters;
    cumulativeData.elevation.pintsMeters += dailyData.elevation.pintsMeters;
    cumulativeData.workouts.tempoCount += dailyData.workouts.tempoCount;
    cumulativeData.workouts.pintsCount += dailyData.workouts.pintsCount;

    // Calculate team points from cumulative data (with floor rounding)
    const { tempo: tempoTotal, pints: pintsTotal } = calculateTeamPoints(cumulativeData);

    // Daily points = difference from previous day's cumulative
    const tempoDaily = tempoTotal - prevTempoTotal;
    const pintsDaily = pintsTotal - prevPintsTotal;

    prevTempoTotal = tempoTotal;
    prevPintsTotal = pintsTotal;

    return {
      date,
      tempoTantrums: tempoDaily,
      pointsPints: pintsDaily,
      tempoTotal,
      pintsTotal,
    };
  });

  // Sort activities by date descending
  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    activities,
    scoreboard,
    totals,
    individuals,
    dailyTracker,
    lastUpdated: new Date().toISOString(),
  };
}

export async function GET() {
  try {
    // Get stored dates for mapping
    const storedDates = await getActivityDates();

    // Sync activities from Strava and merge with stored activities
    const { storedActivityMap, syncedCount } = await syncAndMergeActivities(storedDates);

    // Get last sync time
    const lastSync = await getLastSync();

    // Process all stored activities
    const allStoredActivities = Array.from(storedActivityMap.values());
    const dashboardData = processActivities(allStoredActivities);

    // Add count of activities needing dates
    const activitiesNeedingDates = dashboardData.activities.filter(a => a.date === 'Unknown').length;

    return NextResponse.json({
      ...dashboardData,
      activitiesNeedingDates,
      totalStoredActivities: allStoredActivities.length,
      lastSyncedFromStrava: syncedCount,
      lastSync,
    });
  } catch (error) {
    console.error('Error fetching Strava data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Strava data' },
      { status: 500 }
    );
  }
}
