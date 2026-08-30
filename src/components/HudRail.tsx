/**
 * HUD RAIL — icon rail + flyout modules (desktop) and bottom tab bar +
 * bottom sheets (mobile). One module open at a time; backdrop, ESC,
 * swipe-down, or the close control dismisses it.
 */
import { useEffect, useRef, useState } from "react";
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

const MOBILE_PRIMARY: FlyoutId[] = ["chat", "studio", "forge", "gallery"];

/* ---------- inline icon set ---------- */

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const RailIcon = ({ id, size = 18 }: { id: FlyoutId | "hands" | "mic" | "voice" | "eye" | "broadcast" | "close" | "more"; size?: number }) => {
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
    case "more":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...S} aria-hidden>
          <circle cx="5" cy="12" r="1.4" fill="currentColor" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" />
          <circle cx="19" cy="12" r="1.4" fill="currentColor" />
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

/* ---------- flyout titles + widths ---------- */

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

/* ---------- breakpoint + keyboard hooks ---------- */

function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const fn = () => setMobile(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return mobile;
}

/** extra inset when the on-screen keyboard is open (mobile) */
function useKeyboardInset(enabled: boolean) {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    if (!enabled || !window.visualViewport) return;
    const vv = window.visualViewport;
    const fn = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    fn();
    vv.addEventListener("resize", fn);
    return () => vv.removeEventListener("resize", fn);
  }, [enabled]);
  return inset;
}

/* ---------- items ---------- */

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

