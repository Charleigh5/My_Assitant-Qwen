/**
 * IMAGE SYNTH — prompt-to-image via the keyless Pollinations endpoint,
 * with a seeded procedural canvas fallback so the module never dead-ends.
 */

export interface GeneratedImage {
  id: string;
  src: string;
  prompt: string;
  seed: number;
  method: "ai" | "procedural" | "upload";
  kind?: "image" | "video";
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildImageUrl(prompt: string, seed: number, w = 768, h = 480) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${seed}&nologo=true`;
}

const PALETTES: [RegExp, string[]][] = [
  [/sunset|fire|lava|ember|flame|desert/i, ["#ff7a50", "#f5b94b", "#ff5d8f", "#ffd9a0"]],
  [/sea|ocean|water|wave|tide|ice|rain/i, ["#3fe0c5", "#54d8ff", "#5b9dff", "#bfeee8"]],
  [/forest|jungle|nature|leaf|meadow|moss/i, ["#9be15d", "#3fe0c5", "#f5d94b", "#d9f5b8"]],
  [/space|galaxy|cosmos|nebula|star|void|night/i, ["#7f7bff", "#b48cff", "#54d8ff", "#eaf4f3"]],
  [/neon|cyber|synth|grid|chrome|city/i, ["#3fe0c5", "#ff7ab8", "#f5b94b", "#54d8ff"]],
];
const DEFAULT_PALETTE = ["#3fe0c5", "#f5b94b", "#ff7a50", "#9be15d"];

function proceduralArt(prompt: string, seed: number): string {
  const W = 768;
  const H = 480;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  const rnd = mulberry(seed);
  const palette =
    PALETTES.find(([re]) => re.test(prompt))?.[1] ?? DEFAULT_PALETTE;
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];

  // base
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0f1b21");
  bg.addColorStop(1, "#0b1317");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // glow fields
  for (let i = 0; i < 3; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = 160 + rnd() * 260;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    const c = pick(palette);
    rg.addColorStop(0, c + "55");
    rg.addColorStop(1, c + "00");
    g.fillStyle = rg;
    g.fillRect(0, 0, W, H);
  }

  // horizon rings
  g.strokeStyle = "rgba(234,244,243,0.10)";
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.ellipse(W / 2, H * (0.55 + rnd() * 0.3), 80 + i * 90 + rnd() * 60, 26 + i * 18, 0, 0, Math.PI * 2);
    g.stroke();
  }

  // shapes
  for (let i = 0; i < 90; i++) {
    const c = pick(palette);
    const x = rnd() * W;
    const y = rnd() * H;
    const kind = rnd();
    g.save();
    g.translate(x, y);
    g.rotate(rnd() * Math.PI * 2);
    g.globalAlpha = 0.12 + rnd() * 0.5;
    g.strokeStyle = c;
    g.fillStyle = c;
    if (kind < 0.34) {
      g.beginPath();
      g.arc(0, 0, 1 + rnd() * 5, 0, Math.PI * 2);
      g.fill();
    } else if (kind < 0.6) {
      const r = 6 + rnd() * 34;
      g.lineWidth = 1 + rnd() * 2;
      g.beginPath();
      g.arc(0, 0, r, rnd() * Math.PI, rnd() * Math.PI + 1 + rnd() * 3);
      g.stroke();
    } else if (kind < 0.82) {
      const s = 4 + rnd() * 22;
      g.lineWidth = 1.4;
      g.strokeRect(-s / 2, -s / 2, s, s);
    } else {
      g.lineWidth = 1;
      const len = 20 + rnd() * 90;
      g.beginPath();
      g.moveTo(-len / 2, 0);
      g.lineTo(len / 2, 0);
      g.stroke();
    }
    g.restore();
  }

  // grain + vignette
  g.globalAlpha = 0.05;
  for (let i = 0; i < 1600; i++) {
    g.fillStyle = rnd() > 0.5 ? "#eaf4f3" : "#000000";
    g.fillRect(rnd() * W, rnd() * H, 1, 1);
  }
  g.globalAlpha = 1;
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);

  return cv.toDataURL("image/png");
}

export function generateImage(prompt: string): Promise<GeneratedImage> {
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const src = buildImageUrl(prompt, seed);
  const id = `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  return new Promise((resolve) => {
    const fallback = () =>
      resolve({ id, src: proceduralArt(prompt, seed), prompt, seed, method: "procedural" });
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = window.setTimeout(fallback, 45000);
    img.onload = () => {
      clearTimeout(timer);
      resolve({ id, src, prompt, seed, method: "ai" });
    };
    img.onerror = () => {
      clearTimeout(timer);
      fallback();
    };
    img.src = src;
  });
}
