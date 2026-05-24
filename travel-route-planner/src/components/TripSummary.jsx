import { formatDistance, formatDuration } from '../utils/formatters';
import { PROFILES } from '../hooks/useRouting';

export default function TripSummary({ routeData, isLoading, transportMode }) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">
          {transportMode === 'transit' ? '最寄り駅を検索中...' : 'ルートを計算中...'}
        </span>
      </div>
    );
  }

  if (!routeData) return null;

  const profile = PROFILES[transportMode] || PROFILES.driving;
  const isTransit = routeData.isTransit;

  return (
    <div className="bg-gradient-to-r from-sky-50 to-teal-50 rounded-xl shadow-sm border border-sky-100 p-3">
      {/* Main stats */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-lg">{profile.icon}</span>
        <div>
          <p className="text-xs text-gray-500">総距離</p>
          <p className="text-base font-bold text-sky-700">{formatDistance(routeData.totalDistance)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">{isTransit ? '推定所要時間' : '所要時間'}</p>
          <p className="text-base font-bold text-teal-700">{formatDuration(routeData.totalDuration)}</p>
        </div>
        <div className="hidden sm:block border-l border-sky-200 pl-4">
          <p className="text-xs text-gray-500">区間</p>
          <p className="text-base font-bold text-gray-700">{routeData.legs.length}</p>
        </div>
      </div>

      {/* Transit: station details per leg */}
      {isTransit && routeData.legs.length > 0 && (
        <div className="mt-3 space-y-2">
          {routeData.legs.map((leg, i) => (
            <div key={i} className="bg-white rounded-lg p-2.5 border border-sky-100">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-bold text-emerald-600">🚉 {leg.fromStation}</span>
                <span className="text-gray-300">→</span>
                <span className="px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded text-xs font-bold">
                  {leg.trainType}
                </span>
                <span className="text-gray-300">→</span>
                <span className="font-bold text-rose-600">🚉 {leg.toStation}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                <span>{formatDistance(leg.distance)}</span>
                <span>約{formatDuration(leg.duration)}</span>
                {leg.fromStationDist > 0 && (
                  <span className="text-gray-400">
                    (出発地から駅まで{leg.fromStationDist.toFixed(1)}km)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Non-transit leg summary */}
      {!isTransit && routeData.legs.length > 1 && (
        <div className="mt-2 flex gap-1.5 flex-wrap">
          {routeData.legs.map((leg, i) => (
            <span key={i} className="text-xs bg-white/80 px-2 py-0.5 rounded-full border border-sky-200 text-gray-600">
              {i + 1}: {formatDistance(leg.distance)} · {formatDuration(leg.duration)}
            </span>
          ))}
        </div>
      )}

      {/* Google Maps link for transit */}
      {isTransit && routeData.googleMapsUrl && (
        <a
          href={routeData.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-2 bg-white border border-sky-200 rounded-lg py-2 text-sm font-medium text-sky-600 hover:bg-sky-50 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Google Mapsで乗換案内を見る
        </a>
      )}
    </div>
  );
}
