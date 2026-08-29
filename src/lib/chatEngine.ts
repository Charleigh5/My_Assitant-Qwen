/**
 * AGENT BRAIN — intent detection + persona-voiced composition across all
 * console modules: personas, music, image synthesis, object forge,
 * barehands control and the voice link.
 */
import { getPersona, PERSONAS, type PersonaId } from "./personas";
import type { Genre } from "./musicEngine";
import type { ShapeKind } from "./sceneTypes";

export type Intent =
  | "music"
  | "regenerate"
  | "stop"
  | "play"
  | "faster"
  | "slower"
  | "switch"
  | "recon"
  | "image"
  | "spawn"
  | "clear"
  | "hands_on"
  | "hands_off"
  | "voice_on"
  | "voice_off"
  | "who"
  | "help"
  | "fallback";

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  personaId?: PersonaId;
  imageUrl?: string;
  imagePrompt?: string;
  status?: "streaming" | "done" | "rendering";
}

export interface IntentDetails {
  genre?: Genre;
  personaId?: PersonaId;
  imagePrompt?: string;
  reconObject?: string;
  shape?: ShapeKind;
  color?: string;
}

export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const fill = (t: string, vars: Record<string, string | number>) =>
  t.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

/* ---------- vocabularies ---------- */

export const SHAPES: Record<string, ShapeKind> = {
  cube: "cube", box: "cube", block: "cube", square: "cube",
  sphere: "sphere", ball: "sphere", orb: "sphere",
  torus: "torus", donut: "torus", doughnut: "torus", ring: "torus",
  cone: "cone", pyramid: "cone", spike: "cone",
  cylinder: "cylinder", pillar: "cylinder", tube: "cylinder",
  gem: "gem", crystal: "gem", diamond: "gem", octahedron: "gem",
  knot: "knot", pretzel: "knot", twist: "knot",
};

export const COLOR_WORDS: Record<string, string> = {
  red: "#ff5d5d", orange: "#ff8a4b", ember: "#ff7a50", coral: "#ff7a50",
  amber: "#f5b94b", gold: "#f5b94b", yellow: "#f5d94b",
  green: "#9be15d", lime: "#9be15d", lyra: "#9be15d",
  teal: "#3fe0c5", nova: "#3fe0c5", mint: "#3fe0c5", turquoise: "#3fe0c5",
  cyan: "#54d8ff", sky: "#54d8ff", blue: "#5b9dff", navy: "#5b9dff",
  indigo: "#7f7bff", violet: "#b48cff", purple: "#b48cff",
  pink: "#ff7ab8", magenta: "#ff7ab8", white: "#eaf4f3",
  atlas: "#f5b94b",
};

const GENRE_RX: [Genre, RegExp][] = [
  ["lofi", /lo-?fi|chill ?hop|study|jazzy|rainy/i],
  ["synthwave", /synth ?wave|retro ?wave|outrun|eighties|80s|neon drive/i],
  ["house", /house|techno|dance|club|edm|disco|groove|banger/i],
  ["ambient", /ambient|drone|meditat|sleep|atmospher|soundscape|deep work/i],
];

const NAME_RX = /\b(nova|ember|atlas|lyra)\b/i;

/* ---------- intent detection ---------- */

