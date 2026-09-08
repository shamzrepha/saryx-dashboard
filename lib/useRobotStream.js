import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, updateDoc, collection, addDoc, onSnapshot as onSnap } from "firebase/firestore";
import { firestore } from "./firebase";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
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
  The ROBOT PHONE is the WebRTC "offerer". This dashboard is the "answerer" - it
  watches Firestore for an offer document, responds with an answer, and exchanges
  ICE candidates the same way. Signaling document: calls/robot-stream

  IMPORTANT: setting videoRef.current.srcObject alone does not guarantee playback
  starts in every browser - we explicitly call .play() once metadata loads, and log
  connection-state transitions to the console for debugging.
*/
export function useRobotStream() {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("waiting-for-robot");
  const pcRef = useRef(null);

  useEffect(() => {
    const callDoc = doc(firestore, "calls", "robot-stream");
    const answerCandidates = collection(callDoc, "answerCandidates");
    const offerCandidates = collection(callDoc, "offerCandidates");

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    pc.ontrack = (event) => {
      console.log("[useRobotStream] ontrack fired, streams:", event.streams);
      const video = videoRef.current;
      if (video && event.streams[0]) {
        video.srcObject = event.streams[0];
        video.onloadedmetadata = () => {
          console.log("[useRobotStream] video metadata loaded, attempting play()");
          video.play().catch((err) => {
            console.error("[useRobotStream] video.play() failed:", err);
          });
        };
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[useRobotStream] ICE connection state:", pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log("[useRobotStream] Peer connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setStatus("connected");
        if (connectTimeout) clearTimeout(connectTimeout);
      }
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected" || pc.connectionState === "closed") {
        setStatus("connection-lost");
        if (videoRef.current) videoRef.current.srcObject = null;
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(answerCandidates, event.candidate.toJSON());
      }
    };

    let connectTimeout = null;

    const unsubscribeOffer = onSnapshot(callDoc, async (snapshot) => {
      const data = snapshot.data();
      if (data?.offer && pc.currentRemoteDescription === null) {
        console.log("[useRobotStream] offer found, creating answer");
        setStatus("robot-found-connecting");

        // If we never reach "connected" within 15s, report a real failure
        // instead of leaving the UI stuck on "connecting" forever.
        connectTimeout = setTimeout(() => {
          if (pc.connectionState !== "connected") {
            console.warn("[useRobotStream] Timed out waiting for connection");
            setStatus("connection-timeout");
          }
        }, 15000);

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answerDescription = await pc.createAnswer();
        await pc.setLocalDescription(answerDescription);
        await updateDoc(callDoc, {
          answer: { type: answerDescription.type, sdp: answerDescription.sdp },
        });
        console.log("[useRobotStream] answer written to Firestore");
      } else if (!data?.offer) {
        // Offer was cleared (robot app restarted/stopped) - reset our state
        setStatus("waiting-for-robot");
      }
    });

    const unsubscribeIce = onSnap(offerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        }
      });
    });

    return () => {
      unsubscribeOffer();
      unsubscribeIce();
      if (connectTimeout) clearTimeout(connectTimeout);
      pc.close();
    };
  }, []);

  return { videoRef, status };
}
