#!/usr/bin/env node
/**
 * ORBIT CLI — source-level self-modification for the ORBIT console.
 *
 * The in-app kernel mutates live runtime behavior; this CLI applies the
 * equivalent mutations to the ACTUAL SOURCE FILES, Codex/Claude-Code style:
 * plan → apply → verify → undo. Every edit is journaled in cli/journal.json
 * and reversible with `undo`. Git remains your ultimate safety net.
 *
 * Usage:  node cli/orbit-cli.mjs <command> [args]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JOURNAL = path.join(ROOT, "cli", "journal.json");

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const write = (rel, src) => fs.writeFileSync(path.join(ROOT, rel), src);

const FILES = {
  music: "src/lib/musicEngine.ts",
  chat: "src/lib/chatEngine.ts",
  personas: "src/lib/personas.ts",
};

const GENRES = ["lofi", "synthwave", "house", "ambient"];
const PERSONAS = ["nova", "ember", "atlas", "lyra"];
const c = {
  acc: "\x1b[36m", ok: "\x1b[32m", warn: "\x1b[33m", err: "\x1b[31m",
  dim: "\x1b[2m", bold: "\x1b[1m", off: "\x1b[0m",
};

/* ---------------- journal ---------------- */

const loadJournal = () => {
  try {
    return JSON.parse(fs.readFileSync(JOURNAL, "utf8"));
  } catch {
    return [];
  }
};
const saveJournal = (j) => fs.writeFileSync(JOURNAL, JSON.stringify(j, null, 2));

/** Apply a set of string edits; journal them for `undo`. */
function commit(desc, edits) {
  for (const e of edits) {
    const src = read(e.file);
    if (!src.includes(e.old)) throw new Error(`pattern not found in ${e.file}: ${e.old.slice(0, 60)}…`);
    write(e.file, src.replace(e.old, e.new));
  }
  const j = loadJournal();
  j.push({ ts: new Date().toISOString(), desc, edits });
  saveJournal(j);
  console.log(`${c.ok}✔ committed${c.off} ${c.bold}${desc}${c.off} ${c.dim}(${edits.length} file edit${edits.length > 1 ? "s" : ""}, journal #${j.length})${c.off}`);
}

/* ---------------- block-scoped editing ---------------- */

/** Replace inside a `const NAME ... };` block only. */
function blockEdit(file, blockName, regex, replacement) {
  const src = read(file);
  const start = src.indexOf(blockName);
  if (start < 0) throw new Error(`block ${blockName} not found in ${file}`);
  const end = src.indexOf("};", start);
  const block = src.slice(start, end);
  if (!regex.test(block)) throw new Error(`${regex} did not match inside ${blockName}`);
  const next = block.replace(regex, replacement);
  return [{ file, old: block, new: next }];
}

function personaBlockEdit(pid, mutate) {
  const file = FILES.personas;
  const src = read(file);
  const open = src.indexOf(`id: "${pid}"`);
  if (open < 0) throw new Error(`persona ${pid} not found`);
  const close = src.indexOf("\n  },", open);
  const block = src.slice(open, close);
  const next = mutate(block);
  if (next === block) throw new Error("no change produced");
  return [{ file, old: block, new: next }];
}

const pushIntoArrayLine = (block, key, item) => {
  const re = new RegExp(`(${key}: \\[)([^\\]]*)(\\])`);
  if (!re.test(block)) throw new Error(`array ${key} not found in persona block`);
  return block.replace(re, (_, a, body, z) => {
    const trimmed = body.trim();
    return `${a}${trimmed ? body.replace(/\s*$/, "") + ", " : ""}${item}${z}`;
  });
};

/* ---------------- commands ---------------- */

