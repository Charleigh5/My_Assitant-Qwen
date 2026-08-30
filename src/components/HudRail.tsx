/**
 * HUD RAIL — the console's icon rail + flyout module system.
 * The assistant owns the full viewport; every module lives behind an
 * icon. One flyout at a time; backdrop click or ESC closes it.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export type FlyoutId =
  | "chat"
  | "studio"
  | "gallery"
  | "forge"
  | "recon"
  | "kernel"
  | "taste"
  | "log";

/* ---------- inline icon set ---------- */

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const RailIcon = ({ id, size = 18 }: { id: FlyoutId | "hands" | "mic" | "voice" | "eye" | "broadcast" | "close"; size?: number }) => {
  switch (id) {
    case "chat":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...S} aria-hidden>
          <path d="M21 12a8 8 0 0 1-8 8H4l2.3-2.9A8 8 0 1 1 21 12z" />
          <path d="M8.5 10.5h7M8.5 13.5h4.5" />
        </svg>
      );
    case "studio":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...S} aria-hidden>
          <path d="M3 12h2l2-6 3 12 3-9 2 4.5L17 12h4" />
        </svg>
      );
    case "gallery":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...S} aria-hidden>
          <rect x="3" y="4" width="18" height="16" rx="1.5" />
          <circle cx="9" cy="10" r="1.8" />
          <path d="m21 16-4.2-4.2a1.6 1.6 0 0 0-2.3 0L7 19" />
        </svg>
      );
    case "forge":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...S} aria-hidden>
          <path d="M12 2.5 21 7.5v9L12 21.5l-9-5v-9l9-5z" />
          <path d="M12 12 21 7.5M12 12v9.5M12 12 3 7.5" />
        </svg>
      );
    case "recon":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...S} aria-hidden>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      );
    case "kernel":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...S} aria-hidden>
          <rect x="7" y="7" width="10" height="10" rx="1" />
          <path d="M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4" />
        </svg>
      );
    case "taste":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...S} aria-hidden>
          <path d="M12 3c5 0 9 3.6 9 8.2 0 3-2.4 4.8-5 4.8h-1.6c-1 0-1.5.7-1.2 1.6.4 1.2-.3 2.4-1.7 2.4C6 20 3 16 3 11.2 3 6.6 7 3 12 3z" />
          <circle cx="8.2" cy="10" r="1.1" />
          <circle cx="12.4" cy="7.6" r="1.1" />
          <circle cx="16.4" cy="10.4" r="1.1" />
        </svg>
      );
    case "log":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...S} aria-hidden>
          <path d="M4 5h16M4 9.5h11M4 14h16M4 18.5h8" />
        </svg>
      );
    case "hands":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...S} aria-hidden>
          <path d="M18 11V6.5a1.5 1.5 0 0 0-3 0V11" />
          <path d="M15 10.5V4.8a1.5 1.5 0 0 0-3 0V10" />
          <path d="M12 10V3.5a1.5 1.5 0 0 0-3 0V11" />
          <path d="M9 11.5v-1a1.5 1.5 0 0 0-3 0V15a7 7 0 0 0 14 0v-4a1.5 1.5 0 0 0-3 0" />
        </svg>
      );
    case "mic":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...S} aria-hidden>
          <rect x="9" y="2.5" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" />
        </svg>
      );
    case "voice":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...S} aria-hidden>
          <path d="M11 5 6 9H2.5v6H6l5 4V5z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9.5 9.5 0 0 1 0 13" />
        </svg>
      );
    case "eye":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...S} aria-hidden>
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "broadcast":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...S} aria-hidden>
          <circle cx="12" cy="12" r="2.2" />
          <path d="M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 19a10 10 0 0 1 0-14M19 5a10 10 0 0 1 0 14" />
        </svg>
      );
    case "close":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...S} aria-hidden>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      );
  }
};

/* ---------- flyout titles ---------- */

const TITLES: Record<FlyoutId, string> = {
  chat: "COMMS CHANNEL",
  studio: "WAVEFORGE · MUSIC STUDIO",
  gallery: "SYNTHESIS GALLERY",
  forge: "OBJECT FORGE",
  recon: "RECON BOARDS",
  kernel: "KERNEL · SELF-MOD CONSOLE",
  taste: "TASTE SKILL · DOCTRINE",
  log: "EVENT LOG",
};

const WIDTHS: Record<FlyoutId, string> = {
  chat: "w-[400px]",
  studio: "w-[540px]",
  gallery: "w-[480px]",
  forge: "w-[470px]",
  recon: "w-[560px]",
  kernel: "w-[500px]",
  taste: "w-[520px]",
  log: "w-[380px]",
};

/* ---------- ticking UTC clock ---------- */

export function UtcClock({ accent }: { accent: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const iv = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(iv);
  }, []);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="font-mono text-[9px] tracking-[0.18em] text-mist-500">
      {p(now.getUTCHours())}:{p(now.getUTCMinutes())}
      <span className="blink" style={{ color: accent }}>:</span>
      {p(now.getUTCSeconds())} <span className="text-mist-600">UTC</span>
    </span>
  );
}

/* ---------- rail ---------- */

interface RailItem {
  id: FlyoutId;
  label: string;
  badge?: number;
  pulse?: boolean;
}

