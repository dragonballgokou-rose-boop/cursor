import { useState } from 'react';
import SearchInput from './SearchInput';

const typeConfig = {
  first: { label: '出発地', color: 'border-l-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  last: { label: '目的地', color: 'border-l-rose-500', bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
  mid: { label: '経由地', color: 'border-l-sky-500', bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
};

export default function StopCard({
  stop,
  index,
  total,
  onUpdate,
  onRemove,
  isDragging,
  isDragOver,
  arrivalTime,
  departureTimeFromHere,
  legInfo,
}) {
  const [showMemo, setShowMemo] = useState(!!stop.memo);
  const type = index === 0 ? 'first' : index === total - 1 ? 'last' : 'mid';
  const config = typeConfig[type];

  function handleSelect(result) {
    onUpdate(stop.id, { name: result.name, lat: result.lat, lng: result.lng, address: result.name });
  }

  return (
    <div className="relative">
      {/* Timeline connector */}
      {index > 0 && legInfo && (
        <div className="flex items-center gap-2 py-1.5 px-3">
          <div className="w-8 flex justify-center">
            <div className="w-0.5 h-4 bg-gray-200" />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>↓</span>
            <span>{legInfo.distance}</span>
            <span className="text-gray-300">·</span>
            <span>{legInfo.duration}</span>
          </div>
        </div>
      )}

      <div
        className={`
          bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 ${config.color}
          transition-all duration-200
          ${isDragging ? 'opacity-40 scale-95' : ''}
          ${isDragOver ? 'ring-2 ring-sky-400 ring-offset-1' : ''}
          hover:shadow-md
        `}
      >
        <div className="p-3">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-2">
            <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors" title="ドラッグで並べ替え">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="5" cy="3" r="1.5" />
                <circle cx="11" cy="3" r="1.5" />
                <circle cx="5" cy="8" r="1.5" />
                <circle cx="11" cy="8" r="1.5" />
                <circle cx="5" cy="13" r="1.5" />
                <circle cx="11" cy="13" r="1.5" />
              </svg>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.bg} ${config.text}`}>
              {config.label}
            </span>

            {/* Timeline arrival time */}
            {arrivalTime && (
              <span className="text-xs font-mono font-medium text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
                {arrivalTime}
              </span>
            )}

            <div className="flex-1" />
            {total > 2 && type === 'mid' && (
              <button
                onClick={() => onRemove(stop.id)}
                className="text-gray-300 hover:text-red-500 transition-colors cursor-pointer p-0.5 rounded hover:bg-red-50"
                title="削除"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Location */}
          {stop.name ? (
            <div className="flex items-start gap-2">
              <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${config.dot}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{stop.name.split(',')[0]}</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{stop.name}</p>
                <button
                  onClick={() => onUpdate(stop.id, { name: '', lat: null, lng: null, address: '' })}
                  className="text-xs text-sky-500 hover:text-sky-700 mt-1 cursor-pointer"
                >
                  変更
                </button>
              </div>
            </div>
          ) : (
            <SearchInput onSelect={handleSelect} placeholder={`${config.label}を検索...`} />
          )}

          {/* Stay time + Memo */}
          <div className="mt-2 flex items-center gap-3">
            {type === 'mid' && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">滞在:</span>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={stop.stayMinutes || 0}
                  onChange={e => onUpdate(stop.id, { stayMinutes: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-14 px-1.5 py-0.5 text-xs border border-gray-200 rounded text-center focus:outline-none focus:ring-1 focus:ring-sky-400"
                />
                <span className="text-xs text-gray-400">分</span>
              </div>
            )}
            <button
              onClick={() => setShowMemo(!showMemo)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer flex items-center gap-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              {showMemo ? '閉じる' : 'メモ'}
            </button>
          </div>
          {showMemo && (
            <textarea
              value={stop.memo}
              onChange={e => onUpdate(stop.id, { memo: e.target.value })}
              placeholder="メモを入力..."
              className="w-full mt-2 px-2 py-1.5 text-xs border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-sky-400 h-14"
            />
          )}
        </div>
      </div>
    </div>
  );
}
