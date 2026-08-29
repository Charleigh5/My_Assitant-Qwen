import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../lib/chatEngine";
import type { Persona } from "../lib/personas";
import { alpha } from "../lib/personas";
import { micSupported } from "../lib/voice";

interface Props {
  messages: ChatMessage[];
  persona: Persona;
  typing: boolean;
  input: string;
  setInput: (v: string) => void;
  onSend: (text: string) => void;
  suggestions: string[];
  listening: boolean;
  onMicToggle: () => void;
  voiceOut: boolean;
  onVoiceOutToggle: () => void;
  speaking: boolean;
  interim: string | null;
  onRevealed: (id: string) => void;
  voiceChip?: string | null;
}

function AgentText({ msg, onDone }: { msg: ChatMessage; onDone: (id: string) => void }) {
  const words = msg.text.split(" ");
  const [n, setN] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    setN(0);
    doneRef.current = false;
    let i = 0;
    const iv = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= words.length) {
        window.clearInterval(iv);
        if (!doneRef.current) {
          doneRef.current = true;
          onDone(msg.id);
        }
      }
    }, 32);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msg.id, msg.text]);

  return (
    <span>
      {words.slice(0, n).join(" ")}
      {n < words.length && (
        <span className="blink" style={{ opacity: 0.8 }}>
          ▍
        </span>
      )}
    </span>
  );
}

