import { NextResponse } from 'next/server';
import { fetchClubActivities, getAthleteDisplayName } from '@/lib/strava';
import { getAthleteTeam, ATHLETE_TEAMS } from '@/lib/teams';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Fetch raw activities from Strava (just first page)
    const activities = await fetchClubActivities(1, 50);

    // Process to show debug info
    const debugInfo = {
      totalActivitiesReturned: activities.length,
      configuredAthletes: Object.keys(ATHLETE_TEAMS),
      activities: activities.map((activity) => {
        const displayName = getAthleteDisplayName(activity);
        const team = getAthleteTeam(displayName);
        return {
          id: activity.id,
          name: activity.name,
          athleteFirstname: activity.athlete?.firstname,
          athleteLastname: activity.athlete?.lastname,
          displayName,
          teamMatched: team,
          type: activity.type,
          sport_type: activity.sport_type,
          distance: activity.distance,
          start_date: activity.start_date,
          start_date_local: activity.start_date_local,
        };
      }),
    };

    return NextResponse.json(debugInfo, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