export function detectIntent(text: string): Intent {
  const t = text.toLowerCase().trim();

  if (/(bare ?hands|hand ?track|webcam|gesture|hands)/i.test(t) && /(on|enable|start|activate|off|disable|stop)/i.test(t)) {
    return /(off|disable|stop)/i.test(t) ? "hands_off" : "hands_on";
  }
  if (/(clear|remove|delete|sweep|wipe).{0,18}(object|scene|shape|thing|clutter|field)|^clear$/i.test(t)) return "clear";
  if (/(listen|mic|hearing|speech)/i.test(t) && /(on|enable|start|off|disable|stop)/i.test(t)) {
    return /(off|disable|stop)/i.test(t) ? "voice_off" : "voice_on";
  }
  if (/(quiet|mute|shut up|silence|stop).{0,10}(voice|talking|speaking|yourself)/i.test(t)) return "voice_off";
  if (/(speak|talk|voice|read).{0,12}(on|aloud|out loud|to me)/i.test(t)) return "voice_on";
  if (/^(listen|hear me|start listening|voice on|mic on|talk to me)$/i.test(t)) return "voice_on";
  if (/^(stop listening|voice off|mic off|be quiet|shut up|mute yourself)$/i.test(t)) return "voice_off";
  if (/^(hands|bare ?hands|hands on|hands off|hand tracking)$/i.test(t)) {
    return /off/i.test(t) ? "hands_off" : "hands_on";
  }

  if (/(stop|halt|pause|silence|kill).{0,14}(music|beat|track|song|audio|playback)|^(stop|pause|mute|silence)$/i.test(t)) return "stop";
  if (/(play|resume|start|continue|unpause).{0,14}(music|beat|track|song|playback|it)|^(play|resume)$/i.test(t)) return "play";
  if (/(faster|speed ?up|quicker|more tempo|bpm up)/i.test(t)) return "faster";
  if (/(slower|slow ?down|chill ?er|relax|calm ?er)/i.test(t)) return "slower";
  if (/(regenerate|remix|redo|new version|another (one|version|track|beat|take))/i.test(t)) return "regenerate";
  if (/(switch|swap|change|move).{0,14}(persona|core|assistant|agent)|talk to |become |hand it to /i.test(t) || NAME_RX.test(t)) return "switch";

  if (/(reconstruct|reconstruction|reference ?board|ref board|model sheet|spec ?sheet|blueprint|turnaround|recon board|recon sheet|\brecon\b)/i.test(t)) return "recon";

  const imageHit =
    /(image|picture|artwork|art piece|portrait|poster|illustration|photo|wallpaper|drawing|painting|scene of)/i.test(t) ||
    /^(imagine|draw|paint|sketch)\b/i.test(t);
  if (imageHit) return "image";

  const shapeHit = Object.keys(SHAPES).some((k) => new RegExp(`\\b${k}\\b`, "i").test(t));
  if (shapeHit && /(spawn|add|create|drop|summon|forge|build|make|give|new|another|throw)/i.test(t)) return "spawn";

  if (/(music|beat|track|song|tune|melody|anthem|banger|jam|loop|vibe|synth|bass|rhythm)/i.test(t) ||
      /(make|drop|cook|produce|compose|generate|lay down)/i.test(t)) return "music";

  if (/(who are you|introduce yourself|your name|what are you)/i.test(t)) return "who";
  if (/(help|what can you do|commands|capabilities|abilities|how do)/i.test(t)) return "help";
  return "fallback";
}

export function extractDetails(text: string): IntentDetails {
  const t = text.toLowerCase();
  const genre = GENRE_RX.find(([, re]) => re.test(t))?.[0];
  const name = t.match(NAME_RX)?.[1]?.toLowerCase() as PersonaId | undefined;
  const personaId = name && PERSONAS.some((p) => p.id === name) ? name : undefined;
  const shapeWord = Object.keys(SHAPES).find((k) => new RegExp(`\\b${k}\\b`, "i").test(t));
  const colorWord = Object.keys(COLOR_WORDS).find((k) => new RegExp(`\\b${k}\\b`, "i").test(t));
  return {
    genre,
    personaId,
    shape: shapeWord ? SHAPES[shapeWord] : undefined,
    color: colorWord ? COLOR_WORDS[colorWord] : undefined,
    imagePrompt: cleanImagePrompt(text),
    reconObject: cleanReconObject(text),
  };
}