const MicIcon = ({ live }: { live: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0" />
    <path d="M12 17v4" />
    {live && <circle cx="12" cy="8" r="1.6" fill="currentColor" stroke="none" />}
  </svg>
);

const SpeakerIcon = ({ on }: { on: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M11 5 6 9H2v6h4l5 4V5z" />
    {on ? (
      <>
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9.5 9.5 0 0 1 0 13" />
      </>
    ) : (
      <path d="m16 9 6 6M22 9l-6 6" />
    )}
  </svg>
);

export default function ChatPanel({
  messages,
  persona,
  typing,
  input,
  setInput,
  onSend,
  suggestions,
  listening,
  onMicToggle,
  voiceOut,
  onVoiceOutToggle,
  speaking,
  interim,
  onRevealed,
  voiceChip,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing, interim]);

  const submit = () => {
    const t = input.trim();
    if (t) onSend(t);
  };

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="flex items-center justify-between border-b border-ink-700/70 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="pulse-dot absolute inline-flex h-full w-full rounded-full" style={{ background: persona.accent }} />
          </span>
          <div>
            <p className="font-display text-[11px] font-bold tracking-[0.22em] text-mist-100">
              COMMS <span style={{ color: persona.accent }}>// {persona.name}</span>
            </p>
            <p className="font-mono text-[8px] tracking-[0.18em] text-mist-600">
              {speaking ? "SPEAKING ALOUD" : listening ? "MIC LIVE — TALK TO ME" : "ENCRYPTED CHANNEL"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {voiceChip && (
            <span
              className="border px-1.5 py-0.5 font-mono text-[7.5px] tracking-[0.14em] transition-colors duration-500"
              style={{
                borderColor: voiceChip.startsWith("EDGE") ? "#9be15d77" : "#213843",
                color: voiceChip.startsWith("EDGE") ? "#9be15d" : "#8cacac",
                background: voiceChip.startsWith("EDGE") ? "rgba(155,225,93,0.06)" : "transparent",
              }}
              title="Speech synthesis engine"
            >
              {voiceChip}
            </span>
          )}
          {speaking && (
            <div className="eq-live mr-1 flex h-4 items-end gap-[2px]">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="eq-bar w-[3px]"
                  style={{ height: `${8 + (i % 3) * 4}px`, background: persona.accent, animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </div>
          )}
          <button
            onClick={onVoiceOutToggle}
            title={voiceOut ? "Mute agent voice" : "Enable agent voice"}
            className="border p-1.5 transition-all hover:-translate-y-px"
            style={{
              borderColor: voiceOut ? persona.accent : "#213843",
              color: voiceOut ? persona.accent : "#66868a",
              background: voiceOut ? alpha(persona.accent, 0.12) : "transparent",
            }}
          >
            <SpeakerIcon on={voiceOut} />
          </button>
          <button
            onClick={onMicToggle}
            disabled={!micSupported}
            title={!micSupported ? "Speech recognition needs Chrome/Edge" : listening ? "Stop listening" : "Talk to the agent"}
            className={`border p-1.5 transition-all hover:-translate-y-px disabled:opacity-30 ${listening ? "pulse-dot" : ""}`}
            style={{
              borderColor: listening ? persona.accent : "#213843",
              color: listening ? persona.accent : "#66868a",
              background: listening ? alpha(persona.accent, 0.12) : "transparent",
              borderRadius: 2,
            }}
          >
            <MicIcon live={listening} />
          </button>
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="msg-in flex justify-end">
              <div className="max-w-[85%] border border-ink-600 bg-ink-800/80 px-3 py-2">
                <p className="text-[13px] leading-relaxed text-mist-100">{m.text}</p>
              </div>
            </div>
          ) : (
            <div key={m.id} className="msg-in flex justify-start">
              <div
                className="max-w-[92%] border px-3 py-2"
                style={{
                  borderColor: alpha(m.personaId ? persona.accent : "#3fe0c5", 0.4),
                  background: alpha(m.personaId ? persona.accent : "#3fe0c5", 0.07),
                }}
              >
                <p className="mb-1 font-mono text-[8px] tracking-[0.22em]" style={{ color: persona.accent }}>
                  {m.personaId?.toUpperCase() ?? "AGENT"} · CORE
                </p>
                {m.status === "rendering" ? (
                  <div className="img-shimmer flex items-center gap-2 px-2 py-3">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-mist-500 border-t-transparent" />
                    <span className="font-mono text-[9px] tracking-[0.16em] text-mist-500">RENDERING…</span>
                  </div>
                ) : (
                  <p className="text-[13px] leading-relaxed text-mist-100">
                    <AgentText msg={m} onDone={onRevealed} />
                  </p>
                )}
                {m.imageUrl && (
                  <figure className="mt-2 overflow-hidden border" style={{ borderColor: alpha(persona.accent, 0.35) }}>
                    <img src={m.imageUrl} alt={m.imagePrompt ?? "generated artwork"} className="w-full object-cover transition-transform duration-700 hover:scale-105" />
                    {m.imagePrompt && (
                      <figcaption className="bg-ink-950/80 px-2 py-1 font-mono text-[8px] tracking-[0.14em] text-mist-500">
                        “{m.imagePrompt.toUpperCase()}”
                      </figcaption>
                    )}
                  </figure>
                )}
              </div>
            </div>
          )
        )}
        {typing && (
          <div className="msg-in flex items-center gap-1.5 px-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="tdot inline-block h-1.5 w-1.5 rounded-full" style={{ background: persona.accent }} />
            ))}
            <span className="ml-1 font-mono text-[8px] tracking-[0.2em] text-mist-600">
              {persona.name} IS COMPOSING
            </span>
          </div>
        )}
        {interim && (
          <div className="msg-in border border-dashed px-3 py-2" style={{ borderColor: alpha(persona.accent, 0.5) }}>
            <p className="font-mono text-[9px] tracking-[0.14em]" style={{ color: persona.accent }}>
              HEARD: <span className="text-mist-100">{interim}</span>
            </p>
          </div>
        )}
      </div>

      {/* suggestions */}
      <div className="flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSend(s)}
            className="shrink-0 border border-ink-600 px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-mist-300 transition-all hover:-translate-y-0.5"
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = persona.accent;
              e.currentTarget.style.color = persona.accent;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#213843";
              e.currentTarget.style.color = "";
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-center gap-2 border-t border-ink-700/70 p-3"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={listening ? "Speak now — I'm transcribing…" : `Message ${persona.name}…`}
          className="min-w-0 flex-1 border border-ink-600 bg-ink-950/70 px-3 py-2 text-[13px] text-mist-100 placeholder:text-mist-600 focus:outline-none"
          style={{ caretColor: persona.accent }}
          onFocus={(e) => (e.currentTarget.style.borderColor = persona.accent)}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#213843")}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="px-3.5 py-2 font-mono text-[10px] font-bold tracking-[0.18em] text-ink-950 transition-all enabled:hover:-translate-y-0.5 disabled:opacity-30"
          style={{ background: persona.accent, boxShadow: input.trim() ? `0 0 18px -4px ${persona.accent}` : "none" }}
        >
          SEND
        </button>
      </form>
    </div>
  );
}
