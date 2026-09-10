// SARYX laptop relay server - receives JPEG frames posted by the robot phone,
// serves them as an MJPEG stream to anyone watching (the dashboard, or a browser
// pointed directly at it). No STUN/TURN/WebRTC needed - just plain HTTP.
//
// Run: npm install && node server.js
// Then: ngrok http 3000   (gives you a public URL to put in the phone app and dashboard)

const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// CORS: fetch() (unlike <img> tags) enforces cross-origin restrictions, and we
// need fetch() now to set the ngrok-skip-browser-warning header ourselves.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "ngrok-skip-browser-warning, Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

let latestFrame = null;
let lastFrameTime = 0;
const clients = new Set();

// Accept raw JPEG bytes in the request body
app.use("/upload", express.raw({ type: "*/*", limit: "5mb" }));

app.post("/upload", (req, res) => {
  latestFrame = req.body;
  lastFrameTime = Date.now();
  // Push this frame to every currently-connected MJPEG viewer
  for (const client of clients) {
    writeFrame(client, latestFrame);
  }
  res.sendStatus(200);
});

const FIREBASE_RTDB_URL = "https://saryx-robot-shamz-default-rtdb.europe-west1.firebasedatabase.app";

function syncViewerCount() {
  const count = clients.size;
  if (!FIREBASE_RTDB_URL) return;
  fetch(`${FIREBASE_RTDB_URL}/robot/viewers.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(count),
  }).catch(() => {});
}

app.get("/viewers", (req, res) => {
  res.json({
    viewers: clients.size,
    lastFrameAgeMs: latestFrame ? Date.now() - lastFrameTime : null,
  });
});

app.get("/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "multipart/x-mixed-replace; boundary=saryxframe",
    "Cache-Control": "no-cache",
    "Access-Control-Allow-Origin": "*",
    Connection: "close",
  });
  clients.add(res);
  console.log(`Viewer connected. Total viewers: ${clients.size}`);
  syncViewerCount();

  if (latestFrame) writeFrame(res, latestFrame);

  req.on("close", () => {
    clients.delete(res);
    console.log(`Viewer disconnected. Total viewers: ${clients.size}`);
    syncViewerCount();
  });
});

function writeFrame(res, jpegBuffer) {
  try {
    res.write(`--saryxframe\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpegBuffer.length}\r\n\r\n`);
    res.write(jpegBuffer);
    res.write("\r\n");
  } catch (e) {
    clients.delete(res);
  }
}

app.get("/", (req, res) => {
  const age = latestFrame ? `${Date.now() - lastFrameTime}ms ago` : "never";
  res.send(`SARYX relay server running. Last frame received: ${age}. Viewers: ${clients.size}. Stream at /stream`);
});

app.listen(PORT, () => {
  console.log(`SARYX relay server listening on http://localhost:${PORT}`);
  console.log(`Robot posts frames to: http://localhost:${PORT}/upload`);
  console.log(`Viewers watch at: http://localhost:${PORT}/stream`);
  console.log(`Run 'ngrok http ${PORT}' in another terminal to get a public URL.`);
  syncViewerCount();
});
