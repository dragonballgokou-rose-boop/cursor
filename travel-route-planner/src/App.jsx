import { useCallback } from 'react';
import { useTrips } from './hooks/useTrips';
import { useRouting } from './hooks/useRouting';
import { useSpotSearch } from './hooks/useSpotSearch';
import { reverseGeocode } from './hooks/useGeocoding';
import MapView from './components/MapView';
import RoutePanel from './components/RoutePanel';
import TripList from './components/TripList';
import TripSummary from './components/TripSummary';
import SpotPanel from './components/SpotPanel';

export default function App() {
  const {
    trips,
    currentTrip,
    createTrip,
    selectTrip,
    deleteTrip,
    renameTrip,
    setDepartureTime,
    setTransportMode,
    addStop,
    removeStop,
    updateStop,
    reorderStops,
  } = useTrips();

  const { routeData, isLoading: routeLoading } = useRouting(
    currentTrip?.stops || [],
    currentTrip?.transportMode || 'driving'
  );

  const { spots, isLoading: spotsLoading, searchSpots, clearSpots } = useSpotSearch();

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

  const handleMarkerDrag = useCallback(
    async (stopId, lat, lng) => {
      const name = await reverseGeocode(lat, lng);
      updateStop(stopId, { name, lat, lng, address: name });
    },
    [updateStop]
  );

  const handleAddSpot = useCallback(
    (spot) => {
      if (!currentTrip) return;
      const lastIndex = currentTrip.stops.length - 1;
      addStop(lastIndex);
      setTimeout(() => {
        const trip = currentTrip;
        const newStopId = trip.stops[lastIndex]?.id;
        if (newStopId) {
          updateStop(newStopId, { name: spot.name, lat: spot.lat, lng: spot.lng, address: spot.name });
        }
      }, 50);
    },
    [currentTrip, addStop, updateStop]
  );

  const handleBack = useCallback(() => {
    selectTrip(null);
    clearSpots();
  }, [selectTrip, clearSpots]);

  if (!currentTrip) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-200 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="text-2xl">🗺️</span>
                旅行ルートプランナー
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">旅行のルートを計画・管理</p>
            </div>
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
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-200 shadow-sm">
        <div className="px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="text-gray-500 hover:text-gray-800 transition-colors cursor-pointer flex items-center gap-1 text-sm shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            一覧
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <h1 className="text-sm font-bold text-gray-800 truncate">
            🗺️ {currentTrip.name || '無題の旅行'}
          </h1>
          <div className="flex-1" />
          <span className="text-xs text-gray-400 hidden md:block">
            地図クリックで地点追加 · マーカードラッグで位置調整
          </span>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar */}
        <aside className="w-full md:w-[380px] bg-white border-r border-gray-200 flex flex-col overflow-hidden order-2 md:order-1 max-h-[40vh] md:max-h-none">
          <div className="flex-1 overflow-y-auto">
            <RoutePanel
              trip={currentTrip}
              routeData={routeData}
              onUpdateStop={updateStop}
              onRemoveStop={removeStop}
              onAddStop={addStop}
              onReorderStops={reorderStops}
              onRenameTrip={renameTrip}
              onSetDepartureTime={setDepartureTime}
              onSetTransportMode={setTransportMode}
            />
          </div>
          <SpotPanel
            stops={currentTrip.stops}
            spots={spots}
            isLoading={spotsLoading}
            onSearch={searchSpots}
            onClear={clearSpots}
          />
        </aside>

        {/* Map + Summary */}
        <main className="flex-1 flex flex-col order-1 md:order-2 min-h-0">
          <div className="flex-1 min-h-[300px]">
            <MapView
              stops={currentTrip.stops}
              routeData={routeData}
              onMapClick={handleMapClick}
              onMarkerDrag={handleMarkerDrag}
              spots={spots}
              onAddSpot={handleAddSpot}
            />
          </div>
          <div className="p-2 shrink-0">
            <TripSummary
              routeData={routeData}
              isLoading={routeLoading}
              transportMode={currentTrip.transportMode}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
