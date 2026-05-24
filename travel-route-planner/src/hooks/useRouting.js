import { useState, useEffect, useRef } from 'react';

const OSRM_BASE = 'https://router.project-osrm.org';

export function useRouting(stops) {
  const [routeData, setRouteData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef(null);

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
      `${OSRM_BASE}/route/v1/driving/${coordStr}?overview=full&geometries=geojson&steps=false`,
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
  }, [stops.map(s => `${s.lat},${s.lng}`).join('|')]);

  return { routeData, isLoading };
}
