import { useEffect, useRef, useState } from "react";
import type { BareHands } from "../lib/hands";
import { alpha } from "../lib/personas";

interface Props {
  engine: BareHands;
  personaName: string;
  accent: string;
  onClose: () => void;
}

const pickMime = () => {
  if (typeof MediaRecorder === "undefined") return null;
  const cands = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  return cands.find((c) => MediaRecorder.isTypeSupported(c)) ?? null;
};

export default function LiveStream({ engine, personaName, accent, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rec, setRec] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [take, setTake] = useState<{ url: string; size: number } | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recSupported = pickMime() !== null;

  /* ---------- compositor loop ---------- */
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const g = cv.getContext("2d");
    if (!g) return;
    let raf = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const v = engine.video;
      const W = v?.videoWidth || 960;
      const H = v?.videoHeight || 540;
      if (cv.width !== W || cv.height !== H) {
        cv.width = W;
        cv.height = H;
      }
      // base
      g.fillStyle = "#0b1317";
      g.fillRect(0, 0, W, H);
      // mirrored camera feed
      if (v && v.readyState >= 2) {
        g.save();
        g.translate(W, 0);
        g.scale(-1, 1);
        g.drawImage(v, 0, 0, W, H);
        g.restore();
        // skeleton + pinch FX, matched to native dims
        engine.drawOverlay(g, W, H);
      }

      const s = Math.max(1, H / 540); // hud scale factor

      // top bar
      g.fillStyle = "rgba(11,19,23,0.72)";
      g.fillRect(0, 0, W, 44 * s);
      g.fillStyle = accent;
      g.fillRect(0, 44 * s - 2, W, 2);

      g.font = `700 ${13 * s}px "JetBrains Mono", monospace`;
      g.fillStyle = "#eaf4f3";
      g.fillText("BAREHANDS · ORBIT LIVE", 16 * s, 28 * s);

      // live badge
      const badgeX = W - 130 * s;
      g.fillStyle = alpha(accent, 0.16);
      g.fillRect(badgeX, 10 * s, 114 * s, 24 * s);
      g.fillStyle = rec ? "#ff5d5d" : accent;
      g.beginPath();
      g.arc(badgeX + 16 * s, 22 * s, 5 * s, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = rec ? "#ff5d5d" : "#eaf4f3";
      g.fillText(rec ? "REC" : "LIVE", badgeX + 30 * s, 27 * s);

      // persona watermark
      g.font = `700 ${18 * s}px "Unbounded", sans-serif`;
      g.fillStyle = alpha(accent, 0.9);
      g.fillText(personaName.toUpperCase(), 16 * s, H - 20 * s);
      g.font = `500 ${11 * s}px "JetBrains Mono", monospace`;
      g.fillStyle = "rgba(234,244,243,0.6)";
      g.fillText(new Date().toLocaleTimeString(), 16 * s + g.measureText(personaName).width * 3.1 + 40 * s, H - 20 * s);

      // pinch state readout
      const f = engine.state;
      g.font = `500 ${11 * s}px "JetBrains Mono", monospace`;
      const status = !f.present
        ? "NO HAND IN FRAME"
        : f.pinched
        ? "PINCH · HOLDING"
        : `TRACKING · ${Math.round(f.x * 100)}%/${Math.round(f.y * 100)}%`;
      const tw = g.measureText(status).width;
      g.fillStyle = "rgba(11,19,23,0.72)";
      g.fillRect(W - tw - 32 * s, H - 40 * s, tw + 24 * s, 26 * s);
      g.fillStyle = f.pinched ? accent : "rgba(234,244,243,0.75)";
      g.fillText(status, W - tw - 20 * s, H - 22 * s);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [engine, accent, personaName, rec]);

  /* ---------- recorder ---------- */
  const toggleRec = () => {
    if (rec) {
      recRef.current?.stop();
      return;
    }
    const cv = canvasRef.current;
    if (!cv || !recSupported) return;
    if (take) {
      URL.revokeObjectURL(take.url);
      setTake(null);
    }
    const stream = cv.captureStream(30);
    const mr = new MediaRecorder(stream, { mimeType: pickMime() ?? undefined, videoBitsPerSecond: 5_000_000 });
    chunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || "video/webm" });
      setTake({ url: URL.createObjectURL(blob), size: blob.size });
      setElapsed(0);
    };
    mr.start(1000);
    recRef.current = mr;
    setRec(true);
    setElapsed(0);
  };

  useEffect(() => {
    if (!rec) return;
    const t0 = Date.now();
    const iv = window.setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => window.clearInterval(iv);
  }, [rec]);

  useEffect(
    () => () => {
      try {
        recRef.current?.stop();
      } catch {
        /* noop */
      }
    },
    []
  );

  const fmt = (sec: number) =>
    `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink-950/85 backdrop-blur-sm rise-in" onClick={onClose}>
      <div
        className="panel relative w-[min(92vw,880px)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ borderColor: alpha(accent, 0.4), boxShadow: `0 0 60px -12px ${alpha(accent, 0.5)}` }}
      >
        <div className="flex items-center justify-between border-b border-ink-700/70 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${rec ? "blink" : "pulse-dot"}`} style={{ background: rec ? "#ff5d5d" : accent }} />
            <span className="font-mono text-[10px] tracking-[0.26em] text-mist-100">
              LIVE STREAM <span style={{ color: accent }}>· BAREHANDS FEED</span>
            </span>
          </div>
          <button onClick={onClose} className="border border-ink-600 px-2 py-1 font-mono text-[9px] tracking-[0.18em] text-mist-500 transition-colors hover:border-mist-500 hover:text-mist-100">
            CLOSE ✕
          </button>
        </div>

        <div className="relative bg-ink-950">
          <canvas ref={canvasRef} className="block h-auto max-h-[58vh] w-full object-contain" />
          {rec && (
            <span className="absolute right-3 top-3 bg-ink-950/80 px-2 py-1 font-mono text-[10px] tracking-[0.2em] text-[#ff5d5d]">
              ● {fmt(elapsed)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-ink-700/70 px-4 py-3">
          <button
            onClick={toggleRec}
            disabled={!recSupported}
            className="flex items-center gap-2 border px-3 py-1.5 font-mono text-[10px] tracking-[0.2em] transition-all disabled:opacity-30"
            style={{
              borderColor: rec ? "#ff5d5d" : accent,
              color: rec ? "#ff5d5d" : accent,
              background: rec ? "rgba(255,93,93,0.08)" : alpha(accent, 0.08),
            }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: rec ? "#ff5d5d" : "currentColor" }} />
            {rec ? `STOP · ${fmt(elapsed)}` : "RECORD STREAM"}
          </button>

          {take && (
            <a
              href={take.url}
              download={`orbit-barehands-live-${Date.now()}.webm`}
              className="flex items-center gap-1.5 border border-lyra/60 px-3 py-1.5 font-mono text-[10px] tracking-[0.2em] text-lyra transition-all hover:-translate-y-px hover:shadow-[0_0_14px_rgba(155,225,93,0.35)]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
                <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
              SAVE TAKE · {(take.size / 1048576).toFixed(1)} MB
            </a>
          )}

          <span className="ml-auto font-mono text-[8px] tracking-[0.18em] text-mist-600">
            {!recSupported
              ? "RECORDING UNSUPPORTED IN THIS BROWSER"
              : engine.state.present
              ? "HAND LOCKED · STREAM COMPOSITING AT 30 FPS"
              : "STREAMING · SHOW YOUR HAND TO THE CAMERA"}
          </span>
        </div>
      </div>
    </div>
  );
}