function MiniSwitch({ on, accent }: { on: boolean; accent: string }) {
  return (
    <span
      className="relative inline-block h-[18px] w-[34px] shrink-0 rounded-full border transition-colors duration-300"
      style={{ background: on ? `color-mix(in srgb, ${accent} 28%, transparent)` : "#13222a", borderColor: on ? accent : "#2f4c59" }}
    >
      <span
        className="absolute top-[2.5px] h-[11px] w-[11px] rounded-full transition-all duration-300"
        style={{ left: on ? 18 : 3, background: on ? accent : "#66868a", boxShadow: on ? `0 0 8px ${accent}` : "none" }}
      />
    </span>
  );
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
  const isMobile = useIsMobile();
  const kbInset = useKeyboardInset(isMobile);
  const [moreOpen, setMoreOpen] = useState(false);
  const dragY = useRef(0);
  const dragStart = useRef<number | null>(null);
  const [dragging, setDragging] = useState(0);

  /* ESC closes everything */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFlyout(null);
        setMoreOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setFlyout]);

  useEffect(() => setMoreOpen(false), [flyout]);

  const open = flyout !== null;
  const primary = items.filter((i) => MOBILE_PRIMARY.includes(i.id));
  const secondary = items.filter((i) => !MOBILE_PRIMARY.includes(i.id));
  const moreBadge = secondary.reduce((n, i) => n + (i.badge ?? 0), 0);

  const close = () => {
    setFlyout(null);
    setMoreOpen(false);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    dragStart.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (dragStart.current == null) return;
    dragY.current = Math.max(0, e.touches[0].clientY - dragStart.current);
    setDragging(dragY.current);
  };
  const onTouchEnd = () => {
    if (dragY.current > 90) close();
    dragY.current = 0;
    dragStart.current = null;
    setDragging(0);
  };

  const borderColor = `color-mix(in srgb, ${accent} 45%, #213843)`;

  return (
    <>
      {/* click-away backdrop */}
      <div
        className={`absolute inset-0 z-[55] transition-opacity duration-200 ${open || moreOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        style={{ background: "rgba(8,14,17,0.32)" }}
        onPointerDown={close}
        aria-hidden
      />

      {/* ============ DESKTOP · icon rail ============ */}
      <div className="absolute right-3 top-1/2 z-[60] hidden -translate-y-1/2 flex-col items-center gap-1 lg:flex">
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
                    <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 font-mono text-[7px] font-bold text-ink-950" style={{ background: accent }}>
                      {it.badge > 9 ? "9+" : it.badge}
                    </span>
                  )}
                  <span className="absolute -right-[5px] top-1/2 h-4 w-[3px] -translate-y-1/2 transition-opacity" style={{ background: accent, opacity: active ? 1 : 0, boxShadow: `0 0 8px ${accent}` }} />
                  <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap border border-ink-700 bg-ink-950/95 px-2 py-1 font-mono text-[8px] tracking-[0.18em] text-mist-300 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    {it.label.toUpperCase()}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-1 flex flex-col gap-1 border border-ink-700/70 bg-ink-900/85 p-1 backdrop-blur-md" style={{ boxShadow: "0 18px 44px -18px rgba(0,0,0,0.8)" }}>
          {toggles.map((t) => (
            <div key={t.id} className="group relative">
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

      {/* ============ MOBILE · bottom tab bar ============ */}
      <nav
        className="absolute inset-x-0 bottom-0 z-[58] grid grid-cols-5 border-t border-ink-700/70 bg-ink-900/92 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary modules"
      >
        {primary.map((it) => {
          const active = flyout === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setFlyout(active ? null : it.id)}
              className={`relative flex flex-col items-center gap-1 pb-2 pt-2.5 transition-colors ${it.pulse && !active ? "pulse-dot" : ""}`}
              style={{ color: active ? accent : "#8cacac" }}
            >
              <span
                className="absolute inset-x-4 top-0 h-[2px] transition-all duration-300"
                style={{ background: active ? accent : "transparent", boxShadow: active ? `0 0 10px ${accent}` : "none" }}
              />
              <RailIcon id={it.id} size={19} />
              <span className="font-mono text-[7px] font-bold tracking-[0.16em]">{TITLES[it.id].split(" ")[0]}</span>
              {typeof it.badge === "number" && it.badge > 0 && !active && (
                <span className="absolute right-1/2 top-1 flex h-3.5 min-w-3.5 translate-x-4 items-center justify-center rounded-full px-0.5 font-mono text-[7px] font-bold text-ink-950" style={{ background: accent }}>
                  {it.badge > 9 ? "9+" : it.badge}
                </span>
              )}
            </button>
          );
        })}
        <button
          onClick={() => setMoreOpen((v) => !v)}
          className="relative flex flex-col items-center gap-1 pb-2 pt-2.5 transition-colors"
          style={{ color: moreOpen ? accent : "#8cacac" }}
        >
          <span className="absolute inset-x-4 top-0 h-[2px] transition-all duration-300" style={{ background: moreOpen ? accent : "transparent" }} />
          <RailIcon id="more" size={19} />
          <span className="font-mono text-[7px] font-bold tracking-[0.16em]">MORE</span>
          {moreBadge > 0 && !moreOpen && (
            <span className="absolute right-1/2 top-1 flex h-3.5 min-w-3.5 translate-x-4 items-center justify-center rounded-full px-0.5 font-mono text-[7px] font-bold text-ink-950" style={{ background: accent }}>
              {moreBadge}
            </span>
          )}
        </button>
      </nav>

      {/* ============ MOBILE · more sheet ============ */}
      {moreOpen && isMobile && (
        <div className="sheet-in absolute inset-x-0 bottom-0 z-[60] border-t bg-ink-900/97 backdrop-blur-md lg:hidden" style={{ borderColor, paddingBottom: "calc(env(safe-area-inset-bottom) + 64px)" }}>
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-ink-600" />
          <p className="px-4 pb-1 pt-2 font-mono text-[8px] tracking-[0.24em] text-mist-600">MODULES</p>
          <div className="grid grid-cols-4 gap-1.5 px-3">
            {secondary.map((it) => (
              <button
                key={it.id}
                onClick={() => setFlyout(it.id)}
                className="flex flex-col items-center gap-1.5 border border-ink-700/60 bg-ink-850/50 px-1 py-3 transition-colors"
                style={{ color: "#c2d8d6" }}
              >
                <RailIcon id={it.id} size={18} />
                <span className="font-mono text-[7px] tracking-[0.14em]">{TITLES[it.id].split(" ")[0]}</span>
                {typeof it.badge === "number" && it.badge > 0 && (
                  <span className="-mt-1 rounded-full px-1 font-mono text-[7px] font-bold text-ink-950" style={{ background: accent }}>{it.badge}</span>
                )}
              </button>
            ))}
          </div>
          <p className="px-4 pb-1 pt-3 font-mono text-[8px] tracking-[0.24em] text-mist-600">SYSTEM</p>
          <div className="flex flex-col gap-1 px-3 pb-3">
            {toggles.map((t) => (
              <button
                key={t.id}
                onClick={t.onClick}
                disabled={t.disabled}
                className="flex items-center gap-3 border border-ink-700/50 bg-ink-850/40 px-3 py-2.5 transition-colors disabled:opacity-40"
              >
                <span style={{ color: t.on ? accent : "#8cacac" }}>
                  <RailIcon id={t.id} size={17} />
                </span>
                <span className="flex-1 text-left font-mono text-[9px] tracking-[0.14em] text-mist-300">{t.label.toUpperCase()}</span>
                <MiniSwitch on={t.on} accent={accent} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ============ FLYOUT · anchored panel (desktop) / bottom sheet (mobile) ============ */}
      {open && (
        <div
          key={flyout}
          className={
            isMobile
              ? "sheet-in absolute inset-x-0 bottom-0 z-[60] flex max-h-[88dvh] flex-col border-t bg-ink-900/97 backdrop-blur-md"
              : `flyout-in absolute right-[64px] top-1/2 z-[60] flex max-h-[86vh] -translate-y-1/2 flex-col border bg-ink-900/95 backdrop-blur-md ${WIDTHS[flyout]}`
          }
          style={{
            borderColor,
            boxShadow: `0 30px 70px -24px rgba(0,0,0,0.85), 0 0 44px -18px ${accent}55`,
            transform: isMobile && dragging > 0 ? `translateY(${dragging}px)` : undefined,
            paddingBottom: isMobile ? `calc(env(safe-area-inset-bottom) + ${kbInset}px)` : undefined,
          }}
        >
          {/* sheet handle (mobile) */}
          {isMobile && (
            <div className="flex shrink-0 cursor-grab touch-none justify-center pb-0.5 pt-2" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
              <div className="h-1 w-12 rounded-full" style={{ background: `color-mix(in srgb, ${accent} 45%, #213843)` }} />
            </div>
          )}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-700/60 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="pulse-dot h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
              <span className="truncate font-mono text-[9px] font-bold tracking-[0.24em]" style={{ color: accent }}>
                {TITLES[flyout]}
              </span>
            </div>
            <button
              onClick={close}
              aria-label="Close module"
              className="shrink-0 border border-ink-600 p-1.5 text-mist-500 transition-all hover:-translate-y-px hover:text-mist-100 active:scale-95"
            >
              <RailIcon id="close" size={12} />
            </button>
          </div>
          <div className="min-h-0 flex-1">{children}</div>
          <p className="hidden shrink-0 border-t border-ink-700/40 px-4 py-1.5 font-mono text-[7px] tracking-[0.2em] text-mist-600 lg:block">
            CLICK OUTSIDE OR ESC TO DISMISS
          </p>
        </div>
      )}
    </>
  );
}
