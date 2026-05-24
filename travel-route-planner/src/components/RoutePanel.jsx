import { useState, useCallback, useMemo } from 'react';
import StopCard from './StopCard';
import { PROFILES } from '../hooks/useRouting';
import { formatDistance, formatDuration, addMinutesToTime } from '../utils/formatters';

export default function RoutePanel({
  trip,
  routeData,
  onUpdateStop,
  onRemoveStop,
  onAddStop,
  onReorderStops,
  onRenameTrip,
  onSetDepartureTime,
  onSetTransportMode,
}) {
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleDragStart = useCallback((e, index) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e, toIndex) => {
      e.preventDefault();
      if (dragIndex !== null && dragIndex !== toIndex) {
        onReorderStops(dragIndex, toIndex);
      }
      setDragIndex(null);
      setDragOverIndex(null);
    },
    [dragIndex, onReorderStops]
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  const timeline = useMemo(() => {
    if (!trip || !routeData) return {};
    const times = {};
    let currentTime = trip.departureTime || '09:00';
    times[trip.stops[0].id] = { arrival: currentTime };

    const validStops = trip.stops.filter(s => s.lat && s.lng);
    for (let i = 1; i < validStops.length; i++) {
      const leg = routeData.legs[i - 1];
      if (!leg) break;
      const travelMin = leg.duration / 60;
      const prevStop = validStops[i - 1];
      const prevStay = prevStop.stayMinutes || 0;
      currentTime = addMinutesToTime(currentTime, prevStay + travelMin);
      times[validStops[i].id] = { arrival: currentTime };
    }
    return times;
  }, [trip, routeData]);

  const legInfoMap = useMemo(() => {
    if (!routeData) return {};
    const map = {};
    const validStops = trip.stops.filter(s => s.lat && s.lng);
    for (let i = 0; i < routeData.legs.length; i++) {
      const leg = routeData.legs[i];
      if (validStops[i + 1]) {
        map[validStops[i + 1].id] = {
          distance: formatDistance(leg.distance),
          duration: formatDuration(leg.duration),
        };
      }
    }
    return map;
  }, [routeData, trip]);

  if (!trip) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 space-y-3">
        <input
          type="text"
          value={trip.name}
          onChange={e => onRenameTrip(e.target.value)}
          className="text-lg font-bold text-gray-800 w-full bg-transparent border-none focus:outline-none focus:ring-0 px-0"
          placeholder="旅行名を入力..."
        />

        {/* Transport mode */}
        <div className="flex gap-1">
          {Object.entries(PROFILES).map(([key, p]) => (
            <button
              key={key}
              onClick={() => onSetTransportMode(key)}
              className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                trip.transportMode === key
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>

        {/* Departure time */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">出発時刻:</span>
          <input
            type="time"
            value={trip.departureTime || '09:00'}
            onChange={e => onSetDepartureTime(e.target.value)}
            className="text-sm font-mono border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-400"
          />
        </div>
      </div>

      {/* Stops list */}
      <div className="flex-1 overflow-y-auto p-4">
        {trip.stops.map((stop, i) => (
          <div
            key={stop.id}
            draggable
            onDragStart={e => handleDragStart(e, i)}
            onDragOver={e => handleDragOver(e, i)}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, i)}
            onDragEnd={handleDragEnd}
          >
            <StopCard
              stop={stop}
              index={i}
              total={trip.stops.length}
              onUpdate={onUpdateStop}
              onRemove={onRemoveStop}
              isDragging={dragIndex === i}
              isDragOver={dragOverIndex === i && dragIndex !== i}
              arrivalTime={timeline[stop.id]?.arrival}
              legInfo={legInfoMap[stop.id]}
            />
            {i < trip.stops.length - 1 && !legInfoMap[trip.stops[i + 1]?.id] && (
              <div className="flex items-center gap-2 py-1.5 px-3">
                <div className="w-8 flex justify-center">
                  <div className="w-0.5 h-4 bg-gray-200" />
                </div>
              </div>
            )}
            {i < trip.stops.length - 1 && (
              <div className="flex justify-center py-0.5">
                <button
                  onClick={() => onAddStop(i + 1)}
                  className="w-5 h-5 flex items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-sky-400 hover:text-sky-500 hover:bg-sky-50 transition-all cursor-pointer text-xs hover:scale-110"
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
