// Strava API client for the Burbs Challenge

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
}

interface StravaAthlete {
  id: number;
  firstname: string;
  lastname: string;
}

export interface StravaActivity {
  id: number;
  athlete: {
    firstname: string;
    lastname: string;
  };
  name: string;
  type: string;
  sport_type: string;
  distance: number; // meters
  total_elevation_gain: number; // meters
  start_date: string;
  start_date_local: string;
  moving_time: number; // seconds
  elapsed_time: number; // seconds
}

// In-memory token cache
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Get a valid access token, refreshing if necessary
 */
async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if still valid (with 5 min buffer)
  if (cachedAccessToken && tokenExpiresAt > now + 300) {
    return cachedAccessToken;
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const refreshToken = process.env.STRAVA_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Strava credentials. Please set STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, and STRAVA_REFRESH_TOKEN environment variables.');
  }

  // Refresh the token
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Strava token: ${error}`);
  }

  const data: TokenResponse = await response.json();

  cachedAccessToken = data.access_token;
  tokenExpiresAt = data.expires_at;

  return data.access_token;
}

/**
 * Fetch club activities from Strava
 * @param page - Page number (1-indexed)
 * @param perPage - Number of activities per page (max 200)
 */
export async function fetchClubActivities(
  page: number = 1,
  perPage: number = 200
): Promise<StravaActivity[]> {
  const clubId = process.env.STRAVA_CLUB_ID;

  if (!clubId) {
    throw new Error('Missing STRAVA_CLUB_ID environment variable.');
  }

  const accessToken = await getAccessToken();

  const url = `${STRAVA_API_BASE}/clubs/${clubId}/activities?page=${page}&per_page=${perPage}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    next: { revalidate: 300 }, // Cache for 5 minutes
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch club activities: ${error}`);
  }

  return response.json();
}

/**
 * Fetch all club activities (handles pagination)
 * Note: Club activities endpoint doesn't return dates, so we fetch all recent activities
 */
export async function fetchAllClubActivities(): Promise<StravaActivity[]> {
  const allActivities: StravaActivity[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const activities = await fetchClubActivities(page, perPage);

    if (activities.length === 0) break;

    allActivities.push(...activities);

    // If we got fewer than requested, we've reached the end
    if (activities.length < perPage) break;

    page++;

    // Safety limit - fetch up to 1000 activities
    if (page > 5) break;
  }

  return allActivities;
}

/**
 * Get athlete display name from Strava activity
 */
export function getAthleteDisplayName(activity: StravaActivity): string {
  const firstName = activity.athlete.firstname || '';
  const lastInitial = activity.athlete.lastname ? activity.athlete.lastname.charAt(0) + '.' : '';
  return `${firstName} ${lastInitial}`.trim();
}
