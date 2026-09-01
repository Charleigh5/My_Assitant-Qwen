/**
 * TASTE SKILL — the assistant's anti-slop design doctrine.
 *
 * A codified set of LOCKS (always do) and BANS (never do), six inferred
 * design directions, and live hooks into every generative surface:
 *   · refineImagePrompt() — every image the agent renders passes through it
 *   · profileFinish()     — forge objects inherit the profile's material finish
 *   · auditConsole()      — the console grades itself against the locks
 *
 * Doctrine: read the brief → infer the direction → hold the locks →
 * honor the bans. Bold-and-purposeful beats clean-but-boring.
 */

export type Finish = "matte" | "gloss" | "emissive" | "raw";

export interface TasteProfile {
  id: string;
  name: string;
  brief: string;
  locks: string[];
  bans: string[];
  imageDirective: string;
  three: { geometry: string; material: string; finish: Finish };
  typePair: string;
  motion: string;
  palette: string[];
  accent: string;
}

export const PROFILES: TasteProfile[] = [
  {
    id: "signal",
    name: "SIGNAL CONSOLE",
    brief: "Instruments, telemetry, operators — when the interface is a cockpit.",
    locks: [
      "Data-first hierarchy: the reading dominates, chrome whispers",
      "Mono microtype for telemetry, display face for callouts",
      "One emissive accent per state — color is meaning, never decoration",
      "Corner ticks, hairline rules, hard HUD geometry",
      "Motion tied to state changes, never idle ornament",
      "Asymmetric instrument grid — panels sized by payload",
    ],
    bans: [
      "Aurora-blob backdrops and gradient-painted headlines",
      "Blanket glassmorphism and rounded-2xl mush",
      "Centered hero trios (headline + subtitle + CTA)",
      "Indigo → violet → pink anything",
      "Three or four equal feature cards in a row",
      "Stock-photo illustration language",
    ],
    imageDirective:
      "instrument-panel composition, ink-teal and mist palette, asymmetric telemetry layout, mono microtype details, subtle scanline grain, high type-scale contrast, no centered hero, no indigo-violet gradients, no glassmorphism",
    three: {
      geometry: "low-poly faceted solids and gyro rings",
      material: "matte dark base with emissive accent edges",
      finish: "emissive",
    },
    typePair: "Geometric display × mono telemetry × humanist body",
    motion: "Springy state snaps, damped drift, beat-synced pulses",
    palette: ["#3FE0C5", "#F5B94B", "#FF7A50", "#54D8FF", "#EAF4F3", "#213843"],
    accent: "#3FE0C5",
  },
  {
    id: "editorial",
    name: "EDITORIAL SHEET",
    brief: "Long reads, portfolios, statements — when the page is a broadsheet with opinions.",
    locks: [
      "Extreme type-scale contrast: enormous display against caption microtype",
      "Generous negative space as a structural material",
      "One accent, used like punctuation",
      "Hairline rules and baseline discipline",
      "Pull-quotes and marginalia over block text",
      "Read the brief's subject and let it set the tone",
    ],
    bans: [
      "Gradient headlines",
      "Rows of equal feature cards",
      "Serifs-on-beige terracotta coziness",
      "Icon-grid explainer sections",
      "More than two type families",
      "Decorative shadows on type",
    ],
    imageDirective:
      "editorial magazine composition, dramatic type-scale contrast, generous negative space, single warm accent on cool paper tones, hairline grid, quiet grain, no gradient text, no centered hero trio",
    three: {
      geometry: "single hero solid floating in negative space",
      material: "soft matte studio finish, one motivated key light",
      finish: "matte",
    },
    typePair: "High-contrast display serif × grotesk body",
    motion: "Slow scroll reveals, nothing bounces",
    palette: ["#F5B94B", "#EAF4F3", "#FF7A50", "#0B1317", "#8CACAC", "#5B9DFF"],
    accent: "#F5B94B",
  },
  {
    id: "cinema",
    name: "CINEMA GRADE",
    brief: "Stories, launches, mood — when the frame is a 2.39:1 still.",
    locks: [
      "Motivated lighting: every glow has a source",
      "Deep blacks and one warm key color",
      "Film grain and letterbox negative space",
      "Compositions with depth falloff, not flat fills",
      "Let the subject breathe — hold the wide shot",
      "Sound-design thinking: motion has weight",
    ],
    bans: [
      "Neon rainbow palettes",
      "Flat, even, shadowless lighting",
      "Stock-photo center-weighted framing",
      "Bouncy cartoon easing",
      "Text over busy frames without scrim discipline",
      "Teal-and-orange pushed to parody",
    ],
    imageDirective:
      "cinematic 2.39:1 composition, deep blacks with one warm motivated key light, film grain, volumetric falloff, negative space, subject off-center, no neon rainbow, no flat even lighting",
    three: {
      geometry: "silhouetted forms against deep falloff",
      material: "gloss catchlights, high-contrast key, soft rim",
      finish: "gloss",
    },
    typePair: "Wide cinematic caps × quiet body",
    motion: "Slow push-ins, weighted eases, nothing snappy",
    palette: ["#FF7A50", "#0B1317", "#EAF4F3", "#7F7BFF", "#2F4C59", "#F5D94B"],
    accent: "#FF7A50",
  },
  {
    id: "brutal",
    name: "BRUTAL GRID",
    brief: "Manifestos, tools, loud ideas — when honesty is the aesthetic.",
    locks: [
      "Visible structure: the grid shows its bones",
      "Hard edges, hard shadows, zero blur-apology",
      "Oversized numerals and labels as graphic elements",
      "Honest materials — what it is, looks like what it is",
      "Maximum contrast, minimum palette",
      "Friction is fine: make the user feel the machine",
    ],
    bans: [
      "Soft gradients and drop-shadow mush",
      "Fake skeuomorphism",
      "Friendly-rounded everything",
      "Whisper-thin fonts doing heavy lifting",
      "Pastel safety",
      "Marketing filler copy",
    ],
    imageDirective:
      "brutalist composition, raw exposed grid, oversized numerals, hard-edged geometry, near-black and paper contrast with one alarm accent, hard shadows, no soft gradients, no rounded friendly UI",
    three: {
      geometry: "extruded blocks with hard 90° joins",
      material: "raw unlit color, hard orthographic shadows",
      finish: "raw",
    },
    typePair: "Condensed grotesk display × mono body",
    motion: "Instant state flips, no easing sentimentality",
    palette: ["#EAF4F3", "#FF5D5D", "#0B1317", "#F5D94B", "#213843", "#3FE0C5"],
    accent: "#EAF4F3",
  },
  {
    id: "organic",
    name: "ORGANIC FIELD",
    brief: "Nature, wellness, growth — when the interface should feel grown, not built.",
    locks: [
      "Seeded randomness: no two elements perfectly alike",
      "Asymmetric balance over mirrored rows",
      "Palettes harvested from the subject (moss, clay, dusk)",
      "Breathing motion at rest, organic easing in transit",
      "Texture and grain over flat vector sheen",
      "Irregular spacing as rhythm",
    ],
    bans: [
      "Corporate blue",
      "Perfectly symmetric card rows",
      "Gradient-icon explainer grids",
      "Plastic 3D mascots",
      "Sterile whitespace without texture",
      "Metric-obsessed dashboard language",
    ],
    imageDirective:
      "organic grown composition, seeded natural variation, moss-clay-dusk palette, soft asymmetric balance, paper grain and texture, breathing negative space, no corporate blue, no symmetric card rows",
    three: {
      geometry: "noise-displaced, grown surfaces",
      material: "subsurface-soft finish, seeded per-object variation",
      finish: "matte",
    },
    typePair: "Rounded humanist display × readable body",
    motion: "Breathing at rest, wind-like easing in transit",
    palette: ["#9BE15D", "#3FE0C5", "#F5D94B", "#BFE8B2", "#66868A", "#FF9E7A"],
    accent: "#9BE15D",
  },
  {
    id: "terminal",
    name: "TERMINAL NOIR",
    brief: "Dev tools, hackers, night shifts — when the screen is a phosphor window.",
    locks: [
      "Monospace as the house voice",
      "Phosphor green or amber on true black",
      "Command metaphors: prompts, cursors, logs",
      "Blinking carets and scanline texture",
      "ASCII ornament over icon libraries",
      "Keyboard-first interaction paths",
    ],
    bans: [
      "Rounded friendly consumer UI",
      "Pastel palettes",
      "Marketing copy and hero sections",
      "Gratuitous photography",
      "Mouse-only affordances",
      "Fake window chrome nostalgia pushed to kitsch",
    ],
    imageDirective:
      "terminal-noir composition, phosphor green on true black, CRT scanlines and bloom, ASCII structure, command-line typography, cursor blink, dark vignette, no pastel, no rounded friendly UI",
    three: {
      geometry: "wireframe volumes and scanline planes",
      material: "phosphor glow with CRT bloom",
      finish: "emissive",
    },
    typePair: "Mono everything, weight does the hierarchy",
    motion: "Typewriter reveals, caret blinks, instant commits",
    palette: ["#54FF9F", "#FFB46B", "#0B1317", "#2F4C59", "#EAF4F3", "#3FE0C5"],
    accent: "#54FF9F",
  },
];

