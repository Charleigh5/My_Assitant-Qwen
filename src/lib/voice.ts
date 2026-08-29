/**
 * VOICE LINK — two-way speech.
 * INPUT  : Web Speech recognition (Chrome/Edge).
 * OUTPUT : Microsoft Edge neural voices (edgeTts.ts) with automatic
 *          fallback to the browser's local SpeechSynthesis engine.
 */
import type { PersonaId } from "./personas";
import { PERSONA_VOICES, speakEdge, type EdgeVoice } from "./edgeTts";

/* ================= input (recognition) ================= */

type AnyCtor = new () => any;
const RecCtor: AnyCtor | undefined =
  typeof window !== "undefined"
    ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition)
    : undefined;

export const micSupported = !!RecCtor;
export const ttsSupported =
  typeof window !== "undefined" && "speechSynthesis" in window;

export interface RecognitionHandle {
  stop: () => void;
}

export function startListening(opts: {
  onInterim: (t: string) => void;
  onFinal: (t: string) => void;
  onEnd: () => void;
}): RecognitionHandle | null {
  if (!RecCtor) return null;
  const rec = new RecCtor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";

  rec.onresult = (e: any) => {
    let interim = "";
    let final = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (final.trim()) opts.onFinal(final.trim());
    if (interim) opts.onInterim(interim);
  };
  rec.onerror = () => opts.onEnd();
  rec.onend = () => opts.onEnd();

  try {
    rec.start();
  } catch {
    return null;
  }
  return {
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    },
  };
}

/* ================= output (speech) ================= */

export type TtsEngine = "edge" | "local" | "off";

const LOCAL_STYLE: Record<PersonaId, { rate: number; pitch: number }> = {
  nova: { rate: 1.04, pitch: 0.85 },
  ember: { rate: 1.14, pitch: 1.35 },
  atlas: { rate: 0.94, pitch: 0.7 },
  lyra: { rate: 0.9, pitch: 1.18 },
};

export const voiceLabelFor = (persona: PersonaId): EdgeVoice =>
  PERSONA_VOICES[persona] ?? PERSONA_VOICES.nova;

let voices: SpeechSynthesisVoice[] = [];
function refreshVoices() {
  if (ttsSupported) voices = window.speechSynthesis.getVoices();
}
if (ttsSupported) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

/* --- mp3 playback via a single reusable Audio element --- */
let player: HTMLAudioElement | null = null;
let playerToken = 0;

function ensurePlayer(): HTMLAudioElement {
  if (!player) {
    player = new Audio();
    player.preload = "auto";
  }
  return player;
}

function playBlob(
  blob: Blob,
  onStart?: () => void,
  onEnd?: () => void,
): { cancel: () => void } {
  const el = ensurePlayer();
  const token = ++playerToken;
  const url = URL.createObjectURL(blob);

  const cleanup = () => {
    el.removeEventListener("ended", ended);
    el.removeEventListener("error", ended);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  const ended = () => {
    if (playerToken !== token) return;
    cleanup();
    onEnd?.();
  };
  el.addEventListener("ended", ended);
  el.addEventListener("error", ended);

  el.src = url;
  el.currentTime = 0;
  const p = el.play();
  if (p && typeof p.then === "function") {
    p.then(() => {
      if (playerToken === token) onStart?.();
    }).catch(() => {
      if (playerToken === token) {
        cleanup();
        onEnd?.();
      }
    });
  } else {
    onStart?.();
  }
  return {
    cancel: () => {
      playerToken++;
      try {
        el.pause();
      } catch {
        /* noop */
      }
      cleanup();
    },
  };
}

export interface SpeakHandle {
  cancel: () => void;
}

export interface SpeakCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  /** which engine actually produced the audio */
  onEngine?: (e: TtsEngine, label: string) => void;
}

/**
 * Speak `text` in the persona's voice.
 * Order of preference: Edge neural voice → local SpeechSynthesis → silence.
 */
export function speak(
  text: string,
  persona: PersonaId,
  cb: SpeakCallbacks = {},
): SpeakHandle | null {
  const clean = text
    .replace(/[“”"*_#`…]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;

  // silence whatever is currently talking
  playerToken++;
  if (player) {
    try {
      player.pause();
    } catch {
      /* noop */
    }
  }
  if (ttsSupported) window.speechSynthesis.cancel();

  const voice = voiceLabelFor(persona);
  let cancelled = false;
  let inner: SpeakHandle | null = null;

  const fallbackLocal = () => {
    if (cancelled || !ttsSupported) {
      cb.onEnd?.();
      return;
    }
    const u = new SpeechSynthesisUtterance(clean);
    const style = LOCAL_STYLE[persona];
    u.rate = style.rate;
    u.pitch = style.pitch;
    const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
    const preferred =
      en.find((v) => /google uk english female|samantha|zira|aria|jenny|libby/i.test(v.name)) ??
      en.find((v) => v.default) ??
      en[0];
    if (preferred) u.voice = preferred;
    let ended = false;
    const finish = () => {
      if (!ended) {
        ended = true;
        cb.onEnd?.();
      }
    };
    u.onstart = () => cb.onStart?.();
    u.onend = finish;
    u.onerror = finish;
    window.speechSynthesis.speak(u);
    cb.onEngine?.("local", preferred?.name?.split(" ")[0] ?? "System voice");
    inner = {
      cancel: () => {
        window.speechSynthesis.cancel();
        finish();
      },
    };
  };

  speakEdge(clean, { voice })
    .then((blob) => {
      if (cancelled) return;
      cb.onEngine?.("edge", voice.label);
      inner = playBlob(blob, cb.onStart, cb.onEnd);
    })
    .catch(() => fallbackLocal());

  return {
    cancel: () => {
      cancelled = true;
      inner?.cancel();
    },
  };
}

export function stopSpeaking() {
  playerToken++;
  if (player) {
    try {
      player.pause();
    } catch {
      /* noop */
    }
  }
  if (ttsSupported) window.speechSynthesis.cancel();
}
