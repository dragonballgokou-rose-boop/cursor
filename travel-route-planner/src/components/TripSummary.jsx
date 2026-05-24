import { formatDistance, formatDuration } from '../utils/formatters';
import { PROFILES } from '../hooks/useRouting';

export default function TripSummary({ routeData, isLoading, transportMode }) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">ルートを計算中...</span>
      </div>
    );
  }

  if (!routeData) return null;

  const profile = PROFILES[transportMode] || PROFILES.driving;

  return (
    <div className="bg-gradient-to-r from-sky-50 to-teal-50 rounded-xl shadow-sm border border-sky-100 p-3">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-lg">{profile.icon}</span>
        <div>
          <p className="text-xs text-gray-500">総距離</p>
          <p className="text-base font-bold text-sky-700">{formatDistance(routeData.totalDistance)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">所要時間</p>
          <p className="text-base font-bold text-teal-700">{formatDuration(routeData.totalDuration)}</p>
        </div>
        <div className="hidden sm:block border-l border-sky-200 pl-4">
          <p className="text-xs text-gray-500">区間</p>
          <p className="text-base font-bold text-gray-700">{routeData.legs.length}</p>
        </div>
      </div>

      {routeData.legs.length > 1 && (
        <div className="mt-2 flex gap-1.5 flex-wrap">
          {routeData.legs.map((leg, i) => (
            <span key={i} className="text-xs bg-white/80 px-2 py-0.5 rounded-full border border-sky-200 text-gray-600">
              {i + 1}: {formatDistance(leg.distance)} · {formatDuration(leg.duration)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
