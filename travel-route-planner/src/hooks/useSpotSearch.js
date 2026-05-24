import { useState, useRef } from 'react';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const CATEGORIES = {
  onsen: {
    label: '温泉',
    icon: '♨️',
  },
  tourism: {
    label: '観光地',
    icon: '🏯',
  },
  food: {
    label: 'グルメ',
    icon: '🍜',
  },
  temple: {
    label: '神社仏閣',
    icon: '⛩️',
  },
  nature: {
    label: '自然',
    icon: '🌿',
  },
  hotel: {
    label: '宿泊',
    icon: '🏨',
  },
};

export { CATEGORIES };

function buildQuery(catKey, lat, lng, radius) {
  const r = radius;
  const queries = {
    onsen: `node["natural"="hot_spring"](around:${r},${lat},${lng});node["leisure"="hot_spring"](around:${r},${lat},${lng});node["bath:type"](around:${r},${lat},${lng});node["name"~"温泉"]["tourism"](around:${r},${lat},${lng});`,
    tourism: `node["tourism"~"attraction|museum|viewpoint|theme_park"](around:${r},${lat},${lng});`,
    food: `node["amenity"~"restaurant|cafe"]["name"]["cuisine"](around:${r},${lat},${lng});`,
    temple: `node["amenity"="place_of_worship"](around:${r},${lat},${lng});`,
    nature: `node["natural"~"peak|beach|waterfall"](around:${r},${lat},${lng});`,
    hotel: `node["tourism"~"hotel|guest_house|ryokan"]["name"](around:${r},${lat},${lng});`,
  };
  return queries[catKey] || '';
}

