import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const robotIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function FollowRobot({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position?.lat && position?.lon) {
      map.setView([position.lat, position.lon], 18, { animate: true });
    }
  }, [position?.lat, position?.lon, map]);
  return null;
}

/**
 * @param position - current live position {lat, lon}
 * @param trail - array of [lat, lon] pairs showing where the robot has been,
 *                drawn as a line so you can see the actual mapped/driven path
 */
export default function RobotMap({ position, trail = [] }) {
  const hasFix = position?.lat && position?.lon;
  const initialCenter = hasFix ? [position.lat, position.lon] : [0, 0];

  return (
    <div style={{ borderRadius: 8, overflow: "hidden" }}>
      <MapContainer center={initialCenter} zoom={hasFix ? 18 : 2} style={{ height: 320, width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FollowRobot position={position} />
        {trail.length > 1 && (
          <Polyline positions={trail} pathOptions={{ color: "#4CAF50", weight: 3 }} />
        )}
        {hasFix && (
          <Marker position={[position.lat, position.lon]} icon={robotIcon}>
            <Popup>Robot is here</Popup>
          </Marker>
        )}
      </MapContainer>
      {!hasFix && (
        <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
          No GPS fix yet — robot may be indoors (relative tracking mode).
        </p>
      )}
    </div>
  );
}
