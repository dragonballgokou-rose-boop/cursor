export default function TripList({ trips, onSelect, onCreate, onDelete }) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">保存済みの旅行</h2>
        <button
          onClick={onCreate}
          className="px-4 py-2 bg-gradient-to-r from-sky-500 to-teal-400 text-white rounded-lg text-sm font-medium hover:from-sky-600 hover:to-teal-500 transition-all shadow-sm cursor-pointer"
        >
          + 新しい旅行
        </button>
      </div>

      {trips.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🗺️</div>
          <p className="text-gray-500 mb-2">まだ旅行がありません</p>
          <p className="text-sm text-gray-400">「新しい旅行」ボタンから旅行を作成しましょう</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trips.map(trip => {
            const filledStops = trip.stops.filter(s => s.name);
            return (
              <div
                key={trip.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group"
              >
                <div className="p-4" onClick={() => onSelect(trip.id)}>
                  <h3 className="font-bold text-gray-800 group-hover:text-sky-600 transition-colors">
                    {trip.name || '無題の旅行'}
                  </h3>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span>{trip.stops.length} 地点</span>
                    <span>設定済み: {filledStops.length}</span>
                  </div>
                  {filledStops.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                      {filledStops.map((s, i) => (
                        <span key={s.id} className="flex items-center gap-1">
                          {i > 0 && <span className="text-gray-300">→</span>}
                          <span className="truncate max-w-[80px]">{s.name.split(',')[0]}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    更新: {new Date(trip.updatedAt).toLocaleDateString('ja-JP')}
                  </p>
                </div>
                <div className="border-t border-gray-100 px-4 py-2 flex justify-end">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (confirm('この旅行を削除しますか？')) onDelete(trip.id);
                    }}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                  >
                    削除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
