import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Persona, PersonaId } from "../lib/personas";
import { getPersona, alpha } from "../lib/personas";

export interface ChatMsg {
  id: string;
  role: "user" | "agent";
  text: string;
  personaId: PersonaId;
}

const CHIPS = [
  "Cook a lofi beat",
  "Drop a synthwave banger",
  "Switch to Ember",
  "Make it faster",
  "Who are you?",
];

const SendIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4 20-7z" />
  </svg>
);

interface Props {
  persona: Persona;
  messages: ChatMsg[];
  typing: boolean;
  streamingId: string | null;
  onSend: (text: string) => void;
}

export default function ChatPanel({ persona, messages, typing, streamingId, onSend }: Props) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onSend(text);
  };

  return (
    <div className="panel flex h-full min-h-0 flex-col overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between border-b border-ink-700/60 px-4 py-2.5">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-[11px] font-bold tracking-[0.22em] text-mist-100">UPLINK</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-mist-600">core channel</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: persona.accent }} />
          <span className="font-mono text-[10px] tracking-widest" style={{ color: persona.accent }}>
            {persona.name}
          </span>
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) => {
          const p = getPersona(m.personaId);
          const isUser = m.role === "user";
          return (
            <div key={m.id} className={`msg-in flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] ${isUser ? "text-right" : ""}`}>
                {!isUser && (
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="h-2 w-2 rotate-45" style={{ background: p.accent }} />
                    <span className="font-mono text-[9px] tracking-[0.18em]" style={{ color: p.accent }}>
                      {p.name} · {p.role.toUpperCase()}
                    </span>
                  </div>
                )}
                <div
                  className="inline-block px-3.5 py-2.5 text-left text-[13px] leading-relaxed"
                  style={
                    isUser
                      ? {
                          background: alpha(persona.accent, 0.1),
                          border: `1px solid ${alpha(persona.accent, 0.35)}`,
                          color: "#EAF4F3",
                        }
                      : { background: "#13222A", border: "1px solid #213843", color: "#C2D8D6" }
                  }
                >
                  {m.text}
                  {m.id === streamingId && (
                    <span className="blink ml-0.5 inline-block h-3.5 w-[7px] translate-y-[2px]" style={{ background: p.accent }} />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {typing && (
          <div className="msg-in flex items-center gap-2">
            <span className="h-2 w-2 rotate-45" style={{ background: persona.accent }} />
            <div className="flex items-center gap-1 border border-ink-700 bg-ink-850 px-3 py-2.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="tdot h-1.5 w-1.5 rounded-full" style={{ background: persona.accent }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* chips + input */}
      <div className="border-t border-ink-700/60 p-3">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => onSend(c)}
              className="border border-ink-600 px-2 py-1 font-mono text-[9.5px] tracking-wider text-mist-500 transition-all hover:-translate-y-0.5 hover:text-mist-100 active:scale-95"
              style={{ borderColor: alpha(persona.accent, 0.22) }}
            >
              {c}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="message the core…"
            className="min-w-0 flex-1 border border-ink-600 bg-ink-900 px-3 py-2.5 font-mono text-[12px] text-mist-100 placeholder:text-mist-600 focus:outline-none"
            style={{ caretColor: persona.accent }}
            onFocus={(e) => (e.currentTarget.style.borderColor = alpha(persona.accent, 0.55))}
            onBlur={(e) => (e.currentTarget.style.borderColor = "")}
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center border transition-all enabled:hover:scale-110 enabled:active:scale-95 disabled:opacity-35"
            style={{
              borderColor: alpha(persona.accent, 0.6),
              color: persona.accent,
              background: alpha(persona.accent, 0.08),
            }}
            aria-label="Send"
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  );
}
