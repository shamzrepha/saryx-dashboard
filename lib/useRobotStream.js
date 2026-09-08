import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, setDoc, updateDoc, collection, addDoc, onSnapshot as onSnap } from "firebase/firestore";
import { firestore } from "./firebase";

// Free STUN + TURN (see README for details / upgrade path)
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

/*
  The ROBOT PHONE is the WebRTC "offerer" (it creates the offer once it's ready
  to stream). This dashboard is the "answerer" - it watches Firestore for an
  offer document, responds with an answer, and exchanges ICE candidates the
  same way. Signaling document lives at: calls/robot-stream
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
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
        setStatus("connected");
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(answerCandidates, event.candidate.toJSON());
      }
    };

    const unsubscribeOffer = onSnapshot(callDoc, async (snapshot) => {
      const data = snapshot.data();
      if (data?.offer && pc.currentRemoteDescription === null) {
        setStatus("robot-found-connecting");
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answerDescription = await pc.createAnswer();
        await pc.setLocalDescription(answerDescription);
        await updateDoc(callDoc, {
          answer: { type: answerDescription.type, sdp: answerDescription.sdp },
        });
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
      pc.close();
    };
  }, []);

  return { videoRef, status };
}
