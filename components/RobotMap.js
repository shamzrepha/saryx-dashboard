import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Default marker icon fix for Next.js/webpack bundling
const robotIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function RobotMap({ position }) {
  const hasFix = position?.lat && position?.lon;
  const center = hasFix ? [position.lat, position.lon] : [0, 0];

  return (
    <div style={{ borderRadius: 8, overflow: "hidden" }}>
      <MapContainer center={center} zoom={hasFix ? 18 : 2} style={{ height: 320, width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {hasFix && (
          <Marker position={center} icon={robotIcon}>
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
