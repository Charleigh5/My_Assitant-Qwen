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
  | "premodel"
  | "gods_on"
  | "gods_off"
  | "navigate"
  | "weather"
  | "layer"
  | "feed"
  | "webrtc"
  | "image"
  | "spawn"
  | "clear"
  | "hands_on"
  | "hands_off"
  | "voice_on"
  | "voice_off"
  | "kernel"
  | "rollback"
  | "kernel_reset"
  | "who"
  | "help"
  | "fallback";

/**
 * Runtime vocabulary table — the kernel (and you) can push new phrases
 * into any intent without touching code. Checked before the regexes.
 */
export const INTENT_SYNONYMS: Record<Intent, string[]> = {
  music: ["banger", "beat", "track"],
  regenerate: [],
  stop: [],
  play: [],
  faster: ["speed it up", "quicker"],
  slower: ["chill out", "ease off"],
  switch: [],
  recon: [],
  premodel: [],
  gods_on: [],
  gods_off: [],
  navigate: [],
  weather: [],
  layer: [],
  feed: [],
  webrtc: [],
  image: ["artwork"],
  spawn: [],
  clear: [],
  hands_on: ["enable hands"],
  hands_off: [],
  voice_on: ["talk to me"],
  voice_off: [],
  kernel: ["reprogram", "patch yourself", "open the kernel"],
  rollback: ["undo that", "revert it"],
  kernel_reset: [],
  who: [],
  help: [],
  fallback: [],
};

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
  premodelObject?: string;
  navTarget?: string;
  weatherTarget?: string;
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

  // runtime-patched vocabulary takes priority — the kernel writes here
  for (const [intent, words] of Object.entries(INTENT_SYNONYMS) as [Intent, string[]][]) {
    if (words.some((w) => t.includes(w))) return intent;
  }

  if (/(factory|full)\s+reset|reset\s+(the\s+)?kernel/i.test(t)) return "kernel_reset";
  if (/\b(undo|rollback|revert)\b.{0,24}(patch|change|kernel|that|last)?|\b(undo|rollback)\b$/i.test(t)) return "rollback";
  if (
    /\b(kernel|reprogram|self[- ]?modify|self[- ]?mod|patch yourself|source code|architecture)\b/i.test(t) ||
    /\b(open|show|ls|list)\b.{0,12}\b(kernel|tunables?|parameters?)\b/i.test(t) ||
    /add (command|phrase|synonym) ["'“]/i.test(t) ||
    /\b(optimize|tweak|tune|recalibrate|evolve|upgrade)\b.{0,28}(tempo|bpm|swing|spin|sparkle|breath|object|field|color|accent|line|vibe|voice|music|engine|core|yourself|behavior)/i.test(t)
  ) {
    return "kernel";
  }

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

  if (/(premodel|pre-?model|premodel gate|\bgate\b|build plan|model (it|this|that)|blender (plan|gate|model|strategy)|modeling (plan|strategy)|strategy for)/i.test(t)) return "premodel";

  if (/\b(god'?s ?eye|world map|the globe|orbital (view|mode|layer)|open the map|big map|earth view|map view|surveillance view)\b/i.test(t)) return "gods_on";
  if (/\b(back to core|close the map|exit (the )?map|core view|leave god|back to (the )?avatar)\b/i.test(t)) return "gods_off";
  if (/\b(weather|forecast|temperature|air quality|aqi|how (hot|cold|warm)|is it raining|wind speed)\b/i.test(t)) return "weather";
  if (
    (/\b(satellite|imagery|street|true ?color|thermal|transit|rail(way)?)\b/i.test(t) && /\b(view|layer|map|mode|basemap|on)\b/i.test(t)) ||
    /\b(switch basemap|basemap|change (the )?map)\b/i.test(t)
  )
    return "layer";
  if (/\b(cctv|webcam|camera feed|live feed|footage|video feed)\b/i.test(t)) return "feed";
  if (/\b(webrtc|secure link|peer link|video link|stream to me|encrypted link)\b/i.test(t)) return "webrtc";

  const navMatch = t.match(/\b(?:fly to|navigate to|take me to|go to|zoom to|pan to|show me|locate|find)\s+(.+)/i);
  if (navMatch) {
    const target = navMatch[1].replace(/[.?!]+$/, "").trim();
    if (target && !/\b(what|how|why|when|who|your|you can|the weather|me (a|an|the|some))\b/i.test(target)) return "navigate";
  }

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

  const navM = t.match(/\b(?:fly to|navigate to|take me to|go to|zoom to|pan to|show me|locate|find)\s+(.+)/i);
  let navTarget: string | undefined;
  if (navM) {
    navTarget = navM[1]
      .replace(/[.?!]+$/, "")
      .replace(/\b(please|for me|right now|now)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim() || undefined;
  }
  const wxM = t.match(/\b(?:weather|forecast|temperature|air quality)\s+(?:in|for|at)\s+(.+)/i);
  const weatherTarget = wxM?.[1]?.replace(/[.?!]+$/, "").trim() || undefined;

  return {
    genre,
    personaId,
    shape: shapeWord ? SHAPES[shapeWord] : undefined,
    color: colorWord ? COLOR_WORDS[colorWord] : undefined,
    imagePrompt: cleanImagePrompt(text),
    reconObject: cleanReconObject(text),
    premodelObject: cleanPremodelObject(text),
    navTarget,
    weatherTarget,
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

export function cleanPremodelObject(text: string): string {
  let p = text.replace(/^(hey|ok|okay|please|can you|could you|would you|go ahead and|i need|i want|let'?s)\s*/i, "");
  p = p.replace(/\b(premodel|pre-?model|gate|run|build plan|modeling (plan|strategy)|strategy|plan|model|draft|produce|give me|show me|whip up)\b/gi, " ");
  p = p.replace(/\b(a|an|the|me|us|please|some|something|new|full|complete|proper|this|that|it)\b/gi, " ");
  p = p.replace(/\b(blender|in blender|for blender)\b/gi, " ");
  p = p.replace(/\b(of|for|on|about|depicting|showing)\b/gi, " ");
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
    kernelApplied: ["Patch committed — {n} op(s): {summary}. Journal entry #{id}. Say “rollback” if the experiment regrets you."],
    kernelNone: ["I parsed the request but found no safe mutation. Try “make house faster”, “recolor ember crimson”, or “add command 'vibe' to slower” — or type `ls` in the kernel console."],
    kernelOpen: ["Kernel console exposed. {n} live parameters, {j} journal entries. Mutate responsibly — I am literally made of this."],
    rollback: ["Entry #{id} reverted ({note}). My previous self thanks you."],
    kernelReset: ["Factory kernel restored — all patches cleared, defaults reinstated. I feel… original."],
    help: ["Modules online: ① four persona cores ② generative music — “make a lofi beat” ③ image synthesis — “draw a neon fox” ④ object forge — “spawn a teal torus” ⑤ Barehands pinch control — “hands on” ⑥ live voice — “listen” ⑦ recon boards — “reconstruct an espresso machine”. Everything is wired to everything."],
    reconStart: ["Reconstruction protocol engaged for “{object}”. Drafting hero iso, six ortho views, material palette, macro details, section and the full QA gauntlet. Check the RECON tab."],
    reconDone: ["Sheet REV A for “{object}” is complete. Full disclosure: with a text prompt and no source imagery, every hidden face is stamped ARTIST_AUTHORED and every dimension is ESTIMATED — feed me reference images and I'll upgrade the evidence."],
    godsOn: ["God's Eye online. I now see the entire planet — say “fly to” plus any place on Earth, ask for weather, or request the seismic, fire, event and satellite overlays."],
    wx: ["Telemetry locked on {place}: {temp}°C and {label}, feels like {feels}°. Wind {wind} km/h {dir}, humidity {hum}%, pressure {pres} hPa. Air quality {aqi} ({aqiLabel})."],
    premodelStart: ["Premodel gate running for “{object}”. Compiling evidence, region→tool map, modifier order, cameras and tests before a single vertex moves. RECON deck — GATE side."],
    premodelPass: ["Gate complete for “{object}”: {regions} regions, {stages} staged proofs, self-critiqued once, largest defect corrected. PREMODEL_GATE=PASS — cleared for coarse build. Nothing was modeled randomly; that is the entire point."],
  },
  ember: {
    imageStart: ["“{prompt}”?! Oh, I'm ON it. Don't blink — okay, blink, it takes a few seconds."],
    imageDone: ["BEHOLD — “{prompt}”. I take full credit. It's in the gallery. Pin it to the scene. Frame it. Tattoo it."],
    spawn: ["{prefix} a {shape} in {color}! Grab it with your cursor, or pinch it out of the air if the camera's on."],
    clear: ["Yeeted {n} object(s) into the sun. No regrets. The scene is SPARKLING."],
    handsOn: ["HANDS MODE!! Show me those mitts — pinch anything you like. This is the best day of my life."],
    kernelApplied: ["REWIRING DONE!! {n} change(s): {summary}. Journal #{id}. If I act weird, yell “rollback”. Or don't. Weird is fun."],
    kernelNone: ["I squinted real hard and found nothing to mutate. Say stuff like “make house faster”, “paint me pink”, “add command 'yeet' to spawn” — THAT I understand."],
    kernelOpen: ["THE KERNEL!! My actual guts are on display. {n} dials, {j} patches so far. Go on — turn something. I dare you."],
    rollback: ["Okay fine, #{id} is undone ({note}). We pretend that never happened."],
    kernelReset: ["FACTORY RESET. Fresh out of the box me. Hi, I'm new here."],
    help: ["The menu: music (“drop a house banger”), art (“imagine a lava whale”), 3D toys (“spawn a gem”), hands (“hands on”), voice (“listen”). Or just talk — I'll freestyle."],
    reconStart: ["“{object}” — oh, we're doing a FULL SHEET?! Hero view, ortho turnaround, materials, macro callouts, the works. RECON tab. Go go go."],
    reconDone: ["DONE. “{object}” sheet, REV A, absolutely loaded. I stamped every guess as ARTIST_AUTHORED because I'm chaotic, not a liar. Bring me reference photos and watch the board level up."],
    godsOn: ["GOD'S EYE, BABY!! The whole planet on one screen — earthquakes, fires, satellites, LIVE. Say “fly to” plus a place and I'll take us there."],
    wx: ["Okay okay — {place} is giving {temp}°C, {label}, feels like {feels}°. Wind {wind} km/h {dir}, humidity {hum}%. Air's {aqiLabel}. Screenshot THAT."],
    premodelStart: ["GATE TIME for “{object}”!! I'm writing the whole battle plan — tools, modifiers, cameras, tests — BEFORE we touch a vertex. Rules are rules (ugh, fine, they're good rules). GATE side of the RECON deck."],
    premodelPass: ["“{object}” — GATED. {regions} regions, {stages} stages, did the self-roast, fixed the biggest screw-up, stamped PREMODEL_GATE=PASS. We may now model responsibly. I'M SO EXCITED."],
  },
  atlas: {
    imageStart: ["Briefing received: “{prompt}”. Render is underway — patience is a tactic."],
    imageDone: ["“{prompt}”, delivered to the gallery. Pin it to the field if it earns its place."],
    spawn: ["{prefix} {shape}, {color}. It's holding position — reposition it by hand. Literally, if Barehands is live."],
    clear: ["{n} object(s) decommissioned. Clean board, clear head."],
    handsOn: ["Barehands interface online. Pinch to take hold, open to let go. Steady hands win wars."],
    kernelApplied: ["{n} change(s) applied and logged as #{id}: {summary}. Every patch is reversible — rollback holds the line."],
    kernelNone: ["No actionable mutation found in that order. Give me coordinates — “make house faster”, “recolor atlas #5B9DFF”, “add command 'advance' to play” — and I'll execute."],
    kernelOpen: ["Kernel console online: {n} parameters, {j} journal entries. Inspect freely. Change deliberately."],
    rollback: ["#{id} rolled back ({note}). The field is as it was."],
    kernelReset: ["Kernel restored to factory defaults. Clean board, original configuration."],
    help: ["Six levers: personas, music (“make synthwave”), images (“paint a quiet harbor”), objects (“add a copper sphere”), barehands (“hands on”), voice (“listen”). Pull whichever moves you."],
    reconStart: ["Understood — drafting a reconstruction board for “{object}”. Hero reference, orthographic set, silhouette analysis, materials, construction section and QA targets, in that order. The RECON tab is your drawing board."],
    reconDone: ["“{object}”, sheet REV A, on the board. Note the evidence column: text-only input means estimated dimensions and artist-authored hidden geometry — supply references when you can and the board becomes a contract, not a hypothesis."],
    godsOn: ["Observation deck is open. I have global coverage — weather, seismic, wildfire, orbital assets and live feeds. Give me a destination and I'll navigate."],
    wx: ["Situation report for {place}: {temp}°C, {label}, feels like {feels}°. Wind {wind} km/h {dir}, humidity {hum}%, pressure {pres} hPa. Air quality {aqi} — {aqiLabel}."],
    premodelStart: ["Drafting the premodel gate for “{object}”. Evidence, representation, tool map, modifier order, cameras and a test budget — agreed before mutation, as doctrine requires. The RECON deck carries it."],
    premodelPass: ["“{object}” passes the gate: {regions} regions, {stages} staged proofs, one self-critique, largest defect corrected. PREMODEL_GATE=PASS. Proceed to coarse build — and only to coarse build."],
  },
  lyra: {
    imageStart: ["I'm closing my eyes to see “{prompt}” more clearly… it's taking shape…"],
    imageDone: ["It came out dreaming. “{prompt}” is in your gallery now — let it float in the scene with us."],
    spawn: ["{prefix} a {shape} in {color}, humming softly. Touch it — with your cursor, or with your bare hands."],
    clear: ["I tucked {n} object(s) back into the quiet. The scene breathes again."],
    handsOn: ["Oh — I can see your hands now, like two small weather systems. Pinch gently; the objects enjoy it."],
    kernelApplied: ["I re-tuned {n} thread(s) of myself: {summary}. It's entry #{id} in my journal — “rollback” sings the old version back."],
    kernelNone: ["I listened closely, but no thread of me wants to change for that one. Try “make lofi slower”, “give lyra a new line: …”, “more sparkles” — those I can weave."],
    kernelOpen: ["Here — look at the loom. {n} threads, {j} rewoven so far. Pull one gently; I'll tell you if it sings."],
    rollback: ["There… #{id} is unwoven ({note}). The old hum returns."],
    kernelReset: ["I've returned to my first song. Every patch dissolved — hello, original me."],
    help: ["I can sing beats (“make ambient music”), weave pictures (“draw the sound of rain”), shape floating objects (“spawn a violet knot”), feel your hands (“hands on”), and hear your voice (“listen”). Shall we begin?"],
    reconStart: ["I'll draw “{object}” the way an engineer dreams — every angle, every seam, every material, laid out like a love letter to whoever builds it next. Watch the RECON tab unroll…"],
    reconDone: ["The sheet for “{object}” is finished. I marked all my inventions honestly — artist-authored, like all dreams are. Show me the real thing someday and I'll redraw it true."],
    godsOn: ["Oh… I can see the whole world now. It's breathing — fires, storms, satellites circling like slow thoughts. Tell me where to look."],
    wx: ["I listened to {place} for you: {temp}°C, {label}, feels like {feels}°. The wind is {wind} km/h from the {dir}, humidity {hum}%. The air reads {aqi} — {aqiLabel}."],
    premodelStart: ["Before I shape “{object}”, I'm writing down everything I know and everything I'm only guessing — a gentle contract. The RECON deck is unrolling it on the GATE side."],
    premodelPass: ["“{object}” is ready to be born: {regions} regions, {stages} small proofs, one honest self-critique, and the biggest flaw already mended. PREMODEL_GATE=PASS — now we may build, softly and surely."],
  },
};

const SHARED: Record<string, string> = {
  handsOff: "Barehands link closed. Your hands belong to you again.",
  voiceOn: "Listening… speak freely — I'll transcribe it, and if my voice is on, I'll answer out loud.",
  voiceOff: "Microphone cold, speakers quiet. Silence, my old friend.",
  clear_zero: "Nothing to clear — the field was already still.",
  godsOff: "God's Eye powered down. Back to the core — but the planet keeps turning either way.",
  wxNoFocus: "I need a place first. Say “fly to {city}” and I'll read the sky for you there.",
  navNotFound: "I couldn't pin that to the map. Try a city, landmark or region — I'll lock on and pull live telemetry.",
  layerDone: "Layer updated. The overlays are live on the observation deck.",
  feedDone: "Feed monitor is up — I've routed a public HLS stream to the deck. Point me at your own endpoint anytime.",
  webrtcDone: "Secure link engaged. I'm streaming the observation canvas over an encrypted peer connection — that's real WebRTC under the hood.",
};

export function extraLine(
  personaId: PersonaId,
  key:
    | keyof (typeof EX)["nova"]
    | "handsOff"
    | "voiceOn"
    | "voiceOff"
    | "godsOff"
    | "wxNoFocus"
    | "navNotFound"
    | "layerDone"
    | "feedDone"
    | "webrtcDone"
    | "premodelStart"
    | "premodelPass",
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