function samplePointsAlongRoute(geometry, intervalKm = 40) {
  if (!geometry || geometry.length < 2) return [];
  const points = [];
  let accDist = 0;
  let lastSampled = 0;
  points.push(geometry[0]);

  for (let i = 1; i < geometry.length; i++) {
    const d = haversine(geometry[i - 1][0], geometry[i - 1][1], geometry[i][0], geometry[i][1]);
    accDist += d;
    if (accDist - lastSampled >= intervalKm) {
      points.push(geometry[i]);
      lastSampled = accDist;
    }
  }
  points.push(geometry[geometry.length - 1]);

  const seen = new Set();
  return points.filter(([lat, lng]) => {
    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceFromRoute(spotLat, spotLng, geometry) {
  let minDist = Infinity;
  for (let i = 0; i < geometry.length; i += 5) {
    const d = haversine(spotLat, spotLng, geometry[i][0], geometry[i][1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

function guessArea(lat, lng) {
  const areas = [
    { name: '北海道', lat: 43.0, lng: 141.3, r: 300 },
    { name: '青森', lat: 40.8, lng: 140.7, r: 80 },
    { name: '岩手', lat: 39.7, lng: 141.1, r: 80 },
    { name: '宮城', lat: 38.3, lng: 140.9, r: 70 },
    { name: '秋田', lat: 39.7, lng: 140.1, r: 70 },
    { name: '山形', lat: 38.2, lng: 140.0, r: 70 },
    { name: '福島', lat: 37.4, lng: 140.0, r: 80 },
    { name: '栃木', lat: 36.6, lng: 139.9, r: 60 },
    { name: '群馬', lat: 36.4, lng: 139.1, r: 60 },
    { name: '埼玉', lat: 35.9, lng: 139.6, r: 40 },
    { name: '東京', lat: 35.68, lng: 139.77, r: 30 },
    { name: '神奈川', lat: 35.45, lng: 139.6, r: 35 },
    { name: '千葉', lat: 35.6, lng: 140.1, r: 50 },
    { name: '新潟', lat: 37.9, lng: 139.0, r: 80 },
    { name: '長野', lat: 36.2, lng: 138.2, r: 70 },
    { name: '山梨', lat: 35.7, lng: 138.6, r: 40 },
    { name: '静岡', lat: 34.97, lng: 138.4, r: 70 },
    { name: '愛知', lat: 35.18, lng: 136.9, r: 50 },
    { name: '岐阜', lat: 35.4, lng: 136.7, r: 60 },
    { name: '三重', lat: 34.7, lng: 136.5, r: 60 },
    { name: '滋賀', lat: 35.0, lng: 136.0, r: 40 },
    { name: '京都', lat: 35.01, lng: 135.77, r: 40 },
    { name: '大阪', lat: 34.69, lng: 135.5, r: 35 },
    { name: '兵庫', lat: 34.7, lng: 135.2, r: 60 },
    { name: '奈良', lat: 34.4, lng: 135.8, r: 40 },
    { name: '和歌山', lat: 33.9, lng: 135.5, r: 50 },
    { name: '岡山', lat: 34.7, lng: 133.9, r: 60 },
    { name: '広島', lat: 34.4, lng: 132.5, r: 60 },
    { name: '山口', lat: 34.2, lng: 131.5, r: 60 },
    { name: '香川', lat: 34.3, lng: 134.0, r: 40 },
    { name: '愛媛', lat: 33.8, lng: 132.8, r: 60 },
    { name: '福岡', lat: 33.6, lng: 130.4, r: 50 },
    { name: '大分', lat: 33.2, lng: 131.6, r: 60 },
    { name: '熊本', lat: 32.8, lng: 130.7, r: 60 },
    { name: '鹿児島', lat: 31.6, lng: 130.6, r: 80 },
    { name: '沖縄', lat: 26.3, lng: 127.8, r: 150 },
  ];
  let best = 'その他';
  let bestDist = Infinity;
  for (const a of areas) {
    const d = haversine(lat, lng, a.lat, a.lng);
    if (d < a.r && d < bestDist) {
      best = a.name;
      bestDist = d;
    }
  }
  return best;
}

export function useSpotSearch() {
  const [spots, setSpots] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef(null);

  async function searchAlongRoute(geometry, categories = ['onsen', 'tourism', 'food']) {
    if (!geometry || geometry.length < 2) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setSpots([]);
    try {
      const samplePoints = samplePointsAlongRoute(geometry, 35);
      const radius = 15000;
      const allSpots = [];

      for (const [lat, lng] of samplePoints) {
        if (controller.signal.aborted) break;

        for (const catKey of categories) {
          if (controller.signal.aborted) break;
          const queryBody = buildQuery(catKey, lat, lng, radius);
          if (!queryBody) continue;

          try {
            const query = `[out:json][timeout:8];(${queryBody});out body 10;`;
            const res = await fetch(OVERPASS_URL, {
              method: 'POST',
              body: `data=${encodeURIComponent(query)}`,
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              signal: controller.signal,
            });
            const data = await res.json();

            for (const el of data.elements) {
              if (!el.tags || (!el.tags.name && !el.tags['name:ja'])) continue;
              allSpots.push({
                id: el.id,
                name: el.tags['name:ja'] || el.tags.name,
                lat: el.lat,
                lng: el.lon,
                type: catKey,
                area: guessArea(el.lat, el.lon),
                distFromRoute: distanceFromRoute(el.lat, el.lon, geometry),
              });
            }
          } catch (err) {
            if (err.name === 'AbortError') throw err;
          }
          await new Promise(r => setTimeout(r, 200));
        }

        // Show partial results as they come in
        const seen = new Set();
        const partial = allSpots.filter(s => {
          const key = `${s.name}-${s.lat.toFixed(3)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        partial.sort((a, b) => a.distFromRoute - b.distFromRoute);
        setSpots([...partial.slice(0, 60)]);
      }
    } catch (err) {
      if (err.name !== 'AbortError') setSpots([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function searchSpots(lat, lng, category, radius = 10000) {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    try {
      const queryBody = buildQuery(category, lat, lng, radius);
      if (!queryBody) return;

      const query = `[out:json][timeout:10];(${queryBody});out body 20;`;

      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: controller.signal,
      });
      const data = await res.json();

      setSpots(
        data.elements
          .filter(el => el.tags && (el.tags.name || el.tags['name:ja']))
          .map(el => ({
            id: el.id,
            name: el.tags['name:ja'] || el.tags.name,
            lat: el.lat,
            lng: el.lon,
            type: category,
            area: guessArea(el.lat, el.lon),
            distFromRoute: 0,
          }))
      );
    } catch (err) {
      if (err.name !== 'AbortError') setSpots([]);
    } finally {
      setIsLoading(false);
    }
  }

  function clearSpots() {
    setSpots([]);
  }

  return { spots, isLoading, searchSpots, searchAlongRoute, clearSpots };
}
