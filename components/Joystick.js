import { useRef, useState, useCallback } from "react";

/*
  Touch/pointer-based virtual joystick - drag the knob within the circular base,
  returns normalized {throttle, steer} in real time as you move, snaps back to
  center (and reports 0,0 instantly) the moment you release. No easing/ramping
  here deliberately - a real analog stick reports your exact position live,
  and releasing it should stop the robot as fast as the connection allows.
*/
export default function Joystick({ onChange, size = 160 }) {
  const baseRef = useRef(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const activePointerId = useRef(null);

  const radius = size / 2;
  const knobRadius = size * 0.22;
  const maxDistance = radius - knobRadius;

  const updateFromEvent = useCallback((clientX, clientY) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > maxDistance) {
      dx = (dx / distance) * maxDistance;
      dy = (dy / distance) * maxDistance;
    }
    setKnobPos({ x: dx, y: dy });

    // throttle: up = positive, so invert Y. steer: right = positive.
    const throttle = -(dy / maxDistance);
    const steer = dx / maxDistance;
    onChange(
      Math.abs(throttle) < 0.05 ? 0 : throttle,
      Math.abs(steer) < 0.05 ? 0 : steer
    );
  }, [maxDistance, onChange]);

  const handlePointerDown = (e) => {
    activePointerId.current = e.pointerId;
    e.target.setPointerCapture(e.pointerId);
    updateFromEvent(e.clientX, e.clientY);
  };
  const handlePointerMove = (e) => {
    if (activePointerId.current !== e.pointerId) return;
    updateFromEvent(e.clientX, e.clientY);
  };
  const handlePointerUp = (e) => {
    if (activePointerId.current !== e.pointerId) return;
    activePointerId.current = null;
    setKnobPos({ x: 0, y: 0 });
    onChange(0, 0); // instant stop on release
  };

  return (
    <div
      ref={baseRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        width: size, height: size, borderRadius: "50%",
        background: "rgba(255,255,255,0.08)", border: "2px solid rgba(255,255,255,0.25)",
        position: "relative", touchAction: "none", userSelect: "none",
      }}
    >
      <div
        style={{
          width: knobRadius * 2, height: knobRadius * 2, borderRadius: "50%",
          background: "#2E7D32", position: "absolute",
          left: `calc(50% - ${knobRadius}px + ${knobPos.x}px)`,
          top: `calc(50% - ${knobRadius}px + ${knobPos.y}px)`,
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}
      />
    </div>
  );
}
