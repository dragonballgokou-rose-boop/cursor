import { useCallback, useState } from 'react';
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

  const { spots, isLoading: spotsLoading, searchAlongRoute, clearSpots } = useSpotSearch();

  const [activePanel, setActivePanel] = useState('route'); // 'route' | 'spots'

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

  const handleSearchRoute = useCallback(() => {
    if (!routeData?.geometry) return;
    searchAlongRoute(routeData.geometry, ['onsen', 'tourism', 'food', 'temple']);
    setActivePanel('spots');
  }, [routeData, searchAlongRoute]);

  const handleAddSpot = useCallback(
    (spot) => {
      if (!currentTrip) return;
      const lastIndex = currentTrip.stops.length - 1;
      addStop(lastIndex);
      setTimeout(() => {
        updateStop(currentTrip.stops[lastIndex]?.id, {
          name: spot.name,
          lat: spot.lat,
          lng: spot.lng,
          address: spot.name,
        });
      }, 50);
    },
    [currentTrip, addStop, updateStop]
  );

  const handleBack = useCallback(() => {
    selectTrip(null);
    clearSpots();
    setActivePanel('route');
  }, [selectTrip, clearSpots]);

  if (!currentTrip) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-200 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-2xl">🗺️</span>
              旅行ルートプランナー
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">ルート沿いのおすすめスポットを発見</p>
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

  const hasRoute = !!routeData?.geometry;

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-200 shadow-sm shrink-0">
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

          {/* Panel toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setActivePanel('route')}
              className={`text-xs px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                activePanel === 'route' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
              }`}
            >
              ルート
            </button>
            <button
              onClick={() => setActivePanel('spots')}
              className={`text-xs px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                activePanel === 'spots' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
              }`}
            >
              おすすめ {spots.length > 0 && `(${spots.length})`}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar */}
        <aside className="w-full md:w-[380px] bg-white border-r border-gray-200 flex flex-col overflow-hidden order-2 md:order-1 max-h-[45vh] md:max-h-none">
          {activePanel === 'route' ? (
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
              {hasRoute && (
                <div className="p-3 border-t border-gray-100">
                  <button
                    onClick={handleSearchRoute}
                    disabled={spotsLoading}
                    className="w-full py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer bg-gradient-to-r from-sky-500 to-teal-400 text-white hover:from-sky-600 hover:to-teal-500 shadow-sm disabled:opacity-50"
                  >
                    {spotsLoading ? '検索中...' : '🔍 ルート沿いのおすすめを探す'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <SpotPanel
              spots={spots}
              isLoading={spotsLoading}
              onSearchRoute={handleSearchRoute}
              onAddSpot={handleAddSpot}
              hasRoute={hasRoute}
            />
          )}
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
