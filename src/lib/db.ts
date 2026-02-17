import { Redis } from '@upstash/redis';

// Initialize Redis client
// Supports both Vercel integration names (KV_REST_API_*) and standard Upstash names
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

const ACTIVITY_DATES_KEY = 'activity_dates';
const STORED_ACTIVITIES_KEY = 'stored_activities';
const LAST_SYNC_KEY = 'last_sync';

export interface ActivityDate {
  activityId: string;
  date: string; // YYYY-MM-DD format
  updatedAt: string;
}

// Stored activity structure (matches what we need from Strava)
export interface StoredActivity {
  id: string; // Our generated ID
  athleteFirstname: string;
  athleteLastname: string;
  name: string;
  type: string;
  sport_type: string;
  distance: number;
  total_elevation_gain: number;
  date: string; // YYYY-MM-DD format (manually entered or from Strava)
  storedAt: string; // ISO timestamp when we stored it
}

/**
 * Get all stored activity dates
 */
export async function getActivityDates(): Promise<Record<string, string>> {
  try {
    const data = await redis.hgetall(ACTIVITY_DATES_KEY);
    if (!data) return {};

    // Convert to proper format
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = value as string;
    }
    return result;
  } catch (error) {
    console.error('Error fetching activity dates:', error);
    return {};
  }
}

/**
 * Save a date for an activity
 */
export async function saveActivityDate(activityId: string, date: string): Promise<boolean> {
  try {
    await redis.hset(ACTIVITY_DATES_KEY, { [activityId]: date });
    return true;
  } catch (error) {
    console.error('Error saving activity date:', error);
    return false;
  }
}

/**
 * Save multiple activity dates at once
 */
export async function saveActivityDates(dates: Record<string, string>): Promise<boolean> {
  try {
    if (Object.keys(dates).length === 0) return true;

    await redis.hset(ACTIVITY_DATES_KEY, dates);
    return true;
  } catch (error) {
    console.error('Error saving activity dates:', error);
    return false;
  }
}

/**
 * Delete a date for an activity
 */
export async function deleteActivityDate(activityId: string): Promise<boolean> {
  try {
    await redis.hdel(ACTIVITY_DATES_KEY, activityId);
    return true;
  } catch (error) {
    console.error('Error deleting activity date:', error);
    return false;
  }
}

/**
 * Get all stored activities
 */
export async function getStoredActivities(): Promise<StoredActivity[]> {
  try {
    const data = await redis.get<StoredActivity[]>(STORED_ACTIVITIES_KEY);
    return data || [];
  } catch (error) {
    console.error('Error fetching stored activities:', error);
    return [];
  }
}

/**
 * Save activities to storage (merges with existing, keeping all unique activities)
 */
export async function saveActivities(activities: StoredActivity[]): Promise<boolean> {
  try {
    // Get existing activities
    const existing = await getStoredActivities();

    // Create a map of existing activities by ID for quick lookup
    const activityMap = new Map<string, StoredActivity>();
    for (const activity of existing) {
      activityMap.set(activity.id, activity);
    }

    // Add/update with new activities
    for (const activity of activities) {
      activityMap.set(activity.id, activity);
    }

    // Convert back to array
    const merged = Array.from(activityMap.values());

    // Save to Redis
    await redis.set(STORED_ACTIVITIES_KEY, merged);

    console.log(`Stored ${merged.length} total activities (${activities.length} new/updated)`);
    return true;
  } catch (error) {
    console.error('Error saving activities:', error);
    return false;
  }
}

/**
 * Update the date for a stored activity
 */
export async function updateStoredActivityDate(activityId: string, date: string): Promise<boolean> {
  try {
    const activities = await getStoredActivities();
    const updated = activities.map(a =>
      a.id === activityId ? { ...a, date } : a
    );
    await redis.set(STORED_ACTIVITIES_KEY, updated);
    return true;
  } catch (error) {
    console.error('Error updating stored activity date:', error);
    return false;
  }
}

/**
 * Remove activities by their IDs
 */
export async function removeActivitiesByIds(idsToRemove: string[]): Promise<boolean> {
  try {
    if (idsToRemove.length === 0) return true;

    const activities = await getStoredActivities();
    const idsSet = new Set(idsToRemove);
    const filtered = activities.filter(a => !idsSet.has(a.id));

    await redis.set(STORED_ACTIVITIES_KEY, filtered);

    console.log(`Removed ${idsToRemove.length} duplicate activities`);
    return true;
  } catch (error) {
    console.error('Error removing activities:', error);
    return false;
  }
}

/**
 * Get the last sync timestamp
 */
export async function getLastSync(): Promise<string | null> {
  try {
    return await redis.get<string>(LAST_SYNC_KEY);
  } catch (error) {
    console.error('Error fetching last sync:', error);
    return null;
  }
}

/**
 * Update the last sync timestamp
 */
export async function setLastSync(): Promise<boolean> {
  try {
    await redis.set(LAST_SYNC_KEY, new Date().toISOString());
    return true;
  } catch (error) {
    console.error('Error setting last sync:', error);
    return false;
  }
}
