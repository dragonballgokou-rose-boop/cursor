import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';

function createNumberedIcon(number, color, size = 32) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background: ${color};
      color: white;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${size * 0.42}px;
      font-weight: 700;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      transition: transform 0.2s;
    ">${number}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function createSpotIcon(emoji) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background: white;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      border: 2px solid #e5e7eb;
      box-shadow: 0 1px 4px rgba(0,0,0,0.15);
      cursor: pointer;
    ">${emoji}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  });
}

function getMarkerColor(index, total) {
  if (index === 0) return '#10b981';
  if (index === total - 1) return '#f43f5e';
  return '#0ea5e9';
}

const SPOT_EMOJIS = {
  tourism: '🏯',
  food: '🍜',
  hotel: '🏨',
  temple: '⛩️',
  nature: '🌿',
  onsen: '♨️',
};

function FitBounds({ stops }) {
  const map = useMap();
  useEffect(() => {
    const valid = stops.filter(s => s.lat && s.lng);
    if (valid.length === 0) return;
    if (valid.length === 1) {
      map.setView([valid[0].lat, valid[0].lng], 13);
      return;
    }
    const bounds = L.latLngBounds(valid.map(s => [s.lat, s.lng]));
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [stops, map]);
  return null;
}

function MapClickHandler({ onClick }) {
  const map = useMap();
  useEffect(() => {
    if (!onClick) return;
    function handler(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    }
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [map, onClick]);
  return null;
}

function createStationIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      background: #7c3aed;
      color: white;
      width: 22px;
      height: 22px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      border: 2px solid white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.25);
    ">🚉</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
}

export default function MapView({ stops, routeData, onMapClick, onMarkerDrag, spots = [], onAddSpot }) {
  const validStops = useMemo(() => stops.filter(s => s.lat && s.lng), [stops]);

  return (
    <MapContainer
      center={[36.5, 138.0]}
      zoom={6}
      className="w-full h-full"
      style={{ minHeight: '400px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds stops={stops} />
      <MapClickHandler onClick={onMapClick} />

      {routeData?.geometry && !routeData.isTransit && (
        <>
          <Polyline positions={routeData.geometry} color="#0ea5e9" weight={5} opacity={0.6} />
          <Polyline positions={routeData.geometry} color="#0284c7" weight={3} opacity={0.9} dashArray="8,6" />
        </>
      )}

      {routeData?.geometry && routeData.isTransit && (
        <Polyline positions={routeData.geometry} color="#7c3aed" weight={4} opacity={0.7} dashArray="12,8" />
      )}

      {routeData?.isTransit && routeData.stations?.filter(Boolean).map((st, i) => (
        <Marker key={`station-${i}`} position={[st.lat, st.lng]} icon={createStationIcon()}>
          <Popup>
            <div style={{ minWidth: '100px' }}>
              <p style={{ fontWeight: 600, fontSize: '13px', margin: '0 0 2px' }}>🚉 {st.name}</p>
              {st.operator && <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>{st.operator}</p>}
            </div>
          </Popup>
        </Marker>
      ))}

      {validStops.map((stop, i) => (
        <Marker
          key={stop.id}
          position={[stop.lat, stop.lng]}
          icon={createNumberedIcon(i + 1, getMarkerColor(i, validStops.length))}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const { lat, lng } = e.target.getLatLng();
              onMarkerDrag?.(stop.id, lat, lng);
            },
          }}
        >
          <Popup>
            <div style={{ minWidth: '120px' }}>
              <p style={{ fontWeight: 600, fontSize: '14px', margin: '0 0 4px' }}>
                {stop.name?.split(',')[0] || `地点 ${i + 1}`}
              </p>
              {stop.memo && (
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{stop.memo}</p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {spots.map(spot => (
        <Marker
          key={`spot-${spot.id}`}
          position={[spot.lat, spot.lng]}
          icon={createSpotIcon(SPOT_EMOJIS[spot.type] || '📍')}
        >
          <Popup>
            <div style={{ minWidth: '100px' }}>
              <p style={{ fontWeight: 600, fontSize: '13px', margin: '0 0 4px' }}>{spot.name}</p>
              <button
                onClick={() => onAddSpot?.(spot)}
                style={{
                  background: '#0ea5e9',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                経由地に追加
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
