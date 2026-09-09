import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const robotIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  iconSize: [25, 41], iconAnchor: [12, 41],
});
const greenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  iconSize: [25, 41], iconAnchor: [12, 41],
});
const orangeIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
  iconSize: [25, 41], iconAnchor: [12, 41],
});

function FollowRobot({ position, follow }) {
  const map = useMap();
  useEffect(() => {
    if (follow && position?.lat && position?.lon) {
      map.setView([position.lat, position.lon], 18, { animate: true });
    }
  }, [position?.lat, position?.lon, map, follow]);
  return null;
}

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (onMapClick) onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * General-purpose map used across the admin dashboard, booking page, and
 * tracking page.
 *
 * @param position       - live robot position {lat, lon}
 * @param trail          - array of [lat, lon] - the robot's actual recent path
 * @param routes         - array of {name, points: [[lat,lon], ...]} - ALL saved
 *                         routes, drawn in blue (the "coverage map")
 * @param pendingPoints  - array of {lat, lon, label} - unmatched/pending order
 *                         locations with no nearby trained route, drawn in red
 * @param pickupMarker   - optional {lat, lon} - shown in green (booking page)
 * @param dropoffMarker  - optional {lat, lon} - shown in orange (booking page)
 * @param onMapClick     - optional (lat, lon) => void - lets booking page set
 *                         pickup/dropoff by clicking the map
 * @param follow         - whether the map auto-centers on the robot's position
 */
export default function RobotMap({
  position, trail = [], routes = [], pendingPoints = [],
  pickupMarker, dropoffMarker, onMapClick, follow = true,
}) {
  const hasFix = position?.lat && position?.lon;
  const fallbackCenter = pickupMarker
    ? [pickupMarker.lat, pickupMarker.lon]
    : routes[0]?.points?.[0] || [0, 0];
  const initialCenter = hasFix ? [position.lat, position.lon] : fallbackCenter;

  return (
    <div style={{ borderRadius: 8, overflow: "hidden" }}>
      <MapContainer center={initialCenter} zoom={hasFix ? 18 : (routes.length ? 16 : 2)} style={{ height: 320, width: "100%" }}>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FollowRobot position={position} follow={follow} />
        {onMapClick && <ClickHandler onMapClick={onMapClick} />}

        {routes.map((r) => (
          <Polyline key={r.name} positions={r.points} pathOptions={{ color: "#2196F3", weight: 3, opacity: 0.7 }} />
        ))}

        {trail.length > 1 && (
          <Polyline positions={trail} pathOptions={{ color: "#4CAF50", weight: 4 }} />
        )}

        {pendingPoints.map((p, i) => (
          <Marker key={i} position={[p.lat, p.lon]} icon={orangeIcon}>
            <Popup>{p.label || "Unmatched order - needs a nearby trained route"}</Popup>
          </Marker>
        ))}

        {pickupMarker && (
          <Marker position={[pickupMarker.lat, pickupMarker.lon]} icon={greenIcon}>
            <Popup>Pickup</Popup>
          </Marker>
        )}
        {dropoffMarker && (
          <Marker position={[dropoffMarker.lat, dropoffMarker.lon]} icon={orangeIcon}>
            <Popup>Dropoff</Popup>
          </Marker>
        )}

        {hasFix && (
          <Marker position={[position.lat, position.lon]} icon={robotIcon}>
            <Popup>Robot is here</Popup>
          </Marker>
        )}
      </MapContainer>
      {!hasFix && !routes.length && (
        <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
          No GPS fix yet — robot may be indoors (relative tracking mode).
        </p>
      )}
    </div>
  );
}
