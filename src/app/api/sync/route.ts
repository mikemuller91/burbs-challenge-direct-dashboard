import { NextResponse } from 'next/server';
import { fetchAllClubActivities, getAthleteDisplayName, StravaActivity } from '@/lib/strava';
import { getActivityDates, getStoredActivities, saveActivities, setLastSync, getLastSync, StoredActivity } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Allow longer execution time for cron jobs
export const maxDuration = 60;

/**
 * Generate a unique ID for an activity based on its properties
 */
function generateActivityId(
  activity: StravaActivity,
  athleteName: string,
  usedIds: Map<string, number>
): string {
  const str = `${athleteName}|${activity.name}|${activity.distance}|${activity.sport_type || activity.type}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const baseId = Math.abs(hash).toString();
  const count = usedIds.get(baseId) || 0;
  usedIds.set(baseId, count + 1);
  return count === 0 ? baseId : `${baseId}_${count}`;
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
 * Sync endpoint - called by Vercel Cron
 * Fetches latest activities from Strava and stores them
 */
export async function GET(request: Request) {
  try {
    // Verify cron secret if set (optional security)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting Strava sync...');

    // Get stored dates for mapping
    const storedDates = await getActivityDates();

    // Get existing stored activities
    const existingStored = await getStoredActivities();
    const storedActivityMap = new Map<string, StoredActivity>();

    for (const stored of existingStored) {
      storedActivityMap.set(stored.id, stored);
    }

    const existingCount = storedActivityMap.size;

    // Fetch from Strava
    const stravaActivities = await fetchAllClubActivities();
    console.log(`Fetched ${stravaActivities.length} activities from Strava`);

    // Track used IDs for generating new IDs
    const usedIds = new Map<string, number>();

    // Convert new Strava activities to StoredActivity format
    const newStoredActivities: StoredActivity[] = [];
    let newCount = 0;

    for (const activity of stravaActivities) {
      const athleteName = getAthleteDisplayName(activity);
      const id = generateActivityId(activity, athleteName, usedIds);

      // Check if we already have this activity
      const existingStored = storedActivityMap.get(id);

      // Get date from existing stored activity, or stored dates, or Strava, or Unknown
      const date = existingStored?.date
        || storedDates[id]
        || (activity.start_date_local ? activity.start_date_local.split('T')[0] : null)
        || 'Unknown';

      const storedActivity = stravaToStoredActivity(activity, id, date);

      if (!existingStored) {
        newCount++;
      }

      newStoredActivities.push(storedActivity);
      storedActivityMap.set(id, storedActivity);
    }

    // Save all activities
    await saveActivities(newStoredActivities);
    await setLastSync();

    const lastSync = await getLastSync();
    const totalCount = storedActivityMap.size;

    console.log(`Sync complete: ${newCount} new activities, ${totalCount} total stored`);

    return NextResponse.json({
      success: true,
      message: 'Sync completed successfully',
      stats: {
        fetchedFromStrava: stravaActivities.length,
        newActivities: newCount,
        previouslyStored: existingCount,
        totalStored: totalCount,
        lastSync,
      },
    });
  } catch (error) {
    console.error('Error syncing Strava data:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync Strava data'
      },
      { status: 500 }
    );
  }
}
