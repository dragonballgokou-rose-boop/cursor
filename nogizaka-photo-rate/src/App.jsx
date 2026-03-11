import { useState } from 'react';
import MemberView from './components/MemberView';
import PhotoView from './components/PhotoView';
import StatsView from './components/StatsView';
import { photoSeries, members, getLatestRate, getAverageRate } from './data/data';

const TABS = [
  { id: 'member', label: 'メンバー別', icon: '👤', desc: '直近5種平均・最新レート一覧' },
  { id: 'photo', label: '生写真種別', icon: '📷', desc: '種ごとのランキング' },
  { id: 'stats', label: 'グラフ・統計', icon: '📊', desc: '推移・比較チャート' },
];

function StatBadge({ label, value }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-pink-600">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('member');

  const latestSeries = photoSeries[photoSeries.length - 1];
  const topMember = members
    .map(m => ({ ...m, r: getLatestRate(m.id) ?? 0 }))
    .sort((a, b) => b.r - a.r)[0];

  const avgAll = (() => {
    const rates = members.map(m => getAverageRate(m.id, 5)).filter(Boolean);
    return rates.length ? (rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(2) : '—';
  })();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                乃木坂46 生写真レートシステム
              </h1>
              <p className="text-xs text-gray-400">現メンバー {members.length}名 | {photoSeries.length}種データ</p>
            </div>
            <div className="flex gap-6 text-center hidden sm:flex">
              <StatBadge label="現メンバー" value={`${members.length}名`} />
              <StatBadge label="最新種" value={latestSeries.name.split('「')[0].replace('th', 'th')} />
              <StatBadge label="最高レート" value={`${topMember?.r.toFixed(1)}×`} />
              <StatBadge label="全体平均" value={`${avgAll}×`} />
            </div>
          </div>
        </div>
      </header>

      {/* タブナビ */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-all -mb-px
                  ${activeTab === tab.id
                    ? 'border-pink-500 text-pink-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                <span className="mr-1.5">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* コンテンツ */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* 最新種サマリーバナー */}
        <div className="bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-100 rounded-xl px-5 py-3 mb-6 flex flex-wrap items-center gap-3">
          <div>
            <span className="text-xs text-pink-400 font-medium uppercase tracking-wide">最新種</span>
            <div className="font-bold text-gray-800">{latestSeries.name}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-gray-400">最高レートメンバー</div>
            <div className="font-bold text-pink-600 text-lg">
              {topMember?.name}
              <span className="ml-2 text-2xl font-extrabold">{topMember?.r.toFixed(1)}×</span>
            </div>
          </div>
        </div>

        {activeTab === 'member' && <MemberView />}
        {activeTab === 'photo' && <PhotoView />}
        {activeTab === 'stats' && <StatsView />}
      </main>

      <footer className="mt-10 py-6 border-t border-gray-200 text-center text-xs text-gray-400">
        <p>※ レートデータはサンプルです。実際の市場価格とは異なります。</p>
        <p className="mt-1">データは <code className="bg-gray-100 px-1 rounded">src/data/data.js</code> で管理されています。</p>
      </footer>
    </div>
  );
}
