import { useState } from 'react';
import SearchInput from './SearchInput';

const typeConfig = {
  first: { label: '出発地', color: 'border-l-emerald-500', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  last: { label: '目的地', color: 'border-l-rose-500', bg: 'bg-rose-50', dot: 'bg-rose-500' },
  mid: { label: '経由地', color: 'border-l-sky-400', bg: 'bg-sky-50', dot: 'bg-sky-400' },
};

export default function StopCard({
  stop,
  index,
  total,
  onUpdate,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
}) {
  const [showMemo, setShowMemo] = useState(false);
  const type = index === 0 ? 'first' : index === total - 1 ? 'last' : 'mid';
  const config = typeConfig[type];

  function handleSelect(result) {
    onUpdate(stop.id, { name: result.name, lat: result.lat, lng: result.lng, address: result.name });
  }

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, index)}
      onDragOver={e => onDragOver(e, index)}
      onDrop={e => onDrop(e, index)}
      className={`bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 ${config.color} transition-shadow hover:shadow-md`}
    >
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="cursor-grab text-gray-400 hover:text-gray-600" title="ドラッグで並べ替え">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="5" cy="3" r="1.5" />
              <circle cx="11" cy="3" r="1.5" />
              <circle cx="5" cy="8" r="1.5" />
              <circle cx="11" cy="8" r="1.5" />
              <circle cx="5" cy="13" r="1.5" />
              <circle cx="11" cy="13" r="1.5" />
            </svg>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bg} text-gray-700`}>
            {config.label} {type === 'mid' && index}
          </span>
          <div className="flex-1" />
          {total > 2 && type === 'mid' && (
            <button
              onClick={() => onRemove(stop.id)}
              className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
              title="削除"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {stop.name ? (
          <div className="flex items-start gap-2">
            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${config.dot}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{stop.name.split(',')[0]}</p>
              <p className="text-xs text-gray-500 truncate">{stop.name}</p>
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

        <div className="mt-2">
          <button
            onClick={() => setShowMemo(!showMemo)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            {showMemo ? 'メモを閉じる' : 'メモを追加'}
          </button>
          {showMemo && (
            <textarea
              value={stop.memo}
              onChange={e => onUpdate(stop.id, { memo: e.target.value })}
              placeholder="メモを入力..."
              className="w-full mt-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-sky-400 h-16"
            />
          )}
        </div>
      </div>
    </div>
  );
}
