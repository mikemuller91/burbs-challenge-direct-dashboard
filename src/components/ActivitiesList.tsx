'use client';

import { useState, useMemo } from 'react';

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

interface Props {
  data: ProcessedActivity[];
  onDateSaved?: () => void;
}

export default function ActivitiesList({ data, onDateSaved }: Props) {
  const [sortColumn, setSortColumn] = useState<keyof ProcessedActivity>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Get unique activity types for filter
  const activityTypes = useMemo(() => {
    const types = new Set<string>();
    data.forEach((activity) => {
      if (activity.normalizedType) types.add(activity.normalizedType);
    });
    return ['all', ...Array.from(types).sort()];
  }, [data]);

  // Hardcoded team options
  const teams = ['all', 'Tempo Tantrums', 'Points & Pints'];

  // Count activities needing dates
  const needingDates = useMemo(() => {
    return data.filter((a) => a.date === 'Unknown').length;
  }, [data]);

  // Filter activities
  const filteredActivities = useMemo(() => {
    return data.filter((activity) => {
      if (typeFilter !== 'all' && activity.normalizedType !== typeFilter) return false;
      if (teamFilter !== 'all' && activity.team !== teamFilter) return false;
      if (dateFilter === 'needs-date' && activity.date !== 'Unknown') return false;
      if (dateFilter === 'has-date' && activity.date === 'Unknown') return false;
      return true;
    });
  }, [data, typeFilter, teamFilter, dateFilter]);

  // Sort activities
  const sortedActivities = useMemo(() => {
    const sorted = [...filteredActivities];

    return sorted.sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal || '');
      const bStr = String(bVal || '');
      return sortDirection === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [filteredActivities, sortColumn, sortDirection]);

  const handleSort = (column: keyof ProcessedActivity) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const handleEditDate = (activity: ProcessedActivity) => {
    setEditingId(activity.id);
    // Default to today if no date
    setEditDate(activity.date === 'Unknown' ? new Date().toISOString().split('T')[0] : activity.date);
  };

  const handleSaveDate = async () => {
    if (!editingId || !editDate) return;

    setSaving(true);
    try {
      const response = await fetch('/api/dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId: editingId, date: editDate }),
      });

      if (response.ok) {
        setEditingId(null);
        setEditDate('');
        if (onDateSaved) onDateSaved();
      } else {
        const error = await response.json();
        alert('Failed to save: ' + (error.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Failed to save date');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditDate('');
  };

  const getTeamColor = (team: string) => {
    if (!team) return 'text-white';
    if (team.toLowerCase().includes('tempo')) return 'text-blue-400';
    if (team.toLowerCase().includes('pints')) return 'text-orange-400';
    return 'text-white';
  };

  const getTeamBgColor = (team: string) => {
    if (!team) return '';
    if (team.toLowerCase().includes('tempo')) return 'bg-blue-500/5';
    if (team.toLowerCase().includes('pints')) return 'bg-orange-500/5';
    return '';
  };

  const formatDate = (dateStr: string) => {
    if (dateStr === 'Unknown') return dateStr;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  };

  if (data.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-8 text-center">
        <p className="text-slate-400">No activities available</p>
      </div>
    );
  }

  const columns: { key: keyof ProcessedActivity; label: string }[] = [
    { key: 'date', label: 'Date' },
    { key: 'athlete', label: 'Athlete' },
    { key: 'normalizedType', label: 'Type' },
    { key: 'distance', label: 'Distance (km)' },
    { key: 'totalPoints', label: 'Points' },
  ];

  return (
    <div className="space-y-6">
      {/* Needs dates banner */}
      {needingDates > 0 && (
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📅</span>
            <div>
              <p className="text-yellow-400 font-medium">
                {needingDates} activit{needingDates === 1 ? 'y needs' : 'ies need'} dates
              </p>
              <p className="text-yellow-400/70 text-sm">Click on "Unknown" dates to add them</p>
            </div>
          </div>
          <button
            onClick={() => setDateFilter('needs-date')}
            className="px-4 py-2 bg-yellow-500 text-black rounded-lg font-medium hover:bg-yellow-400 transition-colors"
          >
            Show Activities Needing Dates
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Activity Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-800 text-white rounded-lg px-4 py-2 border border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {activityTypes.map((type) => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Activities' : type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Team</label>
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="bg-slate-800 text-white rounded-lg px-4 py-2 border border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {teams.map((team) => (
              <option key={team} value={team}>
                {team === 'all' ? 'All Teams' : team}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Date Status</label>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-slate-800 text-white rounded-lg px-4 py-2 border border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">All Activities</option>
            <option value="needs-date">Needs Date</option>
            <option value="has-date">Has Date</option>
          </select>
        </div>

        <p className="text-slate-400 text-sm pb-2">
          Showing <span className="text-white font-medium">{filteredActivities.length}</span> of {data.length} activities
        </p>
      </div>

      {/* Table */}
      <div className="bg-slate-800/50 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-700/50">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="text-left py-3 px-4 text-slate-300 font-medium cursor-pointer hover:bg-slate-600/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {col.label}
                      {sortColumn === col.key && (
                        <span className="text-blue-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
                <th className="text-left py-3 px-4 text-slate-300 font-medium">Team</th>
              </tr>
            </thead>
            <tbody>
              {sortedActivities.map((activity) => (
                <tr
                  key={activity.id}
                  className={`border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors ${getTeamBgColor(activity.team)}`}
                >
                  <td className="py-3 px-4">
                    {editingId === activity.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="bg-slate-700 text-white rounded px-2 py-1 border border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <button
                          onClick={handleSaveDate}
                          disabled={saving}
                          className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-500 disabled:opacity-50"
                        >
                          {saving ? '...' : '✓'}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-2 py-1 bg-slate-600 text-white rounded text-sm hover:bg-slate-500"
                        >
                          ✕
                        </button>
                      </div>
                    ) : activity.date === 'Unknown' ? (
                      <button
                        onClick={() => handleEditDate(activity)}
                        className="text-yellow-400 hover:text-yellow-300 underline cursor-pointer"
                      >
                        Unknown
                      </button>
                    ) : (
                      <span
                        onClick={() => handleEditDate(activity)}
                        className="text-white cursor-pointer hover:text-blue-400"
                        title="Click to edit"
                      >
                        {formatDate(activity.date)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-white">{activity.athlete}</td>
                  <td className="py-3 px-4 text-white">{activity.normalizedType}</td>
                  <td className="py-3 px-4 text-white">{activity.distance.toFixed(2)}</td>
                  <td className="py-3 px-4 text-white font-medium">{activity.totalPoints}</td>
                  <td className={`py-3 px-4 ${getTeamColor(activity.team)}`}>
                    {activity.team || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