interface ToggleItem {
  id: "hands" | "mic" | "voice" | "broadcast" | "eye";
  label: string;
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export default function HudRail({
  flyout,
  setFlyout,
  accent,
  items,
  toggles,
  children,
}: {
  flyout: FlyoutId | null;
  setFlyout: (f: FlyoutId | null) => void;
  accent: string;
  items: RailItem[];
  toggles: ToggleItem[];
  children: ReactNode;
}) {
  /* ESC closes */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFlyout(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setFlyout]);

  const open = flyout !== null;

  return (
    <>
      {/* click-away backdrop */}
      <div
        className={`absolute inset-0 z-[55] transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        style={{ background: "rgba(8,14,17,0.28)" }}
        onPointerDown={() => setFlyout(null)}
        aria-hidden
      />

      {/* icon rail */}
      <div className="absolute right-3 top-1/2 z-[60] flex -translate-y-1/2 flex-col items-center gap-1">
        <div className="flex flex-col gap-1 border border-ink-700/70 bg-ink-900/85 p-1 backdrop-blur-md" style={{ boxShadow: "0 18px 44px -18px rgba(0,0,0,0.8)" }}>
          {items.map((it, i) => {
            const active = flyout === it.id;
            return (
              <div key={it.id} className="relative">
                {(i === 1 || i === items.length - 1) && <div className="mx-1 mb-1 mt-0.5 h-px bg-ink-700/80" />}
                <button
                  onClick={() => setFlyout(active ? null : it.id)}
                  aria-label={it.label}
                  title={it.label}
                  className={`group relative flex h-9 w-9 items-center justify-center border transition-all duration-150 ${it.pulse && !active ? "pulse-dot" : ""}`}
                  style={{
                    borderColor: active ? accent : "transparent",
                    color: active ? accent : "#8cacac",
                    background: active ? `color-mix(in srgb, ${accent} 12%, transparent)` : "transparent",
                    boxShadow: active ? `0 0 16px -4px ${accent}` : "none",
                  }}
                >
                  <RailIcon id={it.id} />
                  {typeof it.badge === "number" && it.badge > 0 && !active && (
                    <span
                      className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 font-mono text-[7px] font-bold text-ink-950"
                      style={{ background: accent }}
                    >
                      {it.badge > 9 ? "9+" : it.badge}
                    </span>
                  )}
                  {/* active notch */}
                  <span
                    className="absolute -right-[5px] top-1/2 h-4 w-[3px] -translate-y-1/2 transition-opacity"
                    style={{ background: accent, opacity: active ? 1 : 0, boxShadow: `0 0 8px ${accent}` }}
                  />
                  {/* hover tooltip */}
                  <span
                    className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap border border-ink-700 bg-ink-950/95 px-2 py-1 font-mono text-[8px] tracking-[0.18em] text-mist-300 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  >
                    {it.label.toUpperCase()}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-1 flex flex-col gap-1 border border-ink-700/70 bg-ink-900/85 p-1 backdrop-blur-md" style={{ boxShadow: "0 18px 44px -18px rgba(0,0,0,0.8)" }}>
          {toggles.map((t) => (
            <div key={t.id} className="relative group">
              <button
                onClick={t.onClick}
                disabled={t.disabled}
                aria-label={t.label}
                className={`flex h-9 w-9 items-center justify-center border transition-all duration-150 disabled:opacity-30 ${t.on && t.id !== "eye" ? "pulse-dot" : ""}`}
                style={{
                  borderColor: t.on ? accent : "transparent",
                  color: t.on ? accent : "#8cacac",
                  background: t.on ? `color-mix(in srgb, ${accent} 12%, transparent)` : "transparent",
                }}
              >
                <RailIcon id={t.id} />
              </button>
              <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap border border-ink-700 bg-ink-950/95 px-2 py-1 font-mono text-[8px] tracking-[0.18em] text-mist-300 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                {t.label.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* flyout panel */}
      {open && (
        <div
          key={flyout}
          className="flyout-in absolute right-[64px] top-1/2 z-[60] flex max-h-[86vh] -translate-y-1/2 flex-col border bg-ink-900/95 backdrop-blur-md"
          style={{
            borderColor: `color-mix(in srgb, ${accent} 45%, #213843)`,
            boxShadow: `0 30px 80px -30px rgba(0,0,0,0.9), 0 0 40px -18px ${accent}`,
          }}
        >
          {/* header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-700/70 px-3.5 py-2.5" style={{ background: `color-mix(in srgb, ${accent} 6%, transparent)` }}>
            <div className="flex items-center gap-2">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
              <h2 className="font-display text-[10px] font-bold tracking-[0.24em] text-mist-100">{TITLES[flyout]}</h2>
            </div>
            <button
              onClick={() => setFlyout(null)}
              aria-label="Close panel"
              className="border border-transparent p-1 text-mist-500 transition-colors hover:text-mist-100"
              style={{ borderRadius: 2 }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = accent)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
            >
              <RailIcon id="close" size={13} />
            </button>
          </div>

          {/* body */}
          <div className={`flyout-body min-h-0 flex-1 overflow-hidden ${WIDTHS[flyout]}`}>{children}</div>

          {/* footer rule */}
          <div className="flex shrink-0 items-center justify-between border-t border-ink-700/70 px-3.5 py-1.5">
            <span className="font-mono text-[7px] tracking-[0.2em] text-mist-600">CLICK OUTSIDE OR ESC TO CLOSE</span>
            <span className="font-mono text-[7px] tracking-[0.2em]" style={{ color: accent }}>
              ORBIT·OS
            </span>
          </div>
        </div>
      )}
    </>
  );
}
