import { useState, useEffect, useRef } from 'react';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

function parsePlace(item) {
  const addr = item.address || {};
  const type = item.type || '';
  const category = item.class || '';

  let icon = '📍';
  if (type === 'station' || type === 'halt') icon = '🚉';
  else if (category === 'tourism' || type === 'attraction') icon = '🏯';
  else if (type === 'city' || type === 'town' || type === 'village') icon = '🏘️';
  else if (category === 'amenity') icon = '🏢';
  else if (type === 'airport') icon = '✈️';
  else if (category === 'natural') icon = '🌿';

  const mainName = addr.tourism || addr.station || addr.amenity || addr.building || item.name || '';
  const area = [addr.city, addr.town, addr.village, addr.county].filter(Boolean)[0] || '';
  const prefecture = addr.state || addr.province || '';

  let shortName = mainName;
  if (!shortName) {
    const parts = item.display_name.split(',');
    shortName = parts[0].trim();
  }

  let subtitle = [area, prefecture].filter(Boolean).join(', ');
  if (!subtitle) {
    const parts = item.display_name.split(',');
    subtitle = parts.slice(1, 3).map(s => s.trim()).join(', ');
  }

  return {
    name: item.display_name,
    shortName,
    subtitle,
    icon,
    type,
    category,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  };
}

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
          limit: '8',
          'accept-language': 'ja',
          countrycodes: 'jp',
        });
        const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
          headers: { 'User-Agent': 'TravelRoutePlanner/1.0' },
        });
        lastRequestTime.current = Date.now();
        const data = await res.json();
        setResults(data.map(parsePlace));
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
      addressdetails: '1',
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
