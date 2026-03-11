import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import {
  members,
  photoSeries,
  ratingsData,
  getAverageRate,
  getLatestRate,
  getRateColorClass,
  getGenBadgeClass,
  getGenLabel,
} from '../data/data';

const RECENT_N = 5;
const GEN_COLORS = { 3: '#3b82f6', 4: '#10b981', 5: '#8b5cf6' };

// 上位N名を取得
function getTopMembers(n = 10) {
  return members
    .map(m => ({ ...m, latestRate: getLatestRate(m.id), avgRate: getAverageRate(m.id, RECENT_N) }))
    .sort((a, b) => (b.latestRate ?? 0) - (a.latestRate ?? 0))
    .slice(0, n);
}

// 推移データ（選択メンバー）
function getTrendData(memberId) {
  return photoSeries.map(s => ({
    name: s.name.replace(/「.*」/, '').trim() || s.name,
    fullName: s.name,
    rate: ratingsData[memberId]?.[s.id] ?? null,
  }));
}

// 全メンバー最新レート棒グラフ用データ
function getAllMembersBarData() {
  return members
    .map(m => ({
      name: m.name,
      gen: m.gen,
      rate: getLatestRate(m.id) ?? 0,
      avg: getAverageRate(m.id, RECENT_N) ?? 0,
    }))
    .sort((a, b) => b.rate - a.rate);
}

// 期生別平均
function getGenAverageData() {
  const result = {};
  photoSeries.forEach(s => {
    [3, 4, 5].forEach(gen => {
      const genMembers = members.filter(m => m.gen === gen);
      const rates = genMembers.map(m => ratingsData[m.id]?.[s.id]).filter(r => r != null);
      if (!result[s.id]) result[s.id] = { name: s.name.replace(/「.*」/, '').trim() || s.name, fullName: s.name };
      result[s.id][`gen${gen}`] = rates.length ? +(rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(2) : 0;
    });
  });
  return Object.values(result);
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="flex gap-2">
          <span>{p.name}:</span>
          <span className="font-bold">{typeof p.value === 'number' ? `${p.value.toFixed(2)}×` : p.value}</span>
        </p>
      ))}
    </div>
  );
};

export default function StatsView() {
  const [selectedMemberId, setSelectedMemberId] = useState(members[4].id); // 山下美月
  const [compareIds, setCompareIds] = useState([members[4].id, members[7].id]);

  const topMembers = getTopMembers(10);
  const barData = getAllMembersBarData();
  const genAvgData = getGenAverageData();
  const trendData = getTrendData(selectedMemberId);
  const selectedMember = members.find(m => m.id === selectedMemberId);

  function toggleCompare(id) {
    setCompareIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  }

  const COMPARE_COLORS = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b'];

  return (
    <div className="space-y-6">
      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {topMembers.slice(0, 4).map((m, i) => (
          <div key={m.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className={`px-2 py-0.5 rounded-full text-xs ${getGenBadgeClass(m.gen)}`}>{getGenLabel(m.gen)}</span>
              <span className="text-gray-400 text-xs">#{i + 1}</span>
            </div>
            <div className="font-bold text-gray-800 text-sm truncate">{m.name}</div>
            <div className={`text-2xl font-bold mt-1 ${getRateColorClass(m.latestRate)}`}>
              {m.latestRate?.toFixed(1)}×
            </div>
            <div className="text-xs text-gray-400">平均 {m.avgRate?.toFixed(2)}×</div>
          </div>
        ))}
      </div>

      {/* 全メンバー最新レート棒グラフ */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">全メンバー 最新レート vs 直近5種平均</h3>
        <div className="overflow-x-auto">
          <ResponsiveContainer width="100%" height={320} minWidth={600}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 'auto']} tickFormatter={v => `${v}×`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" />
              <Bar dataKey="rate" name="最新レート" fill="#ec4899" radius={[3, 3, 0, 0]} />
              <Bar dataKey="avg" name="5種平均" fill="#fbcfe8" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 期生別平均推移 */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">期生別 平均レート推移</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={genAvgData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}×`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line type="monotone" dataKey="gen3" name="3期生" stroke={GEN_COLORS[3]} strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="gen4" name="4期生" stroke={GEN_COLORS[4]} strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="gen5" name="5期生" stroke={GEN_COLORS[5]} strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 個人推移 */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-gray-700">個人レート推移</h3>
          <select
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-pink-300"
            value={selectedMemberId}
            onChange={e => setSelectedMemberId(e.target.value)}
          >
            {[3, 4, 5].map(gen => (
              <optgroup key={gen} label={`${gen}期生`}>
                {members.filter(m => m.gen === gen).map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <span className={`px-2 py-1 rounded-full text-xs ${getGenBadgeClass(selectedMember?.gen)}`}>
            {getGenLabel(selectedMember?.gen)}
          </span>
          <span className="text-lg font-bold text-gray-800">{selectedMember?.name}</span>
          <span className={`text-2xl font-bold ml-auto ${getRateColorClass(getLatestRate(selectedMemberId))}`}>
            最新: {getLatestRate(selectedMemberId)?.toFixed(1)}×
          </span>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}×`} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div className="bg-white rounded-lg shadow-lg border p-3 text-sm">
                    <p className="font-semibold text-gray-600 text-xs mb-1">{d?.fullName}</p>
                    <p className={`font-bold text-lg ${getRateColorClass(payload[0]?.value)}`}>
                      {payload[0]?.value?.toFixed(1)}×
                    </p>
                  </div>
                );
              }}
            />
            <Line
              type="monotone" dataKey="rate" name="レート"
              stroke="#ec4899" strokeWidth={3} dot={{ r: 6, fill: '#ec4899' }}
              activeDot={{ r: 8 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 複数メンバー比較 */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">メンバー比較（最大4名）</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {members.map(m => (
            <button
              key={m.id}
              onClick={() => toggleCompare(m.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border
                ${compareIds.includes(m.id)
                  ? 'text-white border-transparent'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-pink-200'}`}
              style={compareIds.includes(m.id) ? {
                backgroundColor: COMPARE_COLORS[compareIds.indexOf(m.id)],
                borderColor: COMPARE_COLORS[compareIds.indexOf(m.id)],
              } : {}}
            >
              {m.name}
            </button>
          ))}
        </div>
        {compareIds.length > 0 && (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="name" type="category"
                allowDuplicatedCategory={false} tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}×`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {compareIds.map((id, i) => {
                const m = members.find(x => x.id === id);
                const data = getTrendData(id);
                return (
                  <Line
                    key={id} data={data} type="monotone" dataKey="rate"
                    name={m?.name ?? id} stroke={COMPARE_COLORS[i]}
                    strokeWidth={2} dot={{ r: 4 }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
