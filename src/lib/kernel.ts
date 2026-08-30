/**
 * KERNEL — the assistant's self-modification layer.
 *
 * A typed registry of *live references* into the console's real modules
 * (music engine DNA, chat-brain vocabulary, persona genetics, scene rules),
 * wrapped in a journaled patch engine: every change is validated, recorded,
 * persisted, undoable, and exportable to the Node CLI for source-level use.
 * A heuristic planner turns plain language ("make house faster", "add
 * command 'vibe' to slower") into patch ops.
 */
import { BPM_RANGE, PROGS, SWING, TITLES } from "./musicEngine";
import type { Genre } from "./musicEngine";
import { INTENT_SYNONYMS } from "./chatEngine";
import type { Intent } from "./chatEngine";
import { taste } from "./taste";

const tasteActiveId = () => taste.active().id;
const tasteSet = (id: string) => taste.set(id);
import { PERSONAS } from "./personas";
import type { PersonaId } from "./personas";

export type KernelOpKind = "set" | "push";

export interface KernelOpPlan {
  path: string;
  op: KernelOpKind;
  value: unknown;
}

export interface KernelOpRecord extends KernelOpPlan {
  before: unknown;
  after: unknown;
}

export type PatchSource = "agent" | "user" | "cli";

export interface JournalEntry {
  id: number;
  ts: number;
  source: PatchSource;
  note: string;
  ops: KernelOpRecord[];
}

/* ---------------- schema ---------------- */

type Kind = "range" | "number" | "color" | "text";

interface ParamDef {
  path: string;
  kind: Kind;
  label: string;
  ops: KernelOpKind[];
  get: () => unknown;
  set: (v: unknown) => void;
  truncate?: (len: number) => void;
  validate: (v: unknown, op: KernelOpKind) => string | null;
}

const GENRES: Genre[] = ["lofi", "synthwave", "house", "ambient"];
const PERSONA_IDS: PersonaId[] = ["nova", "ember", "atlas", "lyra"];

const LOCAL: Record<string, unknown> = {
  "scene.maxObjects": 36,
  "avatar.idleSpin": 0.45,
  "avatar.breathe": 0.03,
  "avatar.sparkles": 85,
};

const LOCAL_DEFAULTS: Record<string, unknown> = { ...LOCAL };

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const SCHEMA: ParamDef[] = [];

const rangeParam = (path: string, label: string, get: () => [number, number], set: (v: unknown) => void, lo: number, hi: number) =>
  SCHEMA.push({
    path, kind: "range", label, ops: ["set"], get, set,
    validate: (v) => {
      if (!Array.isArray(v) || v.length !== 2 || !isNum(v[0]) || !isNum(v[1])) return "expected [lo, hi]";
      if (v[0] < lo || v[1] > hi || v[0] >= v[1]) return `need lo<hi within ${lo}..${hi}`;
      return null;
    },
  });

const numberParam = (path: string, label: string, key: string, lo: number, hi: number) =>
  SCHEMA.push({
    path, kind: "number", label, ops: ["set"],
    get: () => LOCAL[key],
    set: (v) => { LOCAL[key] = v; },
    validate: (v) => (isNum(v) && v >= lo && v <= hi ? null : `need number ${lo}..${hi}`),
  });

const arrayPushParam = (path: string, label: string, kind: Kind, getArr: () => unknown[], itemOk: (v: unknown) => string | null) =>
  SCHEMA.push({
    path, kind, label, ops: ["push"],
    get: () => [...getArr()],
    set: (v) => { getArr().push(v); },
    truncate: (len) => { getArr().length = len; },
    validate: (v) => itemOk(v),
  });

for (const g of GENRES) {
  rangeParam(`music.bpm.${g}`, `${g} tempo window`, () => BPM_RANGE[g], (v) => { BPM_RANGE[g] = v as [number, number]; }, 40, 220);
  SCHEMA.push({
    path: `music.swing.${g}`, kind: "number", label: `${g} swing`, ops: ["set"],
    get: () => SWING[g], set: (v) => { SWING[g] = v as number; },
    validate: (v) => (isNum(v) && v >= 0 && v <= 0.35 ? null : "need 0..0.35"),
  });
  arrayPushParam(`music.progs.${g}`, `${g} chord pool`, "text", () => PROGS[g], (v) =>
    Array.isArray(v) && v.length >= 3 && v.length <= 5 && v.every((n) => Number.isInteger(n) && n >= 0 && n <= 6)
      ? null
      : "need 3–5 scale degrees (ints 0..6), e.g. [0,4,5,3]");
  arrayPushParam(`music.titles.${g}`, `${g} title pool`, "text", () => TITLES[g], (v) =>
    typeof v === "string" && v.trim().length >= 3 ? null : "need a short title string");
}

