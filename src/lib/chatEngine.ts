import type { Persona, PersonaId } from "./personas";
import { PERSONAS } from "./personas";
import type { Genre, Track } from "./musicEngine";

export type Intent =
  | "make-music"
  | "regen"
  | "stop"
  | "play"
  | "faster"
  | "slower"
  | "switch-persona"
  | "none";

export interface Reply {
  intent: Intent;
  text: string;
  genre?: Genre;
  personaId?: PersonaId;
}

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const fill = (tpl: string, vars: Record<string, string | number>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

const fallbackCursor: Record<PersonaId, number> = { nova: 0, ember: 0, atlas: 0, lyra: 0 };

const GENRE_WORDS: [RegExp, Genre][] = [
  [/\b(lo-?fi|lofi|chill|study|cozy|rainy)\b/i, "lofi"],
  [/\b(synthwave|synth-?wave|retro|80s|eighties|neon|outrun|vhs)\b/i, "synthwave"],
  [/\b(house|deep house|dance|club|techno|party|groove|disco)\b/i, "house"],
  [/\b(ambient|sleep|calm|space|meditat|dream|drift|float)\b/i, "ambient"],
];

function detectGenre(text: string): Genre | undefined {
  for (const [re, g] of GENRE_WORDS) if (re.test(text)) return g;
  return undefined;
}

function detectPersona(text: string): PersonaId | undefined {
  const m = text.match(/\b(nova|ember|atlas|lyra)\b/i);
  if (!m) return undefined;
  return m[1].toLowerCase() as PersonaId;
}

export interface ChatState {
  playing: boolean;
  track: Track | null;
}

export function craftReply(raw: string, persona: Persona, state: ChatState): Reply {
  const text = raw.toLowerCase();

  // persona switch
  const mentioned = detectPersona(raw);
  if (mentioned && mentioned !== persona.id && /(switch|become|morph|transform|turn|swap|channel|summon|you are|be)\b/i.test(text)) {
    const target = PERSONAS.find((p) => p.id === mentioned)!;
    return { intent: "switch-persona", personaId: mentioned, text: pick(target.voice.switchIn) };
  }

  // stop
  if (/\b(stop|pause|silence|mute|quiet|cut it|kill it|enough)\b/i.test(text) && !/(make|create|generate|cook|drop|write|compose)/i.test(text)) {
    return { intent: "stop", text: pick(persona.voice.stop) };
  }

  // tempo steering
  if (/\b(faster|speed (it )?up|tempo up|quicker|hype(r)? it)\b/i.test(text)) {
    if (!state.track) return { intent: "make-music", text: "", genre: detectGenre(raw) };
    return { intent: "faster", text: "" };
  }
  if (/\b(slower|slow (it )?(down|up)|tempo down|chill it|relax it)\b/i.test(text)) {
    if (!state.track) return { intent: "make-music", text: "", genre: detectGenre(raw) };
    return { intent: "slower", text: "" };
  }

  // music creation
  const genre = detectGenre(raw);
  const makeVerb = /(make|create|generat|compos|cook|drop|build|produce|whip|write|spin|craft|give me|play me|throw)\b/i.test(text);
  const musicNoun = /(music|beat|track|song|tune|loop|melody|banger|vibe|groove|soundscape|anthem|jams?|something)\b/i.test(text);
  if (makeVerb && (musicNoun || genre)) {
    return { intent: "make-music", text: "", genre };
  }
  if (genre && /(please|now|me|want|need|for)\b/i.test(text)) {
    return { intent: "make-music", text: "", genre };
  }

  // play / resume
  if (/\b(play|resume|start|unpause|drop it|hit it|let'?s go)\b/i.test(text)) {
    if (state.track) return { intent: "play", text: pick(persona.voice.play) };
    return { intent: "make-music", text: "", genre };
  }

  // regenerate
  if (state.track && /\b(another|new one|remix|regenerat|again|different|one more|next)\b/i.test(text)) {
    return { intent: "regen", text: "" };
  }

  // identity & help
  if (/(who are you|what are you|your name|introduce yourself)/i.test(text)) {
    return { intent: "none", text: pick(persona.voice.who) };
  }
  if (/(help|what can you do|capabilities|commands|how does this work)/i.test(text)) {
    return { intent: "none", text: pick(persona.voice.help) };
  }
  if (/^(hi|hey|hello|yo|sup|howdy|good (morning|afternoon|evening))\b/i.test(text)) {
    return { intent: "none", text: pick(persona.voice.greet) };
  }
  if (/\b(thanks|thank you|thx|appreciate)\b/i.test(text)) {
    return {
      intent: "none",
      text:
        persona.id === "ember"
          ? "Anytime! That's literally my whole personality."
          : persona.id === "nova"
            ? "Gratitude logged. Probability of future assistance: 100%."
            : persona.id === "atlas"
              ? "Glad it served the mission. That's what I'm here for."
              : "Thank *you* — every listener makes the music real.",
    };
  }

  // fallback — rotate through the persona's lines
  const lines = persona.voice.fallback;
  const idx = fallbackCursor[persona.id] % lines.length;
  fallbackCursor[persona.id]++;
  return { intent: "none", text: lines[idx] };
}

export const musicLine = (persona: Persona, track: Track) =>
  fill(pick(persona.voice.music), {
    title: track.title,
    genre: track.genre,
    bpm: track.bpm,
    key: `${track.rootName} ${track.scaleName}`,
  });

export const tempoLine = (persona: Persona, track: Track, dir: "faster" | "slower") =>
  fill(pick(dir === "faster" ? persona.voice.faster : persona.voice.slower), { bpm: track.bpm });

export const greetLine = (persona: Persona) => pick(persona.voice.greet);
export const switchLine = (persona: Persona) => pick(persona.voice.switchIn);
