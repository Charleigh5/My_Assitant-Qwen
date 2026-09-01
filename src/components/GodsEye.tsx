import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import Hls from "hls.js";
import {
  BASE_LAYERS,
  OVERLAY_LAYERS,
  FEEDS,
  SATS,
  fetchAir,
  fetchEvents,
  fetchQuakes,
  fetchSat,
  fetchWeather,
  fmtCoord,
  project,
  unproject,
  windDirName,
  eventColor,
} from "../lib/godsEye";
import type { AirNow, LayerId, NatEvent, OverlayId, Quake, SatPos, WeatherNow } from "../lib/godsEye";
import { alpha } from "../lib/personas";

export interface FocusPoint {
  label: string;
  lat: number;
  lon: number;
}

export interface GodsEyeApi {
  flyTo: (lat: number, lon: number, zoom: number, label?: string) => void;
  setBase: (id: LayerId) => void;
  setOverlay: (id: OverlayId, on: boolean) => void;
  setFeed: (id: string | null) => void;
  engageLink: () => void;
  severLink: () => void;
}

interface Props {
  active: boolean;
  accent: string;
  apiRef: MutableRefObject<GodsEyeApi | null>;
  onWeatherReport?: (place: FocusPoint, w: WeatherNow | null, a: AirNow | null) => void;
  onFocusChange?: (f: FocusPoint | null) => void;
  onLog?: (msg: string) => void;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const ago = (t: number) => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
};
const magColor = (m: number) => (m < 4 ? "#f5d94b" : m < 5 ? "#f5b94b" : m < 6 ? "#ff7a50" : "#ff5d5d");
const aqiColor = (l: string) =>
  l === "GOOD" ? "#9be15d" : l === "MODERATE" ? "#f5d94b" : l === "SENSITIVE" ? "#f5b94b" : l === "UNHEALTHY" ? "#ff7a50" : "#ff5d5d";

const OVERLAY_DEFS: { id: OverlayId; label: string }[] = [
  { id: "fires", label: "FIRES" },
  { id: "seismic", label: "SEISMIC" },
  { id: "events", label: "EVENTS" },
  { id: "sats", label: "SATS" },
  { id: "transit", label: "RAIL" },
];

type DeckMode = "camera" | "map";

