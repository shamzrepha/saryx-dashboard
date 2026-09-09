import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ref, onValue, set } from "firebase/database";
import { rtdb } from "../lib/firebase";
import { watchAllRoutes, watchAllOrders } from "../lib/orders";

const RobotMap = dynamic(() => import("../components/RobotMap"), { ssr: false });

export default function Dashboard() {
  const [telemetry, setTelemetry] = useState(null);
  const [position, setPosition] = useState(null);
  const [trail, setTrail] = useState([]);
  const [mode, setMode] = useState("manual"); // this browser's last training toggle
  const [robotConfirmedTraining, setRobotConfirmedTraining] = useState(false);
  const [robotConfirmedLocked, setRobotConfirmedLocked] = useState(null);
  const [streamServerUrl, setStreamServerUrl] = useState(null);
  const [streamKey, setStreamKey] = useState(0);
  const [routes, setRoutes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [autonomousStatus, setAutonomousStatus] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [overrideActive, setOverrideActive] = useState(false);
  const lastTrailPoint = useRef(null);

  useEffect(() => {
    const unsubTelemetry = onValue(ref(rtdb, "robot/telemetry"), (snap) => setTelemetry(snap.val()));
    const unsubPosition = onValue(ref(rtdb, "robot/position"), (snap) => {
      const val = snap.val();
      setPosition(val);
      if (val?.lat && val?.lon) {
        const point = [val.lat, val.lon];
        const last = lastTrailPoint.current;
        if (!last || Math.abs(last[0] - point[0]) > 0.000005 || Math.abs(last[1] - point[1]) > 0.000005) {
          lastTrailPoint.current = point;
          setTrail((prev) => [...prev, point].slice(-500));
        }
      }
    });
    const unsubStreamUrl = onValue(ref(rtdb, "robot/streamServerUrl"), (snap) => setStreamServerUrl(snap.val()));
    const unsubRecording = onValue(ref(rtdb, "robot/recording"), (snap) => setRobotConfirmedTraining(!!snap.val()?.active));
    const unsubLockStatus = onValue(ref(rtdb, "robot/lockStatus"), (snap) => setRobotConfirmedLocked(snap.val()?.locked));
    const unsubAutoStatus = onValue(ref(rtdb, "robot/autonomousStatus"), (snap) => setAutonomousStatus(snap.val()));
    const unsubActiveOrder = onValue(ref(rtdb, "robot/activeOrder"), (snap) => setActiveOrder(snap.val()));
    const unsubOverride = onValue(ref(rtdb, "robot/autonomousOverride"), (snap) => setOverrideActive(!!snap.val()));
    const unsubRoutes = watchAllRoutes(setRoutes);
    const unsubOrders = watchAllOrders(setOrders);
    return () => {
      unsubTelemetry(); unsubPosition(); unsubStreamUrl(); unsubRecording();
      unsubLockStatus(); unsubAutoStatus(); unsubActiveOrder(); unsubOverride();
      unsubRoutes(); unsubOrders();
    };
  }, []);

  const sendCommand = useCallback((throttle, steer) => {
    set(ref(rtdb, "robot/commands"), { throttle, steer, timestamp: Date.now() });
  }, []);
  const sendLock = useCallback((open) => {
    set(ref(rtdb, "robot/lockCommand"), { open, timestamp: Date.now() });
  }, []);

  useEffect(() => {
    const pressed = new Set();
    const compute = () => {
      let throttle = 0, steer = 0;
      if (pressed.has("ArrowUp")) throttle = 0.6;
      if (pressed.has("ArrowDown")) throttle = -0.6;
      if (pressed.has("ArrowLeft")) steer = -0.6;
      if (pressed.has("ArrowRight")) steer = 0.6;
      sendCommand(throttle, steer);
    };
    const down = (e) => { if (e.key.startsWith("Arrow")) { pressed.add(e.key); compute(); } };
    const up = (e) => { if (e.key.startsWith("Arrow")) { pressed.delete(e.key); compute(); } };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [sendCommand]);

  const startTraining = () => {
    setMode("training"); setTrail([]); lastTrailPoint.current = null;
    set(ref(rtdb, "robot/recording"), { active: true, startedAt: Date.now() });
  };
  const stopTraining = () => {
    setMode("manual");
    set(ref(rtdb, "robot/recording"), { active: false });
  };

  const startAutonomous = (routeName) => {
    set(ref(rtdb, "robot/autonomousOverride"), false);
    set(ref(rtdb, "robot/autonomousTarget"), routeName);
  };
  const stopAutonomous = () => set(ref(rtdb, "robot/autonomousTarget"), null);
  const toggleOverride = () => set(ref(rtdb, "robot/autonomousOverride"), !overrideActive);

  const streamSrc = streamServerUrl ? `${streamServerUrl}/stream?k=${streamKey}` : null;
  const unmatchedOrders = orders.filter((o) => o.status === "unmatched" || o.status === "pending");
  const pendingPoints = unmatchedOrders.map((o) => ({ lat: o.pickupLat, lon: o.pickupLon, label: `Order ${o.id} (${o.status})` }));

  return (
    <div style={{ fontFamily: "sans-serif", background: "#111", color: "#eee", minHeight: "100vh", padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ marginTop: 0 }}>SARYX Admin</h1>
        <div>
          <Link href="/book" style={{ color: "#4CAF50", marginRight: 16 }}>Book a delivery →</Link>
          <Link href="/receive" style={{ color: "#4CAF50" }}>Track a delivery →</Link>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <Badge color={robotConfirmedTraining ? "#FFA726" : "#2E7D32"}>
          Mode: {autonomousStatus?.active ? "AUTONOMOUS" : robotConfirmedTraining ? "TRAINING" : "MANUAL"}
        </Badge>
        {robotConfirmedLocked !== null && (
          <Badge color={robotConfirmedLocked ? "#D32F2F" : "#2E7D32"}>
            Cart: {robotConfirmedLocked ? "LOCKED" : "UNLOCKED"}
          </Badge>
        )}
        {activeOrder?.orderId && (
          <Badge color="#1565C0">Active order: {activeOrder.orderId} ({activeOrder.status})</Badge>
        )}
        {overrideActive && <Badge color="#B71C1C">OVERRIDE ACTIVE</Badge>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div>
          <h3>Live Stream <span style={{ fontSize: 12, opacity: 0.7 }}>{streamServerUrl ? `(${streamServerUrl})` : "(no relay server set)"}</span></h3>
          {streamSrc ? (
            <img src={streamSrc} alt="Robot camera feed" style={{ width: "100%", background: "#000", borderRadius: 8, display: "block" }}
              onError={() => setTimeout(() => setStreamKey((k) => k + 1), 2000)} />
          ) : (
            <div style={{ width: "100%", aspectRatio: "4/3", background: "#000", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>
              Waiting for stream server URL
            </div>
          )}
        </div>

        <div>
          <h3>Coverage Map <span style={{ fontSize: 12, opacity: 0.7 }}>(blue = trained routes, orange = unmatched orders)</span></h3>
          <RobotMap position={position} trail={trail} routes={routes} pendingPoints={pendingPoints} />
        </div>
      </div>

      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div>
          <h3>Manual / Training</h3>
          <p style={{ fontSize: 13, opacity: 0.8 }}>Arrow keys to drive. Only works when autonomous mode isn't active.</p>
          <button onClick={mode === "training" ? stopTraining : startTraining}
            style={{ padding: "10px 16px", marginRight: 8, background: mode === "training" ? "#D32F2F" : "#2E7D32", color: "#fff", border: "none", borderRadius: 6 }}>
            {mode === "training" ? "Stop Training" : "Start Training"}
          </button>
          <button onClick={() => sendCommand(0, 0)} style={{ padding: "10px 16px", background: "#555", color: "#fff", border: "none", borderRadius: 6 }}>STOP</button>
          <div style={{ marginTop: 12 }}>
            <button onClick={() => sendLock(true)} style={{ padding: "8px 12px", marginRight: 8 }}>Unlock</button>
            <button onClick={() => sendLock(false)} style={{ padding: "8px 12px" }}>Lock</button>
          </div>

          <h3 style={{ marginTop: 24 }}>Autonomous</h3>
          {autonomousStatus?.active ? (
            <div>
              <p>Following route — waypoint {autonomousStatus.currentWaypointIndex + 1} / {autonomousStatus.totalWaypoints}
                {autonomousStatus.distanceToWaypointMeters >= 0 && ` (${autonomousStatus.distanceToWaypointMeters.toFixed(1)}m away)`}
              </p>
              <button onClick={stopAutonomous} style={{ padding: "10px 16px", background: "#D32F2F", color: "#fff", border: "none", borderRadius: 6 }}>Stop Autonomous</button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 13, opacity: 0.8 }}>Pick a trained route to drive it autonomously:</p>
              {routes.length === 0 && <p style={{ opacity: 0.6 }}>No routes trained yet.</p>}
              {routes.map((r) => (
                <button key={r.name} onClick={() => startAutonomous(r.name)}
                  style={{ padding: "6px 12px", margin: "0 8px 8px 0", background: "#1565C0", color: "#fff", border: "none", borderRadius: 6 }}>
                  {r.name}
                </button>
              ))}
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <button onClick={toggleOverride} style={{ padding: "10px 16px", background: overrideActive ? "#555" : "#B71C1C", color: "#fff", border: "none", borderRadius: 6 }}>
              {overrideActive ? "Clear Override" : "OVERRIDE (force manual now)"}
            </button>
          </div>
        </div>

        <div>
          <h3>Telemetry</h3>
          {telemetry ? (
            <ul style={{ fontSize: 14, lineHeight: 1.8 }}>
              <li>Left ticks: {telemetry.leftTicks}</li>
              <li>Right ticks: {telemetry.rightTicks}</li>
              <li>Ultrasonic: {telemetry.ultrasonicCm} cm {telemetry.bump ? "⚠️ OBSTACLE" : ""}</li>
              <li>Mode: {position?.usingRelativeMode ? "Indoor (relative)" : "Outdoor (GPS)"}</li>
            </ul>
          ) : <p style={{ opacity: 0.6 }}>No telemetry yet.</p>}

          <h3 style={{ marginTop: 24 }}>Orders ({orders.length})</h3>
          {orders.length === 0 && <p style={{ opacity: 0.6 }}>No orders yet.</p>}
          <ul style={{ fontSize: 13, lineHeight: 1.6 }}>
            {orders.slice(-5).reverse().map((o) => (
              <li key={o.id}>{o.id.slice(0, 8)}... — {o.status}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Badge({ color, children }) {
  return (
    <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 6, background: color, color: "#fff", fontWeight: "bold", fontSize: 13 }}>
      {children}
    </div>
  );
}
