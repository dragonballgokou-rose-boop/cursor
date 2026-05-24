import { useState, useEffect, useRef } from 'react';

const OSRM_BASE = 'https://router.project-osrm.org';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const PROFILES = {
  driving: { label: '車', icon: '🚗' },
  transit: { label: '電車', icon: '🚆' },
  cycling: { label: '自転車', icon: '🚲' },
  foot: { label: '徒歩', icon: '🚶' },
};

export { PROFILES };

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function findNearestStation(lat, lng, signal) {
  const query = `[out:json][timeout:8];
    (
      node["railway"="station"]["name"](around:30000,${lat},${lng});
      node["railway"="halt"]["name"](around:30000,${lat},${lng});
    );
    out body 5;`;

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal,
  });
  const data = await res.json();

  if (!data.elements || data.elements.length === 0) return null;

  let best = null;
  let bestDist = Infinity;
  for (const el of data.elements) {
    if (!el.tags?.name) continue;
    const d = haversine(lat, lng, el.lat, el.lon);
    if (d < bestDist) {
      bestDist = d;
      best = {
        name: el.tags['name:ja'] || el.tags.name,
        lat: el.lat,
        lng: el.lon,
        distance: d,
        operator: el.tags.operator || '',
        line: el.tags['railway:line'] || el.tags.line || '',
      };
    }
  }
  return best;
}

function estimateTrainDuration(distKm) {
  if (distKm > 200) return (distKm / 220) * 3600 + 1800;
  if (distKm > 50) return (distKm / 80) * 3600 + 900;
  return (distKm / 40) * 3600 + 600;
}

function estimateTrainType(distKm) {
  if (distKm > 200) return '新幹線';
  if (distKm > 50) return '特急';
  return '在来線';
}

function buildGoogleMapsTransitUrl(stops) {
  const valid = stops.filter(s => s.lat && s.lng);
  if (valid.length < 2) return '';
  const origin = `${valid[0].lat},${valid[0].lng}`;
  const dest = `${valid[valid.length - 1].lat},${valid[valid.length - 1].lng}`;
  const waypoints = valid
    .slice(1, -1)
    .map(s => `${s.lat},${s.lng}`)
    .join('|');
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=transit`;
  if (waypoints) url += `&waypoints=${waypoints}`;
  return url;
}

function interpolateLine(lat1, lng1, lat2, lng2, steps = 30) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push([lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t]);
  }
  return points;
}

export { buildGoogleMapsTransitUrl };

export function useRouting(stops, profile = 'driving') {
  const [routeData, setRouteData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef(null);

  const stopsKey = stops.map(s => `${s.lat},${s.lng}`).join('|');

  useEffect(() => {
    const validStops = stops.filter(s => s.lat && s.lng);
    if (validStops.length < 2) {
      setRouteData(null);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);

    if (profile === 'transit') {
      calculateTransitRoute(validStops, controller.signal)
        .then(data => {
          if (!controller.signal.aborted) setRouteData(data);
        })
        .catch(err => {
          if (err.name !== 'AbortError') setRouteData(null);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    } else {
      const coordStr = validStops.map(s => `${s.lng},${s.lat}`).join(';');
      fetch(
        `${OSRM_BASE}/route/v1/${profile}/${coordStr}?overview=full&geometries=geojson&steps=false`,
        { signal: controller.signal }
      )
        .then(res => res.json())
        .then(data => {
          if (data.code !== 'Ok') {
            setRouteData(null);
            return;
          }
          const route = data.routes[0];
          const legs = route.legs.map((leg, i) => ({
            from: validStops[i].id,
            to: validStops[i + 1].id,
            distance: leg.distance,
            duration: leg.duration,
          }));
          setRouteData({
            totalDistance: route.distance,
            totalDuration: route.duration,
            legs,
            geometry: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
          });
        })
        .catch(err => {
          if (err.name !== 'AbortError') setRouteData(null);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }

    return () => controller.abort();
  }, [stopsKey, profile]);

  return { routeData, isLoading };
}

async function calculateTransitRoute(validStops, signal) {
  const stations = [];
  for (const stop of validStops) {
    const station = await findNearestStation(stop.lat, stop.lng, signal);
    stations.push(station);
    await new Promise(r => setTimeout(r, 200));
  }

  const legs = [];
  const geometryParts = [];
  let totalDistance = 0;
  let totalDuration = 0;

  for (let i = 0; i < validStops.length - 1; i++) {
    const fromStation = stations[i];
    const toStation = stations[i + 1];

    const fromLat = fromStation?.lat || validStops[i].lat;
    const fromLng = fromStation?.lng || validStops[i].lng;
    const toLat = toStation?.lat || validStops[i + 1].lat;
    const toLng = toStation?.lng || validStops[i + 1].lng;

    const dist = haversine(fromLat, fromLng, toLat, toLng) * 1000;
    const distKm = dist / 1000;
    const duration = estimateTrainDuration(distKm);

    legs.push({
      from: validStops[i].id,
      to: validStops[i + 1].id,
      distance: dist,
      duration,
      fromStation: fromStation?.name || '最寄り駅なし',
      toStation: toStation?.name || '最寄り駅なし',
      trainType: estimateTrainType(distKm),
      fromStationDist: fromStation?.distance || 0,
      toStationDist: toStation?.distance || 0,
    });

    geometryParts.push(...interpolateLine(fromLat, fromLng, toLat, toLng));
    totalDistance += dist;
    totalDuration += duration;
  }

  return {
    totalDistance,
    totalDuration,
    legs,
    geometry: geometryParts,
    stations,
    isTransit: true,
    googleMapsUrl: buildGoogleMapsTransitUrl(validStops),
  };
}
