import { formatDistance, formatDuration } from '../utils/formatters';

export default function TripSummary({ routeData, isLoading }) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">ルートを計算中...</span>
      </div>
    );
  }

  if (!routeData) return null;

  return (
    <div className="bg-gradient-to-r from-sky-50 to-teal-50 rounded-xl shadow-sm border border-sky-100 p-4">
      <div className="flex items-center gap-6 flex-wrap">
        <div>
          <p className="text-xs text-gray-500">総距離</p>
          <p className="text-lg font-bold text-sky-700">{formatDistance(routeData.totalDistance)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">所要時間</p>
          <p className="text-lg font-bold text-teal-700">{formatDuration(routeData.totalDuration)}</p>
        </div>
        <div className="hidden md:block border-l border-sky-200 pl-4">
          <p className="text-xs text-gray-500">区間数</p>
          <p className="text-lg font-bold text-gray-700">{routeData.legs.length}</p>
        </div>
      </div>

      {routeData.legs.length > 1 && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {routeData.legs.map((leg, i) => (
            <span key={i} className="text-xs bg-white px-2 py-1 rounded-full border border-sky-200 text-gray-600">
              区間{i + 1}: {formatDistance(leg.distance)} / {formatDuration(leg.duration)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