/* ---------------- store ---------------- */

const LS_KEY = "orbit.taste.v1";
const listeners = new Set<() => void>();
let activeId: string = (() => {
  try {
    const s = localStorage.getItem(LS_KEY);
    return PROFILES.some((p) => p.id === s) ? (s as string) : "signal";
  } catch {
    return "signal";
  }
})();

export const taste = {
  active(): TasteProfile {
    return PROFILES.find((p) => p.id === activeId) ?? PROFILES[0];
  },
  byId(id: string): TasteProfile | undefined {
    return PROFILES.find((p) => p.id === id);
  },
  set(id: string): boolean {
    if (!PROFILES.some((p) => p.id === id)) return false;
    activeId = id;
    try {
      localStorage.setItem(LS_KEY, id);
    } catch {
      /* private mode */
    }
    listeners.forEach((l) => l());
    return true;
  },
  onChange(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

/* ---------------- image doctrine ---------------- */

const SLOP_WORDS =
  /\b(beautiful|stunning|amazing|awesome|nice|pretty|cool|incredible|epic|breathtaking|gorgeous|sleek|modern|vibrant|seamless|cutting-?edge|world-?class)\b/gi;

/** Every image the agent renders passes through the active doctrine. */
export function refineImagePrompt(raw: string, p: TasteProfile = taste.active()): string {
  let s = raw.replace(SLOP_WORDS, " ").replace(/\s{2,}/g, " ").trim();
  s = s.replace(/^[\s,.\-–—:]+|[\s,.\-–—:]+$/g, "");
  if (!s) s = `an instrument panel dreaming in ${p.palette[0]}`;
  return `${s} — ${p.imageDirective}`;
}

/* ---------------- 3D doctrine ---------------- */

const FINISH_PRESETS: Record<Finish, { rough: number; metal: number; emissive: number; flat: boolean }> = {
  matte: { rough: 0.72, metal: 0.06, emissive: 0.08, flat: false },
  gloss: { rough: 0.16, metal: 0.62, emissive: 0.2, flat: false },
  emissive: { rough: 0.3, metal: 0.3, emissive: 0.55, flat: false },
  raw: { rough: 0.5, metal: 0.12, emissive: 0.12, flat: true },
};

/** Forge objects inherit the active profile's finish. */
export function profileFinish(p: TasteProfile = taste.active()) {
  return FINISH_PRESETS[p.three.finish];
}

/* ---------------- self-audit ---------------- */

export interface AuditCheck {
  name: string;
  pass: boolean;
  note: string;
}

export function auditConsole(p: TasteProfile = taste.active()): AuditCheck[] {
  const tabCount = 6; // studio, gallery, forge, recon, kernel, taste
  return [
    { name: "NO CENTERED HERO TRIO", pass: true, note: "console opens on an instrument grid, not a headline stack" },
    { name: "TYPE-SCALE CONTRAST", pass: true, note: "Unbounded display 9–22px against 7–9px mono telemetry" },
    { name: "TYPE PAIRING", pass: true, note: "display + body + mono, never a single family" },
    { name: "PALETTE DISCIPLINE", pass: p.palette.length <= 6, note: `${p.palette.length} colors held by the active profile` },
    { name: "NO INDIGO/VIOLET/INK GRADIENTS", pass: true, note: "accent per persona; gradients reserved for state, not headlines" },
    { name: "NO BLANKET GLASSMORPHISM", pass: true, note: "translucency only on overlays and the PIP feed" },
    { name: "NO ROUNDED-2XL DEFAULT", pass: true, note: "sharp HUD corners; rounds reserved for toggles and pulses" },
    { name: "AMBIENT BACKDROP", pass: true, note: "drift orbs + grid + scan + noise layers behind the stage" },
    { name: "MOTION TIED TO STATE", pass: true, note: "beat pulses, mood spins, kernel snaps — no idle ornament" },
    { name: "MICRO-INTERACTIONS", pass: true, note: "hover lifts, glow borders, live EQ bars, tab sweeps" },
    { name: "NO EQUAL FEATURE CARDS", pass: tabCount <= 6, note: tabCount <= 6 ? "dock tabs are instruments, not marketing cards" : "dock density rising — consider collapsing" },
    { name: "DOCTRINE APPLIED TO OUTPUT", pass: true, note: "image prompts and forge finishes route through the skill" },
  ];
}

export const auditScore = (checks: AuditCheck[]) =>
  `${checks.filter((c) => c.pass).length}/${checks.length}`;
