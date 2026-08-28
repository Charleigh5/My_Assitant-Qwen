import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Assistant3D from "./components/Assistant3D";
import ChatPanel from "./components/ChatPanel";
import type { ChatMsg } from "./components/ChatPanel";
import StudioPanel from "./components/StudioPanel";
import { PERSONAS, getPersona, alpha } from "./lib/personas";
import type { Mood, PersonaId } from "./lib/personas";
import { engine, generateTrack, GENRE_LABEL } from "./lib/musicEngine";
import type { Genre, Track } from "./lib/musicEngine";
import { craftReply, greetLine, musicLine, switchLine, tempoLine } from "./lib/chatEngine";

const uid = () => Math.random().toString(36).slice(2, 10);

const MOOD_LABEL: Record<Mood, string> = {
  idle: "STANDBY",
  thinking: "PROCESSING",
  talking: "SPEAKING",
  djing: "ON THE DECKS",
};

function PersonaGlyph({ shape, accent, size = 22 }: { shape: string; accent: string; size?: number }) {
  const common = { fill: "none", stroke: accent, strokeWidth: 1.6, strokeLinejoin: "round" as const };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {shape === "icosa" && (
        <>
          <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" {...common} />
          <polygon points="12,7 16.5,14.5 7.5,14.5" {...common} strokeWidth={1.1} />
        </>
      )}
      {shape === "knot" && (
        <>
          <circle cx="9" cy="12" r="5.5" {...common} />
          <circle cx="15" cy="12" r="5.5" {...common} />
        </>
      )}
      {shape === "dodeca" && (
        <>
          <polygon points="12,2.5 21,9.5 17.5,20 6.5,20 3,9.5" {...common} />
          <polygon points="12,8 16,11.5 14.5,16.5 9.5,16.5 8,11.5" {...common} strokeWidth={1.1} />
        </>
      )}
      {shape === "blob" && (
        <path d="M12 3c4 0 8 2.5 8 7 0 5-3.5 11-8 11S4 15.5 4 10c0-4.5 4-7 8-7z" {...common} />
      )}
    </svg>
  );
}

const OrbitLogo = ({ accent }: { accent: string }) => (
  <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
    <circle cx="16" cy="16" r="5.5" fill={accent} />
    <ellipse cx="16" cy="16" rx="13" ry="5" fill="none" stroke="#FF7A50" strokeWidth="1.8" transform="rotate(-18 16 16)" />
    <circle cx="27" cy="10.5" r="2.2" fill="#F5B94B" />
  </svg>
);

interface LogEvent {
  id: string;
  time: string;
  text: string;
}

