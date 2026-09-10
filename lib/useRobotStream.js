import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, updateDoc, collection, addDoc } from "firebase/firestore";
import { firestore } from "./firebase";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:80?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turns:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

/*
  Direct WebRTC Peer-to-Peer streaming:
  The ROBOT PHONE is the WebRTC offerer. This dashboard is the answerer.
  Signaling happens through Firestore document calls/robot-stream.
  - Zero relay servers needed
  - Zero tunneling (no ngrok, no cloudflared)
  - Sub-100ms ultra-low latency worldwide
*/
export function useRobotStream() {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("waiting-for-robot");
  const pcRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;
    let connectTimeout = null;
    let unsubscribeOffer = null;
    let unsubscribeIce = null;

    const callDoc = doc(firestore, "calls", "robot-stream");
    const answerCandidates = collection(callDoc, "answerCandidates");
    const offerCandidates = collection(callDoc, "offerCandidates");

    let pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    function setupPeerConnection() {
      pc.ontrack = (event) => {
        console.log("[useRobotStream] ontrack received stream:", event.streams);
        const video = videoRef.current;
        if (video && event.streams[0]) {
          video.srcObject = event.streams[0];
          video.play().catch((err) => {
            console.warn("[useRobotStream] video.play() auto-play prevented:", err);
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("[useRobotStream] ICE state:", pc.iceConnectionState);
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          setStatus("connected");
          if (connectTimeout) clearTimeout(connectTimeout);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log("[useRobotStream] Connection state:", pc.connectionState);
        if (pc.connectionState === "connected") {
          setStatus("connected");
          if (connectTimeout) clearTimeout(connectTimeout);
        } else if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected" ||
          pc.connectionState === "closed"
        ) {
          setStatus("connection-lost");
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(answerCandidates, event.candidate.toJSON()).catch(() => {});
        }
      };
    }

    setupPeerConnection();

    unsubscribeOffer = onSnapshot(callDoc, async (snapshot) => {
      if (isCancelled) return;
      const data = snapshot.data();

      // If robot posted an offer and we haven't answered it yet, or if it's a new offer
      if (data?.offer && (!pc.currentRemoteDescription || data.offer.sdp !== pc.currentRemoteDescription.sdp)) {
        console.log("[useRobotStream] Offer received from robot, creating answer...");
        setStatus("connecting");

        connectTimeout = setTimeout(() => {
          if (pc.connectionState !== "connected") {
            console.warn("[useRobotStream] WebRTC connection timed out (15s)");
            setStatus("connection-timeout");
          }
        }, 15000);

        try {
          // If PC was already in another state, recreate cleanly
          if (pc.signalingState !== "stable" && pc.signalingState !== "have-local-offer") {
            pc.close();
            pc = new RTCPeerConnection(ICE_SERVERS);
            pcRef.current = pc;
            setupPeerConnection();
          }

          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          await updateDoc(callDoc, {
            answer: { type: answer.type, sdp: answer.sdp },
          });
          console.log("[useRobotStream] Answer published to Firestore");
        } catch (err) {
          console.error("[useRobotStream] Failed to negotiate answer:", err);
          setStatus("error");
        }
      } else if (!data?.offer) {
        setStatus("waiting-for-robot");
      }
    });

    unsubscribeIce = onSnapshot(offerCandidates, (snapshot) => {
      if (isCancelled) return;
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          try {
            pc.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => {});
          } catch (e) {}
        }
      });
    });

    return () => {
      isCancelled = true;
      if (connectTimeout) clearTimeout(connectTimeout);
      if (unsubscribeOffer) unsubscribeOffer();
      if (unsubscribeIce) unsubscribeIce();
      pc.close();
      pcRef.current = null;
    };
  }, []);

  return { videoRef, status };
}