for (const p of PERSONA_IDS) {
  const persona = () => PERSONAS.find((x) => x.id === p)!;
  SCHEMA.push({
    path: `persona.accent.${p}`, kind: "color", label: `${p} accent color`, ops: ["set"],
    get: () => persona().accent,
    set: (v) => { persona().accent = v as string; },
    validate: (v) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? null : "need #rrggbb"),
  });
  arrayPushParam(`persona.trait.${p}`, `${p} trait list`, "text", () => persona().traits, (v) =>
    typeof v === "string" && v.trim().length >= 2 ? null : "need a short trait");
  arrayPushParam(`voice.fallback.${p}`, `${p} small-talk lines`, "text", () => persona().voice.fallback, (v) =>
    typeof v === "string" && v.trim().length >= 8 ? null : "need a full sentence");
  arrayPushParam(`voice.greet.${p}`, `${p} greetings`, "text", () => persona().voice.greet, (v) =>
    typeof v === "string" && v.trim().length >= 8 ? null : "need a full sentence");
}

for (const intent of Object.keys(INTENT_SYNONYMS) as Intent[]) {
  arrayPushParam(`intent.${intent}`, `“${intent}” vocabulary`, "text", () => INTENT_SYNONYMS[intent], (v) =>
    typeof v === "string" && v.trim().length >= 2 ? null : "need a phrase (2+ chars)");
}

SCHEMA.push({
  path: "taste.profile",
  kind: "text",
  label: "active design doctrine",
  ops: ["set"],
  get: () => tasteActiveId(),
  set: (v) => { tasteSet(String(v)); },
  validate: (v) =>
    typeof v === "string" && ["signal", "editorial", "cinema", "brutal", "organic", "terminal"].includes(v)
      ? null
      : "need a profile id: signal|editorial|cinema|brutal|organic|terminal",
});

numberParam("scene.maxObjects", "object field capacity", "scene.maxObjects", 4, 96);
numberParam("avatar.idleSpin", "core idle spin", "avatar.idleSpin", 0.05, 3);
numberParam("avatar.breathe", "core breathing depth", "avatar.breathe", 0, 0.2);
numberParam("avatar.sparkles", "spark particle count", "avatar.sparkles", 0, 300);

const byPath = new Map(SCHEMA.map((d) => [d.path, d]));

/* ---------------- journal + apply ---------------- */

const LS_KEY = "orbit.kernel.journal.v1";
let journal: JournalEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

const store = {
  get(): JournalEntry[] { return journal; },
  persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(journal)); } catch { /* private mode */ }
  },
  notify() { listeners.forEach((l) => l()); },
};

function execOp(plan: KernelOpPlan): KernelOpRecord {
  const def = byPath.get(plan.path);
  if (!def) throw new Error(`unknown path “${plan.path}” — try \`ls\``);
  if (!def.ops.includes(plan.op)) throw new Error(`“${plan.path}” only supports ${def.ops.join("/")}`);
  const err = def.validate(plan.value, plan.op);
  if (err) throw new Error(`${plan.path}: ${err}`);
  const before = def.get();
  def.set(plan.value);
  return { ...plan, before, after: plan.value };
}

function invertOp(rec: KernelOpRecord) {
  const def = byPath.get(rec.path)!;
  if (rec.op === "set") def.set(rec.before);
  else if (def.truncate && Array.isArray(rec.before)) def.truncate((rec.before as unknown[]).length);
}

