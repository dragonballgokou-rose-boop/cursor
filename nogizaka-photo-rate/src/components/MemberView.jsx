import { useState, useMemo } from 'react';
import {
  members,
  photoSeries,
  ratingsData,
  getAverageRate,
  getLatestRate,
  getRateColorClass,
  getRateBgClass,
  getGenLabel,
  getGenBadgeClass,
} from '../data/data';

const RECENT_N = 5;

function RateCell({ rate }) {
  if (rate === null) return <td className="px-3 py-2 text-center text-gray-300">—</td>;
  return (
    <td className={`px-3 py-2 text-center text-sm ${getRateColorClass(rate)} ${getRateBgClass(rate)}`}>
      {rate.toFixed(1)}
    </td>
  );
}

function TrendBadge({ current, prev }) {
  if (current === null || prev === null) return null;
  const diff = current - prev;
  if (Math.abs(diff) < 0.05) return <span className="text-gray-400 text-xs">→</span>;
  if (diff > 0) return <span className="text-red-500 text-xs">▲{diff.toFixed(1)}</span>;
  return <span className="text-blue-500 text-xs">▼{Math.abs(diff).toFixed(1)}</span>;
}

export default function MemberView() {
  const [genFilter, setGenFilter] = useState('all');
  const [sortKey, setSortKey] = useState('latest');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedMember, setSelectedMember] = useState(null);

  const recentSeries = photoSeries.slice(-RECENT_N);
  const latestSeries = photoSeries[photoSeries.length - 1];
  const prevSeries = photoSeries[photoSeries.length - 2];

  const tableData = useMemo(() => {
    const filtered = genFilter === 'all' ? members : members.filter(m => m.gen === Number(genFilter));
    return filtered.map(m => ({
      ...m,
      latestRate: getLatestRate(m.id),
      avgRate: getAverageRate(m.id, RECENT_N),
      prevRate: ratingsData[m.id]?.[prevSeries?.id] ?? null,
      rates: recentSeries.map(s => ratingsData[m.id]?.[s.id] ?? null),
    }));
  }, [genFilter, recentSeries, latestSeries, prevSeries]);

  const sorted = useMemo(() => {
    return [...tableData].sort((a, b) => {
      let va, vb;
      if (sortKey === 'latest') { va = a.latestRate ?? -1; vb = b.latestRate ?? -1; }
      else if (sortKey === 'avg') { va = a.avgRate ?? -1; vb = b.avgRate ?? -1; }
      else if (sortKey === 'name') { va = a.name; vb = b.name; }
      else if (sortKey === 'gen') { va = a.gen; vb = b.gen; }
      else {
        const idx = recentSeries.findIndex(s => s.id === sortKey);
        va = a.rates[idx] ?? -1;
        vb = b.rates[idx] ?? -1;
      }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [tableData, sortKey, sortDir, recentSeries]);

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function SortTh({ label, sortId, className = '' }) {
    const active = sortKey === sortId;
    return (
      <th
        className={`px-3 py-3 text-center cursor-pointer select-none whitespace-nowrap text-sm
          ${active ? 'bg-pink-100 text-pink-700' : 'text-gray-600 hover:bg-gray-100'} ${className}`}
        onClick={() => handleSort(sortId)}
      >
        {label}
        {active && <span className="ml-1 text-xs">{sortDir === 'desc' ? '▼' : '▲'}</span>}
      </th>
    );
  }

  return (
    <div className="space-y-4">
      {/* フィルター */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <span className="text-sm font-medium text-gray-600">期生フィルター:</span>
        {['all', '3', '4', '5'].map(g => (
          <button
            key={g}
            onClick={() => setGenFilter(g)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-all
              ${genFilter === g
                ? 'bg-pink-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {g === 'all' ? '全メンバー' : `${g}期生`}
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-400">{sorted.length}名表示</span>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <SortTh label="順位" sortId="latest" className="w-12" />
                <SortTh label="メンバー名" sortId="name" className="text-left min-w-32" />
                <SortTh label="期生" sortId="gen" />
                <SortTh label="最新レート" sortId="latest" />
                <SortTh label={`直近${RECENT_N}種 平均`} sortId="avg" />
                <th className="px-3 py-3 text-center text-gray-400 text-xs">前種比</th>
                {recentSeries.map(s => (
                  <SortTh key={s.id} label={s.name.split('「')[0].trim() || s.name} sortId={s.id} />
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((m, idx) => (
                <tr
                  key={m.id}
                  className={`border-b border-gray-100 cursor-pointer transition-colors
                    ${selectedMember === m.id ? 'bg-pink-50' : 'hover:bg-gray-50'}`}
                  onClick={() => setSelectedMember(selectedMember === m.id ? null : m.id)}
                >
                  <td className="px-3 py-2 text-center text-gray-400 font-mono text-xs">
                    {idx + 1}
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-800">
                    {m.name}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getGenBadgeClass(m.gen)}`}>
                      {getGenLabel(m.gen)}
                    </span>
                  </td>
                  <td className={`px-3 py-2 text-center font-bold text-base ${getRateColorClass(m.latestRate)}`}>
                    {m.latestRate?.toFixed(1) ?? '—'}
                  </td>
                  <td className={`px-3 py-2 text-center font-semibold ${getRateColorClass(m.avgRate)}`}>
                    {m.avgRate?.toFixed(2) ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <TrendBadge current={m.latestRate} prev={m.prevRate} />
                  </td>
                  {m.rates.map((r, i) => (
                    <RateCell key={recentSeries[i].id} rate={r} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* レート凡例 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">レート凡例（定価比倍率）</h3>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 bg-purple-100 text-purple-600 font-bold rounded">5.0× 以上 超人気</span>
          <span className="px-2 py-1 bg-red-50 text-red-500 font-bold rounded">4.0× 以上 高人気</span>
          <span className="px-2 py-1 bg-orange-50 text-orange-500 rounded">3.0× 以上 人気</span>
          <span className="px-2 py-1 bg-yellow-50 text-yellow-600 rounded">2.0× 以上 準人気</span>
          <span className="px-2 py-1 bg-green-50 text-green-600 rounded">1.5× 以上 標準</span>
          <span className="px-2 py-1 bg-gray-50 text-gray-500 rounded">1.5× 未満 定価付近</span>
        </div>
      </div>
    </div>
  );
}
