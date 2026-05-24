import { useState, useMemo } from 'react';
import { CATEGORIES } from '../hooks/useSpotSearch';

export default function SpotPanel({ spots, isLoading, onSearchRoute, onAddSpot, hasRoute }) {
  const [filter, setFilter] = useState('all');

  const grouped = useMemo(() => {
    const filtered = filter === 'all' ? spots : spots.filter(s => s.type === filter);
    const groups = {};
    for (const s of filtered) {
      const area = s.area || 'その他';
      if (!groups[area]) groups[area] = [];
      groups[area].push(s);
    }
    return Object.entries(groups);
  }, [spots, filter]);

  return (
    <div className="flex flex-col h-full border-t border-gray-200 bg-gray-50">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-gray-700">おすすめスポット</p>
          {hasRoute && (
            <button
              onClick={onSearchRoute}
              disabled={isLoading}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer
                ${isLoading
                  ? 'bg-gray-200 text-gray-400'
                  : 'bg-sky-500 text-white hover:bg-sky-600 shadow-sm'
                }
              `}
            >
              {isLoading ? '検索中...' : '🔍 ルート沿いを検索'}
            </button>
          )}
        </div>

        {/* Category filter */}
        {spots.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`text-xs px-2 py-1 rounded-full cursor-pointer transition-all ${
                filter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              すべて ({spots.length})
            </button>
            {Object.entries(CATEGORIES).map(([key, cat]) => {
              const count = spots.filter(s => s.type === key).length;
              if (count === 0) return null;
              return (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`text-xs px-2 py-1 rounded-full cursor-pointer transition-all ${
                    filter === key ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {cat.icon} {count}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && spots.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-400">ルート沿いのスポットを検索中...</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && spots.length === 0 && (
        <div className="text-center py-8 px-4">
          <p className="text-2xl mb-2">🗾</p>
          <p className="text-xs text-gray-400">
            {hasRoute
              ? '「ルート沿いを検索」でおすすめスポットを発見'
              : '出発地と目的地を設定してください'}
          </p>
        </div>
      )}

      {/* Spot list grouped by area */}
      {spots.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          {grouped.map(([area, areaSpots]) => (
            <div key={area}>
              <div className="sticky top-0 bg-gray-100 px-4 py-1.5 border-b border-gray-200">
                <span className="text-xs font-bold text-gray-600">{area}エリア</span>
                <span className="text-xs text-gray-400 ml-2">{areaSpots.length}件</span>
              </div>
              {areaSpots.map(spot => (
                <div
                  key={spot.id}
                  className="px-4 py-2 bg-white border-b border-gray-50 flex items-center gap-2 hover:bg-sky-50 transition-colors group"
                >
                  <span className="text-base shrink-0">{CATEGORIES[spot.type]?.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{spot.name}</p>
                    <p className="text-xs text-gray-400">{spot.distFromRoute > 0 ? `ルートから${spot.distFromRoute.toFixed(1)}km` : ''}</p>
                  </div>
                  <button
                    onClick={() => onAddSpot(spot)}
                    className="text-xs px-2 py-1 rounded-lg bg-sky-100 text-sky-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-sky-200 shrink-0"
                  >
                    + 追加
                  </button>
                </div>
              ))}
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 px-4 py-3">
              <div className="w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-gray-400">さらに検索中...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