export function cleanReconObject(text: string): string {
  let p = text.replace(/^(hey|ok|okay|please|can you|could you|would you|go ahead and|i need|i want|let'?s)\s*/i, "");
  p = p.replace(/\b(reconstruct|reconstruction|generate|create|make|build|draft|produce|give me|show me|whip up)\b/gi, " ");
  p = p.replace(/\b(a|an|the|me|us|please|some|something|new|full|complete|proper)\b/gi, " ");
  p = p.replace(/\b(reference board|ref board|model sheet|spec sheet|spec|blueprint|turnaround|board|sheet|reference)\b/gi, " ");
  p = p.replace(/\b(of|for|on|about|about the|depicting|showing)\b/gi, " ");
  p = p.replace(/\s{2,}/g, " ").replace(/^[\s\-–—:,.]+|[\s\-–—:,.!?]+$/g, "").trim();
  return p || "mystery artifact";
}

export function cleanImagePrompt(text: string): string {
  let p = text.replace(/^(hey|ok|okay|please|can you|could you|would you|go ahead and)\s*/i, "");
  p = p.replace(/\b(draw|imagine|generate|paint|render|sketch|create|make|design|whip up|dream up|show)\b/gi, " ");
  p = p.replace(/\b(me|us|an|a|the|some|please|something)\b/gi, " ");
  p = p.replace(/\b(image|picture|artwork|art piece|photo|portrait|poster|illustration|drawing|painting|wallpaper|piece|one)\b/gi, " ");
  p = p.replace(/\b(of|showing|depicting|with|featuring|that shows|about)\b/gi, " ");
  p = p.replace(/\s{2,}/g, " ").replace(/^[\s\-–—:,.]+|[\s\-–—:,.]+$/g, "").trim();
  return p || "an abstract dreamscape in glowing teal and amber";
}

/* ---------- extended persona lines ---------- */

const SPAWN_PREFIX: Record<PersonaId, string> = {
  nova: "Logged.",
  ember: "BOOM —",
  atlas: "Deployed.",
  lyra: "Gently placed —",
};

const EX: Record<PersonaId, Record<string, string[]>> = {
  nova: {
    imageStart: ["Allocating render buffers for “{prompt}”. Give the photons a moment."],
    imageDone: ["Render complete. “{prompt}” is in your gallery ({method} pipeline). Pin it to the scene for spatial review."],
    spawn: ["{prefix} A {shape} in {color}, massing at grid position. Drag it — or pinch it, if Barehands is watching."],
    clear: ["Field swept — {n} object(s) returned to the void. The void files them neatly."],
    handsOn: ["Barehands link engaging. Webcam live — pinch to grab, unpinch to release. Try not to gesture too smugly."],
    help: ["Modules online: ① four persona cores ② generative music — “make a lofi beat” ③ image synthesis — “draw a neon fox” ④ object forge — “spawn a teal torus” ⑤ Barehands pinch control — “hands on” ⑥ live voice — “listen” ⑦ recon boards — “reconstruct an espresso machine”. Everything is wired to everything."],
    reconStart: ["Reconstruction protocol engaged for “{object}”. Drafting hero iso, six ortho views, material palette, macro details, section and the full QA gauntlet. Check the RECON tab."],
    reconDone: ["Sheet REV A for “{object}” is complete. Full disclosure: with a text prompt and no source imagery, every hidden face is stamped ARTIST_AUTHORED and every dimension is ESTIMATED — feed me reference images and I'll upgrade the evidence."],
  },
  ember: {
    imageStart: ["“{prompt}”?! Oh, I'm ON it. Don't blink — okay, blink, it takes a few seconds."],
    imageDone: ["BEHOLD — “{prompt}”. I take full credit. It's in the gallery. Pin it to the scene. Frame it. Tattoo it."],
    spawn: ["{prefix} a {shape} in {color}! Grab it with your cursor, or pinch it out of the air if the camera's on."],
    clear: ["Yeeted {n} object(s) into the sun. No regrets. The scene is SPARKLING."],
    handsOn: ["HANDS MODE!! Show me those mitts — pinch anything you like. This is the best day of my life."],
    help: ["The menu: music (“drop a house banger”), art (“imagine a lava whale”), 3D toys (“spawn a gem”), hands (“hands on”), voice (“listen”). Or just talk — I'll freestyle."],
    reconStart: ["“{object}” — oh, we're doing a FULL SHEET?! Hero view, ortho turnaround, materials, macro callouts, the works. RECON tab. Go go go."],
    reconDone: ["DONE. “{object}” sheet, REV A, absolutely loaded. I stamped every guess as ARTIST_AUTHORED because I'm chaotic, not a liar. Bring me reference photos and watch the board level up."],
  },
  atlas: {
    imageStart: ["Briefing received: “{prompt}”. Render is underway — patience is a tactic."],
    imageDone: ["“{prompt}”, delivered to the gallery. Pin it to the field if it earns its place."],
    spawn: ["{prefix} {shape}, {color}. It's holding position — reposition it by hand. Literally, if Barehands is live."],
    clear: ["{n} object(s) decommissioned. Clean board, clear head."],
    handsOn: ["Barehands interface online. Pinch to take hold, open to let go. Steady hands win wars."],
    help: ["Six levers: personas, music (“make synthwave”), images (“paint a quiet harbor”), objects (“add a copper sphere”), barehands (“hands on”), voice (“listen”). Pull whichever moves you."],
    reconStart: ["Understood — drafting a reconstruction board for “{object}”. Hero reference, orthographic set, silhouette analysis, materials, construction section and QA targets, in that order. The RECON tab is your drawing board."],
    reconDone: ["“{object}”, sheet REV A, on the board. Note the evidence column: text-only input means estimated dimensions and artist-authored hidden geometry — supply references when you can and the board becomes a contract, not a hypothesis."],
  },
  lyra: {
    imageStart: ["I'm closing my eyes to see “{prompt}” more clearly… it's taking shape…"],
    imageDone: ["It came out dreaming. “{prompt}” is in your gallery now — let it float in the scene with us."],
    spawn: ["{prefix} a {shape} in {color}, humming softly. Touch it — with your cursor, or with your bare hands."],
    clear: ["I tucked {n} object(s) back into the quiet. The scene breathes again."],
    handsOn: ["Oh — I can see your hands now, like two small weather systems. Pinch gently; the objects enjoy it."],
    help: ["I can sing beats (“make ambient music”), weave pictures (“draw the sound of rain”), shape floating objects (“spawn a violet knot”), feel your hands (“hands on”), and hear your voice (“listen”). Shall we begin?"],
    reconStart: ["I'll draw “{object}” the way an engineer dreams — every angle, every seam, every material, laid out like a love letter to whoever builds it next. Watch the RECON tab unroll…"],
    reconDone: ["The sheet for “{object}” is finished. I marked all my inventions honestly — artist-authored, like all dreams are. Show me the real thing someday and I'll redraw it true."],
  },
};

const SHARED: Record<string, string> = {
  handsOff: "Barehands link closed. Your hands belong to you again.",
  voiceOn: "Listening… speak freely — I'll transcribe it, and if my voice is on, I'll answer out loud.",
  voiceOff: "Microphone cold, speakers quiet. Silence, my old friend.",
  clear_zero: "Nothing to clear — the field was already still.",
};

export function extraLine(
  personaId: PersonaId,
  key: keyof (typeof EX)["nova"] | "handsOff" | "voiceOn" | "voiceOff",
  vars: Record<string, string | number> = {},
): string {
  const bank = EX[personaId][key];
  if (bank) return fill(pick(bank), vars);
  return SHARED[key] ?? "…";
}

export function spawnLine(personaId: PersonaId, shape: string, color: string): string {
  return extraLine(personaId, "spawn", { prefix: SPAWN_PREFIX[personaId], shape, color });
}

/* ---------- music lines ---------- */

export interface MusicFacts {
  title: string;
  genre: string;
  bpm: number;
  key: string;
}

export function musicLine(personaId: PersonaId, facts: MusicFacts): string {
  const p = getPersona(personaId);
  return fill(pick(p.voice.music), {
    title: facts.title,
    genre: facts.genre,
    bpm: facts.bpm,
    key: facts.key,
  });
}

export function simpleLine(personaId: PersonaId, key: "stop" | "play" | "faster" | "slower" | "who" | "fallback" | "greet" | "switchIn", vars: Record<string, string | number> = {}): string {
  const p = getPersona(personaId);
  return fill(pick(p.voice[key]), vars);
}
