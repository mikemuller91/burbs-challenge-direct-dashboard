// Points calculation system for the Burbs Challenge

// Strava activity types mapped to our categories
export const ACTIVITY_TYPE_MAP: Record<string, string> = {
  'Run': 'Road Run',
  'TrailRun': 'Trail Run',
  'Ride': 'Cycle',
  'MountainBikeRide': 'MTB',
  'VirtualRide': 'Cycle',
  'Swim': 'Swim',
  'Workout': 'Workout',
  'WeightTraining': 'Workout',
  'HighIntensityIntervalTraining': 'Workout',
  'Kayaking': 'Paddle Ski',
  'Canoeing': 'Paddle Ski',
  'StandUpPaddling': 'Paddle Ski',
  'Rowing': 'Paddle Ski',
  'Surfing': 'Paddle Ski',
};

// Points per unit for each activity type
// Distance is in kilometers, elevation in meters
export const POINTS_CONFIG: Record<string, { perKm?: number; perWorkout?: number }> = {
  'Road Run': { perKm: 1 },
  'Trail Run': { perKm: 1.1 },
  'Cycle': { perKm: 0.25 },
  'MTB': { perKm: 0.4 },
  'Swim': { perKm: 4 },
  'Workout': { perWorkout: 6 },
  'Paddle Ski': { perKm: 1 },
};

// Elevation points: 6 points per 1000m
// Only applies to these activity types
export const ELEVATION_POINTS_PER_1000M = 6;
export const ELEVATION_ELIGIBLE_TYPES = ['Road Run', 'Trail Run', 'Cycle', 'MTB'];

export interface ActivityPoints {
  activityPoints: number;
  elevationPoints: number;
  totalPoints: number;
  activityType: string;
  normalizedType: string;
}

/**
 * Calculate points for an activity
 * @param stravaType - The Strava activity type (e.g., 'Run', 'TrailRun')
 * @param distanceMeters - Distance in meters
 * @param elevationGain - Elevation gain in meters
 * @returns Points breakdown
 */
export function calculatePoints(
  stravaType: string,
  distanceMeters: number,
  elevationGain: number
): ActivityPoints {
  const normalizedType = ACTIVITY_TYPE_MAP[stravaType] || 'Other';
  const config = POINTS_CONFIG[normalizedType];

  let activityPoints = 0;

  if (config) {
    if (config.perKm) {
      const distanceKm = distanceMeters / 1000;
      activityPoints = Math.floor(distanceKm * config.perKm);
    } else if (config.perWorkout) {
      activityPoints = config.perWorkout;
    }
  }

  // Elevation points: 6 per complete 1000m, only for eligible activity types
  // e.g., 1455m = 1 complete 1000m = 6 points
  let elevationPoints = 0;
  if (ELEVATION_ELIGIBLE_TYPES.includes(normalizedType)) {
    elevationPoints = Math.floor(elevationGain / 1000) * ELEVATION_POINTS_PER_1000M;
  }

  return {
    activityPoints,
    elevationPoints,
    totalPoints: activityPoints + elevationPoints,
    activityType: stravaType,
    normalizedType,
  };
}

/**
 * Get all activity categories for display
 */
export function getActivityCategories(): string[] {
  return Object.keys(POINTS_CONFIG);
}