export default function GodsEye({ active, accent, apiRef, onWeatherReport, onFocusChange, onLog }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const feedVideoRef = useRef<HTMLVideoElement>(null);

  const view = useRef({ lat: 18, lon: 8, zoom: 2.7 });
  const anim = useRef<null | { fLat: number; fLon: number; fZ: number; tLat: number; tLon: number; tZ: number; t0: number; dur: number; label?: string }>(null);
  const tileCache = useRef(new Map<string, HTMLImageElement>());
  const failedTiles = useRef(new Set<string>());
  const accentRef = useRef(accent);
  accentRef.current = accent;

  /* camera is the default face of the deck — open it and you see the live feed */
  const [mode, setMode] = useState<DeckMode>("camera");
  const modeRef = useRef<DeckMode>("camera");
  modeRef.current = mode;

  const [nav, setNav] = useState<"IDLE" | "NAVIGATING" | "LOCKED">("IDLE");
  const [base, setBase] = useState<LayerId>("imagery");
  const [overlays, setOverlays] = useState<Record<OverlayId, boolean>>({ fires: true, seismic: true, events: true, sats: true, transit: false });
  const [focus, setFocus] = useState<FocusPoint | null>(null);
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [air, setAir] = useState<AirNow | null>(null);
  const [wxLoading, setWxLoading] = useState(false);
  const [quakes, setQuakes] = useState<Quake[]>([]);
  const [events, setEvents] = useState<NatEvent[]>([]);
  const [sats, setSats] = useState<SatPos[]>([]);
  const [drawer, setDrawer] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"wx" | "tel">("wx");
  const [activeFeed, setActiveFeed] = useState<string>("f1");
  const [feedState, setFeedState] = useState<"idle" | "buffering" | "live" | "error">("idle");
  const [muted, setMuted] = useState(true);
  const [clock, setClock] = useState("--:--:--");
  const [coords, setCoords] = useState({ lat: 18, lon: 8, zoom: 2.7 });
  const lastCoordPush = useRef(0);
  const failCount = useRef(0);

  const reportArmed = useRef(false);
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const quakesRef = useRef(quakes);
  quakesRef.current = quakes;
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const satsRef = useRef(sats);
  satsRef.current = sats;
  const baseRef = useRef(base);
  baseRef.current = base;
  const navRef = useRef(nav);
  navRef.current = nav;

  /* ---------- UTC clock ---------- */
  useEffect(() => {
    const tick = () => setClock(new Date().toISOString().slice(11, 19));
    tick();
    const iv = window.setInterval(tick, 1000);
    return () => window.clearInterval(iv);
  }, []);

  /* ---------- imperative API for the agent ---------- */

  const flyTo = useCallback((lat: number, lon: number, zoom: number, label?: string) => {
    const v = view.current;
    anim.current = { fLat: v.lat, fLon: v.lon, fZ: v.zoom, tLat: lat, tLon: lon, tZ: zoom, t0: performance.now(), dur: 1700, label };
    setNav("NAVIGATING");
    setMode("map");
    if (label) setFocus({ label, lat, lon });
    reportArmed.current = true;
  }, []);

  /* ---------- weather on focus ---------- */

  const refreshWeather = useCallback(async (pt?: FocusPoint | null) => {
    const p = pt ?? focusRef.current;
    if (!p) return;
    setWxLoading(true);
    const [w, a] = await Promise.all([fetchWeather(p.lat, p.lon), fetchAir(p.lat, p.lon)]);
    setWeather(w);
    setAir(a);
    setWxLoading(false);
    if (reportArmed.current) {
      reportArmed.current = false;
      onWeatherReport?.(p, w, a);
    }
  }, [onWeatherReport]);

  useEffect(() => {
    if (focus) void refreshWeather(focus);
  }, [focus, refreshWeather]);

  useEffect(() => {
    onFocusChange?.(focus);
  }, [focus, onFocusChange]);

  /* ---------- live data polling (only while the deck is on screen) ---------- */

  useEffect(() => {
    if (!active) return;
    let dead = false;
    const pullEvents = async () => {
      const [q, e] = await Promise.all([fetchQuakes(), fetchEvents()]);
      if (!dead) {
        setQuakes(q);
        setEvents(e);
      }
    };
    const pullSats = async () => {
      const res = await Promise.all(SATS.map((s) => fetchSat(s.id)));
      if (!dead) {
        setSats(
          SATS.map((s, i) => (res[i] ? { id: String(s.id), name: s.name, color: s.color, ...res[i]! } : null)).filter(Boolean) as SatPos[],
        );
      }
    };
    void pullEvents();
    void pullSats();
    const ivE = window.setInterval(pullEvents, 30000);
    const ivS = window.setInterval(pullSats, 5000);
    return () => {
      dead = true;
      window.clearInterval(ivE);
      window.clearInterval(ivS);
    };
  }, [active]);

  /* ---------- tile loading ---------- */

  const getTile = useCallback((layerId: string, url: (z: number, x: number, y: number) => string, z: number, x: number, y: number) => {
    const key = `${layerId}/${z}/${x}/${y}`;
    const cached = tileCache.current.get(key);
    if (cached) return cached;
    if (failedTiles.current.has(key)) return null;
    if (tileCache.current.size > 420) {
      const first = tileCache.current.keys().next().value;
      if (first) tileCache.current.delete(first);
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      img.dataset.ok = "1";
    };
    img.onerror = () => {
      failedTiles.current.add(key);
      tileCache.current.delete(key);
    };
    img.src = url(z, x, y);
    tileCache.current.set(key, img);
    return img;
  }, []);

  /* ---------- canvas render loop (map mode) ---------- */

  useEffect(() => {
    const cv = canvasRef.current;
    const wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const g = cv.getContext("2d");
    if (!g) return;
    let raf = 0;
    let dragging: null | { px: number; py: number; lat: number; lon: number } = null;

    const onDown = (e: PointerEvent) => {
      dragging = { px: e.clientX, py: e.clientY, lat: view.current.lat, lon: view.current.lon };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const z = view.current.zoom;
      const c = project(dragging.lat, dragging.lon, z);
      const p = unproject(c.x - (e.clientX - dragging.px), c.y - (e.clientY - dragging.py), z);
      view.current.lat = Math.max(-85, Math.min(85, p.lat));
      view.current.lon = p.lon;
      anim.current = null;
    };
    const onUp = () => {
      dragging = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = cv.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const v = view.current;
      const zBefore = v.zoom;
      const zAfter = Math.max(2, Math.min(18, zBefore - Math.sign(e.deltaY) * (e.shiftKey ? 0.25 : 0.55)));
      if (zAfter === zBefore) return;
      const before = unproject(
        project(v.lat, v.lon, zBefore).x - rect.width / 2 + mx,
        project(v.lat, v.lon, zBefore).y - rect.height / 2 + my,
        zBefore,
      );
      const after = unproject(
        project(v.lat, v.lon, zAfter).x - rect.width / 2 + mx,
        project(v.lat, v.lon, zAfter).y - rect.height / 2 + my,
        zAfter,
      );
      v.lat = Math.max(-85, Math.min(85, v.lat + (before.lat - after.lat)));
      v.lon += before.lon - after.lon;
      v.zoom = zAfter;
      anim.current = null;
    };
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointerleave", onUp);
    cv.addEventListener("wheel", onWheel, { passive: false });

    const drawLayer = (W: number, H: number, layer: { id: string; url: (z: number, x: number, y: number) => string; maxNative: number }, z: number, cxF: number, cyF: number) => {
      const zUse = Math.min(Math.floor(z), layer.maxNative);
      const scale = Math.pow(2, z - zUse);
      const ts = 256 * scale;
      const c = project(view.current.lat, view.current.lon, zUse);
      const topLeftX = c.x - W / 2 / scale;
      const topLeftY = c.y - H / 2 / scale;
      const n = Math.pow(2, zUse);
      const x0 = Math.floor(topLeftX / 256);
      const y0 = Math.max(0, Math.floor(topLeftY / 256));
      const x1 = Math.floor((topLeftX + W / scale) / 256);
      const y1 = Math.min(n - 1, Math.floor((topLeftY + H / scale) / 256));
      for (let tx = x0; tx <= x1; tx++) {
        for (let ty = y0; ty <= y1; ty++) {
          const wx = ((tx % n) + n) % n;
          const px = W / 2 + (tx * 256 - c.x) * scale;
          const py = H / 2 + (ty * 256 - c.y) * scale;
          const img = getTile(layer.id, layer.url, zUse, wx, ty);
          if (img?.dataset.ok) {
            g.drawImage(img, px, py, ts, ts);
          } else {
            g.fillStyle = "#0d181e";
            g.fillRect(px, py, ts, ts);
            g.strokeStyle = "#182b34";
            g.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);
          }
        }
      }
    };

    const screenPos = (lat: number, lon: number, W: number, H: number, cxF: number, cyF: number, z: number) => {
      const cf = project(view.current.lat, view.current.lon, z);
      const p = project(lat, lon, z);
      return { x: W / 2 + (p.x - cf.x), y: H / 2 + (p.y - cf.y) };
    };

    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!active || modeRef.current !== "map") return;

      // animation
      if (anim.current) {
        const a = anim.current;
        const t = Math.min(1, (performance.now() - a.t0) / a.dur);
        const e = easeInOut(t);
        view.current.lat = a.fLat + (a.tLat - a.fLat) * e;
        view.current.lon = a.fLon + (a.tLon - a.fLon) * e;
        view.current.zoom = a.fZ + (a.tZ - a.fZ) * e;
        if (t >= 1) {
          anim.current = null;
          setNav(a.label ? "LOCKED" : "IDLE");
        }
      }

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = wrap.clientWidth;
      const H = wrap.clientHeight;
      if (cv.width !== W * dpr || cv.height !== H * dpr) {
        cv.width = W * dpr;
        cv.height = H * dpr;
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = "#0b1317";
      g.fillRect(0, 0, W, H);

      const z = view.current.zoom;
      const cf = project(view.current.lat, view.current.lon, z);
      drawLayer(W, H, BASE_LAYERS[baseRef.current], z, cf.x, cf.y);
      if (overlaysRef.current.fires) drawLayer(W, H, OVERLAY_LAYERS.fires, Math.min(z, OVERLAY_LAYERS.fires.maxNative + 2), cf.x, cf.y);
      if (overlaysRef.current.transit) drawLayer(W, H, OVERLAY_LAYERS.transit, z, cf.x, cf.y);

      const t = performance.now();

      // quake markers
      if (overlaysRef.current.seismic) {
        for (const q of quakesRef.current) {
          const p = screenPos(q.lat, q.lon, W, H, cf.x, cf.y, z);
          if (p.x < -40 || p.x > W + 40 || p.y < -40 || p.y > H + 40) continue;
          const r = Math.min(26, 5 + q.mag * 2.4);
          const c = magColor(q.mag);
          const fresh = Date.now() - q.time < 15 * 60000;
          const pulse = fresh ? 1 + Math.sin(t / 260) * 0.18 : 1;
          g.beginPath();
          g.arc(p.x, p.y, r * pulse, 0, Math.PI * 2);
          g.fillStyle = alpha(c, 0.16);
          g.fill();
          g.strokeStyle = c;
          g.lineWidth = 1.4;
          g.stroke();
          g.beginPath();
          g.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
          g.fillStyle = c;
          g.fill();
        }
      }

      // EONET events
      if (overlaysRef.current.events) {
        for (const ev of eventsRef.current) {
          const p = screenPos(ev.lat, ev.lon, W, H, cf.x, cf.y, z);
          if (p.x < -30 || p.x > W + 30 || p.y < -30 || p.y > H + 30) continue;
          const c = eventColor(ev.category);
          g.save();
          g.translate(p.x, p.y);
          g.rotate(Math.PI / 4);
          g.fillStyle = alpha(c, 0.25);
          g.strokeStyle = c;
          g.lineWidth = 1.2;
          g.fillRect(-3.4, -3.4, 6.8, 6.8);
          g.strokeRect(-3.4, -3.4, 6.8, 6.8);
          g.restore();
        }
      }

      // satellites
      if (overlaysRef.current.sats) {
        g.font = "600 9px 'JetBrains Mono', monospace";
        for (const s of satsRef.current) {
          const p = screenPos(s.lat, s.lon, W, H, cf.x, cf.y, z);
          if (p.x < -60 || p.x > W + 60 || p.y < -30 || p.y > H + 30) continue;
          g.beginPath();
          g.moveTo(p.x, p.y - 6);
          g.lineTo(p.x + 5.5, p.y + 4.5);
          g.lineTo(p.x - 5.5, p.y + 4.5);
          g.closePath();
          g.fillStyle = alpha(s.color, 0.3);
          g.strokeStyle = s.color;
          g.lineWidth = 1.3;
          g.fill();
          g.stroke();
          g.fillStyle = s.color;
          g.fillText(s.name, p.x + 9, p.y + 3);
        }
      }

      // focus crosshair
      const f = focusRef.current;
      if (f) {
        const p = screenPos(f.lat, f.lon, W, H, cf.x, cf.y, z);
        const acc = accentRef.current;
        const rr = 16 + Math.sin(t / 340) * 4;
        g.strokeStyle = alpha(acc, 0.85);
        g.lineWidth = 1.4;
        g.beginPath();
        g.arc(p.x, p.y, rr, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = alpha(acc, 0.35);
        g.beginPath();
        g.arc(p.x, p.y, rr + 9, t / 900, t / 900 + Math.PI * 1.2);
        g.stroke();
        g.beginPath();
        g.moveTo(p.x - rr - 12, p.y);
        g.lineTo(p.x - rr + 4, p.y);
        g.moveTo(p.x + rr - 4, p.y);
        g.lineTo(p.x + rr + 12, p.y);
        g.moveTo(p.x, p.y - rr - 12);
        g.lineTo(p.x, p.y - rr + 4);
        g.moveTo(p.x, p.y + rr - 4);
        g.lineTo(p.x, p.y + rr + 12);
        g.stroke();
        g.font = "700 10px 'JetBrains Mono', monospace";
        const label = f.label.toUpperCase();
        const tw = g.measureText(label).width;
        g.fillStyle = "rgba(11,19,23,0.82)";
        g.fillRect(p.x + rr + 8, p.y - 18, tw + 12, 16);
        g.strokeStyle = alpha(acc, 0.5);
        g.strokeRect(p.x + rr + 8.5, p.y - 17.5, tw + 11, 15);
        g.fillStyle = acc;
        g.fillText(label, p.x + rr + 14, p.y - 6);
      }

      // nav sweep
      if (navRef.current === "NAVIGATING") {
        const y = ((t / 9) % (H + 160)) - 80;
        const grad = g.createLinearGradient(0, y - 40, 0, y + 40);
        const acc = accentRef.current;
        grad.addColorStop(0, alpha(acc, 0));
        grad.addColorStop(0.5, alpha(acc, 0.22));
        grad.addColorStop(1, alpha(acc, 0));
        g.fillStyle = grad;
        g.fillRect(0, y - 40, W, 80);
      }

      const nowMs = performance.now();
      if (nowMs - lastCoordPush.current > 120) {
        setCoords((prev) =>
          Math.abs(prev.lat - view.current.lat) > 1e-4 ||
          Math.abs(prev.lon - view.current.lon) > 1e-4 ||
          Math.abs(prev.zoom - z) > 0.01
            ? { lat: view.current.lat, lon: view.current.lon, zoom: z }
            : prev,
        );
        lastCoordPush.current = nowMs;
      }
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointerleave", onUp);
      cv.removeEventListener("wheel", onWheel);
    };
  }, [active, getTile]);

  /* ---------- live feeds: broadcast HLS + local optics (getUserMedia) ---------- */

  const hlsFeeds = FEEDS.filter((f) => f.id !== "cam");

  useEffect(() => {
    const video = feedVideoRef.current;
    if (!video || !active || mode !== "camera") return;

    /* local camera — the barehands sensor link */
    if (activeFeed === "cam") {
      let stream: MediaStream | null = null;
      setFeedState("buffering");
      navigator.mediaDevices
        ?.getUserMedia({ video: { width: 1280, height: 720 }, audio: false })
        .then((s) => {
          stream = s;
          video.srcObject = s;
          return video.play();
        })
        .then(() => {
          setFeedState("live");
          onLog?.("local optics link established");
        })
        .catch(() => setFeedState("error"));
      return () => {
        stream?.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      };
    }

    const feed = FEEDS.find((f) => f.id === activeFeed);
    if (!feed) return;
    setFeedState("buffering");
    let hls: Hls | null = null;
    let dead = false;

    const advance = (reason: string) => {
      if (dead) return;
      failCount.current += 1;
      if (failCount.current > hlsFeeds.length) {
        setFeedState("error");
        return;
      }
      const idx = hlsFeeds.findIndex((f) => f.id === activeFeed);
      const next = hlsFeeds[(idx + 1) % hlsFeeds.length];
      onLog?.(`feed ${feed.id} ${reason} — advancing to ${next.label}`);
      setActiveFeed(next.id);
    };

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, manifestLoadingTimeOut: 9000, levelLoadingTimeOut: 9000, fragLoadingTimeOut: 12000 });
      hls.loadSource(feed.src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void video.play().catch(() => undefined);
        setFeedState("live");
        failCount.current = 0;
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          hls?.destroy();
          hls = null;
          advance("signal lost");
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = feed.src;
      video.onerror = () => advance("decode error");
      void video
        .play()
        .then(() => {
          setFeedState("live");
          failCount.current = 0;
        })
        .catch(() => advance("playback refused"));
    } else {
      setFeedState("error");
    }

    return () => {
      dead = true;
      if (hls) hls.destroy();
      video.removeAttribute("src");
    };
  }, [activeFeed, active, mode, onLog, hlsFeeds]);

  /* ---------- imperative API for the agent ---------- */

  useEffect(() => {
    apiRef.current = {
      flyTo,
      setBase: (id) => setBase(id),
      setOverlay: (id, on) => setOverlays((p) => ({ ...p, [id]: on })),
      setFeed: (id) => {
        if (id) {
          setActiveFeed(id);
          setMode("camera");
        }
      },
      engageLink: () => {
        setActiveFeed("cam");
        setMode("camera");
      },
      severLink: () => {
        setActiveFeed("f1");
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, flyTo]);

  /* ---------- UI ---------- */

  const layer = BASE_LAYERS[base];
  const kmPerPx = (156543.03392 * Math.cos((coords.lat * Math.PI) / 180)) / Math.pow(2, coords.zoom) / 1000;
  const scaleKm = kmPerPx * 120;
  const scaleLabel = scaleKm >= 1 ? `${Math.round(scaleKm)} km` : `${Math.round(scaleKm * 1000)} m`;
  const feed = FEEDS.find((f) => f.id === activeFeed) ?? FEEDS[0];

  const selectFeed = (id: string) => {
    failCount.current = 0;
    setActiveFeed(id);
  };

  const nextFeed = () => {
    const idx = hlsFeeds.findIndex((f) => f.id === activeFeed);
    const next = hlsFeeds[(idx + 1) % hlsFeeds.length];
    selectFeed(next.id);
  };

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden bg-ink-950">
      {/* ============ MAP (mounted always — hidden behind the camera) ============ */}
      <div className={`absolute inset-0 ${mode === "map" ? "" : "invisible"}`}>
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing" />

        {/* layer chips — top-left, compact */}
        <div className="absolute left-3 top-14 z-20 flex flex-col gap-1.5">
          <div className="flex gap-1">
            {(Object.keys(BASE_LAYERS) as LayerId[]).map((id) => (
              <button
                key={id}
                onClick={() => setBase(id)}
                className="border px-2 py-1 font-mono text-[8px] tracking-[0.16em] transition-all hover:-translate-y-px"
                style={{
                  borderColor: base === id ? alpha(accent, 0.7) : "#213843",
                  color: base === id ? "#0b1317" : "#8cacac",
                  background: base === id ? accent : "rgba(11,19,23,0.82)",
                  fontWeight: base === id ? 700 : 400,
                }}
              >
                {BASE_LAYERS[id].name}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {OVERLAY_DEFS.map((o) => {
              const on = overlays[o.id];
              return (
                <button
                  key={o.id}
                  onClick={() => setOverlays((p) => ({ ...p, [o.id]: !p[o.id] }))}
                  className="border px-2 py-1 font-mono text-[8px] tracking-[0.16em] transition-all hover:-translate-y-px"
                  style={{
                    borderColor: on ? alpha(accent, 0.65) : "#213843",
                    color: on ? accent : "#66868a",
                    background: on ? alpha(accent, 0.1) : "rgba(11,19,23,0.82)",
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* zoom column — right side, above the core PIP */}
        <div className="absolute right-3 top-14 z-20 flex flex-col gap-1.5">
          {[
            { t: "+", fn: () => { view.current.zoom = Math.min(18, view.current.zoom + 0.8); }, a: "Zoom in" },
            { t: "−", fn: () => { view.current.zoom = Math.max(2, view.current.zoom - 0.8); }, a: "Zoom out" },
            { t: "⌂", fn: () => { anim.current = { fLat: view.current.lat, fLon: view.current.lon, fZ: view.current.zoom, tLat: 18, tLon: 8, tZ: 2.7, t0: performance.now(), dur: 1400 }; setNav("NAVIGATING"); }, a: "World view" },
            { t: "◎", fn: () => { if (focusRef.current) flyTo(focusRef.current.lat, focusRef.current.lon, Math.max(view.current.zoom, 9), focusRef.current.label); }, a: "Re-center on focus" },
          ].map((b) => (
            <button
              key={b.a}
              onClick={b.fn}
              aria-label={b.a}
              className="flex h-8 w-8 items-center justify-center border bg-ink-950/82 font-mono text-[13px] text-mist-300 backdrop-blur-sm transition-all hover:-translate-y-px"
              style={{ borderColor: "#213843" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = accent)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#213843")}
            >
              {b.t}
            </button>
          ))}
        </div>

        {/* coords + scale + attribution — bottom-left */}
        <div className="absolute bottom-[88px] left-3 z-20 flex flex-col gap-1 lg:bottom-4">
          <div className="flex items-center gap-3 border bg-ink-950/82 px-2.5 py-1.5 backdrop-blur-sm" style={{ borderColor: "#213843" }}>
            <span className="font-mono text-[9px] tracking-[0.14em] text-mist-300">{fmtCoord(coords.lat, coords.lon)}</span>
            <span className="font-mono text-[9px] text-mist-600">Z{coords.zoom.toFixed(1)}</span>
            <span className="flex items-center gap-1">
              <span className="h-px w-[60px]" style={{ background: "#8cacac" }} />
              <span className="font-mono text-[8px] text-mist-500">{scaleLabel}</span>
            </span>
          </div>
          <p className="pl-0.5 font-mono text-[7px] tracking-[0.1em] text-mist-600">{layer.attribution}</p>
        </div>
      </div>

      {/* ============ CAMERA — the default face of the deck ============ */}
      {mode === "camera" && (
        <div className="absolute inset-0 bg-ink-950">
          <video ref={feedVideoRef} muted={muted} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />
          <div className="scan-layer pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(11,19,23,0.55) 100%)" }} />

          {/* source plate — top-left under the strip */}
          <div className="absolute left-3 top-14 z-20 border bg-ink-950/82 px-3 py-2 backdrop-blur-sm" style={{ borderColor: alpha(accent, 0.45) }}>
            <div className="flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 rounded-full ${feedState === "live" ? "blink" : ""}`}
                style={{ background: feedState === "live" ? "#ff5d5d" : feedState === "buffering" ? accent : "#66868a" }}
              />
              <span className="font-mono text-[10px] font-bold tracking-[0.24em]" style={{ color: feedState === "live" ? "#eaf4f3" : "#8cacac" }}>
                {feedState === "live" ? "LIVE" : feedState === "buffering" ? "ACQUIRING" : feedState === "error" ? "NO SIGNAL" : "STANDBY"}
              </span>
            </div>
            <p className="mt-1 font-mono text-[9px] tracking-[0.14em]" style={{ color: accent }}>
              {feed.label}
            </p>
            <p className="font-mono text-[7.5px] tracking-[0.1em] text-mist-600">{feed.loc.toUpperCase()}</p>
          </div>

          {/* buffering / error states */}
          {feedState === "buffering" && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink-950/70">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: alpha(accent, 0.6), borderTopColor: "transparent" }} />
              <p className="font-mono text-[9px] tracking-[0.3em] text-mist-500">ACQUIRING SIGNAL…</p>
            </div>
          )}
          {feedState === "error" && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink-950/85">
              <p className="font-mono text-[10px] tracking-[0.3em] text-ember">
                {activeFeed === "cam" ? "CAMERA ACCESS DENIED" : "ALL SOURCES DARK"}
              </p>
              <p className="max-w-[380px] text-center font-mono text-[8px] leading-relaxed tracking-[0.14em] text-mist-500">
                {activeFeed === "cam"
                  ? "ALLOW WEBCAM ACCESS IN THE ADDRESS BAR TO OPEN THE LOCAL OPTICS LINK — OR SWITCH TO A BROADCAST SOURCE BELOW."
                  : "EVERY BROADCAST SOURCE FAILED TO ANSWER. CHECK NETWORK ACCESS, THEN RETRY OR SWITCH SOURCES."}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    failCount.current = 0;
                    setActiveFeed(activeFeed);
                    setFeedState("buffering");
                  }}
                  className="border px-3 py-1.5 font-mono text-[9px] tracking-[0.2em] transition-all hover:-translate-y-px"
                  style={{ borderColor: alpha(accent, 0.6), color: accent }}
                >
                  RETRY
                </button>
                {activeFeed === "cam" ? (
                  <button
                    onClick={() => selectFeed("f1")}
                    className="border border-ink-600 px-3 py-1.5 font-mono text-[9px] tracking-[0.2em] text-mist-300 transition-all hover:-translate-y-px"
                  >
                    BROADCAST →
                  </button>
                ) : (
                  <button
                    onClick={() => selectFeed("cam")}
                    className="border border-ink-600 px-3 py-1.5 font-mono text-[9px] tracking-[0.2em] text-mist-300 transition-all hover:-translate-y-px"
                  >
                    LOCAL CAM →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* transport — bottom-left (right side stays clear for the core PIP) */}
          <div className="absolute bottom-[88px] left-3 z-20 flex max-w-[calc(100%-24px)] flex-col gap-1.5 lg:bottom-4 lg:max-w-[calc(100%-380px)]">
            <div className="flex gap-1">
              <button
                onClick={() => setMuted((m) => !m)}
                className="border bg-ink-950/82 px-2.5 py-1 font-mono text-[8px] tracking-[0.18em] backdrop-blur-sm transition-all hover:-translate-y-px"
                style={{ borderColor: muted ? "#213843" : alpha(accent, 0.6), color: muted ? "#66868a" : accent }}
              >
                {muted ? "UNMUTE" : "MUTE"}
              </button>
              <button
                onClick={nextFeed}
                className="border border-ink-600 bg-ink-950/82 px-2.5 py-1 font-mono text-[8px] tracking-[0.18em] text-mist-300 backdrop-blur-sm transition-all hover:-translate-y-px"
              >
                NEXT SOURCE →
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {FEEDS.map((f) => {
                const on = f.id === activeFeed;
                return (
                  <button
                    key={f.id}
                    onClick={() => selectFeed(f.id)}
                    className="border px-2 py-1 font-mono text-[8px] tracking-[0.12em] transition-all hover:-translate-y-px"
                    style={{
                      borderColor: on ? alpha(accent, 0.7) : "#213843",
                      color: on ? "#0b1317" : "#8cacac",
                      background: on ? accent : "rgba(11,19,23,0.82)",
                      fontWeight: on ? 700 : 400,
                    }}
                  >
                    {f.id === "cam" ? "◉ LOCAL" : f.label.split("·")[0].trim()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============ TOP STRIP ============ */}
      <div className="absolute inset-x-0 top-0 z-30 flex h-11 items-center justify-between bg-gradient-to-b from-ink-950/95 via-ink-950/70 to-transparent px-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex border" style={{ borderColor: alpha(accent, 0.45) }}>
            {(["camera", "map"] as DeckMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="px-3 py-1 font-mono text-[9px] tracking-[0.22em] transition-colors"
                style={{
                  background: mode === m ? accent : "rgba(11,19,23,0.6)",
                  color: mode === m ? "#0b1317" : "#8cacac",
                  fontWeight: mode === m ? 700 : 400,
                }}
              >
                {m === "camera" ? "CAMERA" : "MAP"}
              </button>
            ))}
          </div>
          <div className="hidden min-w-0 items-center gap-2 md:flex">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${nav === "NAVIGATING" ? "blink" : ""}`}
              style={{ background: nav === "LOCKED" ? "#9be15d" : nav === "NAVIGATING" ? accent : "#66868a" }}
            />
            <span className="truncate font-mono text-[9px] tracking-[0.22em]" style={{ color: nav === "IDLE" ? "#8cacac" : accent }}>
              {nav === "NAVIGATING"
                ? "ACQUIRING TARGET"
                : nav === "LOCKED"
                ? `LOCKED · ${focus?.label.toUpperCase() ?? ""}`
                : focus
                ? `FOCUS · ${focus.label.toUpperCase()}`
                : "GLOBAL OBSERVATION"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-[9px] tracking-[0.2em] text-mist-500">{clock} UTC</span>
          <button
            onClick={() => setDrawer((d) => !d)}
            className="flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[8px] tracking-[0.2em] transition-all hover:-translate-y-px"
            style={{
              borderColor: drawer ? alpha(accent, 0.7) : "#213843",
              color: drawer ? accent : "#8cacac",
              background: drawer ? alpha(accent, 0.1) : "rgba(11,19,23,0.7)",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <rect x="1.5" y="2" width="4" height="10" />
              <path d="M8 3.5h4.5M8 7h4.5M8 10.5h4.5" />
            </svg>
            TELEMETRY
          </button>
        </div>
      </div>

      {/* ============ TELEMETRY DRAWER (respects the core PIP zone) ============ */}
      {drawer && (
        <div className="absolute bottom-[96px] right-0 top-11 z-20 flex w-[252px] max-w-[82vw] flex-col border-l bg-ink-900/95 backdrop-blur-sm lg:bottom-[268px]" style={{ borderColor: alpha(accent, 0.3) }}>
          <div className="flex border-b border-ink-700/70">
            {([["wx", "WEATHER"], ["tel", "TELEMETRY"]] as ["wx" | "tel", string][]).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setDrawerTab(id)}
                className="flex-1 py-1.5 font-mono text-[8px] tracking-[0.22em] transition-colors"
                style={{
                  color: drawerTab === id ? accent : "#66868a",
                  background: drawerTab === id ? alpha(accent, 0.08) : "transparent",
                  borderBottom: drawerTab === id ? `2px solid ${accent}` : "2px solid transparent",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
            {drawerTab === "wx" ? (
              focus ? (
                <>
                  <p className="font-display text-[15px] font-bold leading-tight tracking-[0.06em]" style={{ color: accent }}>
                    {focus.label.toUpperCase()}
                  </p>
                  <p className="mb-2 font-mono text-[7.5px] tracking-[0.12em] text-mist-500">{fmtCoord(focus.lat, focus.lon)}</p>
                  {weather ? (
                    <>
                      <div className="flex items-end justify-between">
                        <span className="font-display text-[30px] font-extrabold leading-none text-mist-100">
                          {Math.round(weather.temp)}°<span className="text-[13px] text-mist-500">C</span>
                        </span>
                        <span className="pb-1 text-right">
                          <span className="block font-mono text-[8.5px] tracking-[0.14em]" style={{ color: accent }}>
                            {weather.label.toUpperCase()}
                          </span>
                          <span className="block font-mono text-[7.5px] text-mist-600">{weather.isDay ? "DAYLIGHT" : "NIGHT"}</span>
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[8.5px]">
                        {[
                          ["FEELS", `${Math.round(weather.feels)}°C`],
                          ["WIND", `${Math.round(weather.wind)} ${windDirName(weather.windDir)}`],
                          ["HUMIDITY", `${weather.humidity}%`],
                          ["PRESSURE", `${Math.round(weather.pressure)}`],
                          ["CLOUD", `${weather.cloud}%`],
                          ["PRECIP", `${weather.precip}mm`],
                          ["SUNRISE", weather.sunrise || "—"],
                          ["SUNSET", weather.sunset || "—"],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between border-b border-ink-700/50 py-0.5">
                            <span className="text-mist-600">{k}</span>
                            <span className="text-mist-300">{v}</span>
                          </div>
                        ))}
                      </div>
                      {air && (
                        <div className="mt-2 flex items-center justify-between border px-2 py-1" style={{ borderColor: alpha(aqiColor(air.label), 0.5) }}>
                          <span className="font-mono text-[7.5px] tracking-[0.2em] text-mist-500">AIR</span>
                          <span className="font-mono text-[9px] font-bold" style={{ color: aqiColor(air.label) }}>
                            {air.aqi} · {air.label}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="py-3 font-mono text-[8.5px] tracking-[0.14em] text-mist-600">
                      {wxLoading ? "POLLING SATELLITES…" : "TELEMETRY UNAVAILABLE"}
                    </p>
                  )}
                  <button
                    onClick={() => void refreshWeather()}
                    className="mt-2 w-full border border-ink-600 py-1 font-mono text-[8px] tracking-[0.2em] text-mist-500 transition-colors hover:text-mist-100"
                  >
                    REFRESH
                  </button>
                </>
              ) : (
                <p className="py-4 text-center font-mono text-[8.5px] leading-relaxed tracking-[0.14em] text-mist-600">
                  NO FOCUS SET.
                  <br />
                  SAY “FLY TO TOKYO” OR CLICK THE MAP.
                </p>
              )
            ) : (
              <>
                <p className="pb-1 font-mono text-[7.5px] tracking-[0.24em] text-mist-600">SEISMIC · M4.5+ · USGS</p>
                <div className="mb-2.5 space-y-1">
                  {(quakes.length ? [...quakes].sort((a, b) => b.mag - a.mag).slice(0, 5) : []).map((q) => (
                    <button
                      key={q.id}
                      onClick={() => flyTo(q.lat, q.lon, 6.5, q.place.split(",").slice(-2)[0]?.trim() || "Quake")}
                      className="flex w-full items-center gap-2 border border-ink-700/60 px-2 py-1 text-left transition-all hover:-translate-y-px hover:border-mist-600"
                    >
                      <span className="font-mono text-[10px] font-bold" style={{ color: magColor(q.mag) }}>
                        {q.mag.toFixed(1)}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[8px] text-mist-300">{q.place}</span>
                      <span className="shrink-0 font-mono text-[7px] text-mist-600">{ago(q.time)}</span>
                    </button>
                  ))}
                  {!quakes.length && <p className="font-mono text-[8px] text-mist-600">POLLING…</p>}
                </div>

                <p className="pb-1 font-mono text-[7.5px] tracking-[0.24em] text-mist-600">ORBITAL ASSETS</p>
                <div className="mb-2.5 space-y-1">
                  {sats.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => flyTo(s.lat, s.lon, 5, s.name)}
                      className="flex w-full items-center gap-2 border border-ink-700/60 px-2 py-1 text-left transition-all hover:-translate-y-px hover:border-mist-600"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
                      <span className="font-mono text-[8.5px] font-bold text-mist-100">{s.name}</span>
                      <span className="min-w-0 flex-1 truncate text-right font-mono text-[7.5px] text-mist-500">
                        {Math.round(s.alt)}km · {fmtCoord(s.lat, s.lon)}
                      </span>
                    </button>
                  ))}
                  {!sats.length && <p className="font-mono text-[8px] text-mist-600">TRACKING…</p>}
                </div>

                <p className="pb-1 font-mono text-[7.5px] tracking-[0.24em] text-mist-600">NATURAL EVENTS · EONET</p>
                <div className="space-y-1">
                  {events.slice(0, 5).map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => flyTo(ev.lat, ev.lon, 6, ev.title.slice(0, 24))}
                      className="flex w-full items-center gap-2 border border-ink-700/60 px-2 py-1 text-left transition-all hover:-translate-y-px hover:border-mist-600"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rotate-45" style={{ background: eventColor(ev.category) }} />
                      <span className="min-w-0 flex-1 truncate font-mono text-[8px] text-mist-300">{ev.title}</span>
                    </button>
                  ))}
                  {!events.length && <p className="font-mono text-[8px] text-mist-600">SCANNING…</p>}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
