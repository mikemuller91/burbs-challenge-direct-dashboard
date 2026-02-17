import { NextResponse } from 'next/server';
import { fetchAllClubActivities, getAthleteDisplayName, StravaActivity } from '@/lib/strava';
import { calculatePoints, getActivityCategories, POINTS_CONFIG, ELEVATION_ELIGIBLE_TYPES, ELEVATION_POINTS_PER_1000M } from '@/lib/points';
import { getAthleteTeam, TEAMS, TeamName } from '@/lib/teams';
import { getActivityDates, getStoredActivities, saveActivities, setLastSync, getLastSync, StoredActivity, removeActivitiesByIds } from '@/lib/db';

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
 * Create a key for duplicate detection based on athlete + distance + date
 * Distance is rounded to nearest meter to handle floating point differences
 */
function createDuplicateKey(athleteFirstname: string, athleteLastname: string, distance: number, date: string): string {
  const athleteName = `${athleteFirstname} ${athleteLastname}`.trim().toLowerCase();
  const roundedDistance = Math.round(distance);
  return `${athleteName}|${roundedDistance}|${date}`;
}

/**
 * Sync activities from Strava and merge with stored activities
 * Returns the merged list of all activities
 */
async function syncAndMergeActivities(storedDates: Record<string, string>): Promise<{
  activities: StravaActivity[];
  storedActivityMap: Map<string, StoredActivity>;
  syncedCount: number;
  duplicatesRemoved: number;
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

  // Build a map of new activities by duplicate key for detection
  const newActivitiesByDupeKey = new Map<string, StoredActivity>();

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

    // Track by duplicate key (athlete + distance + date)
    if (date !== 'Unknown') {
      const dupeKey = createDuplicateKey(
        storedActivity.athleteFirstname,
        storedActivity.athleteLastname,
        storedActivity.distance,
        date
      );
      newActivitiesByDupeKey.set(dupeKey, storedActivity);
    }
  }

  // Detect duplicates: find old stored activities that match new ones by athlete+distance+date but have different IDs
  const duplicateIdsToRemove: string[] = [];

  for (const stored of existingStored) {
    if (stored.date === 'Unknown') continue;

    const dupeKey = createDuplicateKey(
      stored.athleteFirstname,
      stored.athleteLastname,
      stored.distance,
      stored.date
    );

    const matchingNewActivity = newActivitiesByDupeKey.get(dupeKey);

    // If there's a matching new activity with a different ID, the old one is a duplicate
    if (matchingNewActivity && matchingNewActivity.id !== stored.id) {
      console.log(`Detected duplicate: old="${stored.id}" (${stored.sport_type}) -> new="${matchingNewActivity.id}" (${matchingNewActivity.sport_type}) for ${stored.athleteFirstname} ${stored.athleteLastname}`);
      duplicateIdsToRemove.push(stored.id);
      // Remove from the map so it doesn't appear in results
      storedActivityMap.delete(stored.id);
    }
  }

  // Remove duplicates from storage
  if (duplicateIdsToRemove.length > 0) {
    await removeActivitiesByIds(duplicateIdsToRemove);
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
    duplicatesRemoved: duplicateIdsToRemove.length,
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

function processActivities(storedActivities: StoredActivity[]): DashboardData {
  const activities: ProcessedActivity[] = [];
  const individualMap = new Map<string, IndividualStats>();

  // Track cumulative distances (km) by activity type and team
  const distanceMap = new Map<string, { tempoKm: number; pintsKm: number }>();
  // Track cumulative elevation (meters) by team
  const elevationTotals = { tempoMeters: 0, pintsMeters: 0 };
  // Track workout counts by team
  const workoutCounts = { tempoCount: 0, pintsCount: 0 };

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

  // Historical daily tracker data (verified correct values for Feb 1-14, 2026)
  // Format: { date: { tempoTotal, pintsTotal, tempoDaily, pintsDaily } }
  const historicalData: Record<string, { tempoTotal: number; pintsTotal: number; tempoDaily: number; pintsDaily: number }> = {
    '2026-02-01': { tempoTotal: 93, pintsTotal: 73, tempoDaily: 93, pintsDaily: 73 },
    '2026-02-02': { tempoTotal: 130, pintsTotal: 101, tempoDaily: 37, pintsDaily: 28 },
    '2026-02-03': { tempoTotal: 193, pintsTotal: 134, tempoDaily: 63, pintsDaily: 33 },
    '2026-02-04': { tempoTotal: 232, pintsTotal: 176, tempoDaily: 39, pintsDaily: 42 },
    '2026-02-05': { tempoTotal: 279, pintsTotal: 233, tempoDaily: 47, pintsDaily: 57 },
    '2026-02-06': { tempoTotal: 305, pintsTotal: 263, tempoDaily: 26, pintsDaily: 30 },
    '2026-02-07': { tempoTotal: 444, pintsTotal: 384, tempoDaily: 139, pintsDaily: 121 },
    '2026-02-08': { tempoTotal: 466, pintsTotal: 424, tempoDaily: 22, pintsDaily: 40 },
    '2026-02-09': { tempoTotal: 506, pintsTotal: 438, tempoDaily: 40, pintsDaily: 14 },
    '2026-02-10': { tempoTotal: 575, pintsTotal: 484, tempoDaily: 69, pintsDaily: 46 },
    '2026-02-11': { tempoTotal: 596, pintsTotal: 509, tempoDaily: 21, pintsDaily: 25 },
    '2026-02-12': { tempoTotal: 626, pintsTotal: 542, tempoDaily: 30, pintsDaily: 33 },
    '2026-02-13': { tempoTotal: 656, pintsTotal: 568, tempoDaily: 30, pintsDaily: 26 },
    '2026-02-14': { tempoTotal: 770, pintsTotal: 647, tempoDaily: 114, pintsDaily: 79 },
  };

  // Last historical date and its totals (baseline for future calculations)
  const lastHistoricalDate = '2026-02-14';
  const lastHistoricalTotals = historicalData[lastHistoricalDate];

  // Group February activities by date (for dates after historical data)
  const activitiesByDate = new Map<string, typeof activities>();
  for (const activity of activities) {
    if (!activity.date.startsWith('2026-02')) continue;
    if (!activitiesByDate.has(activity.date)) {
      activitiesByDate.set(activity.date, []);
    }
    activitiesByDate.get(activity.date)!.push(activity);
  }

  // Get all February dates (both historical and from activities)
  const allDates = new Set<string>([
    ...Object.keys(historicalData),
    ...Array.from(activitiesByDate.keys()).filter(d => d.startsWith('2026-02'))
  ]);
  const sortedDates = Array.from(allDates).sort();

  // Build daily tracker
  let prevTempoTotal = 0;
  let prevPintsTotal = 0;

  const dailyTracker: DailyPoint[] = sortedDates.map((date) => {
    // Use historical data if available
    if (historicalData[date]) {
      const hist = historicalData[date];
      prevTempoTotal = hist.tempoTotal;
      prevPintsTotal = hist.pintsTotal;
      return {
        date,
        tempoTantrums: hist.tempoDaily,
        pointsPints: hist.pintsDaily,
        tempoTotal: hist.tempoTotal,
        pintsTotal: hist.pintsTotal,
      };
    }

    // For dates after historical data, calculate from activities
    const dayActivities = activitiesByDate.get(date) || [];

    let tempoDaily = 0;
    let pintsDaily = 0;

    for (const activity of dayActivities) {
      if (activity.normalizedType === 'Other') continue;

      // Add the activity's points to daily total
      if (activity.team === TEAMS.TEMPO_TANTRUMS) {
        tempoDaily += activity.totalPoints;
      } else {
        pintsDaily += activity.totalPoints;
      }
    }

    const tempoTotal = prevTempoTotal + tempoDaily;
    const pintsTotal = prevPintsTotal + pintsDaily;

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
    const { storedActivityMap, syncedCount, duplicatesRemoved } = await syncAndMergeActivities(storedDates);

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
      duplicatesRemoved,
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
