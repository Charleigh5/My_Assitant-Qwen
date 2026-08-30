/**
 * GOD'S EYE — global observation layer.
 * Keyless public data: Nominatim geocoding, Open-Meteo weather + air,
 * USGS seismic feed, NASA EONET events, where-the-iss.at satellites,
 * OSM / Esri / NASA GIBS / OpenRailwayMap tiles.
 */

export interface GeoPlace {
  name: string;
  lat: number;
  lon: number;
  detail: string;
}

export interface WeatherNow {
  temp: number;
  feels: number;
  humidity: number;
  wind: number;
  windDir: number;
  pressure: number;
  cloud: number;
  precip: number;
  code: number;
  label: string;
  isDay: boolean;
  sunrise: string;
  sunset: string;
}

export interface AirNow {
  aqi: number;
  pm25: number;
  pm10: number;
  label: string;
}

export interface Quake {
  id: string;
  mag: number;
  place: string;
  time: number;
  lat: number;
  lon: number;
  depth: number;
}

export interface NatEvent {
  id: string;
  title: string;
  category: string;
  lat: number;
  lon: number;
  date: string;
}

export interface SatPos {
  id: string;
  name: string;
  lat: number;
  lon: number;
  alt: number;
  vel: number;
  vis: string;
  color: string;
}

/* ---------- geocoding ---------- */

export async function geocode(q: string): Promise<GeoPlace | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`,
    );
    if (!r.ok) return null;
    const j = (await r.json()) as any[];
    if (!j.length) return null;
    const hit = j[0];
    const name = hit.name || String(hit.display_name ?? q).split(",")[0];
    return {
      name,
      lat: Number(hit.lat),
      lon: Number(hit.lon),
      detail: String(hit.display_name ?? "").split(",").slice(1, 3).join(",").trim() || "Earth",
    };
  } catch {
    return null;
  }
}

/* ---------- weather ---------- */

const WMO: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Rain showers", 81: "Rain showers", 82: "Violent showers",
  85: "Snow showers", 86: "Snow showers", 95: "Thunderstorm", 96: "Thunderstorm + hail", 99: "Thunderstorm + hail",
};

export const windDirName = (deg: number) =>
  ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][
    Math.round(deg / 22.5) % 16
  ];

export async function fetchWeather(lat: number, lon: number): Promise<WeatherNow | null> {
  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m` +
        `&daily=sunrise,sunset&timezone=auto&forecast_days=1`,
    );
    if (!r.ok) return null;
    const j = await r.json();
    const c = j.current;
    const code = Number(c.weather_code);
    return {
      temp: c.temperature_2m,
      feels: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      wind: c.wind_speed_10m,
      windDir: c.wind_direction_10m,
      pressure: c.pressure_msl,
      cloud: c.cloud_cover,
      precip: c.precipitation,
      code,
      label: WMO[code] ?? "Unknown",
      isDay: c.is_day === 1,
      sunrise: String(j.daily?.sunrise?.[0] ?? "").slice(11, 16),
      sunset: String(j.daily?.sunset?.[0] ?? "").slice(11, 16),
    };
  } catch {
    return null;
  }
}

export async function fetchAir(lat: number, lon: number): Promise<AirNow | null> {
  try {
    const r = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5,pm10,us_aqi`,
    );
    if (!r.ok) return null;
    const j = await r.json();
    const aqi = Math.round(j.current?.us_aqi ?? 0);
    const label =
      aqi <= 50 ? "GOOD" : aqi <= 100 ? "MODERATE" : aqi <= 150 ? "SENSITIVE" : aqi <= 200 ? "UNHEALTHY" : "HAZARDOUS";
    return { aqi, pm25: j.current?.pm2_5 ?? 0, pm10: j.current?.pm10 ?? 0, label };
  } catch {
    return null;
  }
}

/* ---------- live event feeds ---------- */

export async function fetchQuakes(): Promise<Quake[]> {
  try {
    const r = await fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_hour.geojson");
    if (!r.ok) return [];
    const j = await r.json();
    return (j.features ?? [])
      .map((f: any) => ({
        id: f.id,
        mag: f.properties.mag,
        place: f.properties.place ?? "unknown",
        time: f.properties.time,
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
        depth: f.geometry.coordinates[2],
      }))
      .sort((a: Quake, b: Quake) => b.mag - a.mag)
      .slice(0, 30);
  } catch {
    return [];
  }
}

const CATEGORY_COLOR: Record<string, string> = {
  wildfires: "#ff7a50",
  storms: "#54d8ff",
  volcanoes: "#ff5d5d",
  seaLakeIce: "#bfeee8",
  dustHaze: "#f5b94b",
  floods: "#5b9dff",
  earthquakes: "#f5d94b",
  drought: "#e0a35c",
  landslides: "#c9a27e",
  manmade: "#b48cff",
  seaSurfaceTemperature: "#3fe0c5",
};

export const eventColor = (category: string) => CATEGORY_COLOR[category] ?? "#8cacac";

export async function fetchEvents(): Promise<NatEvent[]> {
  try {
    const r = await fetch("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=60");
    if (!r.ok) return [];
    const j = await r.json();
    const out: NatEvent[] = [];
    for (const e of j.events ?? []) {
      const pt = (e.geometry ?? []).find((g: any) => g.type === "Point");
      if (!pt) continue;
      out.push({
        id: e.id,
        title: e.title,
        category: e.categories?.[0]?.id ?? "manmade",
        lat: pt.coordinates[1],
        lon: pt.coordinates[0],
        date: String(pt.date ?? "").slice(0, 10),
      });
    }
    return out.slice(0, 40);
  } catch {
    return [];
  }
}

/* ---------- satellites ---------- */

export const SATS: { id: number; name: string; color: string }[] = [
  { id: 25544, name: "ISS", color: "#9be15d" },
  { id: 25994, name: "TERRA", color: "#3fe0c5" },
  { id: 33591, name: "NOAA-19", color: "#f5b94b" },
];

export async function fetchSat(norad: number): Promise<{ lat: number; lon: number; alt: number; vel: number; vis: string } | null> {
  try {
    const r = await fetch(`https://api.wheretheiss.at/v1/satellites/${norad}`);
    if (!r.ok) return null;
    const j = await r.json();
    return { lat: j.latitude, lon: j.longitude, alt: j.altitude, vel: j.velocity, vis: j.visibility };
  } catch {
    return null;
  }
}

