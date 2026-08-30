import { useState } from "react";
import { useRef } from "react";
import { useEffect } from "react";
import type { GeneratedImage } from "../lib/imageGen";
import type { SceneObject, ShapeKind } from "../lib/sceneTypes";
import { FORGE_COLORS, SHAPE_KINDS } from "../lib/sceneTypes";
import { PROFILES, auditConsole, auditScore } from "../lib/taste";
import type { TasteProfile } from "../lib/taste";

export type DockTab = "studio" | "gallery" | "forge" | "recon" | "kernel" | "taste";

/* ---------- tab bar ---------- */

export function DockBar({
  tab,
  setTab,
  imageCount,
  objectCount,
  reconCount,
  kernelCount,
  accent,
}: {
  tab: DockTab;
  setTab: (t: DockTab) => void;
  imageCount: number;
  objectCount: number;
  reconCount?: number;
  kernelCount?: number;
  accent: string;
}) {
  const tabs: { id: DockTab; label: string; count?: number }[] = [
    { id: "studio", label: "WAVEFORGE" },
    { id: "gallery", label: "GALLERY", count: imageCount },
    { id: "forge", label: "OBJECT FORGE", count: objectCount },
    { id: "recon", label: "RECON", count: reconCount },
    { id: "kernel", label: "KERNEL", count: kernelCount },
    { id: "taste", label: "TASTE SKILL" },
  ];
  return (
    <div className="flex items-end gap-1 border-b border-ink-700/70 bg-ink-900/80 px-2 pt-1.5">
      {tabs.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="group relative flex items-center gap-1.5 px-3 py-2 font-mono text-[10px] tracking-[0.2em] transition-colors"
            style={{ color: active ? accent : "#8cacac" }}
          >
            {t.label}
            {typeof t.count === "number" && t.count > 0 && (
              <span
                className="rounded-sm px-1 font-mono text-[9px]"
                style={{ background: active ? `${accent}22` : "#182b34", color: active ? accent : "#8cacac" }}
              >
                {t.count}
              </span>
            )}
            <span
              className="absolute inset-x-2 bottom-0 h-[2px] transition-all duration-300"
              style={{
                background: active ? accent : "transparent",
                boxShadow: active ? `0 0 8px ${accent}` : "none",
                transform: active ? "scaleX(1)" : "scaleX(0.3)",
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

/* ---------- gallery ---------- */

const PROMPT_IDEAS = ["a neon fox in the rain", "an orbital greenhouse at dusk", "a whale made of stained glass"];

const UploadIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 16V4m0 0 4 4m-4-4-4 4" />
    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);

const badgeFor = (img: GeneratedImage): { label: string; color: string } => {
  if (img.method === "upload") return { label: img.kind === "video" ? "VIDEO · LOCAL" : "LOCAL FILE", color: "#54d8ff" };
  if (img.method === "ai") return { label: "NEURAL", color: "#9be15d" };
  return { label: "PROCEDURAL", color: "#f5b94b" };
};

export function GalleryPanel({
  images,
  busyPrompt,
  pinnedIds,
  onPin,
  onRemove,
  onPrompt,
  onImport,
  accent,
}: {
  images: GeneratedImage[];
  busyPrompt: string | null;
  pinnedIds: string[];
  onPin: (img: GeneratedImage) => void;
  onRemove: (id: string) => void;
  onPrompt: (p: string) => void;
  onImport: (files: FileList) => void;
  accent: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const importControl = (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onImport(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[9px] tracking-[0.16em] transition-all hover:-translate-y-px"
        style={{ borderColor: `${accent}77`, color: accent, background: `${accent}14` }}
      >
        <UploadIcon />
        IMPORT FILES
      </button>
    </>
  );

  if (!images.length && !busyPrompt) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#66868a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.5-3.5a2 2 0 0 0-2.8 0L6 20" />
        </svg>
        <p className="max-w-md font-mono text-[10px] leading-relaxed tracking-[0.12em] text-mist-500">
          EMPTY — TELL A CORE TO “DRAW” SOMETHING, IMPORT FILES, OR DROP IMAGES / VIDEOS ANYWHERE ON THE STAGE
        </p>
        <div className="flex items-center gap-2">
          {importControl}
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {PROMPT_IDEAS.map((p) => (
            <button
              key={p}
              onClick={() => onPrompt(p)}
              className="border border-ink-600 px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-mist-300 transition-all hover:-translate-y-0.5 hover:border-mist-500 hover:text-mist-100"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-ink-700/60 px-2.5 py-1.5">
        {importControl}
        <span className="font-mono text-[8px] tracking-[0.14em] text-mist-600">
          {images.length} ITEM{images.length === 1 ? "" : "S"} · PINNED CARDS ARE DRAGGABLE — BY CURSOR OR BY HAND
        </span>
      </div>
      <div className="flex min-h-0 flex-1 gap-2 overflow-x-auto p-2.5">
        {busyPrompt && (
          <div className="img-shimmer relative flex h-full w-52 shrink-0 flex-col overflow-hidden border border-ink-600">
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-mist-500 border-t-transparent" />
              <p className="w-full truncate text-center font-mono text-[8px] tracking-[0.14em] text-mist-500">
                RENDERING · {busyPrompt.toUpperCase()}
              </p>
            </div>
          </div>
        )}
        {images.map((img) => {
          const isPinned = pinnedIds.includes(img.id);
          const badge = badgeFor(img);
          return (
            <div
              key={img.id}
              className="group flex h-full w-52 shrink-0 flex-col overflow-hidden border border-ink-600 bg-ink-850/60 transition-all hover:-translate-y-0.5 hover:border-mist-500"
              title={img.prompt}
            >
              <div className="relative min-h-0 flex-1 overflow-hidden bg-ink-950">
                {img.kind === "video" ? (
                  <video src={img.src} muted loop autoPlay playsInline className="h-full w-full object-cover" />
                ) : (
                  <img src={img.src} alt={img.prompt} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                )}
                <span
                  className="absolute left-1 top-1 px-1 py-0.5 font-mono text-[7px] tracking-[0.14em]"
                  style={{ background: "rgba(11,19,23,0.8)", color: badge.color }}
                >
                  {badge.label}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1 border-t border-ink-700/60 p-1">
                <button
                  onClick={() => onPin(img)}
                  disabled={isPinned}
                  className="flex-1 border border-ink-600 px-1 py-1 font-mono text-[8px] tracking-[0.1em] text-mist-300 transition-colors hover:border-nova hover:text-nova disabled:opacity-40"
                >
                  {isPinned ? "IN SCENE ✓" : "PIN TO 3D"}
                </button>
                <a
                  href={img.src}
                  download={img.method === "upload" ? img.prompt : `orbit-${img.seed}.png`}
                  target="_blank"
                  rel="noreferrer"
                  className="border border-ink-600 px-1.5 py-1 font-mono text-[8px] text-mist-300 transition-colors hover:border-mist-500 hover:text-mist-100"
                  title="Download"
                >
                  SAVE
                </a>
                <button
                  onClick={() => onRemove(img.id)}
                  className="border border-ink-600 px-1.5 py-1 font-mono text-[8px] text-mist-500 transition-colors hover:border-ember hover:text-ember"
                  aria-label="Remove item"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- object forge ---------- */

const ShapeIcon = ({ kind }: { kind: ShapeKind }) => {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.7 } as const;
  switch (kind) {
    case "cube":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" {...s} strokeLinejoin="round" aria-hidden>
          <path d="M12 2 21 7v10l-9 5-9-5V7l9-5z" />
          <path d="M12 12 21 7M12 12v10M12 12 3 7" />
        </svg>
      );
    case "sphere":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" {...s} aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <ellipse cx="12" cy="12" rx="9" ry="3.6" />
        </svg>
      );
    case "torus":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" {...s} aria-hidden>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="3.4" />
        </svg>
      );
    case "cone":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" {...s} strokeLinejoin="round" aria-hidden>
          <path d="M12 3 20 19H4L12 3z" />
          <ellipse cx="12" cy="19" rx="8" ry="2.4" />
        </svg>
      );
    case "cylinder":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" {...s} aria-hidden>
          <ellipse cx="12" cy="5.5" rx="7" ry="2.8" />
          <path d="M5 5.5v13c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-13" />
        </svg>
      );
    case "gem":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" {...s} strokeLinejoin="round" aria-hidden>
          <path d="M12 2 22 12 12 22 2 12 12 2z" />
          <path d="M2 12h20M12 2v20" opacity="0.5" />
        </svg>
      );
    case "knot":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" {...s} strokeLinecap="round" aria-hidden>
          <path d="M8 12c0-3 2-5 4-5s4 2 4 5-2 5-4 5-4-2-4-5z" transform="rotate(45 12 12)" />
          <path d="M8 12c0-3 2-5 4-5s4 2 4 5-2 5-4 5-4-2-4-5z" transform="rotate(-45 12 12)" />
        </svg>
      );
  }
};

export function ObjectForge({
  objects,
  onSpawn,
  onRemove,
  onClear,
  accent,
  palette,
}: {
  objects: SceneObject[];
  onSpawn: (shape: ShapeKind, color: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  accent: string;
  palette?: string[];
}) {
  const swatches = palette && palette.length ? palette : FORGE_COLORS;
  const [color, setColor] = useState(swatches[0]);
  useEffect(() => {
    if (!swatches.includes(color)) setColor(swatches[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette]);
  return (
    <div className="flex h-full gap-4 p-2.5">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[8px] tracking-[0.22em] text-mist-500">MATERIAL</span>
        <div className="flex flex-wrap gap-1.5" style={{ maxWidth: 150 }}>
          {swatches.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Use color ${c}`}
              className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                background: c,
                borderColor: color === c ? "#eaf4f3" : "transparent",
                boxShadow: color === c ? `0 0 8px ${c}` : "none",
              }}
            />
          ))}
        </div>
        <button
          onClick={onClear}
          disabled={!objects.length}
          className="mt-auto border border-ink-600 px-2 py-1 font-mono text-[9px] tracking-[0.14em] text-mist-500 transition-colors hover:border-ember hover:text-ember disabled:opacity-30"
        >
          CLEAR FIELD ({objects.length})
        </button>
      </div>

      <div className="h-full w-px bg-ink-700/70" />

      <div className="flex flex-1 flex-col gap-1.5 overflow-hidden">
        <span className="font-mono text-[8px] tracking-[0.22em] text-mist-500">
          FORGE A PRIMITIVE — <span style={{ color: accent }}>CLICK TO DEPLOY</span>
        </span>
        <div className="grid flex-1 grid-cols-7 content-start gap-1.5">
          {SHAPE_KINDS.map((k) => (
            <button
              key={k}
              onClick={() => onSpawn(k, color)}
              className="group flex flex-col items-center justify-center gap-1 border border-ink-600 bg-ink-850/60 px-1 py-2 transition-all hover:-translate-y-0.5"
              style={{ borderColor: "#213843" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = accent;
                e.currentTarget.style.color = accent;
                e.currentTarget.style.boxShadow = `0 4px 18px -6px ${accent}88`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#213843";
                e.currentTarget.style.color = "";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <ShapeIcon kind={k} />
              <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-mist-500 group-hover:text-inherit">
                {k}
              </span>
            </button>
          ))}
        </div>
        {objects.length > 0 && (
          <div className="flex flex-wrap gap-1 overflow-hidden">
            {objects.slice(-8).map((o) => (
              <span
                key={o.id}
                className="flex items-center gap-1 border border-ink-600 px-1.5 py-0.5 font-mono text-[8px] tracking-[0.1em] text-mist-300"
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: o.color }} />
                {o.shape.toUpperCase()}
                <button onClick={() => onRemove(o.id)} className="text-mist-600 transition-colors hover:text-ember" aria-label={`Remove ${o.shape}`}>
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- taste skill ---------- */

export function TastePanel({
  profile,
  accent,
  onApply,
  onEvent,
}: {
  profile: TasteProfile;
  accent: string;
  onApply: (id: string) => void;
  onEvent: (msg: string) => void;
}) {
  const [checks, setChecks] = useState(() => auditConsole(profile));
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setChecks(auditConsole(profile));
  }, [profile]);

  const runAudit = () => {
    setChecks(auditConsole(profile));
    setFlash(true);
    window.setTimeout(() => setFlash(false), 900);
    onEvent(`taste: audit run — ${auditScore(auditConsole(profile))} locks held`);
  };

  return (
    <div className="flex h-full min-h-0">
      {/* profile rail */}
      <aside className="flex w-44 shrink-0 flex-col gap-1 overflow-y-auto border-r border-ink-700/70 bg-ink-900/60 p-1.5">
        <span className="px-1 pb-1 font-mono text-[7.5px] tracking-[0.24em] text-mist-600">DESIGN DIRECTIONS</span>
        {PROFILES.map((p) => {
          const active = p.id === profile.id;
          return (
            <button
              key={p.id}
              onClick={() => onApply(p.id)}
              className="group border px-2 py-1.5 text-left transition-all hover:-translate-y-px"
              style={{
                borderColor: active ? p.accent : "#1c313b",
                background: active ? `${p.accent}14` : "transparent",
                boxShadow: active ? `0 0 18px -8px ${p.accent}` : "none",
              }}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-display text-[9px] font-bold tracking-[0.14em]" style={{ color: active ? p.accent : "#c2d8d6" }}>
                  {p.name}
                </span>
                {active && (
                  <span className="px-1 font-mono text-[6.5px] tracking-[0.16em]" style={{ background: `${p.accent}22`, color: p.accent }}>
                    ACTIVE
                  </span>
                )}
              </div>
              <div className="mt-1 flex gap-[2px]">
                {p.palette.map((c) => (
                  <span key={c} className="h-1.5 flex-1" style={{ background: c }} />
                ))}
              </div>
              <p className="mt-1 line-clamp-2 font-mono text-[7px] leading-snug tracking-[0.06em] text-mist-600 group-hover:text-mist-500">
                {p.brief}
              </p>
            </button>
          );
        })}
      </aside>

      {/* doctrine */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-700/70 bg-ink-900/70 px-3 py-2">
          <div className="min-w-0">
            <p className="font-display text-[13px] font-extrabold tracking-[0.12em] text-mist-100">
              {profile.name} <span style={{ color: profile.accent }}>— ANTI-SLOP DOCTRINE</span>
            </p>
            <p className="truncate font-mono text-[8px] tracking-[0.14em] text-mist-600">{profile.brief.toUpperCase()}</p>
          </div>
          <span
            className="shrink-0 border px-2 py-1 font-mono text-[8px] tracking-[0.18em]"
            style={{ borderColor: `${profile.accent}66`, color: profile.accent, background: `${profile.accent}10` }}
          >
            APPLIES TO · IMAGES · 3D · UI
          </span>
        </div>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-2.5">
          {/* locks + bans */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="border border-ink-700/60 bg-ink-900/40">
              <p className="border-b border-ink-700/60 px-2 py-1 font-mono text-[7.5px] tracking-[0.24em] text-lyra">◈ LOCKS — ALWAYS</p>
              <ul className="space-y-1 p-2">
                {profile.locks.map((l) => (
                  <li key={l} className="flex gap-1.5 font-mono text-[8px] leading-snug tracking-[0.04em] text-mist-300">
                    <span className="mt-px shrink-0 text-lyra">✓</span>
                    {l}
                  </li>
                ))}
              </ul>
            </div>
            <div className="border border-ink-700/60 bg-ink-900/40">
              <p className="border-b border-ink-700/60 px-2 py-1 font-mono text-[7.5px] tracking-[0.24em] text-ember">⊘ BANS — NEVER</p>
              <ul className="space-y-1 p-2">
                {profile.bans.map((b) => (
                  <li key={b} className="flex gap-1.5 font-mono text-[8px] leading-snug tracking-[0.04em] text-mist-300">
                    <span className="mt-px shrink-0 text-ember">✕</span>
                    <b className="font-normal line-through decoration-ember/50">{b}</b>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* live directive */}
          <div className="border border-ink-700/60 bg-ink-900/40">
            <p className="flex items-center justify-between border-b border-ink-700/60 px-2 py-1 font-mono text-[7.5px] tracking-[0.24em]" style={{ color: profile.accent }}>
              IMAGE DIRECTIVE — APPENDED TO EVERY PROMPT THE AGENT RENDERS
              <span className="blink">▍</span>
            </p>
            <p className="border-l-2 px-2.5 py-1.5 font-mono text-[8.5px] leading-relaxed tracking-[0.04em] text-mist-300" style={{ borderColor: profile.accent }}>
              {profile.imageDirective}
            </p>
          </div>

          {/* three + type + motion */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="border border-ink-700/60 bg-ink-900/40 p-2">
              <p className="font-mono text-[7px] tracking-[0.22em] text-mist-600">3D DOCTRINE · {profile.three.finish.toUpperCase()}</p>
              <p className="mt-1 font-mono text-[8px] leading-snug text-mist-300">{profile.three.geometry}</p>
              <p className="mt-0.5 font-mono text-[8px] leading-snug text-mist-500">{profile.three.material}</p>
            </div>
            <div className="border border-ink-700/60 bg-ink-900/40 p-2">
              <p className="font-mono text-[7px] tracking-[0.22em] text-mist-600">TYPE PAIR</p>
              <p className="mt-1 font-mono text-[8px] leading-snug text-mist-300">{profile.typePair}</p>
            </div>
            <div className="border border-ink-700/60 bg-ink-900/40 p-2">
              <p className="font-mono text-[7px] tracking-[0.22em] text-mist-600">MOTION</p>
              <p className="mt-1 font-mono text-[8px] leading-snug text-mist-300">{profile.motion}</p>
            </div>
          </div>

          {/* audit */}
          <div className={`border bg-ink-900/40 transition-shadow duration-500 ${flash ? "" : "border-ink-700/60"}`} style={flash ? { borderColor: profile.accent, boxShadow: `0 0 24px -8px ${profile.accent}` } : undefined}>
            <p className="flex items-center justify-between border-b border-ink-700/60 px-2 py-1">
              <span className="font-mono text-[7.5px] tracking-[0.24em] text-mist-300">CONSOLE SELF-AUDIT — {profile.name}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-[9px] font-bold tracking-[0.14em]" style={{ color: profile.accent }}>
                  {auditScore(checks)} LOCKS HELD
                </span>
                <button
                  onClick={runAudit}
                  className="border px-2 py-0.5 font-mono text-[7.5px] tracking-[0.18em] transition-all hover:-translate-y-px"
                  style={{ borderColor: `${profile.accent}66`, color: profile.accent }}
                >
                  RE-RUN ▸
                </button>
              </span>
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 p-2">
              {checks.map((c) => (
                <div key={c.name} className="flex items-start gap-1.5">
                  <span
                    className="mt-px shrink-0 px-1 font-mono text-[6.5px] tracking-[0.14em]"
                    style={{ background: c.pass ? "rgba(155,225,93,0.12)" : "rgba(245,185,75,0.14)", color: c.pass ? "#9be15d" : "#f5b94b" }}
                  >
                    {c.pass ? "PASS" : "WARN"}
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-[7.5px] tracking-[0.1em] text-mist-300">{c.name}</p>
                    <p className="truncate font-mono text-[6.5px] tracking-[0.06em] text-mist-600" title={c.note}>{c.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
