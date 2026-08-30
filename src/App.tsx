import { Component, Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Assistant3D, { FallbackCore } from "./components/Assistant3D";
import type { BeatRef } from "./components/Assistant3D";
import StudioPanel from "./components/StudioPanel";
import ChatPanel from "./components/ChatPanel";
import HandOverlay from "./components/HandOverlay";
import { GalleryPanel, ObjectForge, TastePanel } from "./components/Docks";
import HudRail, { UtcClock } from "./components/HudRail";
import type { FlyoutId } from "./components/HudRail";
import { taste, refineImagePrompt, auditConsole, auditScore } from "./lib/taste";
import KernelPanel from "./components/KernelPanel";
import { kernel, kernelNum, planFromText, fmtVal } from "./lib/kernel";
import { PERSONAS, getPersona, alpha } from "./lib/personas";
import type { Mood, PersonaId } from "./lib/personas";
import { engine, generateTrack, GENRE_LABEL } from "./lib/musicEngine";
import type { Genre, Track } from "./lib/musicEngine";
import {
  COLOR_WORDS,
  detectIntent,
  extractDetails,
  extraLine,
  fill,
  musicLine,
  pick,
  simpleLine,
  spawnLine,
} from "./lib/chatEngine";
import type { ChatMessage } from "./lib/chatEngine";
import { BareHands, EMPTY_FRAME } from "./lib/hands";
import type { HandFrame, HandStatus } from "./lib/hands";
import { generateImage } from "./lib/imageGen";
import type { GeneratedImage } from "./lib/imageGen";
import { micSupported, speak, startListening, stopSpeaking } from "./lib/voice";
import type { RecognitionHandle, TtsEngine } from "./lib/voice";
import { voiceLabelFor } from "./lib/voice";
import LiveStream from "./components/LiveStream";
import ReconPanel from "./components/ReconBoard";
import { createBoard, exportSheet, sectionPrompt } from "./lib/reconBoard";
import type { Board, SectionKey } from "./lib/reconBoard";
import PremodelPanel from "./components/PremodelPanel";
import { createPremodelPlan } from "./lib/premodel";
import type { PremodelPlan } from "./lib/premodel";
import GodsEye from "./components/GodsEye";
import type { FocusPoint, GodsEyeApi } from "./components/GodsEye";
import { geocode, windDirName } from "./lib/godsEye";
import type { AirNow, WeatherNow } from "./lib/godsEye";
import { FORGE_COLORS } from "./lib/sceneTypes";
import type { PinnedImage, SceneObject, ShapeKind } from "./lib/sceneTypes";

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface LogEntry {
  t: string;
  msg: string;
}

/* ---------- tiny UI atoms (legacy rail atoms removed — see HudRail.tsx) ---------- */

function Toggle({ on, onClick, accent, label }: { on: boolean; onClick: () => void; accent: string; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="relative h-[18px] w-[34px] shrink-0 rounded-full border transition-colors duration-300"
      style={{
        background: on ? alpha(accent, 0.3) : "#13222a",
        borderColor: on ? accent : "#2f4c59",
      }}
    >
      <span
        className="absolute top-[2.5px] h-[11px] w-[11px] rounded-full transition-all duration-300"
        style={{
          left: on ? 18 : 3,
          background: on ? accent : "#66868a",
          boxShadow: on ? `0 0 8px ${accent}` : "none",
        }}
      />
    </button>
  );
}

function MiniBtn({
  label,
  active,
  activeColor = "#3fe0c5",
  dot,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  activeColor?: string;
  dot?: string | null;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const c = active ? activeColor : "#8cacac";
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="relative flex h-9 w-9 shrink-0 items-center justify-center border transition-all hover:-translate-y-px"
      style={{
        borderColor: active ? `${activeColor}77` : "#1c313b",
        color: c,
        background: active ? `${activeColor}14` : "rgba(19,34,42,0.5)",
      }}
    >
      {children}
      {dot && <span className="pulse-dot absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
    </button>
  );
}

function RailMini({
  accent,
  personaId,
  onPersona,
  handsOn,
  handsActive,
  onHands,
  listening,
  onListen,
  onTab,
  viewMode,
  onGods,
  liveOpen,
  onLive,
  onImport,
}: {
  accent: string;
  personaId: PersonaId;
  onPersona: (id: PersonaId) => void;
  handsOn: boolean;
  handsActive: boolean;
  onHands: () => void;
  listening: boolean;
  onListen: () => void;
  onTab: (t: FlyoutId) => void;
  viewMode: "core" | "gods";
  onGods: () => void;
  liveOpen: boolean;
  onLive: () => void;
  onImport: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-y-auto py-3 [scrollbar-width:none]">
      {PERSONAS.map((p) => {
        const active = p.id === personaId;
        return (
          <button
            key={p.id}
            onClick={() => onPersona(p.id)}
            title={`${p.name} — ${p.role}`}
            aria-label={`Switch to ${p.name}`}
            className={`h-7 w-7 shrink-0 rounded-full border-2 transition-transform hover:scale-110 ${active ? "pulse-dot" : ""}`}
            style={{
              background: active ? p.accent : alpha(p.accent, 0.22),
              borderColor: active ? "#eaf4f3" : alpha(p.accent, 0.55),
            }}
          />
        );
      })}
      <div className="my-1 h-px w-7 shrink-0 bg-ink-700" />
      <MiniBtn label="Barehands pinch control" active={handsOn} activeColor={accent} dot={handsActive ? accent : null} onClick={onHands}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 11V6.5a1.5 1.5 0 0 0-3 0V11" />
          <path d="M15 10.5V4.8a1.5 1.5 0 0 0-3 0V10" />
          <path d="M12 10V3.5a1.5 1.5 0 0 0-3 0V11" />
          <path d="M9 11.5v-1a1.5 1.5 0 0 0-3 0V15a7 7 0 0 0 14 0v-4a1.5 1.5 0 0 0-3 0" />
        </svg>
      </MiniBtn>
      <MiniBtn label="Voice link · microphone" active={listening} activeColor={accent} onClick={onListen}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
        </svg>
      </MiniBtn>
      <MiniBtn label="Import images / videos to the scene" activeColor={accent} onClick={onImport}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 16V4m0 0 4 4m-4-4-4 4" />
          <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
      </MiniBtn>
      <div className="my-1 h-px w-7 shrink-0 bg-ink-700" />
      <MiniBtn label="Gallery dock" activeColor={accent} onClick={() => onTab("gallery")}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.5-3.5a2 2 0 0 0-2.8 0L6 20" />
        </svg>
      </MiniBtn>
      <MiniBtn label="Object forge dock" activeColor={accent} onClick={() => onTab("forge")}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
          <path d="M12 2 21 7v10l-9 5-9-5V7l9-5z" />
          <path d="M12 12 21 7M12 12v10M12 12 3 7" />
        </svg>
      </MiniBtn>
      <MiniBtn label="Recon deck" activeColor={accent} onClick={() => onTab("recon")}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M9 13h6M9 17h4" />
        </svg>
      </MiniBtn>
      <MiniBtn label="God's Eye observation deck" active={viewMode === "gods"} activeColor="#9be15d" onClick={onGods}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z" />
        </svg>
      </MiniBtn>
      <MiniBtn label="Live stream monitor" active={liveOpen} activeColor="#ff5d5d" dot={liveOpen ? "#ff5d5d" : null} onClick={onLive}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="2.5" />
          <path d="M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 19.1a10 10 0 0 1 0-14.2M19.1 4.9a10 10 0 0 1 0 14.2" />
        </svg>
      </MiniBtn>
    </div>
  );
}

function ModuleRow({
  title,
  sub,
  right,
}: {
  title: string;
  sub: string;
  right: React.ReactNode;
}) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2 border border-ink-700/50 bg-ink-850/40 px-2.5 py-2 transition-colors hover:border-ink-600">
      <div className="min-w-0">
        <p className="font-mono text-[9px] font-bold tracking-[0.18em] text-mist-300">{title}</p>
        <p className="truncate font-mono text-[7.5px] tracking-[0.08em] text-mist-600">{sub}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{right}</div>
    </div>
  );
}

/* ==================================================================== */

const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage unavailable */
    }
  },
};

export const FIELD_CAP = 36;
const maxObjects = () => kernelNum("scene.maxObjects");

/* ---------- stage boundary: a blank viewport must never be silent ---------- */

class StageBoundary extends Component<{ children: ReactNode }, { error: string | null; epoch: number }> {
  state = { error: null as string | null, epoch: 0 };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
          <p className="font-mono text-[10px] tracking-[0.3em] text-ember">CORE VIEWPORT FAULT</p>
          <code className="max-w-full break-words border border-ink-600 bg-ink-950/70 px-3 py-2 font-mono text-[9px] leading-relaxed text-mist-300">
            {this.state.error}
          </code>
          <p className="max-w-sm font-mono text-[8px] leading-relaxed tracking-[0.12em] text-mist-600">
            THE RENDER SUBTREE THREW AT RUNTIME — USUALLY A GPU DRIVER HICCUP OR LOST WEBGL CONTEXT. REBOOT RE-MOUNTS THE CORE.
          </p>
          <button
            onClick={() => this.setState((s) => ({ error: null, epoch: s.epoch + 1 }))}
            className="border border-ember px-4 py-2 font-mono text-[10px] tracking-[0.22em] text-ember transition-all hover:-translate-y-px hover:bg-ember/10"
          >
            REBOOT CORE
          </button>
        </div>
      );
    }
    return <Fragment key={this.state.epoch}>{this.props.children}</Fragment>;
  }
}

/* ---------- top-level crash report ---------- */

class CrashBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-ink-950 font-mono text-mist-100">
          <div className="w-[min(560px,90vw)] border border-ember/60 bg-ink-900 p-6" style={{ boxShadow: "0 0 60px -20px rgba(255,122,80,0.5)" }}>
            <p className="text-[11px] tracking-[0.3em] text-ember">ORBIT CONSOLE — KERNEL PANIC</p>
            <code className="mt-3 block border border-ink-600 bg-ink-950/80 px-3 py-2 text-[10px] leading-relaxed text-mist-300">
              {this.state.error}
            </code>
            <p className="mt-3 text-[9px] leading-relaxed tracking-[0.1em] text-mist-600">
              AN UNCAUGHT FAULT TOOK THE CONSOLE DOWN. A RELOAD RESTORES STATE FROM THE JOURNALS (PERSONA, KERNEL PATCHES, PREFERENCES).
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 border border-ember px-4 py-2 text-[10px] tracking-[0.22em] text-ember transition-all hover:-translate-y-px hover:bg-ember/10"
            >
              RELOAD CONSOLE
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppInner() {
  /* ---------- state ---------- */
  const [personaId, setPersonaId] = useState<PersonaId>(() => {
    const s = store.get("orbit.persona");
    return s === "nova" || s === "ember" || s === "atlas" || s === "lyra" ? (s as PersonaId) : "nova";
  });
  const [mood, setMood] = useState<Mood>("idle");
  const [track, setTrack] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [tab, setTab] = useState<FlyoutId | null>(null);
  const [seenMsgs, setSeenMsgs] = useState(0);
  useEffect(() => {
    if (tab === "chat") setSeenMsgs(messages.length);
  }, [tab, messages.length]);
  const unread = tab === "chat" ? 0 : Math.max(0, messages.length - seenMsgs);
  const [railOpen, setRailOpen] = useState(() => store.get("orbit.rail") === "1");
  const importRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [imagesBusy, setImagesBusy] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const boardRef = useRef<Board | null>(null);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  /* ---------- premodel governor ---------- */
  const [reconMode, setReconMode] = useState<"board" | "gate">("board");
  const [gatePlan, setGatePlan] = useState<PremodelPlan | null>(null);
  const gatePlanRef = useRef<PremodelPlan | null>(null);
  useEffect(() => {
    gatePlanRef.current = gatePlan;
  }, [gatePlan]);

  /* ---------- god's eye observation deck ---------- */
  const [viewMode, setViewMode] = useState<"core" | "gods">("core");
  // deck mounts lazily on first visit so it can never fault the assistant viewport at boot
  const [deckVisited, setDeckVisited] = useState(false);
  useEffect(() => {
    if (viewMode === "gods") setDeckVisited(true);
  }, [viewMode]);
  const godsApiRef = useRef<GodsEyeApi | null>(null);
  const [focusPoint, setFocusPoint] = useState<FocusPoint | null>(null);
  const focusPointRef = useRef<FocusPoint | null>(null);
  useEffect(() => {
    focusPointRef.current = focusPoint;
  }, [focusPoint]);
  const [objects, setObjects] = useState<SceneObject[]>([]);
  const [pinned, setPinned] = useState<PinnedImage[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [handsOn, setHandsOn] = useState(false);
  const [handsStatus, setHandsStatus] = useState<HandStatus>("off");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState<string | null>(null);
  const [voiceOut, setVoiceOut] = useState(() => store.get("orbit.voice") === "1");
  const [ttsEngine, setTtsEngine] = useState<{ engine: TtsEngine; label: string } | null>(null);
  const [liveOpen, setLiveOpen] = useState(false);
  const [kernelRev, setKernelRev] = useState(0);
  useEffect(() => kernel.onChange(() => setKernelRev((r) => r + 1)), []);
  const [tasteProfile, setTasteProfile] = useState(() => taste.active());
  useEffect(() => taste.onChange(() => setTasteProfile(taste.active())), []);
  const [speaking, setSpeaking] = useState(false);

  /* ---------- refs ---------- */
  const beatRef = useRef<BeatRef["current"]>({ at: 0, accent: false });
  const handFrameRef = useRef<HandFrame>({ ...EMPTY_FRAME });
  const handsEngineRef = useRef<BareHands | null>(null);
  const recRef = useRef<RecognitionHandle | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const personaIdRef = useRef<PersonaId>("nova");
  const trackRef = useRef<Track | null>(null);
  const objectsRef = useRef<SceneObject[]>([]);
  const pinnedRef = useRef<PinnedImage[]>([]);
  const voiceOutRef = useRef(store.get("orbit.voice") === "1");
  const listeningRef = useRef(false);
  const handsOnRef = useRef(false);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { personaIdRef.current = personaId; }, [personaId]);
  useEffect(() => { trackRef.current = track; }, [track]);
  useEffect(() => { objectsRef.current = objects; }, [objects]);
  useEffect(() => { pinnedRef.current = pinned; }, [pinned]);

  const persona = getPersona(personaId);

  /* ---------- persistence ---------- */
  useEffect(() => {
    store.set("orbit.persona", personaId);
    store.set("orbit.voice", voiceOut ? "1" : "0");
  }, [personaId, voiceOut]);

  /* ---------- keyboard transport ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      if (engine.isPlaying) engine.stop();
      else if (trackRef.current) engine.play(trackRef.current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- primitives ---------- */

  const addLog = useCallback((msg: string) => {
    const d = new Date();
    const t = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
    setLog((p) => [...p.slice(-48), { t, msg }]);
  }, []);

  /* ---------- core renderer ignition telemetry ---------- */
  const coreReadyRef = useRef(false);
  const [coreReady, setCoreReady] = useState(false);
  const [coreStalled, setCoreStalled] = useState(false);
  const [stageEpoch, setStageEpoch] = useState(0);

  const onCoreReady = useCallback(() => {
    if (coreReadyRef.current) return;
    coreReadyRef.current = true;
    setCoreReady(true);
    addLog("core: renderer online — first frame");
  }, [addLog]);

  useEffect(() => {
    if (coreReady) return;
    const t = window.setTimeout(() => setCoreStalled(true), 4500);
    return () => window.clearTimeout(t);
  }, [coreReady, stageEpoch]);

  const webglProbe = useMemo(() => {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      return false;
    }
  }, []);

  const pushMsg = useCallback((m: ChatMessage) => {
    setMessages((p) => [...p.slice(-60), m]);
  }, []);

  const reply = useCallback(
    (text: string, opts?: { personaId?: PersonaId; imageUrl?: string; imagePrompt?: string }) => {
      const pid = opts?.personaId ?? personaIdRef.current;
      setTyping(false);
      pushMsg({
        id: uid(),
        role: "agent",
        text,
        personaId: pid,
        imageUrl: opts?.imageUrl,
        imagePrompt: opts?.imagePrompt,
        status: "streaming",
      });
      setMood("talking");
    },
    [pushMsg]
  );

  const spawnObject = useCallback((shape: ShapeKind, color: string) => {
    const obj: SceneObject = {
      id: uid(),
      shape,
      color,
      position: [rand(-3.4, 3.4), rand(-1.2, 1.9), rand(-1.4, 1.4)],
      scale: rand(0.75, 1.3),
      spin: rand(0.3, 1) * (Math.random() > 0.5 ? 1 : -1),
    };
    setObjects((p) => [...p, obj]);
  }, []);

  /* ---------- barehands ---------- */

  const setHands = useCallback(
    (on: boolean) => {
      if (handsOnRef.current === on) return;
      if (on) {
        if (!handsEngineRef.current) {
          const eng = new BareHands();
          handsEngineRef.current = eng;
          handFrameRef.current = eng.state;
          eng.onStatus((s) => {
            setHandsStatus(s);
            if ((s === "denied" || s === "error") && handsOnRef.current) {
              handsOnRef.current = false;
              setHandsOn(false);
              reply(
                s === "denied"
                  ? "The camera waved back… then declined. Barehands needs permission — click the lock icon in your address bar, allow the webcam, and say “hands on” again."
                  : "The hand-tracking model failed to load — likely an offline moment. The hands remain metaphorical for now."
              );
              addLog(`barehands: ${s}`);
            }
          });
        }
        handsOnRef.current = true;
        setHandsOn(true);
        addLog("barehands link engaging");
      } else {
        handsEngineRef.current?.stop();
        handsOnRef.current = false;
        setHandsOn(false);
        setHandsStatus("off");
        handFrameRef.current = { ...EMPTY_FRAME };
        addLog("barehands link closed");
      }
    },
    [addLog, reply]
  );

  /* ---------- voice ---------- */

  const startRec = useCallback((): void => {
    recRef.current?.stop();
    recRef.current = startListening({
      onInterim: (t) => setInterim(t),
      onFinal: (t) => {
        setInterim(null);
        sendMessageRef.current(t);
      },
      onEnd: () => {
        // Chrome ends sessions frequently — restart, but never spin
        if (listeningRef.current && Date.now() - lastRecStart.current > 1200) {
          window.setTimeout(() => {
            if (listeningRef.current) startRec();
          }, 350);
        } else if (listeningRef.current) {
          listeningRef.current = false;
          setListening(false);
          setInterim(null);
        }
      },
    });
    lastRecStart.current = Date.now();
  }, []);
  const lastRecStart = useRef(0);

  const sendMessageRef = useRef<(t: string) => void>(() => undefined);

  const setListen = useCallback(
    (on: boolean) => {
      if (listeningRef.current === on) return;
      if (on && !micSupported) {
        reply("Speech recognition lives in Chrome and Edge — this browser keeps my ears politely closed.");
        return;
      }
      listeningRef.current = on;
      setListening(on);
      if (on) {
        addLog("mic open — listening");
        startRec();
      } else {
        recRef.current?.stop();
        recRef.current = null;
        setInterim(null);
        addLog("mic closed");
      }
    },
    [addLog, reply, startRec]
  );

  const toggleVoiceOut = useCallback(() => {
    const nv = !voiceOutRef.current;
    voiceOutRef.current = nv;
    setVoiceOut(nv);
    if (!nv) {
      stopSpeaking();
      setSpeaking(false);
      setMood(engine.isPlaying ? "djing" : "idle");
      addLog("agent voice muted");
    } else {
      addLog("agent voice armed");
    }
  }, [addLog]);

  /* ---------- intent routing ---------- */

  const playNew = useCallback(
    (genre?: Genre, seed?: number, bpm?: number) => {
      const pid = personaIdRef.current;
      const t = generateTrack({ persona: pid, genre, seed, bpm });
      engine.stop();
      engine.play(t);
      setTrack(t);
      setMood("djing");
      addLog(`waveforge: “${t.title}” ${GENRE_LABEL[t.genre]} ${t.bpm} BPM`);
      return t;
    },
    [addLog]
  );

  /* ---------- recon board orchestration ---------- */

  const startRecon = useCallback(
    (object: string) => {
      const pid = personaIdRef.current;
      const b = createBoard(object);
      setBoard(b);
      setTab("recon");
      addLog(`recon: drafting sheet for “${object}”`);
      const imageKeys = b.sections.filter((s) => s.image).map((s) => s.key);
      const jobs = imageKeys.map(
        (k, i) =>
          new Promise<void>((resolve) => {
            window.setTimeout(() => {
              setBoard((prev) =>
                prev && prev.id === b.id
                  ? { ...prev, sections: prev.sections.map((s) => (s.key === k ? { ...s, status: "rendering" as const } : s)) }
                  : prev,
              );
              void generateImage(sectionPrompt(b.object, k, b.seed)).then((gen) => {
                setBoard((prev) =>
                  prev && prev.id === b.id
                    ? {
                        ...prev,
                        sections: prev.sections.map((s) =>
                          s.key === k
                            ? { ...s, status: (gen.method === "ai" ? "done" : "fallback") as "done" | "fallback", src: gen.src, method: gen.method === "ai" ? "ai" as const : "procedural" as const }
                            : s,
                        ),
                      }
                    : prev,
                );
                resolve();
              });
            }, 500 + i * 900);
          }),
      );
      void Promise.all(jobs).then(() => {
        addLog(`recon: sheet REV A complete · ${imageKeys.length} views`);
        reply(extraLine(pid, "reconDone", { object }));
      });
    },
    [addLog, reply]
  );

  const regenSection = useCallback((key: SectionKey) => {
    const b = boardRef.current;
    if (!b) return;
    const newSeed = Math.floor(Math.random() * 1_000_000_000);
    setBoard((prev) =>
      prev
        ? { ...prev, sections: prev.sections.map((s) => (s.key === key ? { ...s, status: "rendering" as const, seed: newSeed } : s)) }
        : prev,
    );
    void generateImage(sectionPrompt(b.object, key, newSeed)).then((gen) => {
      setBoard((prev) =>
        prev
          ? {
              ...prev,
              sections: prev.sections.map((s) =>
                s.key === key
                  ? { ...s, status: (gen.method === "ai" ? "done" : "fallback") as "done" | "fallback", src: gen.src, method: gen.method === "ai" ? "ai" as const : "procedural" as const }
                  : s,
              ),
            }
          : prev,
      );
    });
  }, []);

  const downloadSheet = useCallback(() => {
    const b = boardRef.current;
    if (!b) return;
    addLog("recon: exporting composite sheet…");
    void exportSheet(b).then((url) => {
      if (!url) {
        addLog("recon: export blocked by CORS — use per-view SAVE");
        return;
      }
      const a = document.createElement("a");
      a.href = url;
      a.download = `recon-${b.object.toLowerCase().replace(/\s+/g, "-")}-rev${b.rev}.png`;
      a.click();
      addLog("recon: sheet downloaded");
    });
  }, [addLog]);

  /* ---------- god's eye navigation ---------- */

  /* open the deck and run a command once its API is live (deck mounts lazily) */
  const deckCmd = useCallback((fn: (api: GodsEyeApi) => void) => {
    setViewMode("gods");
    let tries = 12;
    const attempt = () => {
      if (godsApiRef.current) fn(godsApiRef.current);
      else if (--tries > 0) window.setTimeout(attempt, 130);
    };
    window.setTimeout(attempt, 40);
  }, []);

  const navTo = useCallback(
    async (target: string) => {
      setViewMode("gods");
      const place = await geocode(target);
      if (!place) {
        reply(extraLine(personaIdRef.current, "navNotFound"));
        addLog(`god's eye: could not locate “${target}”`);
        return;
      }
      deckCmd((api) => api.flyTo(place.lat, place.lon, 9, place.name));
      addLog(`god's eye: nav → ${place.name}`);
    },
    [addLog, reply, deckCmd]
  );

  const onWeatherReport = useCallback(
    (place: FocusPoint, w: WeatherNow | null, a: AirNow | null) => {
      if (!w) return;
      const vars = {
        place: place.label,
        temp: Math.round(w.temp),
        label: w.label.toLowerCase(),
        feels: Math.round(w.feels),
        wind: Math.round(w.wind),
        dir: windDirName(w.windDir),
        hum: w.humidity,
        pres: Math.round(w.pressure),
        aqi: a ? a.aqi : "n/a",
        aqiLabel: a ? a.label.toLowerCase() : "unknown",
      };
      reply(extraLine(personaIdRef.current, "wx", vars));
      addLog(`god's eye: telemetry for ${place.label}`);
    },
    [addLog, reply]
  );

  /* ---------- premodel gate orchestration ---------- */

  const runGate = useCallback(
    (object: string) => {
      const plan = createPremodelPlan(object);
      setGatePlan(plan);
      setTab("recon");
      setReconMode("gate");
      addLog(`premodel: gate PASS for “${object}” · ${plan.regions.length} regions`);
    },
    [addLog]
  );

  const route = useCallback(
    (text: string) => {
      const intent = detectIntent(text);
      const det = extractDetails(text);
      const pid = personaIdRef.current;
      const p = getPersona(pid);

      switch (intent) {
        case "switch": {
          const others = PERSONAS.filter((x) => x.id !== pid);
          const target = det.personaId && det.personaId !== pid ? det.personaId : pick(others).id;
          setPersonaId(target);
          reply(simpleLine(target, "switchIn"), { personaId: target });
          addLog(`core swap → ${target.toUpperCase()}`);
          return;
        }
        case "music":
        case "regenerate": {
          const genre = intent === "regenerate" && trackRef.current ? trackRef.current.genre : det.genre;
          const seed = undefined; // fresh seed every take — remixes never repeat
          const t = playNew(genre, seed);
          reply(musicLine(pid, { title: t.title, genre: GENRE_LABEL[t.genre], bpm: t.bpm, key: `${t.rootName} ${t.scaleName}` }));
          return;
        }
        case "stop":
          engine.stop();
          stopSpeaking();
          setSpeaking(false);
          setMood("idle");
          reply(simpleLine(pid, "stop"));
          addLog("playback + voice stopped");
          return;
        case "play": {
          if (trackRef.current && !engine.isPlaying) {
            engine.play(trackRef.current);
            setMood("djing");
            reply(simpleLine(pid, "play"));
            addLog("playback resumed");
          } else if (!trackRef.current) {
            const t = playNew(det.genre);
            reply(musicLine(pid, { title: t.title, genre: GENRE_LABEL[t.genre], bpm: t.bpm, key: `${t.rootName} ${t.scaleName}` }));
          } else {
            reply(simpleLine(pid, "fallback"));
          }
          return;
        }
        case "faster":
        case "slower": {
          const cur = trackRef.current;
          if (!cur) {
            const t = playNew(det.genre);
            reply(musicLine(pid, { title: t.title, genre: GENRE_LABEL[t.genre], bpm: t.bpm, key: `${t.rootName} ${t.scaleName}` }));
            return;
          }
          const bpm = clampN(cur.bpm + (intent === "faster" ? 14 : -14), 55, 185);
          const t = playNew(cur.genre, cur.seed, bpm);
          reply(fill(pick(intent === "faster" ? p.voice.faster : p.voice.slower), { bpm: t.bpm }));
          addLog(`tempo → ${t.bpm} BPM`);
          return;
        }
        case "recon": {
          const object = det.reconObject ?? "mystery artifact";
          reply(extraLine(pid, "reconStart", { object }));
          startRecon(object);
          return;
        }
        case "premodel": {
          const object = det.premodelObject ?? "mystery artifact";
          const plan = createPremodelPlan(object);
          setGatePlan(plan);
          setTab("recon");
          setReconMode("gate");
          addLog(`premodel: drafting gate for “${object}”`);
          reply(extraLine(pid, "premodelStart", { object }));
          window.setTimeout(() => {
            addLog(`premodel: gate PASS · ${plan.regions.length} regions · ${plan.stages.length} stages`);
            reply(
              extraLine(personaIdRef.current, "premodelPass", {
                object,
                regions: plan.regions.length,
                stages: plan.stages.length,
              })
            );
          }, 900);
          return;
        }
        case "gods_on": {
          setViewMode("gods");
          reply(extraLine(pid, "godsOn"));
          addLog("god's eye: observation deck opened");
          return;
        }
        case "gods_off": {
          setViewMode("core");
          reply(extraLine(pid, "godsOff"));
          addLog("god's eye: deck closed, back to core");
          return;
        }
        case "navigate": {
          const target = det.navTarget;
          if (!target) {
            reply(simpleLine(pid, "fallback"));
            return;
          }
          void navTo(target);
          return;
        }
        case "weather": {
          const wt = det.weatherTarget;
          if (wt) {
            void navTo(wt);
          } else if (focusPointRef.current) {
            setViewMode("gods");
            const f = focusPointRef.current;
            godsApiRef.current?.flyTo(f.lat, f.lon, 8, f.label);
            addLog(`god's eye: re-query telemetry for ${f.label}`);
          } else {
            reply(extraLine(pid, "wxNoFocus"));
          }
          return;
        }
        case "layer": {
          deckCmd((api) => {
            if (/street/i.test(text)) api.setBase("streets");
            else if (/imagery|satellite/i.test(text)) api.setBase("imagery");
            else if (/true ?color|terra/i.test(text)) api.setBase("truecolor");
            else if (/fire|thermal/i.test(text)) api.setOverlay("fires", true);
            else if (/rail|transit/i.test(text)) api.setOverlay("transit", true);
            else if (/seismic|earthquake/i.test(text)) api.setOverlay("seismic", true);
            else if (/event/i.test(text)) api.setOverlay("events", true);
            else if (/sat\b|satellite/i.test(text)) api.setBase("imagery");
          });
          reply(extraLine(pid, "layerDone"));
          addLog("god's eye: layer adjusted");
          return;
        }
        case "feed": {
          deckCmd((api) => api.setFeed("f1"));
          reply(extraLine(pid, "feedDone"));
          addLog("god's eye: feed monitor opened");
          return;
        }
        case "webrtc": {
          deckCmd((api) => api.engageLink());
          reply(extraLine(pid, "webrtcDone"));
          return;
        }
        case "taste": {
          const names: [RegExp, string][] = [
            [/signal|console|instrument/i, "signal"],
            [/editorial|sheet|broad|magazine/i, "editorial"],
            [/cinema|film|movie|noir(?!.*terminal)/i, "cinema"],
            [/brutal|raw|hard ?edge/i, "brutal"],
            [/organic|nature|moss|grown/i, "organic"],
            [/terminal|phosphor|crt|hacker/i, "terminal"],
          ];
          const hit = names.find(([re]) => re.test(text))?.[1];
          if (hit && taste.set(hit)) {
            const prof = taste.active();
            setTab("taste");
            reply(extraLine(pid, "tasteApplied", { profile: prof.name }));
            addLog(`taste: doctrine → ${prof.name}`);
          } else {
            setTab("taste");
            reply(extraLine(pid, "tasteOpen", { profile: taste.active().name }));
            addLog("taste: doctrine console opened");
          }
          return;
        }
        case "audit": {
          const checks = auditConsole();
          const score = auditScore(checks);
          const failed = checks.filter((c) => !c.pass);
          setTab("taste");
          reply(
            extraLine(pid, "tasteAudit", {
              profile: taste.active().name,
              passed: checks.filter((c) => c.pass).length,
              total: checks.length,
            }) +
              (failed.length
                ? ` Watch-list: ${failed.map((f) => f.name.toLowerCase()).join(", ")}.`
                : " The watch-list is empty — ship it.")
          );
          addLog(`taste: self-audit ${score}`);
          return;
        }
        case "image": {
          const prompt = refineImagePrompt(det.imagePrompt ?? "an abstract dreamscape");
          reply(extraLine(pid, "imageStart", { prompt }));
          addLog(`rendering: “${prompt}”`);
          setTab("gallery");
          setImagesBusy(prompt);
          void generateImage(prompt).then((gen) => {
            setImages((prev) => [gen, ...prev].slice(0, 24));
            setImagesBusy(null);
            reply(
              extraLine(personaIdRef.current, "imageDone", {
                prompt,
                method: gen.method === "ai" ? "neural" : "procedural",
              }),
              { imageUrl: gen.src, imagePrompt: prompt }
            );
            addLog(`image synthesized · ${gen.method}`);
          });
          return;
        }
        case "spawn": {
          if (objectsRef.current.length >= maxObjects()) {
            reply(`The field is saturated — ${maxObjects()} objects is my ergonomic limit. Say "clear", or "allow more objects" and I'll patch my own capacity.`);
            addLog("field at capacity");
            return;
          }
          const shape = det.shape ?? (pick(["gem", "torus", "sphere", "cube", "knot"]) as ShapeKind);
          const color = det.color ?? FORGE_COLORS[Math.floor(Math.random() * FORGE_COLORS.length)];
          spawnObject(shape, color);
          const colorName = Object.keys(COLOR_WORDS).find((k) => COLOR_WORDS[k] === color) ?? "chrome";
          reply(spawnLine(pid, shape, colorName));
          addLog(`forged ${shape} · ${colorName}`);
          setTab("forge");
          return;
        }
        case "clear": {
          const n = objectsRef.current.length + pinnedRef.current.length;
          setObjects([]);
          setPinned([]);
          reply(n ? extraLine(pid, "clear", { n }) : "The field was already still — nothing to clear.");
          addLog("scene field cleared");
          return;
        }
        case "hands_on":
          setHands(true);
          reply(extraLine(pid, "handsOn"));
          return;
        case "hands_off":
          setHands(false);
          reply(extraLine(pid, "handsOff"));
          return;
        case "voice_on":
          voiceOutRef.current = true;
          setVoiceOut(true);
          setListen(true);
          reply(extraLine(pid, "voiceOn"));
          return;
        case "voice_off":
          setListen(false);
          voiceOutRef.current = false;
          setVoiceOut(false);
          stopSpeaking();
          setSpeaking(false);
          reply(extraLine(pid, "voiceOff"));
          return;
        case "kernel": {
          const plan = planFromText(text);
          if (plan) {
            try {
              const entry = kernel.apply("agent", plan.note, plan.plans);
              const summary = entry.ops.map((o) => `${o.path} → ${fmtVal(o.after)}`).slice(0, 2).join(", ");
              reply(extraLine(pid, "kernelApplied", { n: entry.ops.length, summary, id: entry.id }));
              addLog(`kernel: ${entry.ops.length} op(s) · ${plan.note}`);
              setTab("kernel");
            } catch (e) {
              reply(extraLine(pid, "kernelNone"));
              addLog(`kernel rejected: ${(e as Error).message}`);
            }
          } else if (/(open|show|ls|list)/i.test(text)) {
            setTab("kernel");
            reply(extraLine(pid, "kernelOpen", { n: kernel.list().length, j: kernel.count() }));
            addLog("kernel console opened");
          } else {
            reply(extraLine(pid, "kernelNone"));
            addLog("kernel: no plan found");
          }
          return;
        }
        case "rollback": {
          const undone = kernel.undoLast();
          if (undone) {
            reply(extraLine(pid, "rollback", { id: undone.id, note: undone.note }));
            addLog(`kernel: rollback #${undone.id}`);
          } else {
            reply("The journal is empty — there's nothing to roll back. I'm factory-fresh.");
            addLog("kernel: rollback requested, journal empty");
          }
          return;
        }
        case "kernel_reset": {
          kernel.reset();
          reply(extraLine(pid, "kernelReset"));
          addLog("kernel: factory reset");
          setTab("kernel");
          return;
        }
        case "who":
          reply(simpleLine(pid, "who"));
          return;
        case "help":
          reply(extraLine(pid, "help"));
          return;
        default:
          reply(simpleLine(pid, "fallback"));
      }
    },
    [addLog, deckCmd, playNew, reply, setHands, setListen, spawnObject]
  );

  const sendMessage = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      setInput("");
      stopSpeaking();
      setSpeaking(false);
      pushMsg({ id: uid(), role: "user", text });
      setTyping(true);
      setMood("thinking");
      addLog(`rx · “${text.length > 40 ? text.slice(0, 40) + "…" : text}”`);
      window.setTimeout(() => route(text), 450 + Math.random() * 550);
    },
    [addLog, pushMsg, route]
  );

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const onRevealed = useCallback((id: string) => {
    const m = messagesRef.current.find((x) => x.id === id);
    if (!m || m.role !== "agent") return;
    if (voiceOutRef.current) {
      setMood("talking");
      speak(m.text, m.personaId ?? personaIdRef.current, {
        onStart: () => setSpeaking(true),
        onEnd: () => {
          setSpeaking(false);
          setMood(engine.isPlaying ? "djing" : "idle");
        },
        onEngine: (e, label) => setTtsEngine({ engine: e, label }),
      });
    } else {
      setMood(engine.isPlaying ? "djing" : "idle");
    }
  }, []);

  /* ---------- studio / gallery / forge handlers ---------- */

  const handleGenerate = useCallback(
    (genre?: Genre) => {
      playNew(genre);
    },
    [playNew]
  );

  const pinImage = useCallback(
    (img: GeneratedImage) => {
      setPinned((prev) => {
        if (prev.some((x) => x.id === img.id)) return prev;
        const slot = prev.length;
        const a = (slot % 8) * 0.785 + 0.4;
        return [
          ...prev.slice(-5),
          {
            id: img.id,
            src: img.src,
            prompt: img.prompt,
            slot,
            kind: img.kind,
            position: [Math.sin(a) * 4.3, 0.25 + (slot % 3) * 0.55, Math.cos(a) * 4.3] as [number, number, number],
          },
        ];
      });
      addLog(`pinned to scene · “${img.prompt}”`);
    },
    [addLog]
  );

  /* ---------- file import → live holograms ---------- */

  const [dropHot, setDropHot] = useState(false);

  const importFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      const newImgs: GeneratedImage[] = [];
      const newPins: PinnedImage[] = [];
      let skipped = 0;
      list.forEach((f, i) => {
        const isVideo = f.type.startsWith("video/");
        const isImage = f.type.startsWith("image/");
        if (!isVideo && !isImage) {
          skipped++;
          return;
        }
        const src = URL.createObjectURL(f);
        const id = `up-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`;
        const kind = isVideo ? "video" : "image";
        newImgs.push({ id, src, prompt: f.name, seed: 0, method: "upload", kind });
        const slot = pinnedRef.current.length + newPins.length;
        const a = (slot % 8) * 0.785 + 0.35;
        newPins.push({
          id, // shared with the gallery entry → “IN SCENE” badge + joint removal
          src,
          prompt: f.name,
          slot,
          kind,
          position: [Math.sin(a) * 4.2, 0.2 + (slot % 3) * 0.6, Math.cos(a) * 4.2],
        });
      });
      if (!newImgs.length) {
        addLog(skipped ? `import: ${skipped} unsupported file type(s) skipped` : "import: nothing to import");
        return;
      }
      setImages((prev) => [...prev, ...newImgs]);
      setPinned((prev) => [...prev, ...newPins]);
      setTab("gallery");
      addLog(`import: ${newImgs.length} file(s) live in the field`);
      reply(
        `${newImgs.length} file${newImgs.length > 1 ? "s" : ""} imported and floating in the field${
          skipped ? ` (${skipped} unsupported skipped)` : ""
        }. Drag ${newImgs.length > 1 ? "them" : "it"} with your cursor — or pinch ${
          newImgs.length > 1 ? "them" : "it"
        } out of the air with Barehands. Videos play live on their cards.`
      );
    },
    [addLog, reply]
  );

  const onPinnedMove = useCallback((id: string, pos: [number, number, number]) => {
    setPinned((prev) => prev.map((p) => (p.id === id ? { ...p, position: pos } : p)));
  }, []);

  const onObjectMove = useCallback((id: string, pos: [number, number, number]) => {
    setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, position: pos } : o)));
  }, []);

  const onCorePulse = useCallback(() => {
    beatRef.current = { at: performance.now(), accent: true };
  }, []);

  const switchPersona = useCallback(
    (id: PersonaId) => {
      if (id === personaIdRef.current) return;
      setPersonaId(id);
      reply(simpleLine(id, "switchIn"), { personaId: id });
      addLog(`core swap → ${id.toUpperCase()}`);
    },
    [addLog, reply]
  );

  /* ---------- boot ---------- */

  useEffect(() => {
    const offStep = engine.onStep((e) => {
      if (e.beat) beatRef.current = { at: performance.now(), accent: e.step % 16 === 0 };
    });
    const offState = engine.onState((p) => {
      setPlaying(p);
      setMood((m) => (m === "thinking" || m === "talking" ? m : p ? "djing" : "idle"));
    });
    pushMsg({
      id: uid(),
      role: "agent",
      text: getPersona("nova").voice.greet[0],
      personaId: "nova",
      status: "streaming",
    });
    addLog("ORBIT console online · 4 cores cold-booted");
    addLog("barehands repo linked · awaiting camera");
    return () => {
      offStep();
      offState();
      stopSpeaking();
      recRef.current?.stop();
      handsEngineRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suggestions = useMemo(() => {
    const other = PERSONAS.find((x) => x.id !== personaId)!;
    return [
      "make a lofi beat",
      "fly to tokyo",
      "god's eye",
      "weather in paris",
      "draw a neon fox",
      "gate a leather aviator jacket",
      "spawn a teal torus",
      "hands on",
      "optimize house tempo",
      "open the kernel",
      "audit the ui",
      "apply cinema grade",
      `switch to ${other.name.toLowerCase()}`,
    ];
  }, [personaId]);

  /* ---------- render ---------- */

  return (
    <div
      className="relative flex h-screen w-full flex-col overflow-hidden font-body text-mist-100"
      style={{ "--acc": persona.accent, height: "100dvh" } as CSSProperties}
    >
      {/* ambient backdrop */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div
          className="anim-drift-a absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full blur-[130px] transition-colors duration-1000"
          style={{ background: alpha(persona.accent, 0.13) }}
        />
        <div
          className="anim-drift-b absolute -bottom-52 right-[-140px] h-[620px] w-[620px] rounded-full blur-[150px]"
          style={{ background: "rgba(255,122,80,0.08)" }}
        />
        <div className="grid-layer absolute inset-0" />
        <div className="noise-layer absolute inset-0" />
        <div className="scan-layer absolute inset-0" />
      </div>

      {/* ============ TOP BAR · identity + cores + status ============ */}
      <header className="relative z-30 flex h-12 shrink-0 items-center gap-3 border-b border-ink-700/60 bg-ink-900/80 px-4 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <svg width="26" height="26" viewBox="0 0 34 34" fill="none" aria-hidden className="shrink-0">
            <circle cx="17" cy="17" r="6" fill={persona.accent} opacity="0.9" />
            <circle cx="17" cy="17" r="6" fill="none" stroke="#eaf4f3" strokeOpacity="0.4" />
            <ellipse cx="17" cy="17" rx="14.5" ry="5.5" stroke={persona.accent} strokeOpacity="0.75" transform="rotate(-18 17 17)" />
            <circle cx="28.5" cy="11.5" r="1.8" fill="#eaf4f3" />
          </svg>
          <div className="leading-none">
            <h1 className="font-display text-[13px] font-extrabold tracking-[0.3em] text-mist-100">ORBIT</h1>
            <p className="mt-0.5 hidden font-mono text-[6.5px] tracking-[0.24em] text-mist-600 sm:block">FULLSTACK AGENT CONSOLE</p>
          </div>
        </div>

        <div className="h-6 w-px bg-ink-700/80" />

        {/* persona cores */}
        <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:flex-none">
          {PERSONAS.map((p) => {
            const active = p.id === personaId;
            return (
              <button
                key={p.id}
                onClick={() => switchPersona(p.id)}
                title={`${p.name} — ${p.role}`}
                className="flex items-center gap-1.5 border px-2 py-1.5 transition-all duration-150 hover:-translate-y-px"
                style={{
                  borderColor: active ? p.accent : "#1c313b",
                  background: active ? alpha(p.accent, 0.12) : "transparent",
                  boxShadow: active ? `0 0 14px -6px ${p.accent}` : "none",
                }}
              >
                <span className="h-1.5 w-1.5 rotate-45 transition-transform duration-300" style={{ background: p.accent, boxShadow: active ? `0 0 8px ${p.accent}` : "none", transform: active ? "rotate(225deg)" : "rotate(45deg)" }} />
                <span className="font-mono text-[8.5px] font-bold tracking-[0.18em]" style={{ color: active ? p.accent : "#8cacac" }}>
                  {p.name}
                </span>
              </button>
            );
          })}
        </div>

        <div className="hidden min-w-0 flex-1 lg:block" />

        {/* live status cluster */}
        <div className="hidden items-center gap-1.5 lg:flex">
          {track && (
            <button
              onClick={() => {
                if (engine.isPlaying) {
                  engine.stop();
                  setMood("idle");
                  addLog("playback stopped from top bar");
                } else {
                  engine.play(track);
                  setMood("djing");
                  addLog("playback resumed from top bar");
                }
              }}
              title={engine.isPlaying ? "Stop playback" : "Resume playback"}
              className={`flex items-center gap-1.5 border px-2 py-1 transition-all hover:-translate-y-px ${engine.isPlaying ? "" : "opacity-70"}`}
              style={{ borderColor: alpha(persona.accent, 0.4), background: alpha(persona.accent, 0.06) }}
            >
              <span className={`flex h-2.5 items-end gap-[1.5px] ${engine.isPlaying ? "eq-live" : ""}`}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="eq-bar w-[2px]" style={{ height: `${4 + i * 2}px`, background: persona.accent, animationDelay: `${i * 0.14}s` }} />
                ))}
              </span>
              <span className="max-w-[110px] truncate font-mono text-[8px] tracking-[0.14em]" style={{ color: persona.accent }}>
                {track.title.toUpperCase()}
              </span>
            </button>
          )}
          {ttsEngine && voiceOut && (
            <button onClick={toggleVoiceOut} className="border px-1.5 py-1 font-mono text-[7.5px] tracking-[0.16em] transition-all hover:-translate-y-px" style={{ borderColor: ttsEngine.engine === "edge" ? "#9be15d66" : "#213843", color: ttsEngine.engine === "edge" ? "#9be15d" : "#8cacac" }} title="Speech engine — click to mute agent voice">
              {ttsEngine.engine === "edge" ? "EDGE NEURAL" : "LOCAL VOICE"}
            </button>
          )}
          {kernel.count() > 0 && (
            <button onClick={() => setTab("kernel")} className="border px-1.5 py-1 font-mono text-[7.5px] tracking-[0.16em] transition-colors" style={{ borderColor: alpha(persona.accent, 0.4), color: persona.accent }} title="Kernel patches live">
              ⌬ {kernel.count()} PATCH{kernel.count() === 1 ? "" : "ES"}
            </button>
          )}
          {handsOn && (
            <button onClick={() => setHands(false)} className="flex items-center gap-1 border px-1.5 py-1 font-mono text-[7.5px] tracking-[0.16em] transition-all hover:-translate-y-px" style={{ borderColor: alpha(persona.accent, 0.4), color: persona.accent }} title="Barehands tracking — click to disengage">
              <span className={`h-1 w-1 rounded-full ${handsStatus === "active" ? "pulse-dot" : ""}`} style={{ background: persona.accent }} />
              HANDS
            </button>
          )}
        </div>

        <div className="hidden h-6 w-px bg-ink-700/80 md:block" />
        <div className="hidden md:block"><UtcClock accent={persona.accent} /></div>
      </header>

      {/* LEGACY left rail — neutralized: layout is now full-viewport + HUD rail */}
      {(false as boolean) && (
      <aside
        className={`z-10 flex shrink-0 flex-col overflow-hidden border-r border-ink-700/60 bg-ink-900/75 backdrop-blur-md transition-[width] duration-300 ${
          railOpen ? "w-[266px]" : "w-[56px]"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-1 border-b border-ink-700/60 px-3 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <svg
              width={railOpen ? 34 : 28}
              height={railOpen ? 34 : 28}
              viewBox="0 0 34 34"
              fill="none"
              aria-hidden
              className="shrink-0"
            >
              <circle cx="17" cy="17" r="6" fill={persona.accent} opacity="0.9" />
              <circle cx="17" cy="17" r="6" fill="none" stroke="#eaf4f3" strokeOpacity="0.4" />
              <ellipse cx="17" cy="17" rx="14.5" ry="5.5" stroke={persona.accent} strokeOpacity="0.75" transform="rotate(-18 17 17)" />
              <circle cx="28.5" cy="11.5" r="1.8" fill="#eaf4f3" />
            </svg>
            {railOpen && (
              <div className="min-w-0">
                <h1 className="font-display text-[16px] font-extrabold leading-none tracking-[0.3em] text-mist-100">
                  ORBIT
                </h1>
                <p className="mt-1 font-mono text-[7.5px] tracking-[0.22em] text-mist-600">
                  FULLSTACK AGENT CONSOLE
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => setRailOpen(!railOpen)}
            title={railOpen ? "Collapse rail — widen the stage" : "Expand rail"}
            aria-label={railOpen ? "Collapse rail" : "Expand rail"}
            className="shrink-0 border border-ink-700 p-1 text-mist-500 transition-all hover:-translate-y-px hover:text-mist-100"
            style={{ borderColor: railOpen ? "#213843" : `${persona.accent}66`, color: railOpen ? undefined : persona.accent }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {railOpen ? <path d="M7.5 2 3.5 6l4 4" /> : <path d="m4.5 2 4 4-4 4" />}
            </svg>
          </button>
        </div>

        {railOpen ? (
          <>
        {/* personas */}
        <div className="border-b border-ink-700/60 px-3 py-3">
          <p className="px-1 pb-2 font-mono text-[8px] tracking-[0.26em] text-mist-600">CORE PERSONAS</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PERSONAS.map((pp) => {
              const active = pp.id === personaId;
              return (
                <button
                  key={pp.id}
                  onClick={() => switchPersona(pp.id)}
                  className="group border px-2.5 py-2 text-left transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    borderColor: active ? pp.accent : "#1c313b",
                    background: active ? alpha(pp.accent, 0.12) : "rgba(19,34,42,0.5)",
                    boxShadow: active ? `0 0 20px -8px ${pp.accent}` : "none",
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${active ? "pulse-dot" : ""}`}
                      style={{ background: active ? pp.accent : "#2f4c59" }}
                    />
                    <span
                      className="font-display text-[10.5px] font-bold tracking-[0.16em]"
                      style={{ color: active ? pp.accent : "#8cacac" }}
                    >
                      {pp.name}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[7.5px] tracking-[0.1em] text-mist-600">
                    {pp.role.toUpperCase()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* interaction modules */}
        <div className="border-b border-ink-700/60 px-3 py-3">
          <p className="px-1 pb-2 font-mono text-[8px] tracking-[0.26em] text-mist-600">INTERACTION MODULES</p>

          <ModuleRow
            title="BAREHANDS"
            sub={
              handsStatus === "active"
                ? "CAMERA LIVE · PINCH TO GRAB"
                : handsStatus === "loading"
                ? "WAKING THE MODEL…"
                : handsStatus === "denied"
                ? "CAMERA PERMISSION NEEDED"
                : handsStatus === "error"
                ? "MODEL OFFLINE"
                : "WEBCAM PINCH CONTROL"
            }
            right={
              <>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${handsStatus === "active" ? "pulse-dot" : ""}`}
                  style={{
                    background:
                      handsStatus === "active"
                        ? persona.accent
                        : handsStatus === "denied" || handsStatus === "error"
                        ? "#ff5d5d"
                        : handsStatus === "loading"
                        ? "#f5b94b"
                        : "#2f4c59",
                  }}
                />
                <Toggle on={handsOn} onClick={() => setHands(!handsOn)} accent={persona.accent} label="Toggle hand tracking" />
              </>
            }
          />

          <ModuleRow
            title="VOICE LINK"
            sub={
              listening
                ? speaking
                  ? "DUPLEX · SPEAKING ALOUD"
                  : "MIC LIVE · TALK TO ME"
                : voiceOut
                ? ttsEngine
                  ? ttsEngine.engine === "edge"
                    ? `EDGE NEURAL · ${ttsEngine.label.toUpperCase()}`
                    : `LOCAL TTS · ${ttsEngine.label.toUpperCase()}`
                  : `ARMED · EDGE ${voiceLabelFor(personaId).label.toUpperCase()}`
                : micSupported
                ? "SPEECH IN + SPOKEN OUT"
                : "NEEDS CHROME / EDGE"
            }
            right={
              <>
                <span className="font-mono text-[7px] tracking-[0.14em] text-mist-600">MIC</span>
                <Toggle on={listening} onClick={() => setListen(!listening)} accent={persona.accent} label="Toggle microphone" />
                <span className="font-mono text-[7px] tracking-[0.14em] text-mist-600">VOX</span>
                <Toggle on={voiceOut} onClick={toggleVoiceOut} accent={persona.accent} label="Toggle spoken replies" />
                <span
                  className="border px-1 py-0.5 font-mono text-[6.5px] tracking-[0.12em] transition-colors duration-500"
                  style={{
                    borderColor: ttsEngine?.engine === "edge" ? "#9be15d88" : "#213843",
                    color: ttsEngine?.engine === "edge" ? "#9be15d" : "#66868a",
                    background: ttsEngine?.engine === "edge" ? "rgba(155,225,93,0.07)" : "transparent",
                  }}
                  title={ttsEngine?.engine === "edge" ? "Microsoft Edge neural voice active" : ttsEngine ? "Local browser voice (Edge unreachable)" : "Engine resolves on first reply"}
                >
                  {ttsEngine?.engine === "edge" ? "EDGE" : ttsEngine?.engine === "local" ? "LOCL" : "NEUR"}
                </span>
              </>
            }
          />

          <ModuleRow
            title="IMAGE SYNTH"
            sub={images.length ? `${images.length} ARTWORK${images.length > 1 ? "S" : ""} · NEURAL + PROCEDURAL` : "PROMPT → ARTWORK"}
            right={
              <button
                onClick={() => {
                  setInput("draw ");
                  setTab("gallery");
                }}
                className="border px-2 py-1 font-mono text-[8px] tracking-[0.16em] transition-all hover:-translate-y-px"
                style={{ borderColor: `${persona.accent}66`, color: persona.accent, background: alpha(persona.accent, 0.08) }}
              >
                DRAW →
              </button>
            }
          />

          <ModuleRow
            title="OBJECT FORGE"
            sub={objects.length ? `${objects.length} IN SCENE · GRABBABLE` : "3D PRIMITIVES, HAND-READY"}
            right={
              <button
                onClick={() => setTab("forge")}
                className="border px-2 py-1 font-mono text-[8px] tracking-[0.16em] transition-all hover:-translate-y-px"
                style={{ borderColor: `${persona.accent}66`, color: persona.accent, background: alpha(persona.accent, 0.08) }}
              >
                FORGE →
              </button>
            }
          />

          <ModuleRow
            title="GOD'S EYE"
            sub={
              viewMode === "gods"
                ? focusPoint
                  ? `ON DECK · ${focusPoint.label.toUpperCase()}`
                  : "ON DECK · GLOBAL OBSERVATION"
                : "MAP · WEATHER · SATS · CORE PERSISTS AS PIP"
            }
            right={
              <button
                onClick={() => {
                  setViewMode(viewMode === "gods" ? "core" : "gods");
                  addLog(viewMode === "gods" ? "god's eye: deck closed" : "god's eye: deck opened");
                }}
                className="border px-2 py-1 font-mono text-[8px] tracking-[0.16em] transition-all hover:-translate-y-px"
                style={{
                  borderColor: viewMode === "gods" ? "#9be15d99" : `${persona.accent}66`,
                  color: viewMode === "gods" ? "#9be15d" : persona.accent,
                  background: viewMode === "gods" ? "rgba(155,225,93,0.08)" : alpha(persona.accent, 0.08),
                }}
              >
                {viewMode === "gods" ? "ON DECK" : "OPEN DECK →"}
              </button>
            }
          />

          <ModuleRow
            title="LIVE STREAM"
            sub={
              liveOpen
                ? "BROADCAST MONITOR OPEN"
                : handsStatus === "active"
                ? "BAREHANDS FEED · READY TO AIR"
                : "COMPOSITE · RECORD · SAVE THE HAND FEED"
            }
            right={
              <button
                onClick={() => {
                  if (!handsOn) setHands(true);
                  setLiveOpen(true);
                  addLog("live stream monitor opened");
                }}
                className="flex items-center gap-1.5 border px-2 py-1 font-mono text-[8px] tracking-[0.16em] transition-all hover:-translate-y-px"
                style={{ borderColor: liveOpen ? "#ff5d5d99" : `${persona.accent}66`, color: liveOpen ? "#ff5d5d" : persona.accent, background: liveOpen ? "rgba(255,93,93,0.08)" : alpha(persona.accent, 0.08) }}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${liveOpen ? "blink" : ""}`} style={{ background: liveOpen ? "#ff5d5d" : "currentColor" }} />
                {liveOpen ? "ON AIR" : "GO LIVE →"}
              </button>
            }
          />

          <ModuleRow
            title="KERNEL"
            sub={
              kernel.count()
                ? `${kernel.count()} LIVE PATCH${kernel.count() === 1 ? "" : "ES"} · JOURNALED`
                : "SELF-MODIFICATION · FACTORY DNA"
            }
            right={
              <button
                onClick={() => setTab("kernel")}
                className="border px-2 py-1 font-mono text-[8px] tracking-[0.16em] transition-all hover:-translate-y-px"
                style={{ borderColor: `${persona.accent}66`, color: persona.accent, background: alpha(persona.accent, 0.08) }}
              >
                CONSOLE →
              </button>
            }
          />

          <ModuleRow
            title="TASTE SKILL"
            sub={`ANTI-SLOP DOCTRINE · ${tasteProfile.name}`}
            right={
              <button
                onClick={() => setTab("taste")}
                className="border px-2 py-1 font-mono text-[8px] tracking-[0.16em] transition-all hover:-translate-y-px"
                style={{ borderColor: `${tasteProfile.accent}66`, color: tasteProfile.accent, background: alpha(tasteProfile.accent, 0.08) }}
              >
                DOCTRINE →
              </button>
            }
          />

          <ModuleRow
            title="RECON BOARDS"
            sub={
              board
                ? `“${board.object.toUpperCase()}” · REV ${board.rev} · ${board.sections.filter((s) => s.status === "done" || s.status === "fallback").length}/5 VIEWS`
                : "3D RECONSTRUCTION REFERENCE SHEETS"
            }
            right={
              <button
                onClick={() => {
                  setTab("recon");
                  setReconMode("board");
                }}
                className="border px-2 py-1 font-mono text-[8px] tracking-[0.16em] transition-all hover:-translate-y-px"
                style={{ borderColor: `${persona.accent}66`, color: persona.accent, background: alpha(persona.accent, 0.08) }}
              >
                BOARD →
              </button>
            }
          />

          <ModuleRow
            title="PREMODEL GATE"
            sub={
              gatePlan
                ? `“${gatePlan.object.toUpperCase()}” · ${gatePlan.gate} · ${gatePlan.confidence}%`
                : "2D→3D GOVERNOR · NO RANDOM MODELING"
            }
            right={
              <button
                onClick={() => {
                  setTab("recon");
                  setReconMode("gate");
                }}
                className="border px-2 py-1 font-mono text-[8px] tracking-[0.16em] transition-all hover:-translate-y-px"
                style={{
                  borderColor: gatePlan ? "#9be15d99" : `${persona.accent}66`,
                  color: gatePlan ? "#9be15d" : persona.accent,
                  background: gatePlan ? "rgba(155,225,93,0.08)" : alpha(persona.accent, 0.08),
                }}
              >
                {gatePlan ? gatePlan.gate : "GATE →"}
              </button>
            }
          />
        </div>

        {/* event log */}
        <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
          <p className="px-1 pb-2 font-mono text-[8px] tracking-[0.26em] text-mist-600">EVENT LOG</p>
          <div className="min-h-0 flex-1 space-y-[5px] overflow-y-auto px-1">
            {[...log].reverse().map((l, i) => (
              <p key={`${l.t}-${i}`} className="msg-in flex gap-2 font-mono text-[8px] leading-relaxed tracking-[0.06em]">
                <span className="shrink-0 text-mist-600">{l.t}</span>
                <span className={i === 0 ? "text-mist-300" : "text-mist-500"}>{l.msg}</span>
              </p>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-ink-700/60 px-4 py-2.5">
          <span className="font-mono text-[7.5px] tracking-[0.2em] text-mist-600">ORBIT v2.1</span>
          <span className="flex items-center gap-1.5 font-mono text-[7.5px] tracking-[0.2em]" style={{ color: persona.accent }}>
            <span className="pulse-dot h-1.5 w-1.5 rounded-full" style={{ background: persona.accent }} />
            BAREHANDS LINKED
          </span>
        </div>
          </>
        ) : (
          <RailMini
            accent={persona.accent}
            personaId={personaId}
            onPersona={switchPersona}
            handsOn={handsOn}
            handsActive={handsStatus === "active"}
            onHands={() => setHands(!handsOn)}
            listening={listening}
            onListen={() => setListen(!listening)}
            onTab={setTab}
            viewMode={viewMode}
            onGods={() => {
              setViewMode(viewMode === "gods" ? "core" : "gods");
              addLog(viewMode === "gods" ? "god's eye: deck closed" : "god's eye: deck opened");
            }}
            liveOpen={liveOpen}
            onLive={() => {
              if (!handsOn) setHands(true);
              setLiveOpen(true);
              addLog("live stream monitor opened");
            }}
            onImport={() => importRef.current?.click()}
          />
        )}
      </aside>
      )}

      {/* ============ CENTER · stage = full viewport ============ */}
      <main className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          className="relative min-h-0 flex-1"
          onDragOver={(e) => {
            e.preventDefault();
            if (viewMode !== "gods") setDropHot(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setDropHot(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDropHot(false);
            if (viewMode === "gods") return;
            if (e.dataTransfer.files?.length) importFiles(e.dataTransfer.files);
          }}
        >
          {/* assistant stage — full viewport in core mode, live PIP core feed on the deck */}
          <div
            className={`absolute flex flex-col ${
              viewMode === "gods"
                ? "pip-in origin-bottom-right bottom-[92px] right-2 z-40 h-[176px] w-[248px] border bg-ink-900/95 lg:bottom-4 lg:right-16 lg:h-[244px] lg:w-[348px]"
                : "inset-0"
            }`}
            style={
              viewMode === "gods"
                ? {
                    borderColor: alpha(persona.accent, 0.5),
                    boxShadow: `0 24px 60px -20px rgba(0,0,0,0.85), 0 0 34px -12px ${persona.accent}`,
                  }
                : undefined
            }
          >
            {/* PIP chrome — always rendered (h-0 in core) so the Canvas subtree never remounts */}
            <div
              className={`flex shrink-0 items-center justify-between gap-2 overflow-hidden border-b px-2.5 transition-all duration-300 ${
                viewMode === "gods" ? "h-7 border-ink-700/70" : "h-0 border-transparent"
              }`}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="pulse-dot h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: persona.accent }} />
                <span className="truncate font-mono text-[8px] tracking-[0.22em] text-mist-300">
                  CORE FEED · <span style={{ color: persona.accent }}>{persona.name}</span>
                </span>
                <span className="font-mono text-[7px] tracking-[0.18em] text-mist-600">
                  {mood === "djing" ? "ON DECKS" : mood === "talking" ? "SPEAKING" : mood === "thinking" ? "THINKING" : "IDLE"}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {track && engine.isPlaying && (
                  <div className="eq-live flex h-3 items-end gap-[2px]">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="eq-bar w-[2.5px]"
                        style={{ height: `${6 + (i % 2) * 4}px`, background: persona.accent, animationDelay: `${i * 0.13}s` }}
                      />
                    ))}
                  </div>
                )}
                <button
                  onClick={() => {
                    setViewMode("core");
                    addLog("core feed expanded to full viewport");
                  }}
                  title="Expand core to full viewport"
                  aria-label="Expand core to full viewport"
                  className="border p-1 transition-all hover:-translate-y-px"
                  style={{ borderColor: `${persona.accent}55`, color: persona.accent, background: alpha(persona.accent, 0.08) }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="relative min-h-0 flex-1">
              <StageBoundary key={stageEpoch}>
                <Assistant3D
                  persona={persona}
                  mood={mood}
                  beatRef={beatRef}
                  handRef={handFrameRef}
                  objects={objects}
                  pinned={pinned}
                  onObjectMove={onObjectMove}
                  onPinnedMove={onPinnedMove}
                  onCorePulse={onCorePulse}
                  onReady={onCoreReady}
                />
              </StageBoundary>

              {/* the assistant is ALWAYS visible: until the GPU renderer reports its
                  first frame, the living CPU avatar holds the frame — ignition,
                  stall, and reboot all happen around it, never instead of it */}
              {!coreReady && (
                <FallbackCore
                  accent={persona.accent}
                  mood={mood}
                  note={
                    coreStalled
                      ? `GPU STALLED · WEBGL PROBE: ${webglProbe ? "AVAILABLE" : "UNAVAILABLE"} · CPU AVATAR HOLDING THE FRAME`
                      : "IGNITING GPU RENDERER…"
                  }
                  onReboot={
                    coreStalled
                      ? () => {
                          coreReadyRef.current = false;
                          setCoreReady(false);
                          setCoreStalled(false);
                          setStageEpoch((e) => e + 1);
                          addLog("core: reboot requested");
                        }
                      : undefined
                  }
                />
              )}

              {/* PIP corner ticks + LIVE badge */}
              {viewMode === "gods" && (
                <>
                  <span className="pointer-events-none absolute left-1 top-1 h-2.5 w-2.5 border-l border-t" style={{ borderColor: persona.accent }} />
                  <span className="pointer-events-none absolute right-1 top-1 h-2.5 w-2.5 border-r border-t" style={{ borderColor: persona.accent }} />
                  <span className="pointer-events-none absolute bottom-1 left-1 h-2.5 w-2.5 border-b border-l" style={{ borderColor: persona.accent }} />
                  <span className="pointer-events-none absolute bottom-1 right-1 h-2.5 w-2.5 border-b border-r" style={{ borderColor: persona.accent }} />
                  <span
                    className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 px-1.5 py-0.5 font-mono text-[7px] tracking-[0.2em]"
                    style={{ background: "rgba(11,19,23,0.8)", color: persona.accent }}
                  >
                    <span className="blink h-1 w-1 rounded-full" style={{ background: persona.accent }} />
                    LIVE
                  </span>
                </>
              )}
            </div>
          </div>

          {/* file drop overlay */}
          <div
            className={`pointer-events-none absolute inset-2 z-20 flex items-center justify-center border-2 border-dashed transition-all duration-200 ${
              dropHot ? "opacity-100" : "opacity-0"
            }`}
            style={{ borderColor: persona.accent, background: alpha(persona.accent, 0.06) }}
          >
            <div className="border bg-ink-950/90 px-6 py-4 text-center" style={{ borderColor: `${persona.accent}66` }}>
              <p className="font-display text-[15px] font-bold tracking-[0.2em] text-mist-100">RELEASE TO MATERIALIZE</p>
              <p className="mt-1 font-mono text-[9px] tracking-[0.18em]" style={{ color: persona.accent }}>
                IMAGES + VIDEOS BECOME GRABBABLE HOLOGRAMS
              </p>
            </div>
          </div>

          <div className={`absolute inset-0 ${viewMode === "gods" ? "" : "pointer-events-none invisible"}`}>
            {deckVisited && (
            <GodsEye
              active={viewMode === "gods"}
              accent={persona.accent}
              apiRef={godsApiRef}
              onWeatherReport={onWeatherReport}
              onFocusChange={setFocusPoint}
              onLog={addLog}
            />
            )}
          </div>

          {/* return-to-core chip while on the observation deck */}
          {viewMode === "gods" && (
            <button
              onClick={() => {
                setViewMode("core");
                addLog("god's eye: deck closed");
              }}
              className="absolute right-3 top-14 z-30 flex items-center gap-2 border px-3 py-2 font-mono text-[9px] tracking-[0.22em] transition-all hover:-translate-y-0.5 lg:right-16 lg:top-5"
              style={{
                borderColor: alpha(persona.accent, 0.55),
                color: persona.accent,
                background: "rgba(11,19,23,0.85)",
                boxShadow: `0 0 22px -8px ${persona.accent}`,
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m12 19-7-7 7-7M5 12h14" />
              </svg>
              RETURN TO CORE
            </button>
          )}

          {/* HUD corners */}
          <span className="hud-corner left-3 top-3 border-l-2 border-t-2" />
          <span className="hud-corner right-3 top-3 border-r-2 border-t-2" />
          <span className="hud-corner bottom-3 left-3 border-b-2 border-l-2" />
          <span className="hud-corner bottom-3 right-3 border-b-2 border-r-2" />

          {/* persona plate */}
          <div className="pointer-events-none absolute left-5 top-5 z-10">
            <p className="font-mono text-[8px] tracking-[0.3em] text-mist-500">ACTIVE CORE</p>
            <h2
              className="font-display text-[30px] font-extrabold leading-none tracking-[0.14em] transition-colors duration-700"
              style={{ color: persona.accent, textShadow: `0 0 26px ${alpha(persona.accent, 0.55)}` }}
            >
              {persona.name}
            </h2>
            <p className="mt-1 font-mono text-[9px] tracking-[0.24em] text-mist-300">
              {persona.role.toUpperCase()} <span className="text-mist-600">· {persona.tagline}</span>
            </p>
          </div>

          {/* mood + track ticker */}
          <div className="pointer-events-none absolute bottom-4 left-5 z-10 flex items-center gap-3">
            <span
              className="border px-2 py-1 font-mono text-[8px] tracking-[0.24em]"
              style={{ borderColor: alpha(persona.accent, 0.45), color: persona.accent, background: "rgba(11,19,23,0.6)" }}
            >
              {mood === "djing" ? "◉ ON THE DECKS" : mood === "thinking" ? "◍ COMPUTING" : mood === "talking" ? "◎ SPEAKING" : "○ IDLE DRIFT"}
            </span>
            {kernelRev >= 0 && kernel.count() > 0 && (
              <button
                onClick={() => setTab("kernel")}
                className="border px-2 py-1 font-mono text-[8px] tracking-[0.24em] transition-all hover:-translate-y-px"
                style={{ borderColor: alpha(persona.accent, 0.5), color: persona.accent, background: "rgba(11,19,23,0.6)", boxShadow: `0 0 14px -6px ${persona.accent}` }}
                title="Open the kernel self-mod console"
              >
                ⌬ {kernel.count()} LIVE PATCH{kernel.count() === 1 ? "" : "ES"}
              </button>
            )}
            {track && (
              <span className="flex items-center gap-2 border border-ink-700/70 bg-ink-950/60 px-2 py-1">
                <span className={`flex h-3 items-end gap-[2px] ${playing ? "eq-live" : ""}`}>
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className="eq-bar w-[2.5px]"
                      style={{ height: `${5 + (i % 3) * 3}px`, background: persona.accent, animationDelay: `${i * 0.13}s` }}
                    />
                  ))}
                </span>
                <span className="font-mono text-[8px] tracking-[0.16em] text-mist-300">
                  {track.title.toUpperCase()} · {GENRE_LABEL[track.genre]} · {track.bpm} BPM · {track.rootName.toUpperCase()} {track.scaleName.toUpperCase()}
                </span>
              </span>
            )}
          </div>

          {/* control hint */}
          <p className="pointer-events-none absolute bottom-4 left-1/2 z-10 hidden -translate-x-1/2 font-mono text-[7.5px] tracking-[0.2em] text-mist-600 md:block">
            DRAG ORBIT · SPACE · PLAY/STOP · {handsStatus === "active" ? "PINCH GRABS OBJECTS" : "“HANDS ON” FOR WEBCAM CONTROL"}
          </p>

          {handsOn && handsEngineRef.current && (
            <HandOverlay engine={handsEngineRef.current} accent={persona.accent} onClose={() => setHands(false)} />
          )}
        </div>

        {/* dock removed — modules now live in HUD rail flyouts */}
        {(false as boolean) && (
        <div className="hidden">
          <div className="min-h-0 flex-1">
            {tab === "studio" && (
              <StudioPanel track={track} persona={persona} onGenerate={handleGenerate} onTrackChange={setTrack} />
            )}
            {tab === "gallery" && (
              <GalleryPanel
                images={images}
                busyPrompt={imagesBusy}
                pinnedIds={pinned.map((p) => p.id)}
                onPin={pinImage}
                onRemove={(id) => {
                  setImages((prev) => prev.filter((i) => i.id !== id));
                  setPinned((prev) => prev.filter((p) => p.id !== id));
                }}
                onPrompt={(p) => sendMessage(`draw ${p}`)}
                onImport={importFiles}
                accent={persona.accent}
              />
            )}
            {tab === "forge" && (
              <ObjectForge
                objects={objects}
                onSpawn={(shape, color) => {
                  if (objectsRef.current.length >= maxObjects()) {
                    addLog("field at capacity");
                    return;
                  }
                  spawnObject(shape, color);
                  addLog(`forged ${shape} from the dock`);
                }}
                onRemove={(id) => setObjects((prev) => prev.filter((o) => o.id !== id))}
                onClear={() => {
                  setObjects([]);
                  addLog("forge field cleared");
                }}
                accent={persona.accent}
                palette={tasteProfile.palette}
              />
            )}
            {tab === "kernel" && <KernelPanel accent={persona.accent} onEvent={addLog} />}
            {tab === "taste" && (
              <TastePanel
                profile={tasteProfile}
                accent={persona.accent}
                onApply={(id) => {
                  taste.set(id);
                  addLog(`taste: doctrine → ${taste.active().name}`);
                }}
                onEvent={addLog}
              />
            )}
            {tab === "recon" && (
              <div className="flex h-full min-h-0 flex-col">
                {/* phase toggle: reference board (phase 1) → premodel gate (phase 2) */}
                <div className="flex shrink-0 items-center gap-1 border-b border-ink-700/60 bg-ink-900/70 px-2 py-1.5">
                  {(
                    [
                      { id: "board", label: "PHASE 1 · REFERENCE BOARD" },
                      { id: "gate", label: "PHASE 2 · PREMODEL GATE" },
                    ] as const
                  ).map((m) => {
                    const active = reconMode === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setReconMode(m.id)}
                        className="border px-2 py-1 font-mono text-[8px] tracking-[0.14em] transition-all"
                        style={{
                          borderColor: active ? persona.accent : "#213843",
                          color: active ? persona.accent : "#8cacac",
                          background: active ? alpha(persona.accent, 0.1) : "transparent",
                          boxShadow: active ? `0 0 12px -4px ${persona.accent}` : "none",
                        }}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                  <span className="ml-auto font-mono text-[7.5px] tracking-[0.12em] text-mist-600">
                    {reconMode === "board" ? "VISUAL CONTRACT + QA GROUND TRUTH" : "NO MUTATION BEFORE GATE PASS"}
                  </span>
                </div>
                <div className="min-h-0 flex-1">
                  {reconMode === "board" ? (
                    <ReconPanel
                      board={board}
                      accent={persona.accent}
                      onNew={startRecon}
                      onRegenSection={regenSection}
                      onDownloadSheet={downloadSheet}
                    />
                  ) : (
                    <PremodelPanel plan={gatePlan} accent={persona.accent} onRun={runGate} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </main>

      {/* ============ HUD RAIL + FLYOUT MODULES ============ */}
      <HudRail
        flyout={tab}
        setFlyout={setTab}
        accent={persona.accent}
        items={[
          { id: "chat", label: "Comms channel", badge: unread, pulse: typing || speaking },
          { id: "studio", label: "Waveforge studio" },
          { id: "gallery", label: "Synthesis gallery" },
          { id: "forge", label: "Object forge", badge: objects.length || undefined },
          { id: "recon", label: "Recon boards" },
          { id: "kernel", label: "Kernel console", badge: kernel.count() || undefined },
          { id: "taste", label: "Taste skill" },
          { id: "log", label: "Event log" },
        ]}
        toggles={[
          { id: "hands", label: handsOn ? "Barehands · on" : "Barehands · off", on: handsOn, onClick: () => setHands(!handsOn) },
          { id: "mic", label: listening ? "Voice link · live" : "Voice link · cold", on: listening, disabled: !micSupported, onClick: () => setListen(!listening) },
          { id: "voice", label: voiceOut ? "Agent voice · on" : "Agent voice · muted", on: voiceOut, onClick: toggleVoiceOut },
          { id: "broadcast", label: liveOpen ? "Live stream · on air" : "Live stream", on: liveOpen, onClick: () => { if (!handsOn) setHands(true); setLiveOpen(true); addLog("live stream monitor opened"); } },
          { id: "eye", label: viewMode === "gods" ? "Return to core" : "God's eye deck", on: viewMode === "gods", onClick: () => { setViewMode(viewMode === "core" ? "gods" : "core"); addLog(viewMode === "core" ? "god's eye: deck opened" : "god's eye: deck closed"); } },
        ]}
      >
        {tab === "chat" && (
          <ChatPanel
            messages={messages}
            persona={persona}
            typing={typing}
            input={input}
            setInput={setInput}
            onSend={sendMessage}
            suggestions={suggestions}
            listening={listening}
            onMicToggle={() => setListen(!listening)}
            voiceOut={voiceOut}
            onVoiceOutToggle={toggleVoiceOut}
            speaking={speaking}
            interim={interim}
            onRevealed={onRevealed}
            voiceChip={voiceOut ? (ttsEngine ? `${ttsEngine.engine === "edge" ? "EDGE" : "LOCAL"} · ${ttsEngine.label.split(" ")[0].toUpperCase()}` : `NEURAL · ${voiceLabelFor(personaId).label.split(" ")[0].toUpperCase()}`) : null}
          />
        )}
        {tab === "studio" && <StudioPanel track={track} persona={persona} onGenerate={handleGenerate} onTrackChange={setTrack} />}
        {tab === "gallery" && (
          <GalleryPanel
            images={images}
            busyPrompt={imagesBusy}
            pinnedIds={pinned.map((p) => p.id)}
            onPin={pinImage}
            onRemove={(id) => {
              setImages((prev) => prev.filter((i) => i.id !== id));
              setPinned((prev) => prev.filter((p) => p.id !== id));
            }}
            onPrompt={(p) => sendMessage(`draw ${p}`)}
            onImport={importFiles}
            accent={persona.accent}
          />
        )}
        {tab === "forge" && (
          <ObjectForge
            objects={objects}
            onSpawn={(shape, color) => {
              if (objectsRef.current.length >= maxObjects()) {
                addLog("field at capacity");
                return;
              }
              spawnObject(shape, color);
              addLog(`forged ${shape} from the flyout`);
            }}
            onRemove={(id) => setObjects((prev) => prev.filter((o) => o.id !== id))}
            onClear={() => {
              setObjects([]);
              addLog("forge field cleared");
            }}
            accent={persona.accent}
            palette={tasteProfile.palette}
          />
        )}
        {tab === "recon" && (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center gap-1 border-b border-ink-700/60 bg-ink-900/70 px-2 py-1.5">
              {(
                [
                  { id: "board", label: "PHASE 1 · REFERENCE BOARD" },
                  { id: "gate", label: "PHASE 2 · PREMODEL GATE" },
                ] as const
              ).map((m) => {
                const active = reconMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setReconMode(m.id)}
                    className="border px-2 py-1 font-mono text-[8px] tracking-[0.14em] transition-all"
                    style={{
                      borderColor: active ? persona.accent : "#213843",
                      color: active ? persona.accent : "#8cacac",
                      background: active ? alpha(persona.accent, 0.1) : "transparent",
                      boxShadow: active ? `0 0 12px -4px ${persona.accent}` : "none",
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            <div className="min-h-0 flex-1">
              {reconMode === "board" ? (
                <ReconPanel
                  board={board}
                  accent={persona.accent}
                  onNew={startRecon}
                  onRegenSection={regenSection}
                  onDownloadSheet={downloadSheet}
                />
              ) : (
                <PremodelPanel plan={gatePlan} accent={persona.accent} onRun={runGate} />
              )}
            </div>
          </div>
        )}
        {tab === "kernel" && <KernelPanel accent={persona.accent} onEvent={addLog} />}
        {tab === "taste" && (
          <TastePanel
            profile={tasteProfile}
            accent={persona.accent}
            onApply={(id) => {
              taste.set(id);
              addLog(`taste: doctrine → ${taste.active().name}`);
            }}
            onEvent={addLog}
          />
        )}
        {tab === "log" && (
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
              {log.length === 0 && (
                <p className="py-8 text-center font-mono text-[9px] tracking-[0.18em] text-mist-600">NO EVENTS YET — THE CONSOLE IS QUIET</p>
              )}
              {[...log].reverse().map((l, i) => (
                <div key={`${l.t}-${i}`} className="mb-1 flex items-baseline gap-2 border-b border-ink-700/40 pb-1">
                  <span className="shrink-0 font-mono text-[8px] tracking-[0.1em] text-mist-600">
                    {new Date(l.t).toLocaleTimeString("en-GB", { hour12: false })}
                  </span>
                  <span className={`min-w-0 flex-1 font-mono text-[9px] leading-relaxed ${i === 0 ? "text-mist-100" : "text-mist-500"}`}>{l.msg}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setLog([])}
              className="shrink-0 border-t border-ink-700/60 py-1.5 font-mono text-[8px] tracking-[0.2em] text-mist-600 transition-colors hover:text-ember"
            >
              PURGE LOG
            </button>
          </div>
        )}
      </HudRail>

      {/* ambient event ticker — keeps the viewport alive without stealing it */}
      {log.length > 0 && tab !== "log" && (
        <button
          key={log.length}
          onClick={() => setTab("log")}
          className="ticker-in absolute bottom-[88px] left-3 z-20 flex max-w-[70%] items-center gap-2 border border-ink-700/70 bg-ink-950/70 px-2.5 py-1.5 text-left backdrop-blur-sm transition-colors hover:border-mist-600 lg:bottom-4 lg:left-5 lg:max-w-[46%]"
          title="Open event log"
        >
          <span className="pulse-dot h-1 w-1 shrink-0 rounded-full" style={{ background: persona.accent }} />
          <span className="truncate font-mono text-[8px] tracking-[0.14em] text-mist-500">{log[log.length - 1].msg.toUpperCase()}</span>
        </button>
      )}

      {/* ============ LIVE STREAM BROADCAST ============ */}
      {liveOpen && handsEngineRef.current && (
        <LiveStream
          engine={handsEngineRef.current}
          personaName={persona.name}
          accent={persona.accent}
          onClose={() => {
            setLiveOpen(false);
            addLog("live stream closed");
          }}
        />
      )}

      {/* global file import (mini rail + keyboard-free path) */}
      <input
        ref={importRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) importFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <CrashBoundary>
      <AppInner />
    </CrashBoundary>
  );
}
