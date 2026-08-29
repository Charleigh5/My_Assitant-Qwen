import { useEffect, useRef, useState } from "react";
import { kernel, planFromText, fmtVal } from "../lib/kernel";
import type { JournalEntry, KernelOpPlan } from "../lib/kernel";
import { alpha } from "../lib/personas";

interface Line {
  kind: "sys" | "err" | "ok" | "add" | "del";
  text: string;
}

const SOURCE_COLOR: Record<string, string> = {
  agent: "#3fe0c5",
  user: "#eaf4f3",
  cli: "#f5b94b",
};

function DiffBlock({ entry, canUndo, onUndo }: { entry: JournalEntry; canUndo: boolean; onUndo: () => void }) {
  return (
    <div className="border border-ink-700/70 bg-ink-950/50 px-2.5 py-2 transition-colors hover:border-ink-600">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[9px] tracking-[0.14em] text-mist-600">#{entry.id}</span>
        <span
          className="border px-1 py-px font-mono text-[7.5px] tracking-[0.16em]"
          style={{ borderColor: alpha(SOURCE_COLOR[entry.source], 0.5), color: SOURCE_COLOR[entry.source] }}
        >
          {entry.source.toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[9px] tracking-[0.06em] text-mist-300">{entry.note}</span>
        <span className="font-mono text-[8px] text-mist-600">
          {new Date(entry.ts).toLocaleTimeString([], { hour12: false })}
        </span>
        {canUndo && (
          <button
            onClick={onUndo}
            className="border border-ink-600 px-1.5 py-px font-mono text-[8px] tracking-[0.12em] text-mist-300 transition-all hover:-translate-y-px hover:border-ember hover:text-ember"
          >
            UNDO
          </button>
        )}
      </div>
      <div className="mt-1.5 space-y-[3px] border-l border-ink-700/60 pl-2">
        {entry.ops.map((op, i) => (
          <div key={i} className="font-mono text-[9px] leading-relaxed">
            <p className="text-[#ff8a8a]">
              − {op.path} · {fmtVal(op.before)}
            </p>
            <p className="text-[#9be15d]">
              + {op.path} · {fmtVal(op.after)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function KernelPanel({ accent, onEvent }: { accent: string; onEvent: (msg: string) => void }) {
  const [rev, setRev] = useState(0);
  const [lines, setLines] = useState<Line[]>([
    { kind: "sys", text: "ORBIT KERNEL v1 — self-modification console" },
    { kind: "sys", text: "type `help` for commands, or just ask: “make house faster”" },
  ]);
  const [cmd, setCmd] = useState("");
  const [hist, setHist] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const termRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => kernel.onChange(() => setRev((r) => r + 1)), []);
  useEffect(() => {
    const el = termRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, rev]);

  const journal = kernel.journal();

  const print = (...ls: Line[]) => setLines((prev) => [...prev.slice(-120), ...ls]);

  const applyPlans = (plans: KernelOpPlan[], note: string) => {
    try {
      const entry = kernel.apply("user", note, plans);
      entry.ops.forEach((op) => {
        print({ kind: "del", text: `− ${op.path} · ${fmtVal(op.before)}` });
        print({ kind: "add", text: `+ ${op.path} · ${fmtVal(op.after)}` });
      });
      print({ kind: "ok", text: `committed as journal #${entry.id} — undo available` });
      onEvent(`kernel: ${entry.ops.length} op(s) via console`);
    } catch (e) {
      print({ kind: "err", text: `rejected: ${(e as Error).message}` });
    }
  };

  const parseValue = (raw: string): unknown => {
    const t = raw.trim();
    try {
      return JSON.parse(t);
    } catch {
      return t.replace(/^["']|["']$/g, "");
    }
  };

  const run = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    print({ kind: "sys", text: `orbit@kernel ~ % ${text}` });
    setHist((h) => [text, ...h]);
    setHistIdx(-1);
    const [head, ...rest] = text.split(/\s+/);
    const c = head.toLowerCase();

    if (c === "help") {
      print(
        { kind: "sys", text: "COMMANDS" },
        { kind: "sys", text: "  ls [filter]            list live parameters" },
        { kind: "sys", text: "  get <path>             read a parameter" },
        { kind: "sys", text: "  set <path> <value>     write (ranges, numbers, colors)" },
        { kind: "sys", text: "  push <path> <value>    append (vocab, lines, pools)" },
        { kind: "sys", text: "  log · undo · reset     journal control" },
        { kind: "sys", text: "  export                 download journal for the CLI" },
        { kind: "sys", text: "anything else is parsed as a natural-language patch request" },
      );
      return;
    }
    if (c === "ls" || c === "list") {
      const defs = kernel.list(rest.join(" "));
      if (!defs.length) return print({ kind: "err", text: "no parameters match" });
      defs.slice(0, 40).forEach((d) =>
        print({ kind: "sys", text: `  ${d.path.padEnd(26)} ${d.kind.padEnd(6)} ${fmtVal(d.get())}` }),
      );
      if (defs.length > 40) print({ kind: "sys", text: `  …and ${defs.length - 40} more — narrow with a filter` });
      return;
    }
    if (c === "get" && rest[0]) {
      try {
        print({ kind: "ok", text: `${rest[0]} = ${fmtVal(kernel.get(rest[0]))}` });
      } catch (e) {
        print({ kind: "err", text: (e as Error).message });
      }
      return;
    }
    if ((c === "set" || c === "push") && rest[0]) {
      const path = rest[0];
      const value = parseValue(rest.slice(1).join(" "));
      return applyPlans([{ path, op: c, value }], `${c} ${path} (console)`);
    }
    if (c === "log") {
      if (!journal.length) return print({ kind: "sys", text: "journal is empty — factory state" });
      journal.forEach((e) => print({ kind: "sys", text: `  #${e.id} [${e.source}] ${e.note} (${e.ops.length} op)` }));
      return;
    }
    if (c === "undo") {
      const e = kernel.undoLast();
      if (e) {
        print({ kind: "ok", text: `reverted #${e.id} — ${e.note}` });
        onEvent(`kernel: rollback #${e.id}`);
      } else print({ kind: "err", text: "nothing to undo" });
      return;
    }
    if (c === "reset") {
      kernel.reset();
      print({ kind: "ok", text: "factory kernel restored — journal cleared" });
      onEvent("kernel: factory reset");
      return;
    }
    if (c === "export") {
      const blob = new Blob([kernel.exportJournal()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "orbit-kernel-journal.json";
      a.click();
      URL.revokeObjectURL(a.href);
      print({ kind: "ok", text: "journal exported — feed it to: node cli/orbit-cli.mjs apply <file>" });
      return;
    }

    const plan = planFromText(text);
    if (plan) {
      applyPlans(plan.plans, plan.note);
    } else {
      print({ kind: "err", text: "no plan found — try `help`, or be specific: “more swing on lofi”, “recolor nova teal”" });
    }
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden" style={{ background: "rgba(9,15,18,0.6)" }}>
      <div className="scan-layer pointer-events-none absolute inset-0" />

      {/* header */}
      <div className="relative z-10 flex items-center justify-between border-b border-ink-700/70 px-4 py-2">
        <div className="flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 17V7l8-4 8 4v10l-8 4-8-4z" />
            <path d="M4 7l8 4 8-4M12 11v10" />
          </svg>
          <span className="font-display text-[10px] font-bold tracking-[0.24em] text-mist-100">
            KERNEL <span style={{ color: accent }}>// SELF-MOD</span>
          </span>
          <span className="border border-ink-600 px-1.5 py-px font-mono text-[8px] tracking-[0.14em] text-mist-500">
            {journal.length} PATCH{journal.length === 1 ? "" : "ES"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => run("export")}
            className="border border-ink-600 px-2 py-1 font-mono text-[8px] tracking-[0.14em] text-mist-300 transition-all hover:-translate-y-px hover:border-mist-500"
          >
            EXPORT → CLI
          </button>
          <button
            onClick={() => run("reset")}
            className="border border-ink-600 px-2 py-1 font-mono text-[8px] tracking-[0.14em] text-mist-500 transition-all hover:-translate-y-px hover:border-ember hover:text-ember"
          >
            FACTORY RESET
          </button>
        </div>
      </div>

      {/* journal */}
      <div className="relative z-10 min-h-0 flex-[1.1] space-y-1.5 overflow-y-auto px-3 py-2.5">
        {journal.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="max-w-xs font-mono text-[9px] leading-relaxed tracking-[0.14em] text-mist-600">
              NO MUTATIONS YET — THE AGENT IS RUNNING ON FACTORY DNA.
              ASK IT TO “OPTIMIZE HOUSE TEMPO” OR PATCH BELOW.
            </p>
          </div>
        )}
        {[...journal].reverse().map((e, i) => (
          <DiffBlock key={e.id} entry={e} canUndo={i === 0} onUndo={() => run("undo")} />
        ))}
      </div>

      {/* terminal */}
      <div className="relative z-10 border-t border-ink-700/70 bg-ink-950/80">
        <div ref={termRef} className="h-[104px] overflow-y-auto px-3 py-2 font-mono text-[9.5px] leading-relaxed">
          {lines.map((l, i) => (
            <p
              key={i}
              className={
                l.kind === "err"
                  ? "text-[#ff8a8a]"
                  : l.kind === "add"
                  ? "text-[#9be15d]"
                  : l.kind === "del"
                  ? "text-[#ff8a8a]"
                  : l.kind === "ok"
                  ? "text-mist-100"
                  : "text-mist-500"
              }
            >
              {l.text}
            </p>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(cmd);
            setCmd("");
          }}
          className="flex items-center gap-2 border-t border-ink-700/60 px-3 py-2"
        >
          <span className="font-mono text-[10px] tracking-[0.08em]" style={{ color: accent }}>
            orbit@kernel&nbsp;~&nbsp;%
          </span>
          <input
            ref={inputRef}
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") {
                e.preventDefault();
                const ni = Math.min(histIdx + 1, hist.length - 1);
                if (hist[ni] !== undefined) {
                  setHistIdx(ni);
                  setCmd(hist[ni]);
                }
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                const ni = histIdx - 1;
                setHistIdx(Math.max(-1, ni));
                setCmd(ni >= 0 ? hist[ni] : "");
              }
            }}
            placeholder="make house faster · ls · set persona.accent.ember #FF3B3B"
            className="min-w-0 flex-1 bg-transparent font-mono text-[10px] text-mist-100 placeholder:text-mist-600/60 focus:outline-none"
            style={{ caretColor: accent }}
            spellCheck={false}
          />
        </form>
      </div>
    </div>
  );
}
