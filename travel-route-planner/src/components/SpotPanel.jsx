import { useState } from 'react';
import { CATEGORIES } from '../hooks/useSpotSearch';

export default function SpotPanel({ stops, spots, isLoading, onSearch, onClear }) {
  const [selectedCategory, setSelectedCategory] = useState(null);

  const validStops = stops.filter(s => s.lat && s.lng);
  const hasStops = validStops.length > 0;

  function handleSearch(categoryKey) {
    if (!hasStops) return;
    if (selectedCategory === categoryKey) {
      setSelectedCategory(null);
      onClear();
      return;
    }
    setSelectedCategory(categoryKey);
    const center = validStops[Math.floor(validStops.length / 2)];
    onSearch(center.lat, center.lng, categoryKey, 10000);
  }

  return (
    <div className="bg-white border-t border-gray-200 px-4 py-3">
      <p className="text-xs text-gray-500 mb-2 font-medium">周辺スポット検索</p>
      <div className="flex gap-1.5 flex-wrap">
        {Object.entries(CATEGORIES).map(([key, cat]) => (
          <button
            key={key}
            onClick={() => handleSearch(key)}
            disabled={!hasStops}
            className={`text-xs px-2.5 py-1.5 rounded-full font-medium transition-all cursor-pointer
              ${selectedCategory === key
                ? 'bg-sky-500 text-white shadow-sm'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
              }
              ${!hasStops ? 'opacity-40 cursor-not-allowed' : ''}
            `}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>
      {isLoading && (
        <div className="flex items-center gap-2 mt-2">
          <div className="w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-gray-400">検索中...</span>
        </div>
      )}
      {spots.length > 0 && (
        <p className="text-xs text-gray-400 mt-2">{spots.length}件のスポットを地図上に表示中</p>
      )}
    </div>
  );
}
