import { useState } from "react";
import type { GeneratedImage } from "../lib/imageGen";
import type { SceneObject, ShapeKind } from "../lib/sceneTypes";
import { FORGE_COLORS, SHAPE_KINDS } from "../lib/sceneTypes";

export type DockTab = "studio" | "gallery" | "forge" | "recon";

/* ---------- tab bar ---------- */

export function DockBar({
  tab,
  setTab,
  imageCount,
  objectCount,
  reconCount,
  accent,
}: {
  tab: DockTab;
  setTab: (t: DockTab) => void;
  imageCount: number;
  objectCount: number;
  reconCount?: number;
  accent: string;
}) {
  const tabs: { id: DockTab; label: string; count?: number }[] = [
    { id: "studio", label: "WAVEFORGE" },
    { id: "gallery", label: "GALLERY", count: imageCount },
    { id: "forge", label: "OBJECT FORGE", count: objectCount },
    { id: "recon", label: "RECON", count: reconCount },
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

export function GalleryPanel({
  images,
  busyPrompt,
  pinnedIds,
  onPin,
  onRemove,
  onPrompt,
}: {
  images: GeneratedImage[];
  busyPrompt: string | null;
  pinnedIds: string[];
  onPin: (img: GeneratedImage) => void;
  onRemove: (id: string) => void;
  onPrompt: (p: string) => void;
}) {
  if (!images.length && !busyPrompt) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#66868a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.5-3.5a2 2 0 0 0-2.8 0L6 20" />
        </svg>
        <p className="max-w-sm font-mono text-[10px] leading-relaxed tracking-[0.12em] text-mist-500">
          THE GALLERY IS EMPTY — TELL A CORE TO “DRAW” SOMETHING
        </p>
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
    <div className="flex h-full gap-2 overflow-x-auto p-2.5">
      {busyPrompt && (
        <div className="img-shimmer relative aspect-[8/5] w-44 shrink-0 overflow-hidden border border-ink-600">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-mist-500 border-t-transparent" />
            <p className="w-full truncate text-center font-mono text-[8px] tracking-[0.14em] text-mist-500">
              RENDERING · {busyPrompt.toUpperCase()}
            </p>
          </div>
        </div>
      )}
      {images.map((img) => {
        const pinned = pinnedIds.includes(img.id);
        return (
          <div
            key={img.id}
            className="group relative aspect-[8/5] w-44 shrink-0 overflow-hidden border border-ink-600 transition-colors hover:border-mist-500"
            title={img.prompt}
          >
            <img src={img.src} alt={img.prompt} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
            <span
              className="absolute left-1 top-1 px-1 font-mono text-[7px] tracking-[0.16em]"
              style={{ background: "rgba(11,19,23,0.75)", color: img.method === "ai" ? "#9be15d" : "#f5b94b" }}
            >
              {img.method === "ai" ? "NEURAL" : "PROCEDURAL"}
            </span>
            <div className="absolute inset-x-0 bottom-0 flex translate-y-full items-center gap-1 bg-ink-950/90 p-1 transition-transform duration-200 group-hover:translate-y-0">
              <button
                onClick={() => onPin(img)}
                disabled={pinned}
                className="flex-1 border border-ink-600 px-1 py-0.5 font-mono text-[8px] tracking-[0.1em] text-mist-300 transition-colors hover:border-nova hover:text-nova disabled:opacity-40"
              >
                {pinned ? "PINNED" : "PIN TO 3D"}
              </button>
              <a
                href={img.src}
                download={`orbit-${img.seed}.png`}
                target="_blank"
                rel="noreferrer"
                className="border border-ink-600 px-1.5 py-0.5 font-mono text-[8px] text-mist-300 transition-colors hover:border-mist-500 hover:text-mist-100"
              >
                SAVE
              </a>
              <button
                onClick={() => onRemove(img.id)}
                className="border border-ink-600 px-1.5 py-0.5 font-mono text-[8px] text-mist-500 transition-colors hover:border-ember hover:text-ember"
                aria-label="Remove image"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
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
}: {
  objects: SceneObject[];
  onSpawn: (shape: ShapeKind, color: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  accent: string;
}) {
  const [color, setColor] = useState(FORGE_COLORS[0]);
  return (
    <div className="flex h-full gap-4 p-2.5">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[8px] tracking-[0.22em] text-mist-500">MATERIAL</span>
        <div className="flex flex-wrap gap-1.5" style={{ maxWidth: 150 }}>
          {FORGE_COLORS.map((c) => (
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
