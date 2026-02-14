import { Redis } from '@upstash/redis';

// Initialize Redis client
// Supports both Vercel integration names (KV_REST_API_*) and standard Upstash names
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

const ACTIVITY_DATES_KEY = 'activity_dates';

export interface ActivityDate {
  activityId: number;
  date: string; // YYYY-MM-DD format
  updatedAt: string;
}

/**
 * Get all stored activity dates
 */
export async function getActivityDates(): Promise<Record<number, string>> {
  try {
    const data = await redis.hgetall(ACTIVITY_DATES_KEY);
    if (!data) return {};

    // Convert to proper format
    const result: Record<number, string> = {};
    for (const [key, value] of Object.entries(data)) {
      result[parseInt(key)] = value as string;
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
export async function saveActivityDate(activityId: number, date: string): Promise<boolean> {
  try {
    await redis.hset(ACTIVITY_DATES_KEY, { [activityId.toString()]: date });
    return true;
  } catch (error) {
    console.error('Error saving activity date:', error);
    return false;
  }
}

/**
 * Save multiple activity dates at once
 */
export async function saveActivityDates(dates: Record<number, string>): Promise<boolean> {
  try {
    if (Object.keys(dates).length === 0) return true;

    const data: Record<string, string> = {};
    for (const [id, date] of Object.entries(dates)) {
      data[id] = date;
    }
    await redis.hset(ACTIVITY_DATES_KEY, data);
    return true;
  } catch (error) {
    console.error('Error saving activity dates:', error);
    return false;
  }
}

/**
 * Delete a date for an activity
 */
export async function deleteActivityDate(activityId: number): Promise<boolean> {
  try {
    await redis.hdel(ACTIVITY_DATES_KEY, activityId.toString());
    return true;
  } catch (error) {
    console.error('Error deleting activity date:', error);
    return false;
  }
}
