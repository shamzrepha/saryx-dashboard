import { useState, useEffect, useCallback } from "react";

export const FIXED_DRIVER_PIN = "5524";

export function useDriverAuth() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinError, setPinError] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("saryx_driver_pin");
      if (saved === FIXED_DRIVER_PIN) {
        setIsAuthorized(true);
      }
    } catch (e) {}
  }, []);

  const loginWithPin = useCallback((pin) => {
    if (pin.trim() === FIXED_DRIVER_PIN) {
      try {
        localStorage.setItem("saryx_driver_pin", FIXED_DRIVER_PIN);
      } catch (e) {}
      setIsAuthorized(true);
      setShowPinModal(false);
      setPinError("");
      return true;
    } else {
      setPinError("Incorrect PIN. Please enter 5524.");
      return false;
    }
  }, []);

  const logoutPin = useCallback(() => {
    try {
      localStorage.removeItem("saryx_driver_pin");
    } catch (e) {}
    setIsAuthorized(false);
  }, []);

  return {
    isAuthorized,
    showPinModal,
    setShowPinModal,
    pinError,
    setPinError,
    loginWithPin,
    logoutPin,
    fixedPin: FIXED_DRIVER_PIN,
  };
}