function cmdStatus() {
  const music = read(FILES.music);
  console.log(`${c.bold}${c.acc}ORBIT · source status${c.off}\n`);
  const bpm = music.match(/BPM_RANGE[\s\S]*?\};/)?.[0] ?? "";
  for (const g of GENRES) {
    const m = bpm.match(new RegExp(`${g}: \\[(\\d+), (\\d+)\\]`));
    if (m) console.log(`  music.bpm.${g.padEnd(10)} ${c.ok}${m[1]}–${m[2]} BPM${c.off}`);
  }
  const swing = music.match(/SWING[\s\S]*?\};/)?.[0] ?? "";
  for (const g of GENRES) {
    const m = swing.match(new RegExp(`${g}: ([\\d.]+)`));
    if (m) console.log(`  music.swing.${g.padEnd(8)} ${m[1]}`);
  }
  const pers = read(FILES.personas);
  console.log("");
  for (const p of PERSONAS) {
    const open = pers.indexOf(`id: "${p}"`);
    const acc = pers.slice(open).match(/accent: "(#[0-9A-Fa-f]{6})"/)?.[1];
    console.log(`  persona.accent.${p.padEnd(6)} ${acc ?? "?"}`);
  }
  const chat = read(FILES.chat);
  const syn = chat.match(/INTENT_SYNONYMS[\s\S]*?\};/)?.[0] ?? "";
  const count = (syn.match(/"[^"]+"/g) ?? []).length;
  console.log(`\n  intent vocabulary       ${count} runtime synonyms`);
  const j = loadJournal();
  console.log(`  cli journal             ${j.length} committed edit set(s)\n`);
}

