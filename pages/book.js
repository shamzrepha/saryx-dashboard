import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { createOrder, markLoaded, watchOrder, watchAllRoutes } from "../lib/orders";

const RobotMap = dynamic(() => import("../components/RobotMap"), { ssr: false });

const STATUS_LABELS = {
  pending: "Finding the nearest route to your pickup point...",
  unmatched: "No trained route nearby yet - an operator needs to map this area first.",
  heading_to_pickup: "Robot is on its way to you...",
  arrived_pickup: "Robot has arrived! Load your parcel, then confirm below.",
  loaded: "Confirmed - robot is heading to the dropoff location...",
  heading_to_dropoff: "On the way to the recipient...",
  arrived_dropoff: "Arrived at dropoff - waiting for the recipient to enter the code.",
  delivered: "Delivered! Thanks for using SARYX.",
};

export default function Book() {
  const [step, setStep] = useState("pickup"); // "pickup" | "dropoff" | "tracking"
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [order, setOrder] = useState(null);
  const [routes, setRoutes] = useState([]);

  useEffect(() => {
    const unsub = watchAllRoutes(setRoutes);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!orderId) return;
    const unsub = watchOrder(orderId, setOrder);
    return () => unsub();
  }, [orderId]);

  const handleMapClick = (lat, lon) => {
    if (step === "pickup") setPickup({ lat, lon });
    else if (step === "dropoff") setDropoff({ lat, lon });
  };

  const useMyLocationForPickup = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setPickup({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => alert("Couldn't get your location: " + err.message)
    );
  };

  const confirmPickup = () => {
    if (!pickup) return alert("Set a pickup point first - click the map or use your location.");
    setStep("dropoff");
  };

  const confirmDropoffAndBook = async () => {
    if (!dropoff) return alert("Set a dropoff point first - click the map.");
    const id = await createOrder(pickup.lat, pickup.lon, dropoff.lat, dropoff.lon);
    setOrderId(id);
    setStep("tracking");
  };

  const confirmLoaded = () => markLoaded(orderId);

  return (
    <div style={{ fontFamily: "sans-serif", background: "#111", color: "#eee", minHeight: "100vh", padding: 16 }}>
      <h1>Book a Delivery</h1>

      {step === "pickup" && (
        <div>
          <p>Click the map to set your <b>pickup</b> point, or use your current location.</p>
          <button onClick={useMyLocationForPickup} style={{ padding: "8px 14px", marginBottom: 12 }}>
            Use my current location
          </button>
          <RobotMap routes={routes} pickupMarker={pickup} onMapClick={handleMapClick} follow={false} />
          <button onClick={confirmPickup} style={{ marginTop: 12, padding: "10px 20px", background: "#2E7D32", color: "#fff", border: "none", borderRadius: 6 }}>
            Confirm Pickup →
          </button>
        </div>
      )}

      {step === "dropoff" && (
        <div>
          <p>Now click the map to set the <b>dropoff</b> point for the recipient.</p>
          <RobotMap routes={routes} pickupMarker={pickup} dropoffMarker={dropoff} onMapClick={handleMapClick} follow={false} />
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
