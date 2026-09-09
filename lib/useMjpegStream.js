import { useEffect, useState, useRef } from "react";

/*
  Fetches an MJPEG stream manually (instead of using a plain <img src>) so we
  can attach the `ngrok-skip-browser-warning` header - this is what lets
  ANY visitor see the stream immediately with no manual "click through"
  needed on ngrok's free-tier warning page, which a plain <img> tag can't do
  since it can't send custom headers.

  Returns a blob: URL string to use directly as an <img src>, updated as new
  frames arrive, plus a status string for the UI.
*/
export function useMjpegStream(streamServerUrl) {
  const [imageSrc, setImageSrc] = useState(null);
  const [status, setStatus] = useState("waiting");
  const currentBlobUrl = useRef(null);

  useEffect(() => {
    if (!streamServerUrl) {
      setStatus("waiting");
      return;
    }

    let cancelled = false;
    let reader = null;

    async function connect() {
      setStatus("connecting");
      try {
        const response = await fetch(`${streamServerUrl}/stream`, {
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        if (!response.ok || !response.body) {
          setStatus("error");
          return;
        }
        setStatus("streaming");
        reader = response.body.getReader();
        let buffer = new Uint8Array(0);
        const boundary = new TextEncoder().encode("--saryxframe");
        const headerEnd = new TextEncoder().encode("\r\n\r\n");

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer = concatBytes(buffer, value);

          // Extract every complete frame currently sitting in the buffer
          while (true) {
            const boundaryIndex = indexOfSequence(buffer, boundary);
            if (boundaryIndex === -1) break;
            const headerEndIndex = indexOfSequence(buffer, headerEnd, boundaryIndex);
            if (headerEndIndex === -1) break; // headers not fully arrived yet

            const headerText = new TextDecoder().decode(
              buffer.slice(boundaryIndex, headerEndIndex)
            );
            const lengthMatch = headerText.match(/Content-Length:\s*(\d+)/i);
            if (!lengthMatch) {
              // Malformed - drop up to here and keep looking
              buffer = buffer.slice(headerEndIndex + headerEnd.length);
              continue;
            }
            const contentLength = parseInt(lengthMatch[1], 10);
            const frameStart = headerEndIndex + headerEnd.length;
            const frameEnd = frameStart + contentLength;
            if (buffer.length < frameEnd) break; // full frame not arrived yet

            const jpegBytes = buffer.slice(frameStart, frameEnd);
            const blob = new Blob([jpegBytes], { type: "image/jpeg" });
            const url = URL.createObjectURL(blob);
            if (currentBlobUrl.current) URL.revokeObjectURL(currentBlobUrl.current);
            currentBlobUrl.current = url;
            setImageSrc(url);

            buffer = buffer.slice(frameEnd); // advance past this frame (and trailing \r\n)
          }
        }
      } catch (e) {
        console.error("[useMjpegStream] error:", e);
        if (!cancelled) setStatus("error");
        return;
      }
      if (!cancelled) {
        setStatus("disconnected");
        setTimeout(connect, 2000); // auto-retry
      }
    }

    connect();
    return () => {
      cancelled = true;
      reader?.cancel().catch(() => {});
      if (currentBlobUrl.current) URL.revokeObjectURL(currentBlobUrl.current);
    };
  }, [streamServerUrl]);

  return { imageSrc, status };
}

function concatBytes(a, b) {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}

function indexOfSequence(buffer, sequence, fromIndex = 0) {
  for (let i = fromIndex; i <= buffer.length - sequence.length; i++) {
    let match = true;
    for (let j = 0; j < sequence.length; j++) {
      if (buffer[i + j] !== sequence[j]) { match = false; break; }
    }
    if (match) return i;
  }
  return -1;
}
