import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

function createNumberedIcon(number, color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background: ${color};
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 600;
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    ">${number}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

function getMarkerColor(index, total) {
  if (index === 0) return '#10b981';
  if (index === total - 1) return '#f43f5e';
  return '#0ea5e9';
}

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

export default function MapView({ stops, routeData, onMapClick }) {
  const validStops = stops.filter(s => s.lat && s.lng);

  return (
    <MapContainer
      center={[36.5, 138.0]}
      zoom={6}
      className="w-full h-full rounded-xl"
      style={{ minHeight: '400px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds stops={stops} />
      <MapClickHandler onClick={onMapClick} />

      {validStops.map((stop, i) => (
        <Marker
          key={stop.id}
          position={[stop.lat, stop.lng]}
          icon={createNumberedIcon(i + 1, getMarkerColor(i, validStops.length))}
        >
          <Popup>
            <div className="text-sm">
              <strong>{stop.name?.split(',')[0] || `地点 ${i + 1}`}</strong>
              {stop.memo && <p className="mt-1 text-gray-600">{stop.memo}</p>}
            </div>
          </Popup>
        </Marker>
      ))}

      {routeData?.geometry && (
        <Polyline positions={routeData.geometry} color="#0ea5e9" weight={4} opacity={0.7} />
      )}
    </MapContainer>
  );
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
