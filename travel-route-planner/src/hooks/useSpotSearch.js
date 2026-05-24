import { useState, useRef } from 'react';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const CATEGORIES = {
  tourism: { label: '観光地', icon: '🏯', tag: '"tourism"~"attraction|museum|artwork|viewpoint"' },
  food: { label: 'グルメ', icon: '🍜', tag: '"amenity"~"restaurant|cafe|fast_food"' },
  hotel: { label: '宿泊', icon: '🏨', tag: '"tourism"~"hotel|hostel|guest_house"' },
  temple: { label: '神社仏閣', icon: '⛩️', tag: '"amenity"="place_of_worship"' },
  nature: { label: '自然', icon: '🌿', tag: '"natural"~"peak|water|beach|hot_spring"' },
  onsen: { label: '温泉', icon: '♨️', tag: '"leisure"="hot_spring"' },
};

export { CATEGORIES };

export function useSpotSearch() {
  const [spots, setSpots] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef(null);

  async function searchSpots(lat, lng, category, radius = 5000) {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    try {
      const cat = CATEGORIES[category];
      if (!cat) return;

      const query = `
        [out:json][timeout:10];
        (
          node[${cat.tag}](around:${radius},${lat},${lng});
        );
        out body 15;
      `;

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

  return { spots, isLoading, searchSpots, clearSpots };
}
