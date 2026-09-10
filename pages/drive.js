import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { ref, onValue, set } from "firebase/database";
import { rtdb } from "../lib/firebase";
import Joystick from "../components/Joystick";
import { useRobotStream } from "../lib/useRobotStream";
import { useDriverAuth } from "../lib/useDriverAuth";
import DriverPinModal from "../components/DriverPinModal";

const RobotMap = dynamic(() => import("../components/RobotMap"), { ssr: false });

/*
  Full-screen, landscape-first driving screen:
  Uses direct WebRTC peer-to-peer streaming (<100ms latency worldwide),
  with virtual joystick, mini-map, and driver PIN protection.
*/
export default function Drive() {
  const { videoRef, status: webrtcStatus } = useRobotStream();
  const [position, setPosition] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [lockedStatus, setLockedStatus] = useState(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const lastSend = useRef({ throttle: 0, steer: 0 });

  const {
    isAuthorized,
    showPinModal,
    setShowPinModal,
    loginWithPin,
    logoutPin,
    fixedPin,
  } = useDriverAuth();

  useEffect(() => {
    const unsubPos = onValue(ref(rtdb, "robot/position"), (snap) => setPosition(snap.val()));
    const unsubTelemetry = onValue(ref(rtdb, "robot/telemetry"), (snap) => setTelemetry(snap.val()));
    const unsubLock = onValue(ref(rtdb, "robot/lockStatus"), (snap) => setLockedStatus(snap.val()?.locked));

    return () => { unsubPos(); unsubTelemetry(); unsubLock(); };
  }, []);

  useEffect(() => {
    const check = () => setIsPortrait(window.innerHeight > window.innerWidth);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleJoystickChange = useCallback((throttle, steer) => {
    if (!isAuthorized) {
      setShowPinModal(true);
      return;
    }
    lastSend.current = { throttle, steer };
    set(ref(rtdb, "robot/commands"), { throttle, steer, timestamp: Date.now() });
  }, [isAuthorized, setShowPinModal]);

  const sendLock = (open) => {
    if (!isAuthorized) {
      setShowPinModal(true);
      return;
    }
    set(ref(rtdb, "robot/lockCommand"), { open, timestamp: Date.now() });
  };

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
      {/* Instantaneous Direct WebRTC Video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          background: "#000",
        }}
      />

      {webrtcStatus !== "connected" && (
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#aaa",
          background: "rgba(0,0,0,0.8)",
          gap: 12,
        }}>
          <div style={{ fontSize: 32 }}>📹</div>
          <div style={{ fontSize: 16, fontWeight: 500 }}>
            {webrtcStatus === "connecting" && "Connecting to robot stream (WebRTC)..."}
            {webrtcStatus === "waiting-for-robot" && "Waiting for robot stream..."}
            {webrtcStatus === "connection-lost" && "Connection lost — reconnecting..."}
            {webrtcStatus === "connection-timeout" && "Connecting timed out — retrying..."}
            {webrtcStatus === "error" && "Stream error — reconnecting..."}
          </div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            Direct Peer-to-Peer • No servers or tunnels needed
          </div>
        </div>
      )}

      {/* Mini map overlay, top-right */}
      <div style={{ position: "absolute", top: 12, right: 12, width: 160, height: 120, borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
        <RobotMap position={position} />
      </div>

      {/* Telemetry & WebRTC Status, top-left */}
      <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ background: "rgba(0,0,0,0.6)", padding: "6px 12px", borderRadius: 6, color: "#fff", fontSize: 12, backdropFilter: "blur(4px)" }}>
          {telemetry ? `Dist: ${telemetry.ultrasonicCm >= 0 ? telemetry.ultrasonicCm.toFixed(0) : "--"}cm${telemetry.bump ? " ⚠️" : ""}` : "No telemetry"}
        </div>

        {/* WebRTC Live Indicator */}
        <div
          style={{
            background: webrtcStatus === "connected" ? "rgba(46, 125, 50, 0.85)" : "rgba(211, 47, 47, 0.85)",
            padding: "6px 12px",
            borderRadius: 6,
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 6,
            backdropFilter: "blur(4px)",
          }}
        >
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#fff", animation: "pulse 1.5s infinite" }} />
          {webrtcStatus === "connected" ? "LIVE (WebRTC)" : webrtcStatus.toUpperCase()}
        </div>
      </div>

      {/* Driver PIN Authorization Status Badge (Top Center) */}
      <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
        {isAuthorized ? (
          <div
            style={{
              background: "rgba(46, 125, 50, 0.85)",
              color: "#fff",
              padding: "6px 14px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
              backdropFilter: "blur(4px)",
            }}
          >
            <span>🟢 Driver (PIN: {fixedPin})</span>
            <button
              onClick={logoutPin}
              title="Lock controls / Switch to spectator mode"
              style={{
                background: "rgba(0,0,0,0.3)",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "2px 8px",
                fontSize: 10,
                cursor: "pointer",
              }}
            >
              Lock
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowPinModal(true)}
            style={{
              background: "rgba(245, 124, 0, 0.9)",
              color: "#fff",
              border: "none",
              padding: "6px 14px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
              backdropFilter: "blur(4px)",
            }}
          >
            <span>🔒 Spectator Mode</span>
            <span style={{ textDecoration: "underline", fontSize: 11 }}>(Enter PIN to Drive)</span>
          </button>
        )}
      </div>

      {/* Lock control, bottom-right */}
      <div style={{ position: "absolute", bottom: 24, right: 24, display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          onClick={() => sendLock(true)}
          style={{
            padding: "10px 16px",
            background: isAuthorized ? "rgba(46,125,50,0.85)" : "rgba(80,80,80,0.6)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          {isAuthorized ? "Unlock Box" : "🔒 Unlock (PIN req)"}
        </button>
        <button
          onClick={() => sendLock(false)}
          style={{
            padding: "10px 16px",
            background: isAuthorized ? "rgba(85,85,85,0.85)" : "rgba(50,50,50,0.6)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          {isAuthorized ? "Lock Box" : "🔒 Lock (PIN req)"}
        </button>
        {lockedStatus !== null && (
          <div style={{ fontSize: 11, textAlign: "center", color: lockedStatus ? "#EF5350" : "#66BB6A" }}>
            {lockedStatus ? "LOCKED" : "UNLOCKED"}
          </div>
        )}
      </div>

      {/* Joystick, bottom-left */}
      <div
        style={{ position: "absolute", bottom: 24, left: 24 }}
        onClick={() => {
          if (!isAuthorized) setShowPinModal(true);
        }}
      >
        <div style={{ position: "relative" }}>
          <Joystick onChange={handleJoystickChange} size={140} />
          {!isAuthorized && (
            <div
              onClick={() => setShowPinModal(true)}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 140,
                height: 140,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.6)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#ffa726",
                fontSize: 11,
                textAlign: "center",
                padding: 10,
                boxSizing: "border-box",
              }}
            >
              <span style={{ fontSize: 24, marginBottom: 4 }}>🔒</span>
              Tap to enter PIN
            </div>
          )}
        </div>
      </div>

      {/* PIN Unlock Modal */}
      <DriverPinModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onUnlock={loginWithPin}
      />
    </div>
  );
}