export default function App() {
  const [personaId, setPersonaId] = useState<PersonaId>(() => {
    const saved = localStorage.getItem("orbit.persona");
    return (PERSONAS.some((p) => p.id === saved) ? saved : "nova") as PersonaId;
  });
  const persona = getPersona(personaId);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [typing, setTyping] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [mood, setMood] = useState<Mood>("idle");
  const [track, setTrack] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(engine.isPlaying);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [clock, setClock] = useState("--:--:--");

  const beatRef = useRef({ at: -9999, accent: false });
  const personaIdRef = useRef(personaId);
  const trackRef = useRef<Track | null>(null);
  const playingRef = useRef(false);
  const didInit = useRef(false);

  useEffect(() => { personaIdRef.current = personaId; localStorage.setItem("orbit.persona", personaId); }, [personaId]);
  useEffect(() => { trackRef.current = track; }, [track]);
  useEffect(() => { playingRef.current = playing; }, [playing]);

  const addEvent = (text: string) =>
    setEvents((e) =>
      [{ id: uid(), time: new Date().toLocaleTimeString("en-GB", { hour12: false }), text }, ...e].slice(0, 6)
    );

  // boot
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const p = getPersona(personaIdRef.current);
    setMessages([{ id: uid(), role: "agent", text: greetLine(p), personaId: p.id }]);
    addEvent(`${p.name} core online`);
    addEvent("uplink established · all systems nominal");
  }, []);

  // engine subscriptions
  useEffect(() => {
    const offStep = engine.onStep((e) => {
      beatRef.current = { at: performance.now(), accent: e.beat };
    });
    const offState = engine.onState((p) => {
      setPlaying(p);
      if (p) setMood((m) => (m === "talking" || m === "thinking" ? m : "djing"));
      else setMood((m) => (m === "djing" ? "idle" : m));
    });
    return () => { offStep(); offState(); };
  }, []);

  // clock
  useEffect(() => {
    const tickClock = () => setClock(new Date().toLocaleTimeString("en-GB", { hour12: false }));
    tickClock();
    const iv = setInterval(tickClock, 1000);
    return () => clearInterval(iv);
  }, []);

  const streamMessage = (text: string, fromPersona: PersonaId) => {
    const id = uid();
    setMessages((m) => [...m, { id, role: "agent", text: "", personaId: fromPersona }]);
    setStreamingId(id);
    setMood("talking");
    const words = text.split(" ");
    let i = 0;
    const iv = setInterval(() => {
      i += 2;
      const done = i >= words.length;
      const slice = words.slice(0, Math.min(i, words.length)).join(" ");
      setMessages((m) => m.map((msg) => (msg.id === id ? { ...msg, text: slice } : msg)));
      if (done) {
        clearInterval(iv);
        setStreamingId(null);
        setMood((m) => (m === "talking" ? (playingRef.current ? "djing" : "idle") : m));
      }
    }, 34);
  };

  const cookTrack = (genre?: Genre): Track => {
    const t = generateTrack({ genre: genre ?? trackRef.current?.genre, persona: personaIdRef.current });
    setTrack(t);
    engine.play(t);
    addEvent(`composed “${t.title}” · ${GENRE_LABEL[t.genre]} ${t.bpm}bpm`);
    return t;
  };

  const handleSend = (raw: string) => {
    const text = raw.trim();
    if (!text || typing) return;
    setMessages((m) => [...m, { id: uid(), role: "user", text, personaId: personaIdRef.current }]);
    setTyping(true);
    setMood("thinking");

    window.setTimeout(() => {
      const p = getPersona(personaIdRef.current);
      const reply = craftReply(text, p, { playing: playingRef.current, track: trackRef.current });
      setTyping(false);

      switch (reply.intent) {
        case "make-music": {
          const t = cookTrack(reply.genre);
          streamMessage(musicLine(p, t), p.id);
          break;
        }
        case "regen": {
          const t = cookTrack(trackRef.current?.genre);
          streamMessage(musicLine(p, t), p.id);
          break;
        }
        case "stop": {
          engine.stop();
          streamMessage(reply.text, p.id);
          break;
        }
        case "play": {
          if (trackRef.current) engine.play(trackRef.current);
          else cookTrack(reply.genre);
          streamMessage(reply.text || greetLine(p), p.id);
          break;
        }
        case "faster":
        case "slower": {
          const cur = trackRef.current;
          if (!cur) {
            streamMessage("No track on the decks yet — ask me to make one first.", p.id);
            break;
          }
          const delta = reply.intent === "faster" ? 14 : -14;
          const next = { ...cur, bpm: Math.min(160, Math.max(60, cur.bpm + delta)) };
          setTrack(next);
          engine.setTrack(next);
          addEvent(`tempo → ${next.bpm}bpm`);
          streamMessage(tempoLine(p, next, reply.intent), p.id);
          break;
        }
        case "switch-persona": {
          const targetId = reply.personaId!;
          setPersonaId(targetId);
          addEvent(`core swap → ${targetId.toUpperCase()}`);
          streamMessage(reply.text, targetId);
          break;
        }
        default:
          streamMessage(reply.text, p.id);
      }
    }, 650 + Math.random() * 650);
  };

  const switchPersona = (id: PersonaId) => {
    if (id === personaId) return;
    setPersonaId(id);
    const target = getPersona(id);
    addEvent(`core swap → ${id.toUpperCase()}`);
    streamMessage(switchLine(target), id);
  };

  const rootStyle = { "--acc": persona.accent } as CSSProperties;

  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950 font-body text-mist-100 lg:h-screen lg:overflow-hidden" style={rootStyle}>
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(1000px 680px at 72% -12%, ${alpha(persona.accent, 0.16)}, transparent 62%), radial-gradient(820px 620px at -8% 108%, ${alpha(persona.accent, 0.1)}, transparent 58%)`,
          }}
        />
        <div className="grid-layer absolute inset-0" />
        <div className="anim-drift-a absolute -top-24 right-[12%] h-[420px] w-[420px] rounded-full blur-3xl" style={{ background: alpha(persona.accent, 0.06) }} />
        <div className="anim-drift-b absolute bottom-[-160px] left-[6%] h-[380px] w-[380px] rounded-full blur-3xl" style={{ background: alpha("#FF7A50", 0.045) }} />
        <div className="scan-layer absolute inset-0" />
        <div className="noise-layer absolute inset-0" />
      </div>

      {/* header */}
      <header className="relative z-10 flex items-center justify-between border-b border-ink-700/60 bg-ink-950/70 px-4 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <OrbitLogo accent={persona.accent} />
          <div>
            <div className="font-display text-[13px] font-bold leading-tight tracking-[0.18em]">
              FULLSTACK·AGENT
            </div>
            <div className="font-mono text-[9px] tracking-[0.28em] text-mist-600">
              ORBIT CONSOLE — v0.9
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px] tracking-widest text-mist-500">
          <div className="hidden items-center gap-2 sm:flex">
            <span className={`h-1.5 w-1.5 rounded-full ${playing ? "pulse-dot" : ""}`} style={{ background: playing ? persona.accent : "#2F4C59" }} />
            <span>AUDIO·{playing ? "LIVE" : "OFF"}</span>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <span className="h-3 w-px bg-ink-600" />
            <span>
              CORE·<span style={{ color: persona.accent }}>{persona.name}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-px bg-ink-600" />
            <span className="tabular-nums text-mist-300">{clock}</span>
          </div>
        </div>
      </header>

      {/* main grid */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row">
        {/* left rail */}
        <aside className="order-2 flex shrink-0 flex-col gap-3 lg:order-1 lg:w-[268px] lg:overflow-y-auto">
          <div className="panel p-3">
            <div className="mb-2.5 flex items-baseline justify-between px-1">
              <span className="font-display text-[10px] font-bold tracking-[0.22em]">PERSONA CORES</span>
              <span className="font-mono text-[9px] text-mist-600">4 LOADED</span>
            </div>
            <div className="flex flex-col gap-2">
              {PERSONAS.map((p) => {
                const active = p.id === personaId;
                return (
                  <button
                    key={p.id}
                    onClick={() => switchPersona(p.id)}
                    className="group flex w-full items-center gap-3 border p-2.5 text-left transition-all duration-200 hover:translate-x-1 active:scale-[0.98]"
                    style={{
                      borderColor: active ? alpha(p.accent, 0.6) : "#213843",
                      background: active
                        ? `linear-gradient(90deg, ${alpha(p.accent, 0.13)}, transparent 70%)`
                        : "transparent",
                      boxShadow: active ? `0 0 24px -6px ${alpha(p.accent, 0.45)}` : undefined,
                    }}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center border transition-colors"
                      style={{ borderColor: alpha(p.accent, active ? 0.7 : 0.3), background: alpha(p.accent, active ? 0.1 : 0.04) }}
                    >
                      <PersonaGlyph shape={p.shape} accent={p.accent} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between">
                        <span className="font-display text-[11px] font-bold tracking-[0.14em]" style={{ color: active ? p.accent : "#C2D8D6" }}>
                          {p.name}
                        </span>
                        {active && (
                          <span className="font-mono text-[8px] tracking-[0.2em]" style={{ color: p.accent }}>
                            ACTIVE
                          </span>
                        )}
                      </span>
                      <span className="block truncate font-mono text-[9px] tracking-wider text-mist-600">
                        {p.role.toUpperCase()}
                      </span>
                      {active && (
                        <span className="mt-1 block font-mono text-[8.5px] leading-relaxed tracking-wide text-mist-500">
                          {p.traits.join(" · ")}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* diagnostics + event log */}
          <div className="panel flex-1 p-3">
            <div className="mb-2.5 px-1 font-display text-[10px] font-bold tracking-[0.22em]">
              DIAGNOSTICS
            </div>
            <div className="space-y-1.5 px-1 font-mono text-[10px] tracking-wider">
              <div className="flex justify-between"><span className="text-mist-600">ENGINE</span><span style={{ color: playing ? persona.accent : "#8CACAC" }}>{playing ? "WAVE·LIVE" : "IDLE"}</span></div>
              <div className="flex justify-between"><span className="text-mist-600">MOOD</span><span className="text-mist-300">{MOOD_LABEL[mood]}</span></div>
              <div className="flex justify-between"><span className="text-mist-600">SESSION</span><span className="tabular-nums text-mist-300">{clock}</span></div>
              <div className="flex justify-between"><span className="text-mist-600">LINK</span><span className="text-mist-300">STABLE·12ms</span></div>
            </div>
            <div className="mt-3 border-t border-ink-700/60 pt-2.5">
              <div className="mb-1.5 px-1 font-mono text-[9px] tracking-[0.24em] text-mist-600">EVENT LOG</div>
              <ul className="space-y-1 px-1 font-mono text-[9.5px] leading-relaxed">
                {events.map((e) => (
                  <li key={e.id} className="msg-in flex gap-2 text-mist-500">
                    <span className="tabular-nums text-mist-600">{e.time}</span>
                    <span className="truncate">{e.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        {/* center column: stage + studio */}
        <main className="order-1 flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:order-2">
          <section className="panel relative h-[400px] overflow-hidden lg:h-auto lg:min-h-0 lg:flex-[1.15]">
            <div className="absolute inset-0">
              <Assistant3D persona={persona} mood={mood} beatRef={beatRef} />
            </div>

            {/* HUD */}
            <div className="pointer-events-none absolute inset-0">
              <span className="hud-corner left-2 top-2 border-l-2 border-t-2" />
              <span className="hud-corner right-2 top-2 border-r-2 border-t-2" />
              <span className="hud-corner bottom-2 left-2 border-b-2 border-l-2" />
              <span className="hud-corner bottom-2 right-2 border-b-2 border-r-2" />

              <div className="absolute left-5 top-4">
                <div className="font-mono text-[9px] tracking-[0.3em] text-mist-600">// CORE PRESENCE</div>
                <h1 className="mt-1 font-display text-2xl font-black leading-none tracking-wide text-mist-100 md:text-3xl">
                  {persona.name}
                </h1>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="h-[3px] w-8" style={{ background: persona.accent }} />
                  <span className="font-mono text-[10px] tracking-[0.2em]" style={{ color: persona.accent }}>
                    {persona.role.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="absolute right-5 top-4 flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-2 border border-ink-700/80 bg-ink-950/60 px-2.5 py-1.5 backdrop-blur-sm">
                  <span className={`h-1.5 w-1.5 rounded-full ${mood !== "idle" ? "pulse-dot" : ""}`} style={{ background: mood === "idle" ? "#2F4C59" : persona.accent }} />
                  <span className="font-mono text-[9px] tracking-[0.22em] text-mist-300">{MOOD_LABEL[mood]}</span>
                </div>
                {track && (
                  <div className="border border-ink-700/80 bg-ink-950/60 px-2.5 py-1.5 font-mono text-[9px] tracking-[0.18em] text-mist-500 backdrop-blur-sm">
                    NOW · {track.bpm} BPM · {GENRE_LABEL[track.genre]}
                  </div>
                )}
              </div>

              <div className="absolute bottom-4 left-5 font-mono text-[9px] tracking-[0.22em] text-mist-600">
                DRAG TO ORBIT — AUTO-ROTATE ENGAGED
              </div>

              <div className={`absolute bottom-4 right-5 flex items-end gap-[3px] ${playing ? "eq-live" : ""}`}>
                {[0.9, 0.5, 1.1, 0.7, 1.3].map((d, i) => (
                  <span
                    key={i}
                    className="eq-bar w-[5px]"
                    style={{ height: 8 + i * 3.4, background: persona.accent, animationDuration: `${d}s`, animationDelay: `${i * 0.09}s`, opacity: playing ? 0.9 : 0.3 }}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="h-[430px] lg:h-auto lg:min-h-0 lg:flex-1">
            <StudioPanel
              track={track}
              persona={persona}
              onGenerate={cookTrack}
              onTrackChange={setTrack}
            />
          </section>
        </main>

        {/* chat rail */}
        <section className="order-3 h-[560px] shrink-0 lg:h-auto lg:min-h-0 lg:w-[388px] xl:w-[420px]">
          <ChatPanel
            persona={persona}
            messages={messages}
            typing={typing}
            streamingId={streamingId}
            onSend={handleSend}
          />
        </section>
      </div>
    </div>
  );
}
