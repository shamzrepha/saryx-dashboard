import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { watchOrder, submitDeliveryCode, watchAllRoutes } from "../lib/orders";

const RobotMap = dynamic(() => import("../components/RobotMap"), { ssr: false });

const STATUS_LABELS = {
  pending: "Order received - matching to a route...",
  unmatched: "No trained route nearby yet.",
  heading_to_pickup: "Robot is heading to pick up your parcel.",
  arrived_pickup: "Parcel pickup in progress.",
  loaded: "Parcel loaded - robot is on its way to you!",
  heading_to_dropoff: "Robot is on its way to you!",
  arrived_dropoff: "Robot has arrived! Enter your delivery code below to open the cart.",
  delivered: "Delivered - thanks for using SARYX.",
};

export default function Receive() {
  const router = useRouter();
  const [orderIdInput, setOrderIdInput] = useState("");
  const [orderId, setOrderId] = useState(null);
  const [order, setOrder] = useState(null);
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
    return () => unsub();
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
    const ok = await submitDeliveryCode(orderId, codeInput);
    setCodeError(!ok);
  };

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
          </div>

          <RobotMap
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
