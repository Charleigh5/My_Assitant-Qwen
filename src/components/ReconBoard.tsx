import { useMemo, useState } from "react";
import type { Board, BoardSection, MaterialSpec, SectionKey } from "../lib/reconBoard";
import {
  CAMERAS,
  DEFECT_CLASSES,
  EVIDENCE,
  GAUNTLET,
  LIGHTING_RIG,
  STRATEGY_STAGES,
  STRATEGY_TOOLBOX,
  hexToRgb,
} from "../lib/reconBoard";

interface Props {
  board: Board | null;
  accent: string;
  onNew: (object: string) => void;
  onRegenSection: (key: SectionKey) => void;
  onDownloadSheet: () => void;
}

const EXAMPLES = [
  "leather aviator jacket",
  "matte-black espresso machine",
  "carbon road bicycle frame",
  "retro field camera",
];

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- drafting chrome ---------- */

const Ticks = () => (
  <>
    <span className="hud-corner left-0 top-0 border-l border-t" />
    <span className="hud-corner right-0 top-0 border-r border-t" />
    <span className="hud-corner bottom-0 left-0 border-b border-l" />
    <span className="hud-corner bottom-0 right-0 border-b border-r" />
  </>
);

const Stamp = ({ text, tone = "#ff7a50" }: { text: string; tone?: string }) => (
  <span
    className="pointer-events-none absolute -right-1 top-2 -rotate-6 border px-1.5 py-0.5 font-mono text-[7px] font-bold tracking-[0.18em]"
    style={{ borderColor: tone, color: tone, background: "rgba(11,19,23,0.7)" }}
  >
    {text}
  </span>
);

function SectionFrame({
  section,
  width,
  children,
}: {
  section?: { num: string; title: string };
  width: number;
  children: React.ReactNode;
}) {
  return (
    <section className="relative shrink-0 border border-ink-600 bg-ink-900/80" style={{ width }}>
      <Ticks />
      {section && (
        <header className="flex items-baseline gap-2 border-b border-ink-700/70 px-3 py-2">
          <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-mist-500">{section.num}</span>
          <h3 className="font-mono text-[10px] font-bold tracking-[0.22em] text-mist-100">{section.title}</h3>
        </header>
      )}
      {children}
    </section>
  );
}

