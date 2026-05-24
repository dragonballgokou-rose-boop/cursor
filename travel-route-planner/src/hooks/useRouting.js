import { useState, useEffect, useRef } from 'react';

const OSRM_BASE = 'https://router.project-osrm.org';

const PROFILES = {
  driving: { label: '車', icon: '🚗', key: 'driving' },
  cycling: { label: '自転車', icon: '🚲', key: 'bike' },
  foot: { label: '徒歩', icon: '🚶', key: 'foot' },
};

export { PROFILES };

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

    const coordStr = validStops.map(s => `${s.lng},${s.lat}`).join(';');

    setIsLoading(true);
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
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [stopsKey, profile]);

  return { routeData, isLoading };
}
