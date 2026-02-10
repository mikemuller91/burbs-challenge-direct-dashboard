'use client';

import { useState, useEffect } from 'react';
import TeamScoreboard from './TeamScoreboard';
import ActivitiesList from './ActivitiesList';
import DailyTracker from './DailyTracker';
import IndividualsTable from './IndividualsTable';
import CountdownTimer from './CountdownTimer';
import {
  TeamScore,
  parseScoreboard,
  getTotals,
} from '@/lib/sheets';
import Papa from 'papaparse';

const SHEET_ID = '2PACX-1vRnGFgSOWvgvysshy6qPwgLpBp0C9-oIHOzGrtXC6LNwZfp9RSIXshzHoOn4hqpsFO-AKkmo9OR5wUA';

// Sheet GIDs from the published spreadsheet
const SHEET_GIDS = {
  scoreboard: 0,
  individuals: 1757627740,
  dailyTracker: 1201336220,
  activities: 1272828437,     // Strava Club Activities
  teams: 158061936,
  activityOverload: 1272195002,
};

async function fetchSheet(gid: number): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?gid=${gid}&single=true&output=csv`;
  const response = await fetch(url, { cache: 'no-store' });
  const text = await response.text();
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
  return result.data;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'scoreboard' | 'individuals' | 'activities' | 'tracker'>('scoreboard');
  const [scores, setScores] = useState<TeamScore[]>([]);
  const [totals, setTotals] = useState({ tempoTantrums: 0, pointsPints: 0 });
  const [activitiesData, setActivitiesData] = useState<string[][]>([]);
  const [teamsData, setTeamsData] = useState<string[][]>([]);
  const [dailyTrackerData, setDailyTrackerData] = useState<string[][]>([]);
  const [individualsData, setIndividualsData] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch scoreboard data
      const scoreboardData = await fetchSheet(SHEET_GIDS.scoreboard);
      setScores(parseScoreboard(scoreboardData));
      setTotals(getTotals(scoreboardData));

      // Try to fetch activities data
      try {
        const activitiesRaw = await fetchSheet(SHEET_GIDS.activities);
        setActivitiesData(activitiesRaw);
      } catch (e) {
        console.log('Activities sheet not available');
      }

      // Try to fetch teams data
      try {
        const teamsRaw = await fetchSheet(SHEET_GIDS.teams);
        setTeamsData(teamsRaw);
      } catch (e) {
        console.log('Teams sheet not available');
      }

      // Try to fetch daily tracker data
      try {
        const trackerData = await fetchSheet(SHEET_GIDS.dailyTracker);
        setDailyTrackerData(trackerData);
      } catch (e) {
        console.log('Daily tracker sheet not available');
      }

      // Try to fetch individuals data
      try {
        const individualsRaw = await fetchSheet(SHEET_GIDS.individuals);
        setIndividualsData(individualsRaw);
      } catch (e) {
        console.log('Individuals sheet not available');
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Refresh data every 5 minutes
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: 'scoreboard' as const, label: 'Team Scores', icon: '🏆' },
    { id: 'individuals' as const, label: 'Individuals', icon: '👤' },
    { id: 'activities' as const, label: 'Activities', icon: '📋' },
    { id: 'tracker' as const, label: 'Daily Tracker', icon: '📈' },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="relative mb-8">
          {/* Countdown Timer - Top Right */}
          <div className="absolute top-0 right-0">
            <CountdownTimer />
          </div>

          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
              Burbs February Challenge
            </h1>
            <p className="text-slate-400">
              Track the battle between Tempo Tantrums and Points & Pints
            </p>
            {lastUpdated && (
              <p className="text-xs text-slate-500 mt-2">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-slate-800/50 rounded-xl p-1 inline-flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Refresh Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={loadData}
            disabled={loading}
            className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2"
          >
            <svg
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Content */}
        {loading && scores.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            {activeTab === 'scoreboard' && (
              <TeamScoreboard scores={scores} totals={totals} />
            )}
            {activeTab === 'individuals' && (
              <IndividualsTable data={individualsData} />
            )}
            {activeTab === 'activities' && (
              <ActivitiesList data={activitiesData} teamsData={teamsData} />
            )}
            {activeTab === 'tracker' && (
              <DailyTracker data={dailyTrackerData} totals={totals} />
            )}
          </>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-slate-500 text-sm">
          <p>Data sourced from Google Sheets • Auto-refreshes every 5 minutes</p>
        </div>
      </div>
    </div>
  );
}
