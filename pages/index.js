import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { ref, onValue, set } from "firebase/database";
import { rtdb } from "../lib/firebase";

// Leaflet needs the window object, so load the map client-side only
const RobotMap = dynamic(() => import("../components/RobotMap"), { ssr: false });

export default function Dashboard() {
  const [telemetry, setTelemetry] = useState(null);
  const [position, setPosition] = useState(null);
  const [mode, setMode] = useState("manual"); // "manual" | "training" | "autonomous"
  const [streamServerUrl, setStreamServerUrl] = useState(null);
  const [streamKey, setStreamKey] = useState(0); // bump to force <img> reload if it stalls

  useEffect(() => {
    const unsubTelemetry = onValue(ref(rtdb, "robot/telemetry"), (snap) => {
      setTelemetry(snap.val());
    });
    const unsubPosition = onValue(ref(rtdb, "robot/position"), (snap) => {
      setPosition(snap.val());
    });
    const unsubStreamUrl = onValue(ref(rtdb, "robot/streamServerUrl"), (snap) => {
      setStreamServerUrl(snap.val());
    });
    return () => {
      unsubTelemetry();
      unsubPosition();
      unsubStreamUrl();
    };
  }, []);

  const sendCommand = useCallback((throttle, steer) => {
    set(ref(rtdb, "robot/commands"), {
      throttle,
      steer,
      timestamp: Date.now(),
    });
  }, []);

  const sendLock = useCallback((open) => {
    set(ref(rtdb, "robot/lockCommand"), { open, timestamp: Date.now() });
  }, []);

  // Keyboard controls: arrow keys for manual/training drive
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
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [sendCommand]);

  const startTraining = () => {
    setMode("training");
    set(ref(rtdb, "robot/recording"), { active: true, startedAt: Date.now() });
  };
  const stopTraining = () => {
    setMode("manual");
    set(ref(rtdb, "robot/recording"), { active: false });
  };

  const streamSrc = streamServerUrl ? `${streamServerUrl}/stream?k=${streamKey}` : null;

  return (
    <div style={{ fontFamily: "sans-serif", background: "#111", color: "#eee", minHeight: "100vh", padding: "16px" }}>
      <h1 style={{ marginTop: 0 }}>SARYX Dashboard</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div>
          <h3>
            Live Stream{" "}
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              {streamServerUrl ? `(${streamServerUrl})` : "(no relay server set)"}
            </span>
          </h3>
          {streamSrc ? (
            <img
              src={streamSrc}
              alt="Robot camera feed"
              style={{ width: "100%", background: "#000", borderRadius: 8, display: "block" }}
              onError={() => setTimeout(() => setStreamKey((k) => k + 1), 2000)}
            />
          ) : (
            <div style={{ width: "100%", aspectRatio: "4/3", background: "#000", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>
              Waiting for stream server URL (set robot/streamServerUrl in Firebase)
            </div>
          )}
        </div>

        <div>
          <h3>Live Map</h3>
          <RobotMap position={position} />
        </div>
      </div>

      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div>
          <h3>Manual / Training Control</h3>
          <p style={{ fontSize: 13, opacity: 0.8 }}>
            Use arrow keys to drive. Toggling "Start Training" records this drive
            as a route while you steer.
          </p>
          <button onClick={mode === "training" ? stopTraining : startTraining}
            style={{ padding: "10px 16px", marginRight: 8, background: mode === "training" ? "#D32F2F" : "#2E7D32", color: "#fff", border: "none", borderRadius: 6 }}>
            {mode === "training" ? "Stop Training" : "Start Training"}
          </button>
          <button onClick={() => sendCommand(0, 0)}
            style={{ padding: "10px 16px", background: "#555", color: "#fff", border: "none", borderRadius: 6 }}>
            STOP
          </button>
          <div style={{ marginTop: 12 }}>
            <button onClick={() => sendLock(true)} style={{ padding: "8px 12px", marginRight: 8 }}>Unlock</button>
            <button onClick={() => sendLock(false)} style={{ padding: "8px 12px" }}>Lock</button>
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
          ) : <p style={{ opacity: 0.6 }}>No telemetry yet — waiting on robot.</p>}
        </div>
      </div>
    </div>
  );
}
