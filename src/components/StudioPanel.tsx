import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { engine, GENRE_LABEL } from "../lib/musicEngine";
import type { Genre, Track } from "../lib/musicEngine";
import type { Persona } from "../lib/personas";
import { alpha } from "../lib/personas";

const GENRES: Genre[] = ["lofi", "synthwave", "house", "ambient"];

const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path d="M4 2.5v11l9-5.5-9-5.5z" />
  </svg>
);
const StopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
    <rect x="2" y="2" width="10" height="10" rx="1.5" />
  </svg>
);
const RegenIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </svg>
);

interface Props {
  track: Track | null;
  persona: Persona;
  onGenerate: (genre?: Genre) => void;
  onTrackChange: (t: Track) => void;
}

export default function StudioPanel({ track, persona, onGenerate, onTrackChange }: Props) {
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(engine.isPlaying);
  const [vol, setVol] = useState(0.85);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const accentRef = useRef(persona.accent);
  accentRef.current = persona.accent;

  useEffect(() => {
    const offStep = engine.onStep((e) => {
      const now = engine.now();
      const delay = now != null ? Math.max(0, (e.time - now) * 1000) : 0;
      window.setTimeout(() => setStep(e.step), delay);
    });
    const offState = engine.onState((p) => {
      setPlaying(p);
      if (!p) setStep(-1);
    });
    return () => {
      offStep();
      offState();
    };
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const g = cv.getContext("2d");
    if (!g) return;
    let raf = 0;
    const data = new Uint8Array(128);
    let phase = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const dpr = 2;
      const W = cv.clientWidth * dpr;
      const H = cv.clientHeight * dpr;
      if (cv.width !== W || cv.height !== H) {
        cv.width = W;
        cv.height = H;
      }
      g.clearRect(0, 0, W, H);
      const acc = accentRef.current;
      const analyser = engine.getAnalyser();
      const N = 56;
      const bw = W / N;
      phase += 0.02;

      if (analyser && engine.isPlaying) {
        analyser.getByteFrequencyData(data as Uint8Array<ArrayBuffer>);
        for (let i = 0; i < N; i++) {
          const v = data[Math.floor((i / N) * data.length * 0.72)] / 255;
          const h = Math.max(2 * dpr, v * H * 0.92);
          g.fillStyle = alpha(acc, 0.16 + v * 0.75);
          g.fillRect(i * bw + 1.5, H - h, bw - 3, h);
          g.fillStyle = alpha("#EAF4F3", 0.25 + v * 0.6);
          g.fillRect(i * bw + 1.5, H - h, bw - 3, 2.4 * dpr * 0.5);
        }
      } else {
        g.strokeStyle = alpha(acc, 0.5);
        g.lineWidth = 1.6;
        g.beginPath();
        for (let x = 0; x <= W; x += 4) {
          const y = H / 2 + Math.sin(x * 0.02 + phase * 2) * H * 0.16 * Math.sin(phase + x * 0.002);
          if (x === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const bar = step >= 0 ? step >> 4 : 0;
  const col = step >= 0 ? step & 15 : -1;

  const rows = track
    ? [
        { label: "MEL", data: track.melody, color: persona.accent },
        { label: "BAS", data: track.bass, color: "#F5B94B" },
        { label: "KCK", data: track.kick, color: "#FF7A50" },
        {
          label: "HAT",
          data: track.hat.map((v, i) => Math.max(v, track.openHat[i])),
          color: "#8CACAC",
        },
      ]
    : [];

  const togglePlay = () => {
    if (playing) engine.stop();
    else if (track) engine.play(track);
    else onGenerate();
  };

  const fillStyle = (value: number, min: number, max: number): CSSProperties =>
    ({ "--fill": `${((value - min) / (max - min)) * 100}%` }) as CSSProperties;

  return (
    <div className="panel flex h-full flex-col overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between border-b border-ink-700/60 px-4 py-2.5">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-[11px] font-bold tracking-[0.22em] text-mist-100">
            WAVEFORGE
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-mist-600">
            generative studio
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${playing ? "pulse-dot" : ""}`}
            style={{ background: playing ? persona.accent : "#2F4C59" }}
          />
          <span className="font-mono text-[10px] tracking-widest text-mist-500">
            {playing ? "LIVE" : track ? "PAUSED" : "NO SIGNAL"}
          </span>
        </div>
      </div>

      {/* track meta + progress */}
      <div className="px-4 pt-3">
        {track ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h2 className="font-display text-sm font-bold tracking-wide text-mist-100">
              “{track.title}”
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
              <span className="border px-1.5 py-0.5 tracking-wider" style={{ borderColor: alpha(persona.accent, 0.5), color: persona.accent }}>
                {GENRE_LABEL[track.genre]}
              </span>
              <span className="border border-ink-600 px-1.5 py-0.5 text-mist-300">
                {track.rootName} {track.scaleName.toUpperCase()}
              </span>
              <span className="border border-ink-600 px-1.5 py-0.5 text-mist-300">{track.bpm} BPM</span>
              <span className="border border-ink-600 px-1.5 py-0.5 text-mist-600">
                SD·{track.seed.toString(36).slice(0, 5).toUpperCase()}
              </span>
            </div>
          </div>
        ) : (
          <p className="font-mono text-[11px] tracking-wide text-mist-600">
            AWAITING COMPOSITION — ask the core for a beat, or generate below
          </p>
        )}
        <div className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-ink-800">
          <div
            className="h-full rounded-full transition-[width] duration-100 ease-linear"
            style={{ width: `${((step + 1) / 64) * 100}%`, background: persona.accent }}
          />
        </div>
      </div>

      {/* visualizer */}
      <div className="px-4 pt-2.5">
        <canvas ref={canvasRef} className="h-[68px] w-full" />
      </div>

      {/* step grid */}
      <div className="mt-2 flex items-center gap-2 px-4">
        <div className="flex flex-col gap-[3px] font-mono text-[8px] leading-none text-mist-600">
          {rows.map((r) => (
            <span key={r.label} className="flex h-[13px] items-center">{r.label}</span>
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-[3px]">
          {rows.map((r) => (
            <div key={r.label} className="flex h-[13px] gap-[3px]">
              {Array.from({ length: 16 }, (_, s) => {
                const v = r.data[bar * 16 + s] ?? 0;
                const on = v > 0;
                return (
                  <div
                    key={s}
                    className="flex-1 rounded-[2px] transition-colors duration-75"
                    style={{
                      background: on ? alpha(r.color, 0.25 + v * 0.75) : "#182B34",
                      boxShadow: col === s ? `inset 0 0 0 1px ${alpha("#EAF4F3", 0.75)}` : undefined,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="font-mono text-[8px] tracking-widest text-mist-600">BAR</span>
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((b) => (
              <span
                key={b}
                className="h-1.5 w-1.5 rounded-full transition-colors"
                style={{ background: b === bar && step >= 0 ? persona.accent : "#213843" }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* transport */}
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink-700/60 px-4 py-3">
        <button
          onClick={togglePlay}
          className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all duration-200 hover:scale-110 active:scale-95"
          style={{
            borderColor: alpha(persona.accent, 0.65),
            color: playing ? "#0B1317" : persona.accent,
            background: playing ? persona.accent : alpha(persona.accent, 0.08),
            boxShadow: `0 0 22px ${alpha(persona.accent, playing ? 0.5 : 0.15)}`,
          }}
          aria-label={playing ? "Stop" : "Play"}
        >
          {playing ? <StopIcon /> : <PlayIcon />}
        </button>

        <button
          onClick={() => onGenerate(track?.genre)}
          className="flex items-center gap-1.5 border border-ink-600 px-2.5 py-1.5 font-mono text-[10px] tracking-widest text-mist-300 transition-all hover:border-mist-500 hover:text-mist-100 active:scale-95"
        >
          <RegenIcon />
          GENERATE
        </button>

        <div className="flex items-center gap-1">
          {GENRES.map((g) => {
            const active = track?.genre === g;
            return (
              <button
                key={g}
                onClick={() => onGenerate(g)}
                className="px-2 py-1 font-mono text-[9px] tracking-widest transition-all active:scale-95"
                style={{
                  border: `1px solid ${active ? alpha(persona.accent, 0.7) : "#213843"}`,
                  color: active ? persona.accent : "#66868A",
                  background: active ? alpha(persona.accent, 0.1) : "transparent",
                }}
              >
                {GENRE_LABEL[g]}
              </button>
            );
          })}
        </div>

        <label className="flex min-w-[130px] flex-1 items-center gap-2">
          <span className="font-mono text-[9px] tracking-widest text-mist-600">TEMPO</span>
          <input
            type="range"
            min={60}
            max={160}
            value={track?.bpm ?? 90}
            style={fillStyle(track?.bpm ?? 90, 60, 160)}
            onChange={(e) => {
              if (!track) return;
              const t = { ...track, bpm: Number(e.target.value) };
              onTrackChange(t);
              engine.setTrack(t);
            }}
          />
          <span className="w-8 text-right font-mono text-[10px] text-mist-300">{track?.bpm ?? "—"}</span>
        </label>

        <label className="flex min-w-[110px] items-center gap-2">
          <span className="font-mono text-[9px] tracking-widest text-mist-600">VOL</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(vol * 100)}
            style={fillStyle(vol * 100, 0, 100)}
            onChange={(e) => {
              const v = Number(e.target.value) / 100;
              setVol(v);
              engine.setVolume(v);
            }}
          />
        </label>
      </div>
    </div>
  );
}
