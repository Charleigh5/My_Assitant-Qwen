import { useMemo, useState } from "react";
import type { PremodelPlan, Support } from "../lib/premodel";
import { STAGE_COUNT } from "../lib/premodel";

interface Props {
  plan: PremodelPlan | null;
  accent: string;
  onRun: (object: string) => void;
}

const EXAMPLES = ["a leather aviator jacket", "a brushed-steel espresso machine", "a glass potion bottle", "a carbon-fiber drone frame"];

function SupportTag({ s }: { s: Support }) {
  const c = s === "VERIFIED" ? "#9be15d" : s === "INFERRED" ? "#f5b94b" : "#8cacac";
  return (
    <span
      className="shrink-0 border px-1 py-px font-mono text-[7px] tracking-[0.12em]"
      style={{ borderColor: `${c}66`, color: c, background: `${c}11` }}
    >
      {s}
    </span>
  );
}

function SectionTitle({ n, label, accent }: { n: string; label: string; accent: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="font-mono text-[9px] font-bold tracking-[0.2em]" style={{ color: accent }}>
        {n}
      </span>
      <span className="font-display text-[11px] font-bold tracking-[0.22em] text-mist-100">{label}</span>
      <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${accent}55, transparent)` }} />
    </div>
  );
}

export default function PremodelPanel({ plan, accent, onRun }: Props) {
  const [query, setQuery] = useState("");
  const [done, setDone] = useState<Record<number, boolean>>({});

  const progress = useMemo(() => {
    if (!plan) return 0;
    return Object.values(done).filter(Boolean).length;
  }, [done, plan]);

  if (!plan) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8">
        <div className="max-w-xl text-center">
          <p className="font-display text-[20px] font-extrabold tracking-[0.24em] text-mist-100">
            PREMODEL <span style={{ color: accent }}>GATE</span>
          </p>
          <p className="mt-2 font-mono text-[9px] leading-relaxed tracking-[0.1em] text-mist-500">
            NO RANDOM MODELING. The governor drafts evidence, representation, tools, modifier order,
            cameras and tests — self-critiques once, fixes the largest defect, then stamps PASS before any build.
          </p>
        </div>
        <form
          className="flex w-full max-w-xl items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) onRun(query.trim());
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe the object to gate…"
            className="min-w-0 flex-1 border border-ink-600 bg-ink-950/70 px-3 py-2 text-[13px] text-mist-100 placeholder:text-mist-600 focus:outline-none"
            style={{ caretColor: accent }}
          />
          <button
            type="submit"
            disabled={!query.trim()}
            className="px-4 py-2 font-mono text-[10px] font-bold tracking-[0.18em] text-ink-950 transition-all enabled:hover:-translate-y-0.5 disabled:opacity-30"
            style={{ background: accent, boxShadow: query.trim() ? `0 0 18px -4px ${accent}` : "none" }}
          >
            RUN GATE
          </button>
        </form>
        <div className="flex flex-wrap justify-center gap-1.5">
          {EXAMPLES.map((x) => (
            <button
              key={x}
              onClick={() => onRun(x)}
              className="border border-ink-600 px-2 py-1 font-mono text-[9px] tracking-[0.06em] text-mist-300 transition-all hover:-translate-y-0.5"
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

  const toggle = (id: number) => setDone((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div className="h-full overflow-y-auto px-4 py-3">
      {/* header */}
      <div className="relative mb-4 flex items-start justify-between gap-4 border border-ink-700/70 bg-ink-950/50 p-3">
        <div className="min-w-0">
          <p className="font-mono text-[8px] tracking-[0.24em] text-mist-600">
            PREMODEL_STRATEGY · REV A · {new Date(plan.createdAt).toLocaleTimeString()}
          </p>
          <h3 className="mt-1 truncate font-display text-[22px] font-extrabold leading-none tracking-[0.08em] text-mist-100">
            {plan.object}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="border border-ink-600 px-1.5 py-0.5 font-mono text-[8px] tracking-[0.12em] text-mist-300">
              {plan.inputClass}
            </span>
            <span className="border border-ink-600 px-1.5 py-0.5 font-mono text-[8px] tracking-[0.12em] text-mist-300">
              SEED {plan.seed.toString(36).toUpperCase()}
            </span>
            <span className="border border-ink-600 px-1.5 py-0.5 font-mono text-[8px] tracking-[0.12em] text-mist-300">
              {plan.regions.length} REGIONS · {plan.stages.length} STAGES
            </span>
          </div>
        </div>
        {/* gate stamp */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div
            className="stamp-in border-2 px-3 py-1.5 font-display text-[18px] font-extrabold tracking-[0.3em]"
            style={{
              color: plan.gate === "PASS" ? "#9be15d" : "#ff5d5d",
              borderColor: plan.gate === "PASS" ? "#9be15d" : "#ff5d5d",
              textShadow: `0 0 14px ${plan.gate === "PASS" ? "#9be15d66" : "#ff5d5d66"}`,
            }}
          >
            {plan.gate}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-[5px] w-24 overflow-hidden bg-ink-700">
              <div className="h-full transition-all duration-700" style={{ width: `${plan.confidence}%`, background: accent }} />
            </div>
            <span className="font-mono text-[8px] tracking-[0.1em] text-mist-500">{plan.confidence}%</span>
          </div>
        </div>
      </div>

      {/* truth + source */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <SectionTitle n="01" label="SOURCE MAP + TRUTH" accent={accent} />
          <div className="space-y-1">
            {plan.sourceMap.map((s) => (
              <div key={s.source} className="flex items-center justify-between gap-2 border border-ink-700/60 bg-ink-850/40 px-2 py-1.5">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[9px] font-bold text-mist-300">{s.source}</p>
                  <p className="truncate font-mono text-[8px] text-mist-600">{s.lesson}</p>
                </div>
                <span
                  className="shrink-0 border px-1 py-px font-mono text-[7px] tracking-[0.1em]"
                  style={{
                    borderColor: s.status === "CURRENT" ? "#9be15d66" : s.status === "CONFLICT" ? "#ff5d5d66" : "#f5b94b66",
                    color: s.status === "CURRENT" ? "#9be15d" : s.status === "CONFLICT" ? "#ff5d5d" : "#f5b94b",
                  }}
                >
                  {s.status}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {plan.truths.map((t) => (
              <span key={t.label} className="border border-ink-600 px-1.5 py-0.5 font-mono text-[8px] tracking-[0.1em] text-mist-300" title={t.note}>
                {t.label}
              </span>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle n="02" label="MACRO · MESO · MICRO" accent={accent} />
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { h: "MACRO", rows: plan.macro },
              { h: "MESO", rows: plan.meso },
              { h: "MICRO", rows: plan.micro },
            ].map((col) => (
              <div key={col.h} className="border border-ink-700/60 bg-ink-850/40 p-1.5">
                <p className="mb-1 font-mono text-[8px] font-bold tracking-[0.16em]" style={{ color: accent }}>
                  {col.h}
                </p>
                <div className="space-y-1.5">
                  {col.rows.map((e) => (
                    <div key={e.label}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate font-mono text-[8px] font-bold text-mist-300">{e.label}</span>
                        <SupportTag s={e.support} />
                      </div>
                      <p className="font-mono text-[7.5px] leading-snug text-mist-600">{e.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-1.5 font-mono text-[8px] italic text-mist-600">
            Rule: never polish MESO/MICRO while MACRO is wrong.
          </p>
        </div>
      </div>

      {/* regions + modifiers */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <SectionTitle n="03" label="REGION → TOOL MAP" accent={accent} />
          <div className="space-y-1.5">
            {plan.regions.map((r) => (
              <div key={r.name} className="border border-ink-700/60 bg-ink-850/40 p-2 transition-colors hover:border-ink-600">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[9px] font-bold text-mist-100">{r.name}</span>
                  <span className="border px-1.5 py-px font-mono text-[7px] tracking-[0.1em]" style={{ borderColor: `${accent}66`, color: accent }}>
                    {r.rep}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {r.tools.map((t) => (
                    <span key={t} className="bg-ink-700/60 px-1.5 py-0.5 font-mono text-[7.5px] text-mist-300">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {r.rejected.map((t) => (
                    <span key={t.tool} className="line-through decoration-[#ff5d5d88] opacity-60 px-1.5 py-0.5 font-mono text-[7.5px] text-mist-500" title={t.why}>
                      {t.tool}
                    </span>
                  ))}
                </div>
                <p className="mt-1 font-mono text-[7.5px] italic leading-snug text-mist-600">{r.note}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle n="04" label="MODIFIER STACK (ORDERED)" accent={accent} />
          <div className="space-y-1">
            {plan.modifiers.map((m, i) => (
              <div key={m.name + i} className="flex items-start gap-2 border border-ink-700/60 bg-ink-850/40 px-2 py-1.5">
                <span className="mt-px font-mono text-[9px] font-bold" style={{ color: accent }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-[9px] font-bold text-mist-100">{m.name}</p>
                  <p className="font-mono text-[7.5px] text-mist-600">{m.rationale}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-1.5 font-mono text-[8px] text-mist-600">
            <span className="text-mist-300">Symmetry:</span> {plan.symmetry}
          </p>
        </div>
      </div>

      {/* staged build */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <SectionTitle n="05" label="COARSE → FINE BUILD" accent={accent} />
        </div>
        <div className="mb-2 flex items-center gap-2">
          <div className="h-[5px] flex-1 overflow-hidden bg-ink-700">
            <div className="h-full transition-all duration-500" style={{ width: `${(progress / STAGE_COUNT) * 100}%`, background: accent }} />
          </div>
          <span className="font-mono text-[8px] tracking-[0.12em] text-mist-500">
            {progress}/{STAGE_COUNT} PROVEN
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {plan.stages.map((s) => {
            const isDone = !!done[s.id];
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className="flex items-start gap-2 border p-1.5 text-left transition-all hover:-translate-y-px"
                style={{
                  borderColor: isDone ? `${accent}88` : "#213843",
                  background: isDone ? `${accent}11` : "rgba(19,34,42,0.4)",
                }}
              >
                <span
                  className="mt-px flex h-3.5 w-3.5 shrink-0 items-center justify-center border font-mono text-[8px] font-bold"
                  style={{
                    borderColor: isDone ? accent : "#2f4c59",
                    color: isDone ? "#0b1317" : "#66868a",
                    background: isDone ? accent : "transparent",
                  }}
                >
                  {isDone ? "✓" : s.id}
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-[8.5px] font-bold leading-tight" style={{ color: isDone ? accent : "#c2d8d6" }}>
                    {s.name}
                  </p>
                  <p className="font-mono text-[7px] leading-snug text-mist-600">prove: {s.proving}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* cameras / lighting / tests / unknowns */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <SectionTitle n="06" label="CAMERAS + LIGHTING" accent={accent} />
          <div className="mb-1.5 flex flex-wrap gap-1">
            {plan.cameras.map((c) => (
              <span key={c} className="border border-ink-600 px-1.5 py-0.5 font-mono text-[7.5px] tracking-[0.06em] text-mist-300">
                {c}
              </span>
            ))}
          </div>
          {([
            ["DIAGNOSTIC", plan.lighting.diagnostic],
            ["SOURCE", plan.lighting.source],
            ["BEAUTY", plan.lighting.beauty],
          ] as const).map(([k, v]) => (
            <p key={k} className="font-mono text-[8px] leading-snug text-mist-600">
              <span className="font-bold" style={{ color: accent }}>
                {k}:
              </span>{" "}
              {v}
            </p>
          ))}
        </div>
        <div>
          <SectionTitle n="07" label="TEST BUDGET + UNKNOWNS" accent={accent} />
          <div className="space-y-1">
            {plan.tests.map((t) => (
              <div key={t.tier} className="flex items-start gap-2">
                <span className="shrink-0 border px-1 font-mono text-[8px] font-bold" style={{ borderColor: `${accent}66`, color: accent }}>
                  {t.tier}
                </span>
                <p className="font-mono text-[8px] leading-snug text-mist-500">{t.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 border border-dashed border-ink-600 p-1.5">
            {plan.unknowns.map((u) => (
              <p key={u} className="font-mono text-[7.5px] leading-snug text-mist-600">
                · {u}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* self-critique + gate decision */}
      <div className="border p-3" style={{ borderColor: `${accent}55`, background: `${accent}08` }}>
        <SectionTitle n="08" label="SELF-CRITIQUE → CORRECTION → DECISION" accent={accent} />
        <div className="mb-2 space-y-1">
          {plan.critique.map((c) => (
            <div key={c.found} className="flex items-start gap-2">
              <span
                className="shrink-0 border px-1 font-mono text-[7px] font-bold"
                style={{
                  borderColor: c.severity === "HIGH" ? "#ff5d5d66" : c.severity === "MED" ? "#f5b94b66" : "#8cacac66",
                  color: c.severity === "HIGH" ? "#ff5d5d" : c.severity === "MED" ? "#f5b94b" : "#8cacac",
                }}
              >
                {c.severity}
              </span>
              <p className="font-mono text-[8px] leading-snug text-mist-500">{c.found}</p>
            </div>
          ))}
        </div>
        <p className="font-mono text-[8.5px] leading-relaxed text-mist-300">
          <span className="font-bold" style={{ color: "#ff7a50" }}>
            LARGEST DEFECT —{" "}
          </span>
          {plan.largestDefect}
        </p>
        <p className="mt-1 font-mono text-[8.5px] leading-relaxed text-mist-300">
          <span className="font-bold" style={{ color: "#9be15d" }}>
            CORRECTION —{" "}
          </span>
          {plan.correction}
        </p>
        <p className="mt-2 border-t border-ink-700 pt-2 font-mono text-[9px] font-bold tracking-[0.14em]" style={{ color: accent }}>
          PREMODEL_GATE = {plan.gate} · PROCEED TO COARSE BUILD · UNEXECUTED SCRIPT ≠ COMPLETION
        </p>
      </div>
    </div>
  );
}
