import { ref, push, set, get, onValue } from "firebase/database";
import { rtdb } from "./firebase";

/*
  Order data model (matches OrderManager.kt on the robot phone exactly):
    orders/{orderId} = {
      status: "pending" | "unmatched" | "heading_to_pickup" | "arrived_pickup" |
              "loaded" | "heading_to_dropoff" | "arrived_dropoff" | "delivered",
      pickupLat, pickupLon, dropoffLat, dropoffLon,
      matchedRouteId, code, verified, createdAt
    }
  The robot phone (OrderManager.kt) owns all status transitions EXCEPT two,
  which the web app writes directly:
    - "loaded"   (sender confirms parcel is in the cart)
    - "verified" (recipient's code check passed)
*/

export function createOrder(pickupLat, pickupLon, dropoffLat, dropoffLon) {
  const newRef = push(ref(rtdb, "orders"));
  const order = {
    status: "pending",
    pickupLat, pickupLon, dropoffLat, dropoffLon,
    createdAt: Date.now(),
  };
  return set(newRef, order).then(() => newRef.key);
}

export function markLoaded(orderId) {
  return set(ref(rtdb, `orders/${orderId}/status`), "loaded");
}

/** Returns true if the code matched and verification was recorded, false otherwise. */
export async function submitDeliveryCode(orderId, enteredCode) {
  const snap = await get(ref(rtdb, `orders/${orderId}/code`));
  const realCode = snap.val();
  if (realCode && String(realCode) === String(enteredCode).trim()) {
    await set(ref(rtdb, `orders/${orderId}/verified`), true);
    return true;
  }
  return false;
}

export function watchOrder(orderId, callback) {
  return onValue(ref(rtdb, `orders/${orderId}`), (snap) => callback(snap.val()));
}

export function watchAllOrders(callback) {
  return onValue(ref(rtdb, "orders"), (snap) => {
    const list = [];
    snap.forEach((child) => list.push({ id: child.key, ...child.val() }));
    callback(list);
  });
}

export function watchAllRoutes(callback) {
  return onValue(ref(rtdb, "routes"), (snap) => {
    const routes = [];
    snap.forEach((routeSnap) => {
      const points = [];
      routeSnap.forEach((wp) => {
        const lat = wp.child("lat").val();
        const lon = wp.child("lon").val();
        if (lat != null && lon != null) points.push([lat, lon]);
      });
      if (points.length) routes.push({ name: routeSnap.key, points });
    });
    callback(routes);
  });
}
