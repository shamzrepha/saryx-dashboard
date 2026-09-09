/*
  Geography constants and helpers, scoped to FUTO (Federal University of
  Technology Owerri) campus and immediate surroundings - keeps address search
  and station lookups from wandering off-campus and overloading the free
  Nominatim geocoding service with irrelevant queries.

  Center: 5.384°N, 6.995°E (FUTO's published campus coordinates).
  Bounding box: roughly 3km radius around campus (covers Eziobodo/Ihiagwa too).
*/
export const FUTO_CENTER = { lat: 5.384, lon: 6.995 };
export const FUTO_BOUNDS = {
  minLat: 5.357, maxLat: 5.411,
  minLon: 6.968, maxLon: 7.022,
};

export function isWithinFutoBounds(lat, lon) {
  return lat >= FUTO_BOUNDS.minLat && lat <= FUTO_BOUNDS.maxLat &&
         lon >= FUTO_BOUNDS.minLon && lon <= FUTO_BOUNDS.maxLon;
}

export function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Searches addresses/places using OpenStreetMap's free Nominatim geocoder,
 * restricted to the FUTO bounding box (bounded=1 means results MUST fall
 * inside the box, not just be biased toward it).
 */
export async function searchFutoAddress(query) {
  if (!query || query.trim().length < 3) return [];
  const viewbox = `${FUTO_BOUNDS.minLon},${FUTO_BOUNDS.maxLat},${FUTO_BOUNDS.maxLon},${FUTO_BOUNDS.minLat}`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    query
  )}&viewbox=${viewbox}&bounded=1&limit=5`;

  try {
    const res = await fetch(url, {
      headers: { "Accept-Language": "en" }, // Nominatim usage policy: identify requests reasonably
    });
    const data = await res.json();
    return data.map((r) => ({
      label: r.display_name,
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
    }));
  } catch (e) {
    console.error("Address search failed:", e);
    return [];
  }
}

/** Rough ETA given a distance and the robot's assumed cruise speed.
 *  HONEST NOTE: this is an ESTIMATE using an assumed walking-pace speed since
 *  there's no wheel encoder yet to measure real speed - accuracy will improve
 *  once encoders are added. */
export function estimateEtaMinutes(distanceMeters, assumedSpeedMs = 1.0) {
  if (distanceMeters <= 0) return 0;
  return Math.ceil(distanceMeters / assumedSpeedMs / 60);
}
