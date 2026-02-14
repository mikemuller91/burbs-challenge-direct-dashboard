import { NextResponse } from 'next/server';
import { fetchAllClubActivities, getAthleteDisplayName, StravaActivity } from '@/lib/strava';
import { calculatePoints, getActivityCategories, POINTS_CONFIG, ELEVATION_ELIGIBLE_TYPES, ELEVATION_POINTS_PER_1000M } from '@/lib/points';
import { getAthleteTeam, TEAMS, TeamName } from '@/lib/teams';
import { getActivityDates } from '@/lib/db';

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

function processActivities(stravaActivities: StravaActivity[], storedDates: Record<string, string>): DashboardData {
  const activities: ProcessedActivity[] = [];
  const individualMap = new Map<string, IndividualStats>();
  const dailyMap = new Map<string, { tempoTantrums: number; pointsPints: number }>();

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

  // Track used IDs to handle duplicates
  const usedIds = new Map<string, number>();

  // Process each activity
  for (const stravaActivity of stravaActivities) {
    const athleteName = getAthleteDisplayName(stravaActivity);
    const team = getAthleteTeam(athleteName);

    if (!team) {
      // Skip activities from athletes not in either team
      continue;
    }

    const { activityPoints, elevationPoints, totalPoints, normalizedType } = calculatePoints(
      stravaActivity.sport_type || stravaActivity.type,
      stravaActivity.distance || 0,
      stravaActivity.total_elevation_gain || 0
    );

    const distanceKm = stravaActivity.distance / 1000;

    // Generate a unique ID for this activity
    const activityId = generateActivityId(stravaActivity, athleteName, usedIds);

    // Use stored date if available, otherwise try Strava date, otherwise Unknown
    const dateStr = storedDates[activityId]
      || (stravaActivity.start_date_local ? stravaActivity.start_date_local.split('T')[0] : null)
      || 'Unknown';

    // Create processed activity
    const processed: ProcessedActivity = {
      id: activityId,
      date: dateStr,
      athlete: athleteName,
      team,
      type: stravaActivity.sport_type || stravaActivity.type,
      normalizedType,
      distance: Math.round(distanceKm * 100) / 100,
      elevation: Math.round(stravaActivity.total_elevation_gain),
      points: activityPoints,
      elevationPoints,
      totalPoints,
      title: stravaActivity.name,
    };
    activities.push(processed);

    // Only count February activities for scoring
    const isFebruary = isFebruaryActivity(dateStr);

    if (isFebruary) {
      // Accumulate raw distances by activity type (for team scoring)
      const scoreKey = normalizedType === 'Other' ? 'Workout' : normalizedType;

      if (scoreKey === 'Workout') {
        // Count workouts instead of distance
        if (team === TEAMS.TEMPO_TANTRUMS) {
          workoutCounts.tempoCount += 1;
        } else {
          workoutCounts.pintsCount += 1;
        }
      } else if (distanceMap.has(scoreKey)) {
        // Accumulate distance in km
        const current = distanceMap.get(scoreKey)!;
        if (team === TEAMS.TEMPO_TANTRUMS) {
          current.tempoKm += distanceKm;
        } else {
          current.pintsKm += distanceKm;
        }
      }

      // Accumulate elevation (only for eligible types)
      if (ELEVATION_ELIGIBLE_TYPES.includes(normalizedType)) {
        if (team === TEAMS.TEMPO_TANTRUMS) {
          elevationTotals.tempoMeters += stravaActivity.total_elevation_gain || 0;
        } else {
          elevationTotals.pintsMeters += stravaActivity.total_elevation_gain || 0;
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
      individual.elevation += stravaActivity.total_elevation_gain || 0;
      individual.elevationPoints += elevationPoints;

      if (!individual.activities[normalizedType]) {
        individual.activities[normalizedType] = { distance: 0, points: 0 };
      }
      individual.activities[normalizedType].distance += distanceKm;
      individual.activities[normalizedType].points += activityPoints;

      // Update daily tracker with raw points (will be recalculated below)
      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, { tempoTantrums: 0, pointsPints: 0 });
      }
      const daily = dailyMap.get(dateStr)!;
      if (team === TEAMS.TEMPO_TANTRUMS) {
        daily.tempoTantrums += totalPoints;
      } else {
        daily.pointsPints += totalPoints;
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

  // Convert daily tracker and calculate running totals
  const sortedDates = Array.from(dailyMap.keys()).sort();
  let tempoRunning = 0;
  let pintsRunning = 0;
  const dailyTracker: DailyPoint[] = sortedDates.map((date) => {
    const daily = dailyMap.get(date)!;
    tempoRunning += daily.tempoTantrums;
    pintsRunning += daily.pointsPints;
    return {
      date,
      tempoTantrums: Math.round(daily.tempoTantrums),
      pointsPints: Math.round(daily.pointsPints),
      tempoTotal: Math.round(tempoRunning),
      pintsTotal: Math.round(pintsRunning),
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
    // Fetch activities and stored dates in parallel
    const [stravaActivities, storedDates] = await Promise.all([
      fetchAllClubActivities(),
      getActivityDates(),
    ]);

    const dashboardData = processActivities(stravaActivities, storedDates);

    // Add count of activities needing dates
    const activitiesNeedingDates = dashboardData.activities.filter(a => a.date === 'Unknown').length;

    return NextResponse.json({
      ...dashboardData,
      activitiesNeedingDates,
    });
  } catch (error) {
    console.error('Error fetching Strava data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Strava data' },
      { status: 500 }
    );
  }
}
