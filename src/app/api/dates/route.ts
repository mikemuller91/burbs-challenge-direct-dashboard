import { NextResponse } from 'next/server';
import { getActivityDates, saveActivityDate, saveActivityDates } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - Fetch all stored dates
export async function GET() {
  try {
    const dates = await getActivityDates();
    return NextResponse.json({ dates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch dates' },
      { status: 500 }
    );
  }
}

// POST - Save a single date or bulk dates
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Bulk save
    if (body.dates && typeof body.dates === 'object') {
      const success = await saveActivityDates(body.dates);
      if (!success) {
        return NextResponse.json({ error: 'Failed to save dates' }, { status: 500 });
      }
      return NextResponse.json({ success: true, count: Object.keys(body.dates).length });
    }

    // Single save
    const { activityId, date } = body;

    if (!activityId || !date) {
      return NextResponse.json(
        { error: 'Missing activityId or date' },
        { status: 400 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    const success = await saveActivityDate(activityId, date);

    if (!success) {
      return NextResponse.json({ error: 'Failed to save date' }, { status: 500 });
    }

    return NextResponse.json({ success: true, activityId, date });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save date' },
      { status: 500 }
    );
  }
}
