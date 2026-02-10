'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface Props {
  data: string[][];
  totals: { tempoTantrums: number; pointsPints: number };
}

interface ChartDataPoint {
  date: string;
  tempoDaily: number;
  pintsDaily: number;
  tempoTotal: number;
  pintsTotal: number;
}

export default function DailyTracker({ data, totals }: Props) {
  // Parse the raw data from the Daily Tracker sheet
  // Column 10: Date
  // Column 11: Tempo Tantrums Total Points
  // Column 12: Points & Pints Total Points
  // Column 13: Tempo Tantrums Daily Points
  // Column 14: Points & Pints Daily Points
  const chartData = useMemo(() => {
    if (data.length < 2) return [];

    const points: ChartDataPoint[] = [];

    // Skip header row (row 0), parse data rows
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const date = row[10];
      if (!date || !date.trim()) continue;

      const tempoTotal = parseFloat(row[11]) || 0;
      const pintsTotal = parseFloat(row[12]) || 0;
      const tempoDaily = parseFloat(row[13]) || 0;
      const pintsDaily = parseFloat(row[14]) || 0;

      // Only add if we have valid data
      if (date && (tempoDaily > 0 || pintsDaily > 0 || tempoTotal > 0 || pintsTotal > 0)) {
        points.push({
          date,
          tempoDaily,
          pintsDaily,
          tempoTotal,
          pintsTotal,
        });
      }
    }

    return points;
  }, [data]);

  // Calculate max values for Y-axis domains
  const maxDaily = useMemo(() => {
    if (chartData.length === 0) return 150;
    const max = Math.max(...chartData.map(d => Math.max(d.tempoDaily, d.pintsDaily)));
    return Math.ceil(max / 50) * 50 + 50; // Round up to nearest 50 and add buffer
  }, [chartData]);

  const maxTotal = useMemo(() => {
    if (chartData.length === 0) return 600;
    const max = Math.max(...chartData.map(d => Math.max(d.tempoTotal, d.pintsTotal)));
    return Math.ceil(max / 100) * 100 + 100; // Round up to nearest 100 and add buffer
  }, [chartData]);

  if (data.length < 2 || chartData.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-8 text-center">
        <p className="text-slate-400">No daily tracker data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 rounded-2xl p-6 border border-blue-500/30">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <Image
                src="/tempo-tantrums.png"
                alt="Tempo Tantrums"
                width={80}
                height={80}
                className="rounded-lg"
              />
            </div>
            <div>
              <h3 className="text-lg font-medium text-blue-400">Tempo Tantrums</h3>
              <p className="text-5xl font-bold text-white mt-2">{totals.tempoTantrums}</p>
              <p className="text-slate-400 mt-1">total points</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 rounded-2xl p-6 border border-orange-500/30">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <Image
                src="/points-pints.jpg"
                alt="Points & Pints"
                width={80}
                height={80}
                className="rounded-lg"
              />
            </div>
            <div>
              <h3 className="text-lg font-medium text-orange-400">Points & Pints</h3>
              <p className="text-5xl font-bold text-white mt-2">{totals.pointsPints}</p>
              <p className="text-slate-400 mt-1">total points</p>
            </div>
          </div>
        </div>
      </div>

      {/* Combo Chart - Bars for Daily, Lines for Total */}
      <div className="bg-slate-800/50 rounded-2xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">February Burbs Challenge</h3>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 60, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                stroke="#9ca3af"
                fontSize={11}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              {/* Left Y-axis for Total (lines) */}
              <YAxis
                yAxisId="left"
                stroke="#9ca3af"
                domain={[0, maxTotal]}
                label={{ value: 'Total', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
              />
              {/* Right Y-axis for Daily (bars) */}
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#9ca3af"
                domain={[0, maxDaily]}
                label={{ value: 'Daily', angle: 90, position: 'insideRight', fill: '#9ca3af' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
              />

              {/* Bars for daily points */}
              <Bar
                yAxisId="right"
                dataKey="tempoDaily"
                name="Tempo Tantrums (Daily)"
                fill="#60a5fa"
                radius={[2, 2, 0, 0]}
              />
              <Bar
                yAxisId="right"
                dataKey="pintsDaily"
                name="Points & Pints (Daily)"
                fill="#f87171"
                radius={[2, 2, 0, 0]}
              />

              {/* Lines for cumulative totals */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="tempoTotal"
                name="Tempo Tantrums (Total)"
                stroke="#2563eb"
                strokeWidth={3}
                dot={{ fill: '#2563eb', r: 4 }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="pintsTotal"
                name="Points & Pints (Total)"
                stroke="#dc2626"
                strokeWidth={3}
                dot={{ fill: '#dc2626', r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 text-center">
          <p className="text-slate-400 text-sm">Days Tracked</p>
          <p className="text-2xl font-bold text-white">{chartData.length}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 text-center">
          <p className="text-slate-400 text-sm">Avg Daily (Tempo)</p>
          <p className="text-2xl font-bold text-blue-400">
            {chartData.length > 0
              ? (totals.tempoTantrums / chartData.length).toFixed(1)
              : 0}
          </p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 text-center">
          <p className="text-slate-400 text-sm">Avg Daily (Pints)</p>
          <p className="text-2xl font-bold text-orange-400">
            {chartData.length > 0
              ? (totals.pointsPints / chartData.length).toFixed(1)
              : 0}
          </p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 text-center">
          <p className="text-slate-400 text-sm">Point Gap</p>
          <p className="text-2xl font-bold text-white">
            {Math.abs(totals.tempoTantrums - totals.pointsPints)}
          </p>
        </div>
      </div>
    </div>
  );
}
