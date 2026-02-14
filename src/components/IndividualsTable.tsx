'use client';

import { useState, useMemo } from 'react';

interface IndividualStats {
  name: string;
  team: string;
  totalPoints: number;
  activities: Record<string, { distance: number; points: number }>;
  elevation: number;
  elevationPoints: number;
}

interface Props {
  data: IndividualStats[];
}

export default function IndividualsTable({ data }: Props) {
  const [sortColumn, setSortColumn] = useState<string>('totalPoints');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [teamFilter, setTeamFilter] = useState<string>('all');

  // Get all activity types across all individuals
  const activityTypes = useMemo(() => {
    const types = new Set<string>();
    data.forEach((individual) => {
      Object.keys(individual.activities).forEach((type) => types.add(type));
    });
    return Array.from(types).sort();
  }, [data]);

  // Filter by team
  const filteredData = useMemo(() => {
    if (teamFilter === 'all') return data;
    return data.filter((individual) => individual.team === teamFilter);
  }, [data, teamFilter]);

  // Sort data
  const sortedData = useMemo(() => {
    const sorted = [...filteredData];

    return sorted.sort((a, b) => {
      let aVal: number;
      let bVal: number;

      if (sortColumn === 'totalPoints') {
        aVal = a.totalPoints;
        bVal = b.totalPoints;
      } else if (sortColumn === 'elevation') {
        aVal = a.elevationPoints;
        bVal = b.elevationPoints;
      } else if (sortColumn === 'name') {
        return sortDirection === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      } else {
        // Activity type column
        aVal = a.activities[sortColumn]?.points || 0;
        bVal = b.activities[sortColumn]?.points || 0;
      }

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [filteredData, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
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

  const teams = ['all', 'Tempo Tantrums', 'Points & Pints'];

  if (data.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-8 text-center">
        <p className="text-slate-400">No individual data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex flex-wrap gap-4 items-end">
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
        <p className="text-slate-400 text-sm pb-2">
          Showing <span className="text-white font-medium">{filteredData.length}</span> of {data.length} athletes
        </p>
      </div>

      {/* Table */}
      <div className="bg-slate-800/50 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-700/50">
                <th
                  onClick={() => handleSort('name')}
                  className="text-left py-3 px-4 text-slate-300 font-medium cursor-pointer hover:bg-slate-600/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Athlete
                    {sortColumn === 'name' && (
                      <span className="text-blue-400">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="text-left py-3 px-4 text-slate-300 font-medium">Team</th>
                <th
                  onClick={() => handleSort('totalPoints')}
                  className="text-right py-3 px-4 text-slate-300 font-medium cursor-pointer hover:bg-slate-600/50 transition-colors"
                >
                  <div className="flex items-center justify-end gap-2">
                    Total Points
                    {sortColumn === 'totalPoints' && (
                      <span className="text-blue-400">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                {activityTypes.map((type) => (
                  <th
                    key={type}
                    onClick={() => handleSort(type)}
                    className="text-right py-3 px-4 text-slate-300 font-medium cursor-pointer hover:bg-slate-600/50 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end gap-2">
                      {type}
                      {sortColumn === type && (
                        <span className="text-blue-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
                <th
                  onClick={() => handleSort('elevation')}
                  className="text-right py-3 px-4 text-slate-300 font-medium cursor-pointer hover:bg-slate-600/50 transition-colors"
                >
                  <div className="flex items-center justify-end gap-2">
                    Elevation
                    {sortColumn === 'elevation' && (
                      <span className="text-blue-400">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((individual, idx) => (
                <tr
                  key={individual.name}
                  className={`border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors ${getTeamBgColor(individual.team)}`}
                >
                  <td className="py-3 px-4 text-white font-medium">
                    <div className="flex items-center gap-2">
                      {idx < 3 && (
                        <span className="text-lg">
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                        </span>
                      )}
                      {individual.name}
                    </div>
                  </td>
                  <td className={`py-3 px-4 ${getTeamColor(individual.team)}`}>
                    {individual.team}
                  </td>
                  <td className="py-3 px-4 text-right text-white font-bold">
                    {individual.totalPoints}
                  </td>
                  {activityTypes.map((type) => {
                    const activity = individual.activities[type];
                    return (
                      <td key={type} className="py-3 px-4 text-right text-slate-300">
                        {activity ? (
                          <div>
                            <span className="text-white">{activity.points}</span>
                            <span className="text-slate-500 text-xs ml-1">
                              ({activity.distance.toFixed(1)}km)
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-3 px-4 text-right text-slate-300">
                    <div>
                      <span className="text-white">{individual.elevationPoints}</span>
                      <span className="text-slate-500 text-xs ml-1">
                        ({individual.elevation.toFixed(0)}m)
                      </span>
                    </div>
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
