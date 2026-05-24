import { useState, useEffect, useRef } from 'react';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

export function useGeocoding(query) {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const lastRequestTime = useRef(0);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      const now = Date.now();
      const elapsed = now - lastRequestTime.current;
      if (elapsed < 1000) {
        await new Promise(r => setTimeout(r, 1000 - elapsed));
      }

      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          q: query,
          format: 'json',
          addressdetails: '1',
          limit: '5',
          'accept-language': 'ja',
          countrycodes: 'jp',
        });
        const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
          headers: { 'User-Agent': 'TravelRoutePlanner/1.0' },
        });
        lastRequestTime.current = Date.now();
        const data = await res.json();
        setResults(
          data.map(item => ({
            name: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          }))
        );
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  return { results, isLoading };
}

export async function reverseGeocode(lat, lng) {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'json',
      'accept-language': 'ja',
    });
    const res = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
      headers: { 'User-Agent': 'TravelRoutePlanner/1.0' },
    });
    const data = await res.json();
    return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}