function ImageBody({
  s,
  onRegen,
  tall = false,
}: {
  s: BoardSection;
  onRegen: (k: SectionKey) => void;
  tall?: boolean;
}) {
  if (s.status === "queued" || s.status === "rendering") {
    return (
      <div className={`img-shimmer relative ${tall ? "h-[300px]" : "h-[230px]"} w-full`}>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-mist-500 border-t-transparent" />
          <p className="font-mono text-[8px] tracking-[0.22em] text-mist-500">
            {s.status === "queued" ? "QUEUED FOR RENDER" : "RENDERING VIEW…"}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="group relative overflow-hidden" style={{ height: tall ? 300 : 230 }}>
      <img
        src={s.src}
        alt={s.title}
        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
      />
      {s.status === "fallback" && <Stamp text="PROCEDURAL FALLBACK" tone="#f5b94b" />}
      {s.method === "ai" && <Stamp text="NEURAL RENDER" tone="#9be15d" />}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-ink-950/85 px-2 py-1 opacity-0 transition-opacity group-hover:opacity-100">
        <a
          href={s.src}
          download={`recon-${s.key}.png`}
          className="font-mono text-[8px] tracking-[0.16em] text-mist-300 transition-colors hover:text-mist-100"
        >
          SAVE VIEW
        </a>
        <button
          onClick={() => onRegen(s.key)}
          className="font-mono text-[8px] tracking-[0.16em] text-mist-500 transition-colors hover:text-ember"
        >
          RE-RENDER
        </button>
      </div>
    </div>
  );
}

/* ---------- §C silhouette diagram ---------- */

function SilhouetteSVG({ seed, accent }: { seed: number; accent: string }) {
  const d = useMemo(() => {
    const r = seeded(seed);
    const wf = 0.55 + r() * 0.3;
    const hf = 0.45 + r() * 0.35;
    const bulge = 0.1 + r() * 0.25;
    const asym = (r() - 0.5) * 18;
    const cx = 178;
    const cy = 128;
    const hw = 108 * wf;
    const hh = 78 * hf;
    const path = `M ${cx - hw} ${cy}
      C ${cx - hw} ${cy - hh * (1 + bulge)}, ${cx - hw * 0.3} ${cy - hh * 1.15}, ${cx + asym * 0.4} ${cy - hh}
      C ${cx + hw * 0.5} ${cy - hh * 0.92}, ${cx + hw} ${cy - hh * (0.7 - bulge * 0.4)}, ${cx + hw} ${cy}
      C ${cx + hw} ${cy + hh * 0.7}, ${cx + hw * 0.4} ${cy + hh}, ${cx} ${cy + hh}
      C ${cx - hw * 0.5} ${cy + hh}, ${cx - hw} ${cy + hh * 0.6}, ${cx - hw} ${cy} Z`;
    return { path, cx, cy, hw, hh };
  }, [seed]);

  const L = Math.round(d.hw * 2.4);
  const H = Math.round(d.hh * 2.4);

  return (
    <div className="relative p-2">
      <svg viewBox="0 0 356 262" className="w-full" role="img" aria-label="Silhouette and proportion guide">
        {/* ground hatch */}
        <line x1="26" y1="222" x2="330" y2="222" stroke="#66868a" strokeWidth="1.4" />
        {Array.from({ length: 19 }, (_, i) => (
          <line key={i} x1={30 + i * 16} y1="222" x2={22 + i * 16} y2="232" stroke="#2f4c59" strokeWidth="1" />
        ))}
        {/* silhouette */}
        <path d={d.path} fill={`${accent}14`} stroke={accent} strokeWidth="1.6" />
        {/* centerlines */}
        <line x1={d.cx} y1="18" x2={d.cx} y2="244" stroke="#8cacac" strokeWidth="0.8" strokeDasharray="6 4" opacity="0.7" />
        <line x1="30" y1={d.cy} x2="326" y2={d.cy} stroke="#8cacac" strokeWidth="0.8" strokeDasharray="6 4" opacity="0.5" />
        {/* width dimension */}
        <line x1={d.cx - d.hw} y1="240" x2={d.cx + d.hw} y2="240" stroke="#eaf4f3" strokeWidth="1" />
        <path d={`M ${d.cx - d.hw} 240 l 5 -3 v 6 z`} fill="#eaf4f3" />
        <path d={`M ${d.cx + d.hw} 240 l -5 -3 v 6 z`} fill="#eaf4f3" />
        <text x={d.cx} y="254" textAnchor="middle" fill="#eaf4f3" fontSize="8" fontFamily="JetBrains Mono, monospace" letterSpacing="1.5">
          L ≈ {L} — ESTIMATED FROM PROMPT
        </text>
        {/* height dimension */}
        <line x1="336" y1={d.cy - d.hh} x2="336" y2={d.cy + d.hh} stroke="#eaf4f3" strokeWidth="1" />
        <text x="331" y={d.cy} fill="#eaf4f3" fontSize="8" fontFamily="JetBrains Mono, monospace" textAnchor="end" letterSpacing="1.5">
          H ≈ {H}
        </text>
        {/* ticks */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={d.cx - d.hw + d.hw * 2 * f}
            y1={d.cy + d.hh + 2}
            x2={d.cx - d.hw + d.hw * 2 * f}
            y2={d.cy + d.hh + 8}
            stroke="#66868a"
            strokeWidth="1"
          />
        ))}
        <text x="26" y="20" fill="#66868a" fontSize="7.5" fontFamily="JetBrains Mono, monospace" letterSpacing="2">
          SYMMETRY PLANE ▸ DASHED
        </text>
        <text x="26" y="32" fill="#66868a" fontSize="7.5" fontFamily="JetBrains Mono, monospace" letterSpacing="2">
          CONTACT PLANE ▸ HATCHED
        </text>
      </svg>
      <Stamp text="ESTIMATED FROM REFERENCE" tone="#f5b94b" />
    </div>
  );
}

/* ---------- §F material palette ---------- */

