import { useCallback } from 'react';
import { useTrips } from './hooks/useTrips';
import { useRouting } from './hooks/useRouting';
import { reverseGeocode } from './hooks/useGeocoding';
import MapView from './components/MapView';
import RoutePanel from './components/RoutePanel';
import TripList from './components/TripList';
import TripSummary from './components/TripSummary';

export default function App() {
  const {
    trips,
    currentTrip,
    createTrip,
    selectTrip,
    deleteTrip,
    renameTrip,
    addStop,
    removeStop,
    updateStop,
    reorderStops,
  } = useTrips();

  const { routeData, isLoading: routeLoading } = useRouting(currentTrip?.stops || []);

  const handleMapClick = useCallback(
    async (lat, lng) => {
      if (!currentTrip) return;
      const name = await reverseGeocode(lat, lng);
      const emptyStop = currentTrip.stops.find(s => !s.name);
      if (emptyStop) {
        updateStop(emptyStop.id, { name, lat, lng, address: name });
      } else {
        addStop(currentTrip.stops.length - 1);
      }
    },
    [currentTrip, updateStop, addStop]
  );

  const handleBack = useCallback(() => selectTrip(null), [selectTrip]);

  if (!currentTrip) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-2xl">🗺️</span>
              旅行ルートプランナー
            </h1>
            <p className="text-xs text-gray-500 mt-1">旅行のルートを計画・管理</p>
          </div>
        </header>
        <div className="max-w-5xl mx-auto">
          <TripList
            trips={trips}
            onSelect={selectTrip}
            onCreate={createTrip}
            onDelete={deleteTrip}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="text-gray-500 hover:text-gray-800 transition-colors cursor-pointer flex items-center gap-1 text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            一覧
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <h1 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <span>🗺️</span>
            {currentTrip.name || '無題の旅行'}
          </h1>
          <div className="flex-1" />
          <span className="text-xs text-gray-400 hidden sm:block">
            地図をクリックして地点を追加
          </span>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row">
        <aside className="w-full md:w-96 bg-white border-r border-gray-200 md:h-[calc(100vh-57px)] overflow-hidden flex flex-col order-2 md:order-1">
          <RoutePanel
            trip={currentTrip}
            onUpdateStop={updateStop}
            onRemoveStop={removeStop}
            onAddStop={addStop}
            onReorderStops={reorderStops}
            onRenameTrip={renameTrip}
          />
        </aside>

        <main className="flex-1 flex flex-col order-1 md:order-2">
          <div className="flex-1 md:h-[calc(100vh-57px-80px)]" style={{ minHeight: '350px' }}>
            <MapView
              stops={currentTrip.stops}
              routeData={routeData}
              onMapClick={handleMapClick}
            />
          </div>
          <div className="p-3">
            <TripSummary routeData={routeData} isLoading={routeLoading} />
          </div>
        </main>
      </div>
    </div>
  );
}
