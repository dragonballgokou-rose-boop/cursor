import { useState, useCallback } from 'react';
import StopCard from './StopCard';

export default function RoutePanel({
  trip,
  onUpdateStop,
  onRemoveStop,
  onAddStop,
  onReorderStops,
  onRenameTrip,
}) {
  const [dragIndex, setDragIndex] = useState(null);

  const handleDragStart = useCallback((e, index) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (e, toIndex) => {
      e.preventDefault();
      if (dragIndex !== null && dragIndex !== toIndex) {
        onReorderStops(dragIndex, toIndex);
      }
      setDragIndex(null);
    },
    [dragIndex, onReorderStops]
  );

  if (!trip) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-100">
        <input
          type="text"
          value={trip.name}
          onChange={e => onRenameTrip(e.target.value)}
          className="text-lg font-bold text-gray-800 w-full bg-transparent border-none focus:outline-none focus:ring-0 px-0"
          placeholder="旅行名を入力..."
        />
        <p className="text-xs text-gray-400 mt-1">{trip.stops.length} 地点</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {trip.stops.map((stop, i) => (
          <div key={stop.id}>
            <StopCard
              stop={stop}
              index={i}
              total={trip.stops.length}
              onUpdate={onUpdateStop}
              onRemove={onRemoveStop}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
            {i < trip.stops.length - 1 && (
              <div className="flex justify-center py-1">
                <button
                  onClick={() => onAddStop(i + 1)}
                  className="w-6 h-6 flex items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-sky-400 hover:text-sky-500 hover:bg-sky-50 transition-colors cursor-pointer text-xs"
                  title="経由地を追加"
                >
                  +
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
