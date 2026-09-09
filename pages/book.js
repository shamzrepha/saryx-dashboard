import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { createOrder, markLoaded, watchOrder, watchAllRoutes } from "../lib/orders";
import { watchAllStations, nearestStations } from "../lib/stations";
import { searchFutoAddress, FUTO_CENTER } from "../lib/geo";

const RobotMap = dynamic(() => import("../components/RobotMap"), { ssr: false });

const STATUS_LABELS = {
  pending: "Finding the nearest route to your pickup station...",
  unmatched: "No trained route nearby yet - an operator needs to map this area first.",
  heading_to_pickup: "Robot is on its way to the pickup station...",
  arrived_pickup: "Robot has arrived! Load your parcel, then confirm below.",
  loaded: "Confirmed - robot is heading to the dropoff station...",
  heading_to_dropoff: "On the way to the dropoff station...",
  arrived_dropoff: "Arrived - waiting for the recipient to enter the code.",
  delivered: "Delivered! Thanks for using SARYX.",
};

export default function Book() {
  const [step, setStep] = useState("pickup"); // "pickup" | "dropoff" | "tracking"
  const [userLocation, setUserLocation] = useState(null);
  const [stations, setStations] = useState([]);
  const [nearbyPickupStations, setNearbyPickupStations] = useState([]);
  const [pickupStation, setPickupStation] = useState(null);

  const [destQuery, setDestQuery] = useState("");
  const [destResults, setDestResults] = useState([]);
  const [dropoffStation, setDropoffStation] = useState(null);

  const [orderId, setOrderId] = useState(null);
  const [order, setOrder] = useState(null);
  const [routes, setRoutes] = useState([]);

  useEffect(() => {
    const unsub = watchAllRoutes(setRoutes);
    const unsubStations = watchAllStations(setStations);
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setUserLocation(FUTO_CENTER) // fall back to campus center if denied
    );
    return () => { unsub(); unsubStations(); };
  }, []);

  useEffect(() => {
    if (userLocation && stations.length) {
      // "scan a reasonable radius" - 2km around the user, falling back to
      // nearest overall if nothing is that close
      const withinRadius = nearestStations(stations, userLocation.lat, userLocation.lon, 2000);
      setNearbyPickupStations(withinRadius.length ? withinRadius : nearestStations(stations, userLocation.lat, userLocation.lon).slice(0, 3));
    }
  }, [userLocation, stations]);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (destQuery.trim().length >= 3) {
        const results = await searchFutoAddress(destQuery);
        setDestResults(results);
      } else {
        setDestResults([]);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [destQuery]);

  useEffect(() => {
    if (!orderId) return;
    const unsub = watchOrder(orderId, setOrder);
    return () => unsub();
  }, [orderId]);

  const pickDestinationResult = (result) => {
    if (!stations.length) return;
    const nearest = nearestStations(stations, result.lat, result.lon)[0];
    setDropoffStation(nearest);
    setDestQuery(result.label);
    setDestResults([]);
  };

  const confirmPickup = () => {
    if (!pickupStation) return alert("Choose a pickup station first.");
    setStep("dropoff");
  };

  const confirmDropoffAndBook = async () => {
    if (!dropoffStation) return alert("Search for a destination and pick a result first.");
    const id = await createOrder(pickupStation.lat, pickupStation.lon, dropoffStation.lat, dropoffStation.lon);
    setOrderId(id);
    setStep("tracking");
  };

  const confirmLoaded = () => markLoaded(orderId);

  const trackingLink = orderId ? `${typeof window !== "undefined" ? window.location.origin : ""}/receive?order=${orderId}` : "";
  const whatsappShareUrl = order?.code
    ? `https://wa.me/?text=${encodeURIComponent(
        `You have a SARYX delivery inbound! Track it here: ${trackingLink}\nWhen the robot arrives, enter this code to open the cart: ${order.code}`
      )}`
    : null;

  return (
    <div style={{ fontFamily: "sans-serif", background: "#111", color: "#eee", minHeight: "100vh", padding: 16 }}>
      <h1>Book a Ride</h1>

      {step === "pickup" && (
        <div>
          <p>Nearest pickup stations to you:</p>
          {!userLocation && <p style={{ opacity: 0.6 }}>Getting your location...</p>}
          {userLocation && nearbyPickupStations.length === 0 && (
            <p style={{ opacity: 0.6 }}>No stations set up yet - check back once the admin has mapped some routes.</p>
          )}
          <div style={{ marginBottom: 12 }}>
            {nearbyPickupStations.map((s) => (
              <button key={s.id} onClick={() => setPickupStation(s)}
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "10px 14px", marginBottom: 6,
                  background: pickupStation?.id === s.id ? "#2E7D32" : "#222", color: "#fff", border: "1px solid #444", borderRadius: 6
                }}>
                {s.name} — {(s.distanceMeters / 1000).toFixed(2)} km away
              </button>
            ))}
          </div>
          {userLocation && (
            <RobotMap
              position={{ lat: userLocation.lat, lon: userLocation.lon }}
              routes={routes}
              pendingPoints={stations.map((s) => ({ lat: s.lat, lon: s.lon, label: s.name }))}
              pickupMarker={pickupStation}
              follow={false}
            />
          )}
          <button onClick={confirmPickup} style={{ marginTop: 12, padding: "10px 20px", background: "#2E7D32", color: "#fff", border: "none", borderRadius: 6 }}>
            Confirm Pickup Station →
          </button>
        </div>
      )}

      {step === "dropoff" && (
        <div>
          <p>Where are you delivering to? Search an address on campus:</p>
          <input
            value={destQuery}
            onChange={(e) => setDestQuery(e.target.value)}
            placeholder="e.g. School of Engineering, Hostel Block C..."
            style={{ padding: 10, fontSize: 16, width: "100%", maxWidth: 400, marginBottom: 8 }}
          />
          {destResults.length > 0 && (
            <div style={{ background: "#222", borderRadius: 6, marginBottom: 12 }}>
              {destResults.map((r, i) => (
                <div key={i} onClick={() => pickDestinationResult(r)}
                  style={{ padding: 10, cursor: "pointer", borderBottom: "1px solid #333" }}>
                  {r.label}
                </div>
              ))}
            </div>
          )}
          {dropoffStation && (
            <p style={{ color: "#4CAF50" }}>Nearest station to that address: <b>{dropoffStation.name}</b> ({(dropoffStation.distanceMeters / 1000).toFixed(2)} km from there)</p>
          )}
          <RobotMap
            routes={routes}
            pendingPoints={stations.map((s) => ({ lat: s.lat, lon: s.lon, label: s.name }))}
            pickupMarker={pickupStation}
            dropoffMarker={dropoffStation}
            follow={false}
          />
          <button onClick={confirmDropoffAndBook} style={{ marginTop: 12, padding: "10px 20px", background: "#2E7D32", color: "#fff", border: "none", borderRadius: 6 }}>
            Book Delivery →
          </button>
        </div>
      )}

      {step === "tracking" && order && (
        <div>
          <div style={{ padding: 12, background: "#222", borderRadius: 8, marginBottom: 16 }}>
            <p style={{ margin: 0, fontWeight: "bold" }}>Order ID: {orderId}</p>
            <p style={{ margin: "8px 0 0 0" }}>{STATUS_LABELS[order.status] || order.status}</p>
          </div>

          <RobotMap
            routes={routes}
            pickupMarker={{ lat: order.pickupLat, lon: order.pickupLon }}
            dropoffMarker={{ lat: order.dropoffLat, lon: order.dropoffLon }}
          />

          {order.status === "arrived_pickup" && (
            <button onClick={confirmLoaded} style={{ marginTop: 16, padding: "12px 24px", background: "#2E7D32", color: "#fff", border: "none", borderRadius: 6, fontSize: 16 }}>
              I've loaded the parcel - close the cart
            </button>
          )}

          {order.code && (
            <div style={{ marginTop: 16, padding: 16, background: "#1B5E20", borderRadius: 8 }}>
              <p style={{ margin: 0 }}>Delivery code (share this with the recipient):</p>
              <p style={{ margin: "8px 0 0 0", fontSize: 32, fontWeight: "bold", letterSpacing: 4 }}>{order.code}</p>
              {whatsappShareUrl && (
                <a href={whatsappShareUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-block", marginTop: 12, padding: "10px 20px", background: "#25D366", color: "#111", borderRadius: 6, fontWeight: "bold", textDecoration: "none" }}>
                  Send via WhatsApp
                </a>
              )}
            </div>
          )}

          {order.status === "delivered" && (
            <p style={{ marginTop: 16, color: "#4CAF50", fontWeight: "bold" }}>✓ Delivered successfully.</p>
          )}
        </div>
      )}
    </div>
  );
}
