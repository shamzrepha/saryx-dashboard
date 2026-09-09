import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { ref, onValue } from "firebase/database";
import { rtdb } from "../lib/firebase";
import { watchOrder, submitDeliveryCode, watchAllRoutes } from "../lib/orders";
import { haversineMeters, estimateEtaMinutes } from "../lib/geo";

const RobotMap = dynamic(() => import("../components/RobotMap"), { ssr: false });

const STATUS_LABELS = {
  pending: "Order received - matching to a route...",
  unmatched: "No trained route nearby yet.",
  heading_to_pickup: "Robot is heading to the pickup station.",
  arrived_pickup: "Parcel pickup in progress.",
  loaded: "Parcel loaded - robot is on its way to the dropoff station!",
  heading_to_dropoff: "Robot is on its way to the dropoff station!",
  arrived_dropoff: "Robot has arrived! Enter your delivery code below to open the cart.",
  delivered: "Delivered - thanks for using SARYX.",
};

// Which coordinate the ETA/distance should measure toward, based on order status
function targetForStatus(order) {
  if (!order) return null;
  if (order.status === "heading_to_pickup" || order.status === "pending" || order.status === "arrived_pickup") {
    return { lat: order.pickupLat, lon: order.pickupLon, label: "pickup station" };
  }
  return { lat: order.dropoffLat, lon: order.dropoffLon, label: "dropoff station" };
}

export default function Receive() {
  const router = useRouter();
  const [orderIdInput, setOrderIdInput] = useState("");
  const [orderId, setOrderId] = useState(null);
  const [order, setOrder] = useState(null);
  const [robotPosition, setRobotPosition] = useState(null);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [routes, setRoutes] = useState([]);

  useEffect(() => {
    if (router.query.order) {
      setOrderId(router.query.order);
      setOrderIdInput(router.query.order);
    }
  }, [router.query.order]);

  useEffect(() => {
    const unsub = watchAllRoutes(setRoutes);
    const unsubPos = onValue(ref(rtdb, "robot/position"), (snap) => setRobotPosition(snap.val()));
    return () => { unsub(); unsubPos(); };
  }, []);

  useEffect(() => {
    if (!orderId) return;
    const unsub = watchOrder(orderId, setOrder);
    return () => unsub();
  }, [orderId]);

  const lookUpOrder = () => {
    if (!orderIdInput.trim()) return;
    setOrderId(orderIdInput.trim());
  };

  const handleCodeSubmit = async () => {
    // FIX applied here: previously this page had no live ETA/distance and no
    // clear guard against submitting an empty code - both addressed below.
    if (!codeInput.trim()) { setCodeError(true); return; }
    const ok = await submitDeliveryCode(orderId, codeInput);
    setCodeError(!ok);
  };

  const target = targetForStatus(order);
  const hasLiveTracking = robotPosition?.lat && robotPosition?.lon && target?.lat && target?.lon;
  const distanceMeters = hasLiveTracking ? haversineMeters(robotPosition.lat, robotPosition.lon, target.lat, target.lon) : null;
  const etaMinutes = distanceMeters != null ? estimateEtaMinutes(distanceMeters) : null;

  return (
    <div style={{ fontFamily: "sans-serif", background: "#111", color: "#eee", minHeight: "100vh", padding: 16 }}>
      <h1>Track Your Delivery</h1>

      {!orderId && (
        <div>
          <p>Enter the Order ID the sender shared with you (or use the link they sent).</p>
          <input
            value={orderIdInput}
            onChange={(e) => setOrderIdInput(e.target.value)}
            placeholder="Order ID"
            style={{ padding: 10, fontSize: 16, width: 250, marginRight: 8 }}
          />
          <button onClick={lookUpOrder} style={{ padding: "10px 16px" }}>Track</button>
        </div>
      )}

      {orderId && order && (
        <div>
          <div style={{ padding: 12, background: "#222", borderRadius: 8, marginBottom: 16 }}>
            <p style={{ margin: 0, fontWeight: "bold" }}>Order ID: {orderId}</p>
            <p style={{ margin: "8px 0 0 0" }}>{STATUS_LABELS[order.status] || order.status}</p>
            {hasLiveTracking && (
              <p style={{ margin: "8px 0 0 0", color: "#64B5F6" }}>
                {(distanceMeters / 1000).toFixed(2)} km from the {target.label} — est. {etaMinutes} min
                <span style={{ fontSize: 11, opacity: 0.6 }}> (rough estimate, improves once wheel encoders are added)</span>
              </p>
            )}
          </div>

          <RobotMap
            position={robotPosition}
            routes={routes}
            pickupMarker={{ lat: order.pickupLat, lon: order.pickupLon }}
            dropoffMarker={{ lat: order.dropoffLat, lon: order.dropoffLon }}
          />

          {(order.status === "arrived_dropoff" || order.status === "heading_to_dropoff") && !order.verified && (
            <div style={{ marginTop: 16 }}>
              <p>Enter the delivery code the sender gave you:</p>
              <input
                value={codeInput}
                onChange={(e) => { setCodeInput(e.target.value); setCodeError(false); }}
                placeholder="6-digit code"
                style={{ padding: 10, fontSize: 20, width: 160, marginRight: 8, letterSpacing: 2 }}
                maxLength={6}
              />
              <button onClick={handleCodeSubmit} style={{ padding: "10px 20px", background: "#2E7D32", color: "#fff", border: "none", borderRadius: 6 }}>
                Unlock Cart
              </button>
              {codeError && <p style={{ color: "#EF5350", marginTop: 8 }}>That code doesn't match - check with the sender and try again.</p>}
            </div>
          )}

          {order.status === "delivered" && (
            <p style={{ marginTop: 16, color: "#4CAF50", fontWeight: "bold", fontSize: 18 }}>
              ✓ Cart unlocked - your parcel is ready to collect!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
