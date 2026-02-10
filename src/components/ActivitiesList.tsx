'use client';

import { useState, useMemo } from 'react';

interface Props {
  data: string[][];
  teamsData: string[][];
}

// Only show these columns (0, 1, 2, 3, 5 - skipping 4)
const VISIBLE_COLUMNS = [0, 1, 2, 3, 5];

// Column indices in the activities sheet
const ATHLETE_NAME_COLUMN = 0;
const WORKOUT_TYPE_COLUMN = 1;

export default function ActivitiesList({ data, teamsData }: Props) {
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');

  // Build athlete-to-team lookup from Teams sheet
  // Teams sheet has Col 1 for Tempo Tantrums and Col 2 for Points & Pints
  const athleteToTeam = useMemo(() => {
    const lookup: Record<string, string> = {};

    if (teamsData.length < 2) return lookup;

    // Skip header row, parse athlete names from each team column
    for (let i = 1; i < teamsData.length; i++) {
      const row = teamsData[i];

      // Column 1: Tempo Tantrums athletes
      const tempoAthlete = row[1]?.trim();
      if (tempoAthlete) {
        lookup[tempoAthlete.toLowerCase()] = 'Tempo Tantrums';
      }

      // Column 2: Points & Pints athletes
      const pintsAthlete = row[2]?.trim();
      if (pintsAthlete) {
        lookup[pintsAthlete.toLowerCase()] = 'Points & Pints';
      }
    }

    return lookup;
  }, [teamsData]);

  // Row 0 is headers, data starts from row 1
  const rawHeaders = data.length >= 1 ? data[0] : [];

  // Map headers - rename column 0 to "Athlete Name"
  const headers = VISIBLE_COLUMNS.map((colIdx) => {
    if (colIdx === 0) return 'Athlete Name';
    return rawHeaders[colIdx] || `Col ${colIdx}`;
  });

  const rows = useMemo(() =>
    data.length >= 2
      ? data.slice(1).filter(row => row.some(cell => cell && cell.trim() !== ''))
      : [],
    [data]
  );

  // Get athlete's team from lookup
  const getAthleteTeam = (athleteName: string): string => {
    if (!athleteName) return '';
    return athleteToTeam[athleteName.toLowerCase().trim()] || '';
  };

  // Get unique workout types for Activity Type filter (from column 1)
  const activityTypes = useMemo(() => {
    const types = new Set<string>();
    rows.forEach(row => {
      const workoutType = row[WORKOUT_TYPE_COLUMN]?.trim();
      if (workoutType) types.add(workoutType);
    });
    return ['all', ...Array.from(types).sort()];
  }, [rows]);

  // Hardcoded team options
  const teams = ['all', 'Tempo Tantrums', 'Points & Pints'];

  // Filter rows
  const filteredRows = useMemo(() =>
    rows.filter(row => {
      // Filter by workout type (column 1)
      if (typeFilter !== 'all' && row[WORKOUT_TYPE_COLUMN] !== typeFilter) return false;

      // Filter by team (lookup from athlete name)
      if (teamFilter !== 'all') {
        const athleteName = row[ATHLETE_NAME_COLUMN];
        const team = getAthleteTeam(athleteName);
        if (team !== teamFilter) return false;
      }

      return true;
    }),
    [rows, typeFilter, teamFilter, athleteToTeam]
  );

  // Sort rows
  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];

    if (sortColumn === null) return sorted;

    // Map visible column index back to original column index
    const originalColIndex = VISIBLE_COLUMNS[sortColumn];

    return sorted.sort((a, b) => {
      const aVal = a[originalColIndex] || '';
      const bVal = b[originalColIndex] || '';

      // Try numeric sort first
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // Fall back to string sort
      return sortDirection === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    });
  }, [filteredRows, sortColumn, sortDirection]);

  const handleSort = (visibleColumnIndex: number) => {
    if (sortColumn === visibleColumnIndex) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(visibleColumnIndex);
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

  if (data.length < 2 || rows.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-8 text-center">
        <p className="text-slate-400">No activities available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

        <p className="text-slate-400 text-sm pb-2">
          Showing <span className="text-white font-medium">{filteredRows.length}</span> of {rows.length} activities
        </p>
      </div>

      {/* Table */}
      <div className="bg-slate-800/50 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-700/50">
                {headers.map((header, idx) => (
                  <th
                    key={idx}
                    onClick={() => handleSort(idx)}
                    className="text-left py-3 px-4 text-slate-300 font-medium cursor-pointer hover:bg-slate-600/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {header}
                      {sortColumn === idx && (
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
              {sortedRows.map((row, rowIdx) => {
                const athleteName = row[ATHLETE_NAME_COLUMN];
                const team = getAthleteTeam(athleteName);

                return (
                  <tr
                    key={rowIdx}
                    className={`border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors ${getTeamBgColor(team)}`}
                  >
                    {VISIBLE_COLUMNS.map((originalColIdx, visibleIdx) => (
                      <td
                        key={visibleIdx}
                        className="py-3 px-4 text-white"
                      >
                        {row[originalColIdx] || '-'}
                      </td>
                    ))}
                    <td className={`py-3 px-4 ${getTeamColor(team)}`}>
                      {team || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
