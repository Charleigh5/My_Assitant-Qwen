/**
 * EDGE NEURAL TTS — Microsoft Edge's neural voices (Aria, Jenny, Ryan,
 * Michelle…) spoken through the same WebSocket synthesis endpoint the
 * Edge browser uses. Pure client-side: no API key, no server.
 *
 * Returns MP3 audio as a Blob; callers decide how to play it and how to
 * fall back (voice.ts routes to Web Speech synthesis on failure).
 */

const ENDPOINT =
  "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const TRUSTED_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";

export interface EdgeVoice {
  name: string;
  label: string;
  rate: number; // percent, e.g. +14
  pitch: number; // percent
}

/** One curated neural voice per persona core. */
export const PERSONA_VOICES: Record<string, EdgeVoice> = {
  nova: { name: "en-US-AriaNeural", label: "Aria · en-US", rate: 3, pitch: -6 },
  ember: { name: "en-US-JennyNeural", label: "Jenny · en-US", rate: 15, pitch: 18 },
  atlas: { name: "en-GB-RyanNeural", label: "Ryan · en-GB", rate: -6, pitch: -12 },
  lyra: { name: "en-US-MichelleNeural", label: "Michelle · en-US", rate: -9, pitch: 6 },
};

const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "")
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const gmtStamp = () => {
  const d = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const p = (n: number) => String(n).padStart(2, "0");
  return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${p(d.getUTCDate())} ${d.getUTCFullYear()} ${p(
    d.getUTCHours()
  )}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`;
};

const xmlEscape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export interface EdgeSpeakOptions {
  voice: EdgeVoice;
  /** hard timeout for the whole synthesis, ms */
  timeoutMs?: number;
}

let sessionDead = false;
export const edgeSessionDead = () => sessionDead;
export const resetEdgeSession = () => {
  sessionDead = false;
};

/**
 * Synthesize `text` with an Edge neural voice.
 * Resolves with an MP3 Blob; rejects on transport/timeout failure.
 */
export function speakEdge(text: string, opts: EdgeSpeakOptions): Promise<Blob> {
  if (sessionDead) return Promise.reject(new Error("edge session marked dead"));

  return new Promise((resolve, reject) => {
    const requestId = uuid();
    const chunks: BlobPart[] = [];
    let settled = false;
    let ws: WebSocket | null = null;

    const fail = (msg: string) => {
      if (settled) return;
      settled = true;
      try {
        ws?.close();
      } catch {
        /* noop */
      }
      reject(new Error(msg));
    };

    const timer = window.setTimeout(() => fail("timeout"), opts.timeoutMs ?? 14000);
    const done = (ok: boolean, msg = "") => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try {
        ws?.close();
      } catch {
        /* noop */
      }
      if (ok) {
        resolve(new Blob(chunks, { type: "audio/mpeg" }));
      } else {
        sessionDead = chunks.length === 0; // only blacklist if we never got audio
        reject(new Error(msg || "edge synthesis failed"));
      }
    };

    try {
      ws = new WebSocket(
        `${ENDPOINT}?TrustedClientToken=${TRUSTED_TOKEN}&ConnectionId=${uuid()}`
      );
    } catch {
      window.clearTimeout(timer);
      sessionDead = true;
      reject(new Error("websocket constructor failed"));
      return;
    }

    ws.binaryType = "arraybuffer";
    ws.onopen = () => {
      const config =
        `X-Timestamp:${gmtStamp()}\r\n` +
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
        `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
      ws!.send(config);

      const ssml =
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
        `<voice name='${opts.voice.name}'>` +
        `<prosody rate='${opts.voice.rate >= 0 ? "+" : ""}${opts.voice.rate}%' pitch='${
          opts.voice.pitch >= 0 ? "+" : ""
        }${opts.voice.pitch}%'>${xmlEscape(text)}</prosody>` +
        `</voice></speak>`;
      const frame =
        `X-RequestId:${requestId}\r\n` +
        `Content-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${gmtStamp()}Z\r\n` +
        `Path:ssml\r\n\r\n${ssml}`;
      ws!.send(frame);
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        if (ev.data.includes("Path:turn.end")) done(chunks.length > 0, "empty turn");
        return;
      }
      // binary frame: headers + \r\n\r\n + mp3 bytes
      const buf = new Uint8Array(ev.data as ArrayBuffer);
      let sep = -1;
      for (let i = 0; i < buf.length - 3; i++) {
        if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) {
          sep = i + 4;
          break;
        }
      }
      if (sep > 0 && sep < buf.length) chunks.push(buf.slice(sep));
    };

    ws.onerror = () => fail("socket error");
    ws.onclose = () => {
      if (!settled) done(chunks.length > 0, "socket closed early");
    };
  });
}
