'use client';

import Image from 'next/image';
import { TeamScore } from '@/lib/sheets';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface Props {
  scores: TeamScore[];
  totals: { tempoTantrums: number; pointsPints: number };
}

export default function TeamScoreboard({ scores, totals }: Props) {
  const leader = totals.tempoTantrums > totals.pointsPints ? 'Tempo Tantrums' : 'Points & Pints';
  const leadAmount = Math.abs(totals.tempoTantrums - totals.pointsPints);

  return (
    <div className="space-y-6">
      {/* Total Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`rounded-2xl p-6 ${totals.tempoTantrums >= totals.pointsPints ? 'bg-blue-500/20 ring-2 ring-blue-500' : 'bg-slate-800/50'}`}>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <Image
                src="/tempo-tantrums.png"
                alt="Tempo Tantrums"
                width={100}
                height={100}
                className="rounded-lg"
              />
            </div>
            <div className="flex-grow">
              <h3 className="text-lg font-medium text-blue-400">Tempo Tantrums</h3>
              <p className="text-5xl font-bold text-white mt-2">{totals.tempoTantrums}</p>
              <p className="text-slate-400 mt-1">points</p>
            </div>
            {totals.tempoTantrums >= totals.pointsPints && (
              <div className="text-5xl">🏆</div>
            )}
          </div>
        </div>

        <div className={`rounded-2xl p-6 ${totals.pointsPints > totals.tempoTantrums ? 'bg-orange-500/20 ring-2 ring-orange-500' : 'bg-slate-800/50'}`}>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <Image
                src="/points-pints.jpg"
                alt="Points & Pints"
                width={100}
                height={100}
                className="rounded-lg"
              />
            </div>
            <div className="flex-grow">
              <h3 className="text-lg font-medium text-orange-400">Points & Pints</h3>
              <p className="text-5xl font-bold text-white mt-2">{totals.pointsPints}</p>
              <p className="text-slate-400 mt-1">points</p>
            </div>
            {totals.pointsPints > totals.tempoTantrums && (
              <div className="text-5xl">🏆</div>
            )}
          </div>
        </div>
      </div>

      {/* Lead Banner */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-4 text-center">
        <p className="text-slate-300">
          <span className={leader === 'Tempo Tantrums' ? 'text-blue-400' : 'text-orange-400'}>
            {leader}
          </span>
          {' '}leads by <span className="text-white font-bold">{leadAmount}</span> points
        </p>
      </div>

      {/* Bar Chart */}
      <div className="bg-slate-800/50 rounded-2xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Points by Activity Type</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={scores} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#9ca3af" />
              <YAxis dataKey="activity" type="category" stroke="#9ca3af" width={100} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Bar dataKey="tempoTantrums" name="Tempo Tantrums" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              <Bar dataKey="pointsPints" name="Points & Pints" fill="#f97316" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Activity Breakdown Table */}
      <div className="bg-slate-800/50 rounded-2xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Activity Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Activity</th>
                <th className="text-right py-3 px-4 text-blue-400 font-medium">Tempo Tantrums</th>
                <th className="text-right py-3 px-4 text-orange-400 font-medium">Points & Pints</th>
                <th className="text-center py-3 px-4 text-slate-400 font-medium">Leader</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((score, index) => (
                <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="py-3 px-4 text-white">{score.activity}</td>
                  <td className="py-3 px-4 text-right text-blue-300">{score.tempoTantrums}</td>
                  <td className="py-3 px-4 text-right text-orange-300">{score.pointsPints}</td>
                  <td className="py-3 px-4 text-center">
                    {score.tempoTantrums > score.pointsPints ? (
                      <span className="text-blue-400">🔵</span>
                    ) : score.pointsPints > score.tempoTantrums ? (
                      <span className="text-orange-400">🟠</span>
                    ) : (
                      <span className="text-slate-400">➖</span>
                    )}
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