/* ---------- map layers ---------- */

export type LayerId = "streets" | "imagery" | "truecolor";
export type OverlayId = "fires" | "seismic" | "events" | "sats" | "transit";

const gibsDate = (daysBack: number) => {
  const d = new Date(Date.now() - daysBack * 86400_000);
  return d.toISOString().slice(0, 10);
};

export interface TileLayer {
  id: string;
  name: string;
  url: (z: number, x: number, y: number) => string;
  maxNative: number;
  maxZoom: number;
  attribution: string;
}

export const BASE_LAYERS: Record<LayerId, TileLayer> = {
  streets: {
    id: "streets",
    name: "STREETS",
    url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    maxNative: 19,
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  },
  imagery: {
    id: "imagery",
    name: "IMAGERY",
    url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    maxNative: 18,
    maxZoom: 18,
    attribution: "© Esri",
  },
  truecolor: {
    id: "truecolor",
    name: "TERRA TRUE-COLOR",
    url: (z, x, y) =>
      `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${gibsDate(3)}/GoogleMapsCompatible_Level6/${z}/${y}/${x}.jpg`,
    maxNative: 6,
    maxZoom: 6,
    attribution: "NASA GIBS / MODIS Terra · 48h lag",
  },
};

export const OVERLAY_LAYERS: Record<string, TileLayer> = {
  fires: {
    id: "fires",
    name: "VIIRS THERMAL ANOMALIES",
    url: (z, x, y) =>
      `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_Thermal_Anomalies_375m_Day_Night/default/${gibsDate(3)}/GoogleMapsCompatible_Level7/${z}/${y}/${x}.png`,
    maxNative: 7,
    maxZoom: 7,
    attribution: "NASA GIBS / VIIRS SNPP",
  },
  transit: {
    id: "transit",
    name: "GLOBAL RAIL NETWORK",
    url: (z, x, y) => `https://tiles.openrailwaymap.org/standard/${z}/${x}/${y}.png`,
    maxNative: 17,
    maxZoom: 17,
    attribution: "© OpenRailwayMap",
  },
};

/* ---------- mercator math ---------- */

export const project = (lat: number, lon: number, z: number) => {
  const s = 256 * Math.pow(2, z);
  const x = ((lon + 180) / 360) * s;
  const rad = (lat * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * s;
  return { x, y };
};

export const unproject = (x: number, y: number, z: number) => {
  const s = 256 * Math.pow(2, z);
  const lon = (x / s) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / s;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lon };
};

export const fmtCoord = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? "E" : "W"}`;

/* ---------- public demo feeds (CORS-open HLS) ---------- */

export interface FeedDef {
  id: string;
  label: string;
  loc: string;
  src: string;
}

export const FEEDS: FeedDef[] = [
  {
    id: "f1",
    label: "DW NEWS · BERLIN",
    loc: "global newsroom — live HLS",
    src: "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8",
  },
  {
    id: "f2",
    label: "AL JAZEERA EN · DOHA",
    loc: "live broadcast — public HLS",
    src: "https://live-hls-web-aje.getaj.net/AJE/index.m3u8",
  },
  {
    id: "f3",
    label: "FRANCE 24 EN · PARIS",
    loc: "live broadcast — public HLS",
    src: "https://static.france24.com/live/F24_EN_HI_HLS/live_web.m3u8",
  },
  {
    id: "f4",
    label: "CGTN · BEIJING",
    loc: "live broadcast — public HLS",
    src: "https://live.cgtn.com/1000/prog_index.m3u8",
  },
  {
    id: "cam",
    label: "LOCAL OPTICS · YOUR CAMERA",
    loc: "barehands sensor link — getUserMedia",
    src: "",
  },
];
