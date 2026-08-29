import { useEffect, useRef, useState } from "react";
import type { BareHands, HandStatus } from "../lib/hands";

interface Props {
  engine: BareHands;
  accent: string;
  onClose: () => void;
}

const STATUS_TEXT: Record<HandStatus, string> = {
  off: "LINK OFF",
  loading: "WAKING MODEL…",
  active: "SHOW YOUR HAND",
  denied: "CAMERA DECLINED",
  error: "MODEL FAILED",
};

export default function HandOverlay({ engine, accent, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<HandStatus>(engine.status);
  const [seen, setSeen] = useState(false);
  const seenRef = useRef(false);

  useEffect(() => engine.onStatus(setStatus), [engine]);
  useEffect(() => {
    engine.accent = accent;
  }, [accent, engine]);

  useEffect(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    engine.canvas = c;
    engine.start(v);

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!seenRef.current && engine.state.present) {
        seenRef.current = true;
        setSeen(true);
      }
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      engine.canvas = null;
    };
  }, [engine]);

  const label =
    status === "active"
      ? seen
        ? "PINCH TO GRAB · OPEN TO DROP"
        : "SHOW YOUR HAND"
      : STATUS_TEXT[status];

  return (
    <div
      className="absolute right-3 top-3 z-20 w-48 overflow-hidden border bg-ink-900/90 backdrop-blur-sm rise-in"
      style={{ borderColor: `${accent}55`, boxShadow: `0 0 24px -8px ${accent}66` }}
    >
      <div
        className="flex items-center justify-between px-2.5 py-1.5"
        style={{ background: `${accent}14` }}
      >
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 11V6.5a1.5 1.5 0 0 0-3 0V11" />
            <path d="M15 10.5V4.8a1.5 1.5 0 0 0-3 0V10" />
            <path d="M12 10V3.5a1.5 1.5 0 0 0-3 0V11" />
            <path d="M9 11.5v-1a1.5 1.5 0 0 0-3 0V15a7 7 0 0 0 14 0v-4a1.5 1.5 0 0 0-3 0" />
          </svg>
          <span className="font-mono text-[9px] tracking-[0.22em] text-mist-300">BAREHANDS</span>
        </div>
        <button
          onClick={onClose}
          className="text-mist-500 transition-colors hover:text-mist-100"
          aria-label="Disable hand tracking"
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
        </button>
      </div>

      <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink-950">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
          style={{ transform: "scaleX(-1)", opacity: 0.55 }}
        />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: `${accent}66`, borderTopColor: "transparent" }}
            />
          </div>
        )}
      </div>

      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[8px] tracking-[0.18em]"
        style={{ color: status === "active" ? accent : "#8cacac" }}
      >
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${status === "active" ? "pulse-dot" : ""}`}
          style={{ background: status === "active" ? accent : status === "denied" || status === "error" ? "#ff5d5d" : "#66868a" }}
        />
        {label}
      </div>
    </div>
  );
}
