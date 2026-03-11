import { useState } from 'react';
import {
  photoSeries,
  getMembersRankedBySeries,
  getRateColorClass,
  getRateBgClass,
  getGenLabel,
  getGenBadgeClass,
} from '../data/data';

function RankBadge({ rank }) {
  if (rank === 1) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-400 text-white text-xs font-bold">1</span>;
  if (rank === 2) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-400 text-white text-xs font-bold">2</span>;
  if (rank === 3) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-bold">3</span>;
  return <span className="inline-flex items-center justify-center w-6 h-6 text-gray-400 text-xs">{rank}</span>;
}

function RateBar({ rate, maxRate }) {
  const pct = maxRate > 0 ? (rate / maxRate) * 100 : 0;
  let barColor = 'bg-gray-300';
  if (rate >= 5.0) barColor = 'bg-purple-500';
  else if (rate >= 4.0) barColor = 'bg-red-400';
  else if (rate >= 3.0) barColor = 'bg-orange-400';
  else if (rate >= 2.0) barColor = 'bg-yellow-400';
  else if (rate >= 1.5) barColor = 'bg-green-400';
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-sm font-bold min-w-[3rem] text-right ${getRateColorClass(rate)}`}>
        {rate.toFixed(1)}×
      </span>
    </div>
  );
}

export default function PhotoView() {
  const [selectedSeriesId, setSelectedSeriesId] = useState(photoSeries[photoSeries.length - 1].id);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'table'

  const series = photoSeries.find(s => s.id === selectedSeriesId);
  const ranked = getMembersRankedBySeries(selectedSeriesId);
  const maxRate = ranked[0]?.rate ?? 1;

  return (
    <div className="space-y-4">
      {/* 種別セレクター */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">生写真種を選択</h3>
        <div className="flex flex-wrap gap-2">
          {photoSeries.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSeriesId(s.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border
                ${selectedSeriesId === s.id
                  ? 'bg-pink-500 text-white border-pink-500 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-pink-300 hover:text-pink-600'}`}
            >
              <div className="font-semibold">{s.name}</div>
              <div className="text-xs opacity-70">{s.date}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 選択中の種 サマリー */}
      <div className="bg-gradient-to-r from-pink-500 to-rose-400 rounded-xl p-5 text-white shadow">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs opacity-80 mb-1">{series?.date}</div>
            <h2 className="text-xl font-bold">{series?.name}</h2>
            <div className="mt-2 text-sm opacity-90">{ranked.length}名 ランキング</div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-80 mb-1">最高レート</div>
            <div className="text-3xl font-bold">{maxRate.toFixed(1)}×</div>
            <div className="text-xs opacity-80">{ranked[0]?.name}</div>
          </div>
        </div>
      </div>

      {/* ビューモード切替 */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('list')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${viewMode === 'list' ? 'bg-pink-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
        >
          リスト表示
        </button>
        <button
          onClick={() => setViewMode('table')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${viewMode === 'table' ? 'bg-pink-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
        >
          テーブル表示
        </button>
      </div>

      {/* リスト表示 */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {ranked.map((m, idx) => (
              <div key={m.id} className={`flex items-center gap-3 px-4 py-3 ${getRateBgClass(m.rate)}`}>
                <RankBadge rank={idx + 1} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{m.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${getGenBadgeClass(m.gen)}`}>
                      {getGenLabel(m.gen)}
                    </span>
                  </div>
                </div>
                <RateBar rate={m.rate} maxRate={maxRate} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* テーブル表示 */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-center text-gray-500 w-12">順位</th>
                  <th className="px-4 py-3 text-left text-gray-500">メンバー名</th>
                  <th className="px-4 py-3 text-center text-gray-500">期生</th>
                  <th className="px-4 py-3 text-center text-gray-500">レート（×定価）</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((m, idx) => (
                  <tr key={m.id} className={`border-b border-gray-100 ${getRateBgClass(m.rate)}`}>
                    <td className="px-4 py-3 text-center">
                      <RankBadge rank={idx + 1} />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{m.name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${getGenBadgeClass(m.gen)}`}>
                        {getGenLabel(m.gen)}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-center text-lg font-bold ${getRateColorClass(m.rate)}`}>
                      {m.rate.toFixed(1)}×
                    </td>
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
