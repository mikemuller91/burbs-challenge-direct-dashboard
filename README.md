# Burbs February Challenge Dashboard

A visually appealing dashboard to showcase the progress of the Burbs February Challenge, tracking competition between **Tempo Tantrums** and **Points & Pints**.

## Features

- **Team Scores Tab**: View points by activity type with bar charts and breakdowns
- **Activities Tab**: Browse all activities with filtering by type and team
- **Daily Tracker Tab**: Track cumulative progress over time with area and line charts

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Deploy to Vercel

### Option 1: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Option 2: Deploy via GitHub

1. Push this project to a GitHub repository
2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your GitHub repository
5. Click "Deploy"

## Data Source

The dashboard fetches data from your published Google Sheet:
- Scoreboard (gid=0)
- Daily Tracker (gid=1201336220)
- Strava Club Activities (gid=1272828437)

Data auto-refreshes every 5 minutes.

## Customization

### Update Sheet GIDs

If your sheet structure changes, update the GIDs in `src/components/Dashboard.tsx`:

```typescript
const SHEET_GIDS = {
  scoreboard: 0,
  dailyTracker: 1201336220,
  activities: 1272828437,
  // ... other sheets
};
```

### Update Parsing Logic

If your column structure differs, update the parsing functions in `src/lib/sheets.ts`.

## Tech Stack

- Next.js 16
- React 18
- TypeScript
- Tailwind CSS
- Recharts (charts)
- PapaParse (CSV parsing)