export const kernel = {
  list(filter = ""): ParamDef[] {
    const f = filter.toLowerCase();
    return SCHEMA.filter((d) => d.path.includes(f) || d.label.toLowerCase().includes(f));
  },
  get(path: string): unknown {
    const def = byPath.get(path);
    if (!def) throw new Error(`unknown path “${path}”`);
    return def.get();
  },
  apply(source: PatchSource, note: string, plans: KernelOpPlan[]): JournalEntry {
    const ops: KernelOpRecord[] = [];
    try {
      for (const p of plans) ops.push(execOp(p));
    } catch (e) {
      ops.slice().reverse().forEach(invertOp); // atomic: roll back partial
      throw e;
    }
    const entry: JournalEntry = { id: nextId++, ts: Date.now(), source, note, ops };
    journal.push(entry);
    store.persist();
    store.notify();
    return entry;
  },
  undoLast(): JournalEntry | null {
    const entry = journal.pop();
    if (!entry) return null;
    entry.ops.slice().reverse().forEach(invertOp);
    store.persist();
    store.notify();
    return entry;
  },
  reset() {
    journal.slice().reverse().forEach((e) => e.ops.slice().reverse().forEach(invertOp));
    for (const [k, v] of Object.entries(LOCAL_DEFAULTS)) LOCAL[k] = v;
    journal = [];
    nextId = 1;
    store.persist();
    store.notify();
  },
  journal: () => journal,
  count: () => journal.length,
  onChange(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  exportJournal(): string {
    return JSON.stringify(
      { app: "orbit-kernel", version: 1, exportedAt: new Date().toISOString(), entries: journal },
      null,
      2,
    );
  },
};

export const kernelNum = (path: string): number => {
  const v = kernel.get(path);
  return typeof v === "number" ? v : Number(v) || 0;
};

/* boot: replay persisted journal */
try {
  const raw = localStorage.getItem(LS_KEY);
  if (raw) {
    const parsed = JSON.parse(raw) as JournalEntry[];
    if (Array.isArray(parsed)) {
      for (const e of parsed) {
        const ops: KernelOpRecord[] = [];
        for (const p of e.ops) {
          try { ops.push(execOp(p)); } catch { /* stale path — skip */ }
        }
        journal.push({ ...e, ops });
        nextId = Math.max(nextId, e.id + 1);
      }
    }
  }
} catch { /* corrupted journal — start clean */ }

/* ---------------- natural-language planner ---------------- */

const ALIASES: Record<string, Intent> = {
  slow: "slower", slower: "slower", fast: "faster", faster: "faster",
  stop: "stop", play: "play", hands: "hands_on", voice: "voice_on",
  image: "image", draw: "image", spawn: "spawn", music: "music",
  kernel: "kernel", rollback: "rollback", switch: "switch", help: "help",
};

export interface PlanResult {
  plans: KernelOpPlan[];
  note: string;
}

export function planFromText(text: string): PlanResult | null {
  const t = text.toLowerCase();

  // tempo shift: "make house faster", "lofi slower"
  const g = GENRES.find((x) => t.includes(x));
  if (g && /(faster|quicker|speed ?up)/.test(t)) {
    const [lo, hi] = BPM_RANGE[g];
    const nl = Math.min(210, Math.round(lo * 1.16));
    const nh = Math.min(220, Math.round(hi * 1.16));
    return { plans: [{ path: `music.bpm.${g}`, op: "set", value: [nl, nh] }], note: `${g} tempo window ${lo}–${hi} → ${nl}–${nh}` };
  }
  if (g && /(slower|chiller|calmer)/.test(t)) {
    const [lo, hi] = BPM_RANGE[g];
    const nl = Math.max(40, Math.round(lo * 0.86));
    const nh = Math.max(nl + 2, Math.round(hi * 0.86));
    return { plans: [{ path: `music.bpm.${g}`, op: "set", value: [nl, nh] }], note: `${g} tempo window ${lo}–${hi} → ${nl}–${nh}` };
  }

  // swing: "more swing on lofi" / "less swing"
  if (/swing/.test(t)) {
    const delta = /(less|reduce|remove|kill)/.test(t) ? -0.04 : 0.04;
    const targets = g ? [g] : GENRES;
    const plans: KernelOpPlan[] = targets.map((x) => ({
      path: `music.swing.${x}`, op: "set" as const,
      value: Math.min(0.35, Math.max(0, Math.round((SWING[x] + delta) * 100) / 100)),
    }));
    return { plans, note: `swing ${delta > 0 ? "+" : ""}${delta} on ${targets.join(", ")}` };
  }

  // vocabulary: add command 'vibe' to slower
  const vocab = t.match(/(?:add|map|register)\s+(?:command\s+|phrase\s+|synonym\s+)?["'“]([^"'”]{2,28})["'”]\s*(?:as|to|for|→|->)\s*([a-z_]+)/);
  if (vocab) {
    const intent = ALIASES[vocab[2]] ?? (Object.keys(INTENT_SYNONYMS).includes(vocab[2]) ? (vocab[2] as Intent) : null);
    if (intent) {
      return {
        plans: [{ path: `intent.${intent}`, op: "push", value: vocab[1].trim().toLowerCase() }],
        note: `“${vocab[1]}” now triggers ${intent}`,
      };
    }
  }

  // persona lines: "give ember a new line: ..."
  const line = t.match(/(?:give|add|teach)\s+(?:a\s+)?(?:new\s+)?(?:fallback\s+)?(?:line|quip|response|phrase)?s?\s*(?:to\s+)?(nova|ember|atlas|lyra)[^:]*:\s*(.{8,})/);
  if (line) {
    const pid = line[1] as PersonaId;
    return {
      plans: [{ path: `voice.fallback.${pid}`, op: "push", value: line[2].trim().replace(/^["']|["']$/g, "") }],
      note: `${pid} learned a new small-talk line`,
    };
  }

  // recolor: "recolor ember to #FF3B3B" / "paint nova red"
  const color = t.match(/(?:recolor|repaint|paint|change\s+(?:the\s+)?color\s+of)\s+(nova|ember|atlas|lyra)(?:\s+to)?\s+(#[0-9a-fA-F]{6}|[a-z]+)/);
  if (color) {
    const WORDS: Record<string, string> = {
      red: "#ff5d5d", orange: "#ff8a4b", amber: "#f5b94b", gold: "#f5b94b", yellow: "#f5d94b",
      green: "#9be15d", lime: "#9be15d", teal: "#3fe0c5", mint: "#3fe0c5", cyan: "#54d8ff",
      sky: "#54d8ff", blue: "#5b9dff", indigo: "#7f7bff", violet: "#b48cff", purple: "#b48cff",
      pink: "#ff7ab8", magenta: "#ff7ab8", white: "#eaf4f3", crimson: "#e63946",
    };
    const hex = color[2].startsWith("#") ? color[2].toUpperCase() : WORDS[color[2]];
    if (hex) {
      return { plans: [{ path: `persona.accent.${color[1]}`, op: "set", value: hex }], note: `${color[1]} accent → ${hex}` };
    }
  }

  // field capacity
  const cap = t.match(/allow\s+(\d+)\s+objects|capacity\s+(\d+)/);
  if (cap || /(more|bigger|expand).{0,10}(objects|field|capacity)/.test(t)) {
    const cur = LOCAL["scene.maxObjects"] as number;
    const v = cap ? Number(cap[1] ?? cap[2]) : cur + 12;
    return { plans: [{ path: "scene.maxObjects", op: "set", value: Math.min(96, Math.max(4, v)) }], note: `object capacity → ${Math.min(96, Math.max(4, v))}` };
  }

  // avatar physics
  if (/(spin|rotate|rotation).{0,10}(faster|slower)/.test(t)) {
    const cur = LOCAL["avatar.idleSpin"] as number;
    const v = /faster/.test(t) ? Math.min(3, cur * 1.6) : Math.max(0.05, cur * 0.6);
    return { plans: [{ path: "avatar.idleSpin", op: "set", value: Math.round(v * 100) / 100 }], note: `idle spin → ${Math.round(v * 100) / 100}` };
  }
  if (/(more|less).{0,8}sparkles?/.test(t)) {
    const cur = LOCAL["avatar.sparkles"] as number;
    const v = /more/.test(t) ? Math.min(300, cur + 40) : Math.max(0, cur - 40);
    return { plans: [{ path: "avatar.sparkles", op: "set", value: v }], note: `sparkles → ${v}` };
  }
  if (/(breathe|breathing).{0,10}(deeper|more|less|calmer)/.test(t)) {
    const cur = LOCAL["avatar.breathe"] as number;
    const v = /(deeper|more)/.test(t) ? Math.min(0.2, cur + 0.02) : Math.max(0, cur - 0.015);
    return { plans: [{ path: "avatar.breathe", op: "set", value: Math.round(v * 1000) / 1000 }], note: `breathing → ${Math.round(v * 1000) / 1000}` };
  }

  return null;
}

export const fmtVal = (v: unknown): string =>
  typeof v === "string" ? (v.length > 42 ? `${v.slice(0, 42)}…` : v) : JSON.stringify(v);
