import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Assistant3D from "./components/Assistant3D";
import type { BeatRef } from "./components/Assistant3D";
import StudioPanel from "./components/StudioPanel";
import ChatPanel from "./components/ChatPanel";
import HandOverlay from "./components/HandOverlay";
import { DockBar, GalleryPanel, ObjectForge } from "./components/Docks";
import type { DockTab } from "./components/Docks";
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
import { FORGE_COLORS } from "./lib/sceneTypes";
import type { PinnedImage, SceneObject, ShapeKind } from "./lib/sceneTypes";

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface LogEntry {
  t: string;
  msg: string;
}

/* ---------- tiny UI atoms ---------- */

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

export default function App() {
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
  const [tab, setTab] = useState<DockTab>(() => {
    const s = store.get("orbit.tab");
    return s === "gallery" || s === "forge" || s === "recon" ? (s as DockTab) : "studio";
  });
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [imagesBusy, setImagesBusy] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const boardRef = useRef<Board | null>(null);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);
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
    store.set("orbit.tab", tab);
  }, [personaId, voiceOut, tab]);

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
                            ? { ...s, status: (gen.method === "ai" ? "done" : "fallback") as "done" | "fallback", src: gen.src, method: gen.method }
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
                  ? { ...s, status: (gen.method === "ai" ? "done" : "fallback") as "done" | "fallback", src: gen.src, method: gen.method }
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
          setMood("idle");
          reply(simpleLine(pid, "stop"));
          addLog("playback stopped");
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
        case "image": {
          const prompt = det.imagePrompt ?? "an abstract dreamscape";
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
          if (objectsRef.current.length >= FIELD_CAP) {
            reply(`The field is saturated — ${FIELD_CAP} objects is my ergonomic limit. Say "clear" and I'll sweep the deck.`);
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
    [addLog, playNew, reply, setHands, setListen, spawnObject]
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
        return [...prev.slice(-5), { id: img.id, src: img.src, prompt: img.prompt, slot: prev.length }];
      });
      addLog(`pinned to scene · “${img.prompt}”`);
    },
    [addLog]
  );

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
      "draw a neon fox",
      "reconstruct a leather aviator jacket",
      "spawn a teal torus",
      "hands on",
      "listen",
      `switch to ${other.name.toLowerCase()}`,
    ];
  }, [personaId]);

  /* ---------- render ---------- */

  return (
    <div
      className="relative flex h-screen w-full overflow-hidden font-body text-mist-100"
      style={{ "--acc": persona.accent } as CSSProperties}
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

      {/* ============ LEFT · identity + modules + log ============ */}
      <aside className="z-10 flex w-[266px] shrink-0 flex-col border-r border-ink-700/60 bg-ink-900/75 backdrop-blur-md">
        <div className="border-b border-ink-700/60 px-4 py-4">
          <div className="flex items-center gap-3">
            <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
              <circle cx="17" cy="17" r="6" fill={persona.accent} opacity="0.9" />
              <circle cx="17" cy="17" r="6" fill="none" stroke="#eaf4f3" strokeOpacity="0.4" />
              <ellipse cx="17" cy="17" rx="14.5" ry="5.5" stroke={persona.accent} strokeOpacity="0.75" transform="rotate(-18 17 17)" />
              <circle cx="28.5" cy="11.5" r="1.8" fill="#eaf4f3" />
            </svg>
            <div>
              <h1 className="font-display text-[16px] font-extrabold leading-none tracking-[0.3em] text-mist-100">
                ORBIT
              </h1>
              <p className="mt-1 font-mono text-[7.5px] tracking-[0.22em] text-mist-600">
                FULLSTACK AGENT CONSOLE
              </p>
            </div>
          </div>
        </div>

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
            title="RECON BOARDS"
            sub={
              board
                ? `“${board.object.toUpperCase()}” · REV ${board.rev} · ${board.sections.filter((s) => s.status === "done" || s.status === "fallback").length}/5 VIEWS`
                : "3D RECONSTRUCTION REFERENCE SHEETS"
            }
            right={
              <button
                onClick={() => setTab("recon")}
                className="border px-2 py-1 font-mono text-[8px] tracking-[0.16em] transition-all hover:-translate-y-px"
                style={{ borderColor: `${persona.accent}66`, color: persona.accent, background: alpha(persona.accent, 0.08) }}
              >
                BOARD →
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
      </aside>

      {/* ============ CENTER · stage + dock ============ */}
      <main className="z-10 flex min-w-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1">
          <Assistant3D
            persona={persona}
            mood={mood}
            beatRef={beatRef}
            handRef={handFrameRef}
            objects={objects}
            pinned={pinned}
            onObjectMove={onObjectMove}
            onCorePulse={onCorePulse}
          />

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
          <p className="pointer-events-none absolute bottom-4 right-5 z-10 font-mono text-[7.5px] tracking-[0.2em] text-mist-600">
            DRAG ORBIT · SPACE · PLAY/STOP · {handsStatus === "active" ? "PINCH GRABS OBJECTS" : "“HANDS ON” FOR WEBCAM CONTROL"}
          </p>

          {handsOn && handsEngineRef.current && (
            <HandOverlay engine={handsEngineRef.current} accent={persona.accent} onClose={() => setHands(false)} />
          )}
        </div>

        {/* dock */}
        <div
          className={`flex shrink-0 flex-col border-t border-ink-700/60 bg-ink-900/75 backdrop-blur-md transition-[height] duration-500 ${
            tab === "recon" ? "h-[420px]" : "h-[258px]"
          }`}
        >
          <DockBar
            tab={tab}
            setTab={setTab}
            imageCount={images.length}
            objectCount={objects.length}
            reconCount={board ? board.sections.filter((s) => s.status === "done" || s.status === "fallback").length : undefined}
            accent={persona.accent}
          />
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
              />
            )}
            {tab === "forge" && (
              <ObjectForge
                objects={objects}
                onSpawn={(shape, color) => {
                  if (objectsRef.current.length >= FIELD_CAP) {
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
              />
            )}
            {tab === "recon" && (
              <ReconPanel
                board={board}
                accent={persona.accent}
                onNew={startRecon}
                onRegenSection={regenSection}
                onDownloadSheet={downloadSheet}
              />
            )}
          </div>
        </div>
      </main>

      {/* ============ RIGHT · comms ============ */}
      <section className="z-10 w-[384px] shrink-0 border-l border-ink-700/60 bg-ink-900/75 backdrop-blur-md">
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
      </section>

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
    </div>
  );
}
