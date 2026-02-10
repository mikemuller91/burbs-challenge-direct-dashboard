'use client';

import { useState, useEffect } from 'react';
import Papa from 'papaparse';

const SHEET_ID = '2PACX-1vRnGFgSOWvgvysshy6qPwgLpBp0C9-oIHOzGrtXC6LNwZfp9RSIXshzHoOn4hqpsFO-AKkmo9OR5wUA';

const SHEETS = {
  scoreboard: { gid: 0, name: 'Scoreboard' },
  individuals: { gid: 1757627740, name: 'Individuals' },
  dailyTracker: { gid: 1201336220, name: 'Daily Tracker' },
  activities: { gid: 1272828437, name: 'Strava Club Activities' },
  teams: { gid: 158061936, name: 'Teams' },
  activityOverload: { gid: 1272195002, name: 'Activity Overload' },
};

async function fetchSheet(gid: number): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?gid=${gid}&single=true&output=csv`;
  const response = await fetch(url);
  const text = await response.text();
  const result = Papa.parse<string[]>(text, { skipEmptyLines: false });
  return result.data;
}

export default function DebugPage() {
  const [selectedSheet, setSelectedSheet] = useState<keyof typeof SHEETS>('scoreboard');
  const [data, setData] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSheet = async () => {
    setLoading(true);
    setError(null);
    try {
      const sheetData = await fetchSheet(SHEETS[selectedSheet].gid);
      setData(sheetData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSheet();
  }, [selectedSheet]);

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <h1 className="text-3xl font-bold text-white mb-6">Debug: Raw Sheet Data</h1>

      <div className="mb-6">
        <label className="text-slate-400 block mb-2">Select Sheet:</label>
        <select
          value={selectedSheet}
          onChange={(e) => setSelectedSheet(e.target.value as keyof typeof SHEETS)}
          className="bg-slate-800 text-white rounded-lg px-4 py-2 border border-slate-700"
        >
          {Object.entries(SHEETS).map(([key, { name }]) => (
            <option key={key} value={key}>{name}</option>
          ))}
        </select>
        <button
          onClick={loadSheet}
          className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-lg"
        >
          Reload
        </button>
      </div>

      {loading && <p className="text-slate-400">Loading...</p>}
      {error && <p className="text-red-400">Error: {error}</p>}

      {!loading && data.length > 0 && (
        <div className="space-y-4">
          <p className="text-slate-400">
            Found {data.length} rows, max {Math.max(...data.map(r => r.length))} columns
          </p>

          <div className="overflow-x-auto">
            <table className="text-sm text-white border-collapse">
              <thead>
                <tr>
                  <th className="border border-slate-700 px-2 py-1 bg-slate-800 text-slate-400">Row</th>
                  {data[0]?.map((_, colIdx) => (
                    <th key={colIdx} className="border border-slate-700 px-2 py-1 bg-slate-800 text-slate-400">
                      Col {colIdx}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, rowIdx) => (
                  <tr key={rowIdx} className={rowIdx === 0 ? 'bg-blue-900/30' : ''}>
                    <td className="border border-slate-700 px-2 py-1 text-slate-500">{rowIdx}</td>
                    {row.map((cell, colIdx) => (
                      <td key={colIdx} className="border border-slate-700 px-2 py-1 max-w-xs truncate">
                        {cell || <span className="text-slate-600">(empty)</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
