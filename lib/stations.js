import { ref, push, set, onValue, remove } from "firebase/database";
import { rtdb } from "./firebase";
import { haversineMeters } from "./geo";

/*
  Stations are fixed pickup/dropoff points the admin designates (usually
  matching the start/end of a trained route). Booking always resolves to the
  nearest station rather than an arbitrary point - this is what lets the robot
  navigate reliably (it only ever needs to reach a handful of known, trained
  locations, not anywhere someone clicks on a map).

  stations/{stationId} = { name, lat, lon, createdAt }
*/

export function createStation(name, lat, lon) {
  const newRef = push(ref(rtdb, "stations"));
  return set(newRef, { name, lat, lon, createdAt: Date.now() }).then(() => newRef.key);
}

export function deleteStation(stationId) {
  return remove(ref(rtdb, `stations/${stationId}`));
}

export function watchAllStations(callback) {
  return onValue(ref(rtdb, "stations"), (snap) => {
    const list = [];
    snap.forEach((child) => list.push({ id: child.key, ...child.val() }));
    callback(list);
  });
}

/** Returns stations sorted by distance from a point, nearest first, with a
 *  `distanceMeters` field added to each. */
export function nearestStations(stations, lat, lon, withinMeters = null) {
  const withDistance = stations.map((s) => ({
    ...s,
    distanceMeters: haversineMeters(lat, lon, s.lat, s.lon),
  }));
  withDistance.sort((a, b) => a.distanceMeters - b.distanceMeters);
  if (withinMeters) return withDistance.filter((s) => s.distanceMeters <= withinMeters);
  return withDistance;
}
