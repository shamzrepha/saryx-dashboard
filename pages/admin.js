import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ref, onValue, set } from "firebase/database";
import { rtdb } from "../lib/firebase";
import { watchAllRoutes, watchAllOrders } from "../lib/orders";
import { createStation, deleteStation, watchAllStations } from "../lib/stations";
import { FUTO_CENTER } from "../lib/geo";
import { useMjpegStream } from "../lib/useMjpegStream";

const RobotMap = dynamic(() => import("../components/RobotMap"), { ssr: false });

export default function Admin() {
  const [telemetry, setTelemetry] = useState(null);
  const [position, setPosition] = useState(null);
  const [trail, setTrail] = useState([]);
  const [mode, setMode] = useState("manual");
  const [robotConfirmedTraining, setRobotConfirmedTraining] = useState(false);
  const [robotConfirmedLocked, setRobotConfirmedLocked] = useState(null);
  const [streamServerUrl, setStreamServerUrl] = useState(null);
  const { imageSrc: mjpegImageSrc, status: mjpegStatus } = useMjpegStream(streamServerUrl);
  const [routes, setRoutes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stations, setStations] = useState([]);
  const [autonomousStatus, setAutonomousStatus] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [overrideActive, setOverrideActive] = useState(false);

  // "Manual mapping" workflow: clicking an unmatched order flies the map there
  // and shows a hint to drive there manually, then Start Training.
  const [focusedOrder, setFocusedOrder] = useState(null);
  const [addingStation, setAddingStation] = useState(false);
  const [newStationName, setNewStationName] = useState("");
  const [newStationPoint, setNewStationPoint] = useState(null);

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
    const unsubStations = watchAllStations(setStations);
    return () => {
      unsubTelemetry(); unsubPosition(); unsubStreamUrl(); unsubRecording();
      unsubLockStatus(); unsubAutoStatus(); unsubActiveOrder(); unsubOverride();
      unsubRoutes(); unsubOrders(); unsubStations();
    };
  }, []);

  const sendCommand = useCallback((throttle, steer) => {
    set(ref(rtdb, "robot/commands"), { throttle, steer, timestamp: Date.now() });
  }, []);
  const sendLock = useCallback((open) => {
    set(ref(rtdb, "robot/lockCommand"), { open, timestamp: Date.now() });
  }, []);

  // Smooth acceleration/deceleration instead of instant on/off - eases the
  // current throttle/steer toward whatever the held keys target, like a real
  // gas pedal/brake rather than a binary switch.
  useEffect(() => {
    const pressed = new Set();
    let currentThrottle = 0, currentSteer = 0;
    const ACCEL_STEP = 0.08;  // gradual ramp-up, like easing onto the gas
    const DECEL_STEP = 0.35;  // fast ramp-down when releasing, like braking -
                               // matches the BLE-level fix that also prioritizes
                               // stopping quickly over smoothness
    const TICK_MS = 50;

    const targetValues = () => {
      let throttle = 0, steer = 0;
      if (pressed.has("ArrowUp")) throttle = 0.6;
      if (pressed.has("ArrowDown")) throttle = -0.6;
      if (pressed.has("ArrowLeft")) steer = -0.6;
      if (pressed.has("ArrowRight")) steer = 0.6;
      return { throttle, steer };
    };

    const ease = (current, target) => {
      // Moving toward zero (releasing/braking) uses the fast step; moving
      // away from zero (accelerating) uses the slow, smooth step.
      const movingTowardZero = Math.abs(target) < Math.abs(current) || target === 0;
      const step = movingTowardZero ? DECEL_STEP : ACCEL_STEP;
      if (Math.abs(target - current) < step) return target;
      return current + Math.sign(target - current) * step;
    };

    const tick = () => {
      const { throttle: targetThrottle, steer: targetSteer } = targetValues();
      currentThrottle = ease(currentThrottle, targetThrottle);
      currentSteer = ease(currentSteer, targetSteer);
      sendCommand(currentThrottle, currentSteer);
    };

    const interval = setInterval(tick, TICK_MS);
    const down = (e) => { if (e.key.startsWith("Arrow")) pressed.add(e.key); };
    const up = (e) => { if (e.key.startsWith("Arrow")) pressed.delete(e.key); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      clearInterval(interval);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
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

  const handleMapClick = (lat, lon) => {
    if (addingStation) setNewStationPoint({ lat, lon });
  };

  const saveStation = async () => {
    if (!newStationName.trim() || !newStationPoint) return;
    await createStation(newStationName.trim(), newStationPoint.lat, newStationPoint.lon);
    setNewStationName(""); setNewStationPoint(null); setAddingStation(false);
  };

  const unmatchedOrders = orders.filter((o) => o.status === "unmatched" || o.status === "pending");
  const pendingPoints = unmatchedOrders.map((o) => ({ lat: o.pickupLat, lon: o.pickupLon, label: `Order ${o.id} (${o.status})` }));
  const mapFocus = focusedOrder ? { lat: focusedOrder.pickupLat, lon: focusedOrder.pickupLon } : null;

  return (
    <div style={{ fontFamily: "sans-serif", background: "#111", color: "#eee", minHeight: "100vh", padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ marginTop: 0 }}>SARYX Admin</h1>
        <Link href="/" style={{ color: "#888" }}>← Public site</Link>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <Badge color={robotConfirmedTraining ? "#FFA726" : "#2E7D32"}>
          Mode: {autonomousStatus?.active ? "AUTONOMOUS" : robotConfirmedTraining ? "TRAINING" : "MANUAL"}
        </Badge>
        {robotConfirmedLocked !== null && (
          <Badge color={robotConfirmedLocked ? "#D32F2F" : "#2E7D32"}>Cart: {robotConfirmedLocked ? "LOCKED" : "UNLOCKED"}</Badge>
        )}
        {activeOrder?.orderId && <Badge color="#1565C0">Active order: {activeOrder.orderId} ({activeOrder.status})</Badge>}
        {overrideActive && <Badge color="#B71C1C">OVERRIDE ACTIVE</Badge>}
      </div>

      {unmatchedOrders.length > 0 && (
        <div style={{ background: "#4A2600", padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <b>{unmatchedOrders.length} order(s) have no nearby trained route.</b> Click one below to
          fly the map there, then drive manually and hit "Start Training" to map that area:
          <div style={{ marginTop: 8 }}>
            {unmatchedOrders.map((o) => (
              <button key={o.id} onClick={() => setFocusedOrder(o)}
                style={{ padding: "6px 10px", marginRight: 8, marginBottom: 4, background: "#FF6F00", color: "#fff", border: "none", borderRadius: 6 }}>
                {o.id.slice(0, 8)}...
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div>
          <h3>Live Stream <span style={{ fontSize: 12, opacity: 0.7 }}>{streamServerUrl ? `(${streamServerUrl}) - ${mjpegStatus}` : "(no relay server set)"}</span></h3>
          {mjpegImageSrc ? (
            <img src={mjpegImageSrc} alt="Robot camera feed" style={{ width: "100%", background: "#000", borderRadius: 8, display: "block" }} />
          ) : (
            <div style={{ width: "100%", aspectRatio: "4/3", background: "#000", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>
              Waiting for stream server URL
            </div>
          )}
        </div>

        <div>
          <h3>
            Coverage Map <span style={{ fontSize: 12, opacity: 0.7 }}>(blue = routes, orange = unmatched/stations)</span>
          </h3>
          <button onClick={() => setAddingStation(!addingStation)}
            style={{ padding: "6px 12px", marginBottom: 8, background: addingStation ? "#D32F2F" : "#1565C0", color: "#fff", border: "none", borderRadius: 6 }}>
            {addingStation ? "Cancel adding station" : "+ Add station (click map)"}
          </button>
          {addingStation && newStationPoint && (
            <div style={{ marginBottom: 8 }}>
              <input value={newStationName} onChange={(e) => setNewStationName(e.target.value)} placeholder="Station name"
                style={{ padding: 6, marginRight: 8 }} />
              <button onClick={saveStation} style={{ padding: "6px 12px", background: "#2E7D32", color: "#fff", border: "none", borderRadius: 6 }}>Save</button>
            </div>
          )}
          <RobotMap
            position={mapFocus ? null : position}
            trail={trail}
            routes={routes}
            pendingPoints={[...pendingPoints, ...stations.map((s) => ({ lat: s.lat, lon: s.lon, label: `Station: ${s.name}` }))]}
            pickupMarker={mapFocus}
            onMapClick={handleMapClick}
            follow={!mapFocus}
          />
        </div>
      </div>

      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div>
          <h3>Manual / Training</h3>
          <a href="/drive" target="_blank" rel="noopener noreferrer" style={{
            display: "inline-block", padding: "8px 16px", marginBottom: 12, background: "#1565C0",
            color: "#fff", borderRadius: 6, textDecoration: "none", fontSize: 13
          }}>
            🎮 Open Drive Mode (phone, landscape, joystick) →
          </a>
          <br />
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
              <p>Waypoint {autonomousStatus.currentWaypointIndex + 1} / {autonomousStatus.totalWaypoints}
                {autonomousStatus.distanceToWaypointMeters >= 0 && ` (${autonomousStatus.distanceToWaypointMeters.toFixed(1)}m away)`}</p>
              <button onClick={stopAutonomous} style={{ padding: "10px 16px", background: "#D32F2F", color: "#fff", border: "none", borderRadius: 6 }}>Stop Autonomous</button>
            </div>
          ) : (
            <div>
              {routes.length === 0 && <p style={{ opacity: 0.6 }}>No routes trained yet.</p>}
              {routes.map((r) => (
                <button key={r.name} onClick={() => startAutonomous(r.name)}
                  style={{ padding: "6px 12px", margin: "0 8px 8px 0", background: "#1565C0", color: "#fff", border: "none", borderRadius: 6 }}>
                  {r.name}
                </button>
              ))}
            </div>
          )}
          <button onClick={toggleOverride} style={{ marginTop: 8, padding: "10px 16px", background: overrideActive ? "#555" : "#B71C1C", color: "#fff", border: "none", borderRadius: 6 }}>
            {overrideActive ? "Clear Override" : "OVERRIDE (force manual now)"}
          </button>

          <h3 style={{ marginTop: 24 }}>Stations ({stations.length})</h3>
          {stations.map((s) => (
            <div key={s.id} style={{ fontSize: 13, marginBottom: 4 }}>
              {s.name} <button onClick={() => deleteStation(s.id)} style={{ fontSize: 11, marginLeft: 6 }}>remove</button>
            </div>
          ))}
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
          <ul style={{ fontSize: 13, lineHeight: 1.6 }}>
            {orders.slice(-5).reverse().map((o) => <li key={o.id}>{o.id.slice(0, 8)}... — {o.status}</li>)}
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