function MaterialCard({ m }: { m: MaterialSpec }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="group border border-ink-600 bg-ink-850/70 transition-all hover:-translate-y-0.5"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="relative h-9 w-full transition-all" style={{ background: m.hex, boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.12)` }}>
        <span className="absolute bottom-1 left-1.5 font-mono text-[7.5px] font-bold tracking-[0.12em] text-ink-950/80">
          {hover ? `RGB ${hexToRgb(m.hex)}` : m.hex}
        </span>
      </div>
      <div className="p-2">
        <p className="font-mono text-[9px] font-bold tracking-[0.1em] text-mist-100">{m.name}</p>
        <p className="font-mono text-[8px] tracking-[0.08em] text-mist-500">{m.colorName}</p>
        <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[7.5px] tracking-[0.06em] text-mist-300">
          <span>ROUGH <b className="text-mist-100">{m.roughness}</b></span>
          <span>MET <b className="text-mist-100">{m.metallic}</b></span>
          <span>SPEC <b className="text-mist-100">{m.specular}</b></span>
          <span>IOR <b className="text-mist-100">{m.ior}</b></span>
          <span className="col-span-2">BUMP <b className="text-mist-100">{m.bump}</b> · {m.normal}</span>
          {m.extras && <span className="col-span-2 text-atlas">{m.extras}</span>}
        </div>
        <p className="mt-1.5 border-t border-ink-700/70 pt-1 font-mono text-[7.5px] leading-relaxed tracking-[0.04em] text-mist-500">
          MICRO ▸ {m.micro}
        </p>
      </div>
    </div>
  );
}

/* ---------- main panel ---------- */

export default function ReconPanel({ board, accent, onNew, onRegenSection, onDownloadSheet }: Props) {
  const [draft, setDraft] = useState("");
  const [checked, setChecked] = useState<Set<number>>(new Set());

  if (!board) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#66868a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="1" />
          <path d="M3 9h18M9 9v12M15 3v6" />
          <circle cx="12" cy="15" r="2.4" />
        </svg>
        <p className="max-w-md font-mono text-[10px] leading-relaxed tracking-[0.14em] text-mist-500">
          NO ACTIVE BOARD — DESCRIBE AN OBJECT AND I'LL DRAFT A FULL
          <span className="text-mist-100"> 3D RECONSTRUCTION REFERENCE BOARD</span>: HERO ISO, ORTHO SET,
          MATERIALS, MACRO DETAILS, SECTION AND QA GAUNTLET
        </p>
        <form
          className="flex w-full max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) onNew(draft.trim());
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. brushed-aluminium desk lamp"
            className="min-w-0 flex-1 border border-ink-600 bg-ink-950/70 px-3 py-2 font-mono text-[11px] text-mist-100 placeholder:text-mist-600 focus:outline-none"
            style={{ caretColor: accent }}
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="px-3 py-2 font-mono text-[10px] font-bold tracking-[0.18em] text-ink-950 transition-all enabled:hover:-translate-y-0.5 disabled:opacity-30"
            style={{ background: accent }}
          >
            DRAFT
          </button>
        </form>
        <div className="flex flex-wrap justify-center gap-1.5">
          {EXAMPLES.map((x) => (
            <button
              key={x}
              onClick={() => onNew(x)}
              className="border border-ink-600 px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-mist-300 transition-all hover:-translate-y-0.5"
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = accent;
                e.currentTarget.style.color = accent;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#213843";
                e.currentTarget.style.color = "";
              }}
            >
              {x}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const sec = (k: SectionKey) => board.sections.find((s) => s.key === k)!;
  const doneCount = board.sections.filter((s) => s.status === "done" || s.status === "fallback").length;

  return (
    <div className="flex h-full flex-col">
      {/* title block */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-ink-700/70 bg-ink-900/80 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate font-display text-[15px] font-extrabold leading-tight tracking-[0.1em] text-mist-100">
            {board.object.toUpperCase()} <span style={{ color: accent }}>— 3D RECONSTRUCTION MASTER</span>
          </p>
          <p className="font-mono text-[8px] tracking-[0.18em] text-mist-600">
            REV {board.rev} · SEED {board.seed} · VIEWS {doneCount}/5 · EVIDENCE: TEXT PROMPT ONLY — GEOMETRY IS{" "}
            <span className="text-ember">ARTIST_AUTHORED</span>
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {EVIDENCE.legend.slice(2).map((e) => (
            <span
              key={e.tag}
              title={e.note}
              className="border px-1.5 py-0.5 font-mono text-[7px] tracking-[0.12em]"
              style={{ borderColor: `${e.tone}66`, color: e.tone }}
            >
              {e.tag}
            </span>
          ))}
          <button
            onClick={onDownloadSheet}
            className="border px-2 py-1 font-mono text-[8px] font-bold tracking-[0.16em] transition-all hover:-translate-y-px"
            style={{ borderColor: accent, color: accent, background: `${accent}14` }}
          >
            DOWNLOAD SHEET
          </button>
        </div>
      </div>

      {/* the sheet — unrolls left to right in spec order */}
      <div className="flex min-h-0 flex-1 items-stretch gap-2.5 overflow-x-auto overflow-y-hidden p-2.5">
        {/* §A hero */}
        <SectionFrame section={sec("hero")} width={380}>
          <ImageBody s={sec("hero")} onRegen={onRegenSection} tall />
          <p className="px-3 py-1.5 font-mono text-[7.5px] tracking-[0.14em] text-mist-500">{sec("hero").caption.toUpperCase()}</p>
        </SectionFrame>

        {/* §B ortho */}
        <SectionFrame section={sec("ortho")} width={520}>
          <ImageBody s={sec("ortho")} onRegen={onRegenSection} tall />
          <p className="px-3 py-1.5 font-mono text-[7.5px] tracking-[0.14em] text-mist-500">{sec("ortho").caption.toUpperCase()}</p>
        </SectionFrame>

        {/* §C silhouette */}
        <SectionFrame section={sec("silhouette")} width={360}>
          <SilhouetteSVG seed={board.seed} accent={accent} />
          <p className="px-3 pb-2 font-mono text-[7.5px] leading-relaxed tracking-[0.12em] text-mist-500">
            VALUES DERIVED FROM PROMPT — DO NOT TREAT AS MEASURED. SUPPLY REFERENCE IMAGES TO UPGRADE EVIDENCE.
          </p>
        </SectionFrame>

        {/* §D macro */}
        <SectionFrame section={sec("macro")} width={400}>
          <ImageBody s={sec("macro")} onRegen={onRegenSection} tall />
          <p className="px-3 py-1.5 font-mono text-[7.5px] tracking-[0.14em] text-mist-500">{sec("macro").caption.toUpperCase()}</p>
        </SectionFrame>

        {/* §E markings */}
        <SectionFrame section={sec("markings")} width={380}>
          <ImageBody s={sec("markings")} onRegen={onRegenSection} tall />
          <p className="px-3 py-1.5 font-mono text-[7.5px] tracking-[0.14em] text-mist-500">
            UNREADABLE SOURCE TEXT → <span className="text-atlas">TEXT UNRESOLVED</span> · NEVER INVENTED
          </p>
        </SectionFrame>

        {/* §F materials */}
        <SectionFrame section={sec("materials")} width={460}>
          <div className="relative grid grid-cols-2 gap-2 p-2.5">
            <Stamp text="RENDER CALIBRATION STARTING VALUES" tone="#54d8ff" />
            {board.materials.map((m) => (
              <MaterialCard key={m.name} m={m} />
            ))}
          </div>
        </SectionFrame>

        {/* §G section view */}
        <SectionFrame section={sec("section")} width={400}>
          <ImageBody s={sec("section")} onRegen={onRegenSection} tall />
          <p className="px-3 py-1.5 font-mono text-[7.5px] tracking-[0.14em] text-mist-500">
            INTERNAL CONSTRUCTION NOT SOURCE VERIFIED — <span className="text-ember">ARTIST HYPOTHESIS</span>
          </p>
        </SectionFrame>

        {/* §H cameras + lighting */}
        <SectionFrame section={sec("cameras")} width={300}>
          <div className="flex h-full flex-col p-2.5">
            <p className="font-mono text-[8px] tracking-[0.2em] text-mist-500">CANONICAL CAMERAS</p>
            <ul className="mt-1.5 space-y-0.5 font-mono text-[9px] tracking-[0.08em] text-mist-300">
              {CAMERAS.map((c) => (
                <li key={c} className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full" style={{ background: accent }} />
                  {c}
                </li>
              ))}
            </ul>
            <p className="mt-3 font-mono text-[8px] tracking-[0.2em] text-mist-500">NEUTRAL VALIDATION RIG</p>
            <ul className="mt-1.5 space-y-0.5 font-mono text-[8.5px] leading-relaxed tracking-[0.04em] text-mist-400 text-mist-500">
              {LIGHTING_RIG.map((l) => (
                <li key={l}>· {l}</li>
              ))}
            </ul>
            <p className="mt-auto pt-2 font-mono text-[7.5px] leading-relaxed tracking-[0.1em] text-mist-600">
              NEVER COMPENSATE BAD GEOMETRY WITH CAMERA. NEVER POLISH MICRODETAIL WHILE SILHOUETTE IS WRONG.
            </p>
          </div>
        </SectionFrame>

        {/* §I build strategy */}
        <SectionFrame section={{ num: "§I", title: "BLENDER RECONSTRUCTION STRATEGY" }} width={330}>
          <div className="p-2.5">
            <div className="flex flex-wrap gap-y-1">
              {STRATEGY_STAGES.map((st, i) => (
                <span key={st} className="flex items-center font-mono text-[7.5px] tracking-[0.1em]">
                  <span className="px-1 py-0.5" style={{ color: i < 5 ? accent : "#8cacac", borderColor: `${accent}44` }}>
                    {st}
                  </span>
                  {i < STRATEGY_STAGES.length - 1 && <span className="text-mist-600">→</span>}
                </span>
              ))}
            </div>
            <ul className="mt-2 space-y-1 border-t border-ink-700/70 pt-2">
              {STRATEGY_TOOLBOX.map((t) => (
                <li key={t.part} className="font-mono text-[8px] leading-relaxed tracking-[0.04em] text-mist-400 text-mist-500">
                  <b className="text-mist-300">{t.part}</b> ▸ {t.tool}
                </li>
              ))}
            </ul>
          </div>
        </SectionFrame>

        {/* §J gauntlet */}
        <SectionFrame section={{ num: "§J", title: "VISUAL GAUNTLET — QA ORDER" }} width={330}>
          <div className="flex h-full flex-col p-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-mono text-[8px] tracking-[0.16em] text-mist-500">
                {checked.size}/{GAUNTLET.length} CLEARED
              </span>
              <div className="h-1 w-24 overflow-hidden bg-ink-800">
                <div
                  className="h-full transition-all duration-300"
                  style={{ width: `${(checked.size / GAUNTLET.length) * 100}%`, background: accent }}
                />
              </div>
            </div>
            <ol className="space-y-0.5 overflow-y-auto pr-1">
              {GAUNTLET.map((g, i) => {
                const on = checked.has(i);
                return (
                  <li key={g.step}>
                    <button
                      onClick={() =>
                        setChecked((prev) => {
                          const n = new Set(prev);
                          if (n.has(i)) n.delete(i);
                          else n.add(i);
                          return n;
                        })
                      }
                      className="flex w-full items-start gap-1.5 py-0.5 text-left"
                    >
                      <span
                        className="mt-[3px] flex h-2.5 w-2.5 shrink-0 items-center justify-center border font-mono text-[7px]"
                        style={{ borderColor: on ? accent : "#2f4c59", color: accent }}
                      >
                        {on ? "✓" : ""}
                      </span>
                      <span className="font-mono text-[8.5px] leading-snug tracking-[0.04em]" style={{ color: on ? "#66868a" : "#c2d8d6", textDecoration: on ? "line-through" : "none" }}>
                        <b>{String(i + 1).padStart(2, "0")}</b> {g.step.toUpperCase()}
                        <span className="text-mist-600"> — {g.note}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </SectionFrame>

        {/* §K defects */}
        <SectionFrame section={{ num: "§K", title: "DEFECT CLASSIFICATION" }} width={280}>
          <div className="flex h-full flex-col p-2.5">
            <div className="flex flex-wrap gap-1">
              {DEFECT_CLASSES.map((dc, i) => (
                <span
                  key={dc}
                  title={`visual impact rank ${i + 1}`}
                  className="border border-ink-600 px-1.5 py-0.5 font-mono text-[7.5px] tracking-[0.08em] text-mist-400 transition-colors hover:text-mist-100"
                >
                  <b style={{ color: i < 3 ? "#ff7a50" : "#66868a" }}>{String(i + 1).padStart(2, "0")}</b> {dc}
                </span>
              ))}
            </div>
            <p className="mt-auto pt-2 font-mono text-[7.5px] leading-relaxed tracking-[0.1em] text-mist-600">
              RANK BY VISUAL IMPACT — CORRECT HIGHEST-IMPACT FIRST.
            </p>
          </div>
        </SectionFrame>
      </div>
    </div>
  );
}
