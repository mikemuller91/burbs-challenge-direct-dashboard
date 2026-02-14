'use client';

import { useState, useEffect } from 'react';
import TeamScoreboard from './TeamScoreboard';
import ActivitiesList from './ActivitiesList';
import DailyTracker from './DailyTracker';
import IndividualsTable from './IndividualsTable';
import CountdownTimer from './CountdownTimer';

// Types matching the Strava API response
interface TeamScore {
  activity: string;
  tempoTantrums: number;
  pointsPints: number;
}

interface ProcessedActivity {
  id: number;
  date: string;
  athlete: string;
  team: string;
  type: string;
  normalizedType: string;
  distance: number;
  elevation: number;
  points: number;
  elevationPoints: number;
  totalPoints: number;
  title: string;
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

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'scoreboard' | 'individuals' | 'activities' | 'tracker'>('scoreboard');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/strava', { cache: 'no-store' });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch data');
      }

      const dashboardData: DashboardData = await response.json();
      setData(dashboardData);
      setLastUpdated(new Date(dashboardData.lastUpdated));
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
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

        {/* Error State */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-xl p-4 mb-4 text-red-400">
            <p className="font-medium">Error loading data</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Content */}
        {loading && !data ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : data ? (
          <>
            {activeTab === 'scoreboard' && (
              <TeamScoreboard scores={data.scoreboard} totals={data.totals} />
            )}
            {activeTab === 'individuals' && (
              <IndividualsTable data={data.individuals} />
            )}
            {activeTab === 'activities' && (
              <ActivitiesList data={data.activities} onDateSaved={loadData} />
            )}
            {activeTab === 'tracker' && (
              <DailyTracker data={data.dailyTracker} totals={data.totals} />
            )}
          </>
        ) : null}

        {/* Footer */}
        <div className="mt-12 text-center text-slate-500 text-sm">
          <p>Data sourced directly from Strava • Auto-refreshes every 5 minutes</p>
        </div>
      </div>
    </div>
  );
}
