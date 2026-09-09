import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { ref, onValue, set } from "firebase/database";
import { rtdb } from "../lib/firebase";
import Joystick from "../components/Joystick";

const RobotMap = dynamic(() => import("../components/RobotMap"), { ssr: false });

/*
  Full-screen, landscape-first driving screen - meant to be opened on a phone
  and held sideways, like a live-feed driving game: video fills the screen,
  a small map overlay shows position/heading, and a touch joystick drives.
*/
export default function Drive() {
  const [streamServerUrl, setStreamServerUrl] = useState(null);
  const [streamKey, setStreamKey] = useState(0);
  const [position, setPosition] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [lockedStatus, setLockedStatus] = useState(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const lastSend = useRef({ throttle: 0, steer: 0 });

  useEffect(() => {
    const unsubStream = onValue(ref(rtdb, "robot/streamServerUrl"), (snap) => setStreamServerUrl(snap.val()));
    const unsubPos = onValue(ref(rtdb, "robot/position"), (snap) => setPosition(snap.val()));
    const unsubTelemetry = onValue(ref(rtdb, "robot/telemetry"), (snap) => setTelemetry(snap.val()));
    const unsubLock = onValue(ref(rtdb, "robot/lockStatus"), (snap) => setLockedStatus(snap.val()?.locked));
    return () => { unsubStream(); unsubPos(); unsubTelemetry(); unsubLock(); };
  }, []);

  useEffect(() => {
    const check = () => setIsPortrait(window.innerHeight > window.innerWidth);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleJoystickChange = useCallback((throttle, steer) => {
    // Send on every real change, uncapped rate - the joystick itself already
    // only fires on actual pointer movement, and the phone-side BLE layer
    // handles its own send-rate limiting (with stop commands bypassing it).
    lastSend.current = { throttle, steer };
    set(ref(rtdb, "robot/commands"), { throttle, steer, timestamp: Date.now() });
  }, []);

  const sendLock = (open) => set(ref(rtdb, "robot/lockCommand"), { open, timestamp: Date.now() });

  const streamSrc = streamServerUrl ? `${streamServerUrl}/stream?k=${streamKey}` : null;

  if (isPortrait) {
    return (
      <div style={{
        height: "100vh", background: "#000", color: "#fff", display: "flex",
        alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24
      }}>
        <div>
          <div style={{ fontSize: 48, marginBottom: 16 }}>↻</div>
          <p>Rotate your phone to landscape to drive.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", width: "100vw", background: "#000", position: "relative", overflow: "hidden" }}>
      {streamSrc ? (
        <img src={streamSrc} alt="Live feed" style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => setTimeout(() => setStreamKey((k) => k + 1), 2000)} />
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>
          Waiting for stream...
        </div>
      )}

      {/* Mini map overlay, top-right */}
      <div style={{ position: "absolute", top: 12, right: 12, width: 160, height: 120, borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
        <RobotMap position={position} />
      </div>

      {/* Telemetry strip, top-left */}
      <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.5)", padding: "6px 12px", borderRadius: 6, color: "#fff", fontSize: 12 }}>
        {telemetry ? `Dist: ${telemetry.ultrasonicCm >= 0 ? telemetry.ultrasonicCm.toFixed(0) : "--"}cm${telemetry.bump ? " ⚠️" : ""}` : "No telemetry"}
      </div>

      {/* Lock control, bottom-right */}
      <div style={{ position: "absolute", bottom: 24, right: 24, display: "flex", flexDirection: "column", gap: 8 }}>
        <button onClick={() => sendLock(true)} style={{ padding: "10px 16px", background: "rgba(46,125,50,0.85)", color: "#fff", border: "none", borderRadius: 8 }}>
          Unlock
        </button>
        <button onClick={() => sendLock(false)} style={{ padding: "10px 16px", background: "rgba(85,85,85,0.85)", color: "#fff", border: "none", borderRadius: 8 }}>
          Lock
        </button>
        {lockedStatus !== null && (
          <div style={{ fontSize: 11, textAlign: "center", color: lockedStatus ? "#EF5350" : "#66BB6A" }}>
            {lockedStatus ? "LOCKED" : "UNLOCKED"}
          </div>
        )}
      </div>

      {/* Joystick, bottom-left */}
      <div style={{ position: "absolute", bottom: 24, left: 24 }}>
        <Joystick onChange={handleJoystickChange} size={140} />
      </div>
    </div>
  );
}
