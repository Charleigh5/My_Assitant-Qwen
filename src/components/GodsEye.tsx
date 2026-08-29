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

export default function GodsEye({ active, accent, apiRef, onWeatherReport, onFocusChange, onLog }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const feedVideoRef = useRef<HTMLVideoElement>(null);
  const linkVideoRef = useRef<HTMLVideoElement>(null);

  const view = useRef({ lat: 18, lon: 8, zoom: 2.7 });
  const anim = useRef<null | { fLat: number; fLon: number; fZ: number; tLat: number; tLon: number; tZ: number; t0: number; dur: number; label?: string }>(null);
  const tileCache = useRef(new Map<string, HTMLImageElement>());
  const failedTiles = useRef(new Set<string>());
  const accentRef = useRef(accent);
  accentRef.current = accent;

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
  const [railOpen, setRailOpen] = useState(true);
  const [activeFeed, setActiveFeed] = useState<string | null>(null);
  const [feedState, setFeedState] = useState<"idle" | "buffering" | "live" | "error">("idle");
  const [link, setLink] = useState<"off" | "connecting" | "live">("off");
  const [coords, setCoords] = useState({ lat: 18, lon: 8, zoom: 2.7 });
  const lastCoordPush = useRef(0);

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

  /* ---------- imperative API for the agent ---------- */

  const flyTo = useCallback((lat: number, lon: number, zoom: number, label?: string) => {
    const v = view.current;
    anim.current = { fLat: v.lat, fLon: v.lon, fZ: v.zoom, tLat: lat, tLon: lon, tZ: zoom, t0: performance.now(), dur: 1700, label };
    setNav("NAVIGATING");
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

  /* ---------- live data polling ---------- */

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

  /* ---------- canvas render loop ---------- */

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
      if (!active) return;

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

  /* ---------- feeds (HLS) ---------- */

  useEffect(() => {
    const video = feedVideoRef.current;
    if (!video || !activeFeed) return;
    const feed = FEEDS.find((f) => f.id === activeFeed);
    if (!feed) return;
    setFeedState("buffering");
    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(feed.src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void video.play().catch(() => undefined);
        setFeedState("live");
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setFeedState("error");
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = feed.src;
      void video.play().catch(() => undefined);
      setFeedState("live");
    } else {
      setFeedState("error");
    }
    return () => {
      if (hls) hls.destroy();
      video.removeAttribute("src");
    };
  }, [activeFeed]);

  /* ---------- WebRTC loopback link ---------- */

  const pcs = useRef<RTCPeerConnection[]>([]);
  const startLink = useCallback(async () => {
    const cv = canvasRef.current;
    const video = linkVideoRef.current;
    if (!cv || !video || typeof RTCPeerConnection === "undefined") return;
    setLink("connecting");
    try {
      const stream = (cv as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(30);
      const a = new RTCPeerConnection();
      const b = new RTCPeerConnection();
      pcs.current = [a, b];
      b.ontrack = (e) => {
        video.srcObject = e.streams[0];
        void video.play().catch(() => undefined);
      };
      b.oniceconnectionstatechange = () => {
        if (b.iceConnectionState === "connected" || b.iceConnectionState === "completed") setLink("live");
      };
      stream.getTracks().forEach((tr) => a.addTrack(tr, stream));
      a.onicecandidate = (e) => e.candidate && void b.addIceCandidate(e.candidate).catch(() => undefined);
      b.onicecandidate = (e) => e.candidate && void a.addIceCandidate(e.candidate).catch(() => undefined);
      const offer = await a.createOffer();
      await a.setLocalDescription(offer);
      await b.setRemoteDescription(offer);
      const answer = await b.createAnswer();
      await b.setLocalDescription(answer);
      await a.setRemoteDescription(answer);
      onLog?.("webrtc secure link engaged · DTLS-SRTP");
    } catch {
      setLink("off");
    }
  }, [onLog]);

  const stopLink = useCallback(() => {
    pcs.current.forEach((p) => p.close());
    pcs.current = [];
    if (linkVideoRef.current) linkVideoRef.current.srcObject = null;
    setLink("off");
  }, []);

  useEffect(() => () => stopLink(), [stopLink]);

  /* ---------- imperative API for the agent ---------- */

  useEffect(() => {
    apiRef.current = {
      flyTo,
      setBase: (id) => setBase(id),
      setOverlay: (id, on) => setOverlays((p) => ({ ...p, [id]: on })),
      setFeed: (id) => setActiveFeed(id),
      engageLink: () => void startLink(),
      severLink: () => stopLink(),
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, flyTo, startLink, stopLink]);

  /* ---------- UI ---------- */

  const layer = BASE_LAYERS[base];
  const kmPerPx = (156543.03392 * Math.cos((coords.lat * Math.PI) / 180)) / Math.pow(2, coords.zoom) / 1000;
  const scaleKm = kmPerPx * 120;
  const scaleLabel = scaleKm >= 1 ? `${Math.round(scaleKm)} km` : `${Math.round(scaleKm * 1000)} m`;

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing" />

      {/* nav status chip */}
      <div className="pointer-events-none absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-2 border bg-ink-950/80 px-3 py-1.5 backdrop-blur-sm" style={{ borderColor: alpha(accent, 0.5) }}>
        <span className={`h-1.5 w-1.5 rounded-full ${nav === "NAVIGATING" ? "blink" : ""}`} style={{ background: nav === "LOCKED" ? "#9be15d" : nav === "NAVIGATING" ? accent : "#66868a" }} />
        <span className="font-mono text-[9px] tracking-[0.26em]" style={{ color: nav === "IDLE" ? "#8cacac" : accent }}>
          {nav === "NAVIGATING" ? "AGENT NAV · ACQUIRING TARGET" : nav === "LOCKED" ? `TARGET LOCKED · ${focus?.label.toUpperCase() ?? ""}` : "ORBITAL OBSERVATION · MANUAL"}
        </span>
      </div>

      {/* right controls */}
      <div className="absolute right-3 top-4 z-20 flex flex-col gap-1.5">
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
            className="flex h-8 w-8 items-center justify-center border bg-ink-950/80 font-mono text-[13px] text-mist-300 backdrop-blur-sm transition-all hover:-translate-y-px"
            style={{ borderColor: "#213843" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = accent)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#213843")}
          >
            {b.t}
          </button>
        ))}
        <button
          onClick={() => setRailOpen((r) => !r)}
          aria-label="Toggle data rail"
          className="flex h-8 w-8 items-center justify-center border bg-ink-950/80 backdrop-blur-sm transition-all hover:-translate-y-px"
          style={{ borderColor: railOpen ? accent : "#213843", color: railOpen ? accent : "#8cacac" }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <rect x="1.5" y="2" width="4" height="10" />
            <path d="M8 3.5h4.5M8 7h4.5M8 10.5h4.5" />
          </svg>
        </button>
      </div>

      {/* base layer switcher */}
      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 border bg-ink-950/80 backdrop-blur-sm" style={{ borderColor: alpha(accent, 0.35) }}>
        {(Object.keys(BASE_LAYERS) as LayerId[]).map((id) => {
          const on = base === id;
          return (
            <button
              key={id}
              onClick={() => setBase(id)}
              className="px-3 py-1.5 font-mono text-[9px] tracking-[0.2em] transition-colors"
              style={{ color: on ? "#0b1317" : "#8cacac", background: on ? accent : "transparent", fontWeight: on ? 700 : 400 }}
            >
              {BASE_LAYERS[id].name}
            </button>
          );
        })}
      </div>

      {/* bottom-left: overlays + coords + scale */}
      <div className={`absolute bottom-4 z-20 flex flex-col gap-1.5 transition-[left] duration-300 ${railOpen ? "left-[272px]" : "left-4"}`}>
        <div className="flex gap-1">
          {OVERLAY_DEFS.map((o) => {
            const on = overlays[o.id];
            return (
              <button
                key={o.id}
                onClick={() => setOverlays((p) => ({ ...p, [o.id]: !p[o.id] }))}
                className="border px-2 py-1 font-mono text-[8px] tracking-[0.18em] transition-all hover:-translate-y-px"
                style={{
                  borderColor: on ? alpha(accent, 0.65) : "#213843",
                  color: on ? accent : "#66868a",
                  background: on ? alpha(accent, 0.1) : "rgba(11,19,23,0.8)",
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3 border bg-ink-950/80 px-2.5 py-1.5 backdrop-blur-sm" style={{ borderColor: "#213843" }}>
          <span className="font-mono text-[9px] tracking-[0.14em] text-mist-300">{fmtCoord(coords.lat, coords.lon)}</span>
          <span className="font-mono text-[9px] text-mist-600">Z{coords.zoom.toFixed(1)}</span>
          <span className="flex items-center gap-1">
            <span className="h-px w-[60px]" style={{ background: "#8cacac" }} />
            <span className="font-mono text-[8px] text-mist-500">{scaleLabel}</span>
          </span>
        </div>
        <p className="font-mono text-[7px] tracking-[0.1em] text-mist-600">{layer.attribution}</p>
      </div>

      {/* ============ DATA RAIL ============ */}
      {railOpen && (
        <div className="absolute bottom-3 left-3 top-14 z-10 flex w-[254px] flex-col gap-2 overflow-y-auto pr-1">
          {/* FOCUS / WEATHER */}
          <div className="panel p-3">
            <p className="pb-1.5 font-mono text-[8px] tracking-[0.26em] text-mist-600">FOCUS · LIVE TELEMETRY</p>
            {focus ? (
              <>
                <p className="font-display text-[17px] font-bold leading-tight tracking-[0.06em]" style={{ color: accent }}>
                  {focus.label.toUpperCase()}
                </p>
                <p className="mb-2 font-mono text-[8px] tracking-[0.12em] text-mist-500">{fmtCoord(focus.lat, focus.lon)}</p>
                {weather ? (
                  <>
                    <div className="flex items-end justify-between">
                      <span className="font-display text-[34px] font-extrabold leading-none text-mist-100">
                        {Math.round(weather.temp)}°<span className="text-[15px] text-mist-500">C</span>
                      </span>
                      <span className="pb-1 text-right">
                        <span className="block font-mono text-[9px] tracking-[0.14em]" style={{ color: accent }}>
                          {weather.label.toUpperCase()}
                        </span>
                        <span className="block font-mono text-[8px] text-mist-600">{weather.isDay ? "DAYLIGHT" : "NIGHT"}</span>
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[9px]">
                      {[
                        ["FEELS", `${Math.round(weather.feels)}°C`],
                        ["WIND", `${Math.round(weather.wind)} km/h ${windDirName(weather.windDir)}`],
                        ["HUMIDITY", `${weather.humidity}%`],
                        ["PRESSURE", `${Math.round(weather.pressure)} hPa`],
                        ["CLOUD", `${weather.cloud}%`],
                        ["PRECIP", `${weather.precip} mm`],
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
                        <span className="font-mono text-[8px] tracking-[0.2em] text-mist-500">AIR QUALITY</span>
                        <span className="font-mono text-[10px] font-bold" style={{ color: aqiColor(air.label) }}>
                          {air.aqi} · {air.label}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="py-3 font-mono text-[9px] tracking-[0.14em] text-mist-600">
                    {wxLoading ? "POLLING SATELLITES…" : "TELEMETRY UNAVAILABLE"}
                  </p>
                )}
                <button
                  onClick={() => void refreshWeather()}
                  className="mt-2 w-full border border-ink-600 py-1 font-mono text-[8px] tracking-[0.2em] text-mist-500 transition-colors hover:text-mist-100"
                  style={{ borderColor: "#213843" }}
                >
                  REFRESH TELEMETRY
                </button>
              </>
            ) : (
              <p className="py-2 font-mono text-[9px] leading-relaxed tracking-[0.1em] text-mist-600">
                NO FOCUS — TELL THE AGENT “FLY TO TOKYO” OR “WEATHER IN REYKJAVÍK”
              </p>
            )}
          </div>

          {/* SATELLITES */}
          <div className="panel p-3">
            <p className="pb-1.5 font-mono text-[8px] tracking-[0.26em] text-mist-600">ORBITAL ASSETS · LIVE</p>
            {sats.length === 0 ? (
              <p className="py-1 font-mono text-[9px] text-mist-600">ACQUIRING DOWNLINK…</p>
            ) : (
              <div className="space-y-1">
                {sats.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => flyTo(s.lat, s.lon, 5, s.name)}
                    className="flex w-full items-center justify-between border border-ink-700/60 bg-ink-850/50 px-2 py-1.5 text-left transition-all hover:-translate-y-px hover:border-mist-600"
                  >
                    <span className="flex items-center gap-1.5">
                      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
                        <path d="M4 0 8 7H0z" fill={s.color} />
                      </svg>
                      <span className="font-mono text-[9px] font-bold tracking-[0.14em] text-mist-300">{s.name}</span>
                    </span>
                    <span className="font-mono text-[8px] text-mist-500">
                      {Math.round(s.alt)} km · {Math.round(s.vel)} km/h
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SEISMIC */}
          <div className="panel p-3">
            <p className="pb-1.5 font-mono text-[8px] tracking-[0.26em] text-mist-600">
              SEISMIC · M2.5+ PAST HOUR <span className="text-mist-500">({quakes.length})</span>
            </p>
            {quakes.length === 0 ? (
              <p className="py-1 font-mono text-[9px] text-mist-600">QUIET HOUR — USGS FEED LIVE</p>
            ) : (
              <div className="space-y-1">
                {quakes.slice(0, 5).map((q) => (
                  <button
                    key={q.id}
                    onClick={() => flyTo(q.lat, q.lon, 6.5, `M${q.mag.toFixed(1)}`)}
                    className="flex w-full items-center gap-2 border border-ink-700/60 bg-ink-850/50 px-2 py-1.5 text-left transition-all hover:-translate-y-px hover:border-mist-600"
                  >
                    <span
                      className="flex h-6 w-8 shrink-0 items-center justify-center font-mono text-[10px] font-bold"
                      style={{ background: alpha(magColor(q.mag), 0.18), color: magColor(q.mag) }}
                    >
                      {q.mag.toFixed(1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[8.5px] text-mist-300">{q.place}</span>
                      <span className="block font-mono text-[7.5px] text-mist-600">{ago(q.time)} · {Math.round(q.depth)} km deep</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* EVENTS */}
          <div className="panel p-3">
            <p className="pb-1.5 font-mono text-[8px] tracking-[0.26em] text-mist-600">
              OPEN EVENTS · NASA EONET <span className="text-mist-500">({events.length})</span>
            </p>
            {events.length === 0 ? (
              <p className="py-1 font-mono text-[9px] text-mist-600">AWAITING EONET FEED…</p>
            ) : (
              <div className="space-y-1">
                {events.slice(0, 6).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => flyTo(ev.lat, ev.lon, 6, ev.title.split(" ").slice(0, 2).join(" "))}
                    className="flex w-full items-center gap-2 border border-ink-700/60 bg-ink-850/50 px-2 py-1.5 text-left transition-all hover:-translate-y-px hover:border-mist-600"
                  >
                    <span className="h-2 w-2 shrink-0 rotate-45" style={{ background: eventColor(ev.category) }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[8.5px] text-mist-300">{ev.title}</span>
                      <span className="block font-mono text-[7.5px] uppercase tracking-[0.1em]" style={{ color: eventColor(ev.category) }}>
                        {ev.category} · {ev.date}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* LINKED FEEDS */}
          <div className="panel p-3">
            <p className="pb-1.5 font-mono text-[8px] tracking-[0.26em] text-mist-600">LINKED FEEDS · HLS</p>
            {activeFeed && (
              <div className="relative mb-2 aspect-video w-full overflow-hidden border" style={{ borderColor: alpha(accent, 0.4) }}>
                <video ref={feedVideoRef} muted playsInline className="h-full w-full bg-black object-cover" />
                <span
                  className="absolute left-1.5 top-1.5 flex items-center gap-1 px-1.5 py-0.5 font-mono text-[7.5px] tracking-[0.2em]"
                  style={{ background: "rgba(11,19,23,0.85)", color: feedState === "live" ? "#ff5d5d" : "#f5b94b" }}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${feedState === "live" ? "blink" : ""}`} style={{ background: feedState === "live" ? "#ff5d5d" : "#f5b94b" }} />
                  {feedState === "live" ? "LIVE" : feedState === "buffering" ? "BUFFERING" : "SIGNAL LOST"}
                </span>
                <button
                  onClick={() => setActiveFeed(null)}
                  className="absolute right-1.5 top-1.5 border border-ink-600 bg-ink-950/85 px-1.5 py-0.5 font-mono text-[7.5px] text-mist-400 hover:text-mist-100"
                >
                  CUT
                </button>
              </div>
            )}
            <div className="space-y-1">
              {FEEDS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFeed(f.id)}
                  className="flex w-full items-center justify-between border border-ink-700/60 bg-ink-850/50 px-2 py-1.5 text-left transition-all hover:-translate-y-px hover:border-mist-600"
                  style={activeFeed === f.id ? { borderColor: alpha(accent, 0.7) } : undefined}
                >
                  <span className="font-mono text-[8.5px] tracking-[0.12em] text-mist-300">{f.label}</span>
                  <span className="font-mono text-[7.5px] text-mist-600">{activeFeed === f.id ? "ON MONITOR" : "STANDBY"}</span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 font-mono text-[7px] leading-relaxed text-mist-600">PUBLIC DEMO STREAMS — POINT THE AGENT AT YOUR OWN HLS / WEBRTC ENDPOINTS.</p>
          </div>

          {/* WEBRTC SECURE LINK */}
          <div className="panel p-3">
            <p className="pb-1.5 font-mono text-[8px] tracking-[0.26em] text-mist-600">SECURE LINK · WEBRTC</p>
            {link !== "off" && (
              <div className="relative mb-2 aspect-video w-full overflow-hidden border" style={{ borderColor: link === "live" ? "rgba(155,225,93,0.5)" : "#213843" }}>
                <video ref={linkVideoRef} muted playsInline className="h-full w-full bg-black object-cover" />
                <span
                  className="absolute left-1.5 top-1.5 flex items-center gap-1 px-1.5 py-0.5 font-mono text-[7.5px] tracking-[0.18em]"
                  style={{ background: "rgba(11,19,23,0.85)", color: link === "live" ? "#9be15d" : "#f5b94b" }}
                >
                  <span className="pulse-dot h-1.5 w-1.5 rounded-full" style={{ background: link === "live" ? "#9be15d" : "#f5b94b" }} />
                  {link === "live" ? "PEER CONNECTED" : "NEGOTIATING…"}
                </span>
              </div>
            )}
            {link === "off" ? (
              <button
                onClick={() => void startLink()}
                className="w-full border py-1.5 font-mono text-[9px] font-bold tracking-[0.22em] transition-all hover:-translate-y-px"
                style={{ borderColor: alpha(accent, 0.6), color: accent, background: alpha(accent, 0.08) }}
              >
                ENGAGE LINK
              </button>
            ) : (
              <button
                onClick={stopLink}
                className="w-full border border-ember/60 py-1.5 font-mono text-[9px] font-bold tracking-[0.22em] text-ember transition-all hover:-translate-y-px"
              >
                SEVER LINK
              </button>
            )}
            <p className="mt-1.5 font-mono text-[7px] leading-relaxed text-mist-600">
              {link === "live"
                ? "DTLS-SRTP ENCRYPTED · MAP CANVAS STREAMING OVER A REAL RTCPeerConnection."
                : "PIPES THIS OBSERVATION DECK THROUGH AN ENCRYPTED PEER CONNECTION TO A LOCAL MONITOR."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
