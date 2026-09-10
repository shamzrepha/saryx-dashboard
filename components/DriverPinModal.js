import { useState, useEffect, useRef } from "react";
import { FIXED_DRIVER_PIN } from "../lib/useDriverAuth";

export default function DriverPinModal({ isOpen, onClose, onUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [showPinHint, setShowPinHint] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPin("");
      setError("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (pin.trim() === FIXED_DRIVER_PIN) {
      onUnlock(pin.trim());
    } else {
      setError("Incorrect PIN. Please try again.");
      setPin("");
      inputRef.current?.focus();
    }
  };

  const handleQuickKey = (num) => {
    if (pin.length < 4) {
      const next = pin + num;
      setPin(next);
      if (next.length === 4) {
        if (next === FIXED_DRIVER_PIN) {
          onUnlock(next);
        } else {
          setError("Incorrect PIN. Please try again.");
          setPin("");
        }
      }
    }
  };

  const handleBackspace = () => {
    setPin((p) => p.slice(0, -1));
    setError("");
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1e1e1e",
          color: "#fff",
          borderRadius: 16,
          padding: 24,
          maxWidth: 340,
          width: "100%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
          border: "1px solid #333",
          textAlign: "center",
          fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 36, marginBottom: 8 }}>🔒</div>
        <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700 }}>Driver Authorization</h2>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#aaa" }}>
          Enter the 4-digit PIN to enable driving, steering, and robot lock controls.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                setPin(val);
                setError("");
                if (val.length === 4 && val === FIXED_DRIVER_PIN) {
                  onUnlock(val);
                }
              }}
              placeholder="••••"
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: 28,
                letterSpacing: 12,
                textAlign: "center",
                background: "#111",
                color: "#fff",
                border: error ? "2px solid #e53935" : "2px solid #444",
                borderRadius: 10,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div style={{ color: "#ef5350", fontSize: 12, marginBottom: 12, fontWeight: 500 }}>
              {error}
            </div>
          )}

          {/* Quick numpad for easy touch input on mobile */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
              marginBottom: 16,
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleQuickKey(String(n))}
                style={{
                  padding: "12px 0",
                  fontSize: 18,
                  fontWeight: 600,
                  background: "#2a2a2a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowPinHint(!showPinHint)}
              title="Show / Hide PIN hint"
              style={{
                padding: "12px 0",
                fontSize: 12,
                background: "#222",
                color: "#888",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              {showPinHint ? "Hide" : "Hint"}
            </button>
            <button
              type="button"
              onClick={() => handleQuickKey("0")}
              style={{
                padding: "12px 0",
                fontSize: 18,
                fontWeight: 600,
                background: "#2a2a2a",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              style={{
                padding: "12px 0",
                fontSize: 16,
                background: "#222",
                color: "#ff8a80",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              ⌫
            </button>
          </div>

          {showPinHint && (
            <div
              style={{
                background: "rgba(46,125,50,0.15)",
                border: "1px solid #2e7d32",
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 12,
                color: "#81c784",
                marginBottom: 14,
              }}
            >
              Configured Fixed PIN: <strong>{FIXED_DRIVER_PIN}</strong>
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: "12px 0",
                background: "#333",
                color: "#ccc",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Cancel (Spectate)
            </button>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: "12px 0",
                background: "#2e7d32",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Unlock Controls
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
