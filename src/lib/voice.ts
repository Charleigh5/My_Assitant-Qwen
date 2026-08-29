/**
 * VOICE LINK — live two-way speech: Web Speech recognition for input,
 * persona-tuned SpeechSynthesis for output.
 */
import type { PersonaId } from "./personas";

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

/* ---------- speech output ---------- */

const VOICE_STYLE: Record<PersonaId, { rate: number; pitch: number }> = {
  nova: { rate: 1.04, pitch: 0.85 },
  ember: { rate: 1.14, pitch: 1.35 },
  atlas: { rate: 0.94, pitch: 0.7 },
  lyra: { rate: 0.9, pitch: 1.18 },
};

let voices: SpeechSynthesisVoice[] = [];
function refreshVoices() {
  if (ttsSupported) voices = window.speechSynthesis.getVoices();
}
if (ttsSupported) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

export interface SpeakHandle {
  cancel: () => void;
}

export function speak(
  text: string,
  persona: PersonaId,
  onStart?: () => void,
  onEnd?: () => void,
): SpeakHandle | null {
  if (!ttsSupported) return null;
  window.speechSynthesis.cancel();
  const clean = text
    .replace(/[“”"*_#`…]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;

  const u = new SpeechSynthesisUtterance(clean);
  const style = VOICE_STYLE[persona];
  u.rate = style.rate;
  u.pitch = style.pitch;
  u.volume = 1;

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
      onEnd?.();
    }
  };
  u.onstart = () => onStart?.();
  u.onend = finish;
  u.onerror = finish;

  window.speechSynthesis.speak(u);
  return {
    cancel: () => {
      window.speechSynthesis.cancel();
      finish();
    },
  };
}

export function stopSpeaking() {
  if (ttsSupported) window.speechSynthesis.cancel();
}