function planFrom(text) {
  const t = text.toLowerCase();
  const ops = [];
  const g = GENRES.find((x) => t.includes(x));
  if (g && /(faster|quicker|speed)/.test(t)) {
    const m = read(FILES.music).match(new RegExp(`${g}: \\[(\\d+), (\\d+)\\]`));
    if (m) {
      const nl = Math.min(210, Math.round(+m[1] * 1.16));
      const nh = Math.min(220, Math.round(+m[2] * 1.16));
      ops.push({ path: `music.bpm.${g}`, op: "set", value: [nl, nh], note: `tempo ${m[1]}–${m[2]} → ${nl}–${nh}` });
    }
  }
  if (g && /(slower|chiller)/.test(t)) {
    const m = read(FILES.music).match(new RegExp(`${g}: \\[(\\d+), (\\d+)\\]`));
    if (m) {
      const nl = Math.max(40, Math.round(+m[1] * 0.86));
      const nh = Math.max(nl + 2, Math.round(+m[2] * 0.86));
      ops.push({ path: `music.bpm.${g}`, op: "set", value: [nl, nh], note: `tempo ${m[1]}–${m[2]} → ${nl}–${nh}` });
    }
  }
  if (/swing/.test(t)) {
    const delta = /(less|reduce)/.test(t) ? -0.04 : 0.04;
    for (const x of g ? [g] : GENRES) {
      const m = read(FILES.music).match(new RegExp(`SWING[\\s\\S]*?${x}: ([\\d.]+)`));
      const cur = m ? +m[1] : 0;
      ops.push({ path: `music.swing.${x}`, op: "set", value: Math.max(0, Math.min(0.35, +(cur + delta).toFixed(2))), note: `swing ${delta > 0 ? "+" : ""}${delta}` });
    }
  }
  const vocab = t.match(/(?:add|map)\s+(?:command\s+)?["']([^"']{2,28})["']\s*(?:as|to|for)\s*([a-z_]+)/);
  if (vocab) ops.push({ path: `intent.${vocab[2]}`, op: "push", value: vocab[1], note: `“${vocab[1]}” → ${vocab[2]}` });
  const color = t.match(/(?:recolor|paint)\s+(nova|ember|atlas|lyra)(?:\s+to)?\s+(#[0-9a-fA-F]{6}|[a-z]+)/);
  if (color) {
    const W = { red: "#FF5D5D", teal: "#3FE0C5", green: "#9BE15D", blue: "#5B9DFF", purple: "#B48CFF", pink: "#FF7AB8", amber: "#F5B94B", crimson: "#E63946" };
    const hex = color[2].startsWith("#") ? color[2].toUpperCase() : W[color[2]];
    if (hex) ops.push({ path: `persona.accent.${color[1]}`, op: "set", value: hex, note: `${color[1]} accent → ${hex}` });
  }
  return ops;
}

function applyOps(ops, sourceDesc) {
  const allEdits = [];
  const applied = [];
  for (const op of ops) {
    const [domain, key, sub] = op.path.split(".");
    try {
      if (domain === "music" && key === "bpm") {
        const [lo, hi] = op.value;
        allEdits.push(...blockEdit(FILES.music, "BPM_RANGE", new RegExp(`${sub}: \\[\\d+,\\s*\\d+\\]`), `${sub}: [${lo}, ${hi}]`));
      } else if (domain === "music" && key === "swing") {
        allEdits.push(...blockEdit(FILES.music, "SWING", new RegExp(`${sub}: [\\d.]+`), `${sub}: ${op.value}`));
      } else if (domain === "music" && key === "titles") {
        allEdits.push(...blockEdit(FILES.music, "TITLES", new RegExp(`(${sub}: \\[)([^\\]]*)(\\])`), `$1$2, ${JSON.stringify(op.value)}$3`));
      } else if (domain === "music" && key === "progs") {
        allEdits.push(...blockEdit(FILES.music, "PROGS", new RegExp(`(  ${sub}: \\[[\\s\\S]*?)(\\n  \\],)`), `$1\n    ${JSON.stringify(op.value)},$2`));
      } else if (domain === "intent") {
        const src = read(FILES.chat);
        const s0 = src.indexOf("INTENT_SYNONYMS");
        const s1 = src.indexOf("};", s0);
        const block = src.slice(s0, s1);
        const re = new RegExp(`(${key}: \\[)([^\\]]*)(\\])`);
        const m = block.match(re);
        if (!m) throw new Error(`intent “${key}” not in vocabulary table`);
        const body = m[2].trim();
        const newBody = body ? `${m[2].replace(/\s*$/, "")}, ${JSON.stringify(op.value)}` : `${m[2]}${JSON.stringify(op.value)}`;
        allEdits.push({ file: FILES.chat, old: block, new: block.replace(re, `$1${newBody}$3`) });
      } else if (domain === "persona" && key === "accent") {
        allEdits.push(...personaBlockEdit(sub, (b) => b.replace(/accent: "#[0-9A-Fa-f]{6}"/, `accent: "${op.value}"`)));
      } else if (domain === "voice" && key === "fallback") {
        allEdits.push(...personaBlockEdit(sub, (b) => pushIntoArrayLine(b, "fallback", JSON.stringify(op.value))));
      } else if (domain === "persona" && key === "trait") {
        allEdits.push(...personaBlockEdit(sub, (b) => pushIntoArrayLine(b, "traits", JSON.stringify(op.value))));
      } else {
        console.log(`${c.warn}· skip${c.off} ${op.path} — runtime-only parameter (apply in-app; it rides the exported journal)`);
        continue;
      }
      applied.push(op);
    } catch (e) {
      console.log(`${c.err}✖ ${op.path}${c.off} — ${e.message}`);
    }
  }
  if (allEdits.length) commit(sourceDesc, allEdits);
  else if (!applied.length) console.log(`${c.warn}nothing applied${c.off}`);
}

function cmdPlan(text) {
  const ops = planFrom(text ?? "");
  if (!ops.length) {
    console.log(`${c.warn}no plan found${c.off} — try: “make house faster”, “more swing on lofi”, “recolor ember crimson”, “add command 'vibe' to slower”`);
    return;
  }
  console.log(`${c.bold}PLAN${c.off} ${c.dim}(dry run — nothing written)${c.off}\n`);
  for (const op of ops) {
    const file = op.path.startsWith("music") ? FILES.music : op.path.startsWith("intent") ? FILES.chat : FILES.personas;
    console.log(`  ${c.acc}${op.op.toUpperCase().padEnd(4)}${c.off} ${op.path} ${c.ok}${JSON.stringify(op.value)}${c.off}`);
    console.log(`       ${c.dim}→ ${file} · ${op.note}${c.off}`);
  }
  console.log(`\n${c.dim}apply with:${c.off} node cli/orbit-cli.mjs tune … ${c.dim}(or the matching command below)${c.off}`);
}

function parseVal(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw.replace(/^["']|["']$/g, "");
  }
}

/* ---------------- main ---------------- */

const [cmd, ...args] = process.argv.slice(2);

try {
  switch (cmd) {
    case "status":
      cmdStatus();
      break;
    case "plan":
      cmdPlan(args.join(" "));
      break;
    case "tune": {
      const [p, v] = args;
      if (!p || !v) throw new Error("usage: tune <music.bpm.G|music.swing.G> <value>");
      applyOps([{ path: p, op: "set", value: parseVal(v) }], `tune ${p}`);
      break;
    }
    case "intent": {
      const intent = args[args.length - 1];
      const phrase = args.slice(0, -1).join(" ");
      if (!phrase) throw new Error("usage: intent <phrase…> <intent>");
      applyOps([{ path: `intent.${intent}`, op: "push", value: phrase.toLowerCase() }], `intent “${phrase}” → ${intent}`);
      break;
    }
    case "accent": {
      const [pid, hex] = args;
      if (!PERSONAS.includes(pid) || !/^#[0-9a-fA-F]{6}$/.test(hex ?? "")) throw new Error("usage: accent <persona> <#rrggbb>");
      applyOps([{ path: `persona.accent.${pid}`, op: "set", value: hex.toUpperCase() }], `accent ${pid} → ${hex.toUpperCase()}`);
      break;
    }
    case "voice": {
      const [pid, ...rest] = args;
      if (!PERSONAS.includes(pid) || !rest.length) throw new Error("usage: voice <persona> <line…>");
      applyOps([{ path: `voice.fallback.${pid}`, op: "push", value: rest.join(" ") }], `voice line for ${pid}`);
      break;
    }
    case "title": {
      const [g, ...rest] = args;
      if (!GENRES.includes(g) || !rest.length) throw new Error("usage: title <genre> <title…>");
      applyOps([{ path: `music.titles.${g}`, op: "push", value: rest.join(" ") }], `title for ${g}`);
      break;
    }
    case "apply": {
      const file = args[0];
      if (!file) throw new Error("usage: apply <journal.json exported from the app>");
      const doc = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
      const ops = (doc.entries ?? []).flatMap((e) => e.ops.map((o) => ({ path: o.path, op: o.op, value: o.after })));
      console.log(`${c.bold}importing ${ops.length} op(s)${c.off} ${c.dim}from in-app kernel journal${c.off}\n`);
      applyOps(ops, "import from in-app kernel journal");
      break;
    }
    case "log": {
      const j = loadJournal();
      if (!j.length) console.log(`${c.dim}journal empty${c.off}`);
      j.forEach((e, i) => console.log(`  ${c.acc}#${i + 1}${c.off} ${e.ts.slice(11, 19)} ${e.desc} ${c.dim}(${e.edits.length} edits)${c.off}`));
      break;
    }
    case "undo": {
      const j = loadJournal();
      const last = j.pop();
      if (!last) throw new Error("nothing to undo");
      for (const e of [...last.edits].reverse()) {
        const src = read(e.file);
        if (!src.includes(e.new)) throw new Error(`source drifted — cannot revert ${e.file} cleanly (use git)`);
        write(e.file, src.replace(e.new, e.old));
      }
      saveJournal(j);
      console.log(`${c.ok}✔ reverted${c.off} ${c.bold}${last.desc}${c.off}`);
      break;
    }
    case "reset":
      saveJournal([]);
      console.log(`${c.warn}journal cleared${c.off} — source files untouched (use ${c.bold}undo${c.off} per entry, or git)`);
      break;
    default:
      console.log(`${c.bold}${c.acc}ORBIT CLI${c.off} — source-level self-modification\n
  ${c.bold}status${c.off}                        show live source parameters
  ${c.bold}plan${c.off} "<request>"              dry-run a natural-language patch
  ${c.bold}tune${c.off} music.bpm.house "[128,136]"
  ${c.bold}tune${c.off} music.swing.lofi 0.16
  ${c.bold}intent${c.off} "vibe check" slower     extend the runtime vocabulary
  ${c.bold}accent${c.off} ember "#FF3B3B"
  ${c.bold}voice${c.off} lyra "I hummed a new line for you."
  ${c.bold}title${c.off} lofi "Kernel Panic Café"
  ${c.bold}apply${c.off} orbit-kernel-journal.json  import patches from the in-app kernel
  ${c.bold}log${c.off} · ${c.bold}undo${c.off} · ${c.bold}reset${c.off}            journal control

  ${c.dim}Loop like Codex: plan → apply → npm run build → verify → undo if wrong.${c.off}
  ${c.dim}Git is your ultimate rollback: git diff / git checkout -- src${c.off}\n`);
  }
} catch (e) {
  console.error(`${c.err}✖ ${e.message}${c.off}`);
  process.exit(1);
}
