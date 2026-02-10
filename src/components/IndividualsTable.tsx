'use client';

import { useState, useMemo } from 'react';

interface Props {
  data: string[][];
}

export default function IndividualsTable({ data }: Props) {
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [initialSortApplied, setInitialSortApplied] = useState(false);

  // Skip row 0, use row 1 as headers, data starts from row 2
  const headers = data.length >= 2 ? data[1] : [];
  const rows = useMemo(() =>
    data.length >= 3
      ? data.slice(2).filter(row => row.some(cell => cell && cell.trim() !== ''))
      : [],
    [data]
  );

  // Find team column
  const teamColumnIndex = useMemo(() =>
    headers.findIndex(h => h?.toLowerCase().includes('team')),
    [headers]
  );

  // Find total points column for default sorting
  const totalPointsColumnIndex = useMemo(() =>
    headers.findIndex(h =>
      h?.toLowerCase().includes('total') && h?.toLowerCase().includes('point')
    ),
    [headers]
  );

  // Apply initial sort on first render when we have data
  if (!initialSortApplied && totalPointsColumnIndex >= 0 && rows.length > 0) {
    setSortColumn(totalPointsColumnIndex);
    setInitialSortApplied(true);
  }

  // Get unique teams for filter
  const teams = useMemo(() =>
    ['all', ...new Set(rows.map(row => row[teamColumnIndex]).filter(Boolean))],
    [rows, teamColumnIndex]
  );

  // Filter by team
  const filteredRows = useMemo(() =>
    teamFilter === 'all'
      ? rows
      : rows.filter(row => row[teamColumnIndex] === teamFilter),
    [rows, teamFilter, teamColumnIndex]
  );

  // Sort rows
  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];

    if (sortColumn === null) return sorted;

    return sorted.sort((a, b) => {
      const aVal = a[sortColumn] || '';
      const bVal = b[sortColumn] || '';

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

  const handleSort = (columnIndex: number) => {
    if (sortColumn === columnIndex) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnIndex);
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
    if (!team) return 'bg-slate-800/50 border-slate-700';
    if (team.toLowerCase().includes('tempo')) return 'bg-blue-500/10 border-blue-500/30';
    if (team.toLowerCase().includes('pints')) return 'bg-orange-500/10 border-orange-500/30';
    return 'bg-slate-800/50 border-slate-700';
  };

  if (data.length < 3 || rows.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-8 text-center">
        <p className="text-slate-400">No individual data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter */}
      {teamColumnIndex >= 0 && (
        <div className="flex gap-4 items-center">
          <label className="text-slate-400">Filter by Team:</label>
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
      )}

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
                      {header || `Col ${idx}`}
                      {sortColumn === idx && (
                        <span className="text-blue-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className={`border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors ${
                    teamColumnIndex >= 0 ? getTeamBgColor(row[teamColumnIndex] || '') : ''
                  }`}
                >
                  {headers.map((_, colIdx) => (
                    <td
                      key={colIdx}
                      className={`py-3 px-4 ${
                        colIdx === teamColumnIndex
                          ? getTeamColor(row[colIdx] || '')
                          : 'text-white'
                      }`}
                    >
                      {row[colIdx] || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
