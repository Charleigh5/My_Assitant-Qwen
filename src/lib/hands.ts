/**
 * BAREHANDS — webcam hand-tracking interface (MediaPipe HandLandmarker).
 * Turns the webcam into a pinch-to-grab controller: no headset, no mouse.
 */

export interface HandFrame {
  present: boolean;
  /** normalized 0..1, already mirrored to match the user's view */
  x: number;
  y: number;
  /** 0 = open … 1 = fully pinched */
  pinch: number;
  /** latched pinch state (with hysteresis) */
  pinched: boolean;
  /** 0 = fist … 1 = open palm */
  palm: number;
}

export type HandStatus = "off" | "loading" | "active" | "denied" | "error";

export const EMPTY_FRAME: HandFrame = {
  present: false,
  x: 0.5,
  y: 0.5,
  pinch: 0,
  pinched: false,
  palm: 0,
};

const VISION_VERSION = "0.10.14";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const ESM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/+esm`;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

export class BareHands {
  /** mutated in place every frame — safe to read from rAF / useFrame loops */
  state: HandFrame = { ...EMPTY_FRAME };
  status: HandStatus = "off";
  canvas: HTMLCanvasElement | null = null;
  accent = "#3fe0c5";

  private video: HTMLVideoElement | null = null;
  private landmarker: any = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  private statusListeners = new Set<(s: HandStatus) => void>();

  onStatus(fn: (s: HandStatus) => void): () => void {
    this.statusListeners.add(fn);
    fn(this.status);
    return () => this.statusListeners.delete(fn);
  }

  private setStatus(s: HandStatus) {
    this.status = s;
    this.statusListeners.forEach((fn) => fn(s));
  }

  async start(video: HTMLVideoElement): Promise<void> {
    if (this.status === "active" || this.status === "loading") return;
    this.video = video;
    this.setStatus("loading");

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
    } catch {
      this.setStatus("denied");
      return;
    }

    video.srcObject = this.stream;
    video.muted = true;
    video.playsInline = true;
    await video.play().catch(() => undefined);

    try {
      const vision: any = await import(/* @vite-ignore */ ESM_URL);
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);
      const opts = (delegate: string) => ({
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: "VIDEO",
        numHands: 1,
      });
      try {
        this.landmarker = await vision.HandLandmarker.createFromOptions(fileset, opts("GPU"));
      } catch {
        this.landmarker = await vision.HandLandmarker.createFromOptions(fileset, opts("CPU"));
      }
    } catch {
      this.killStream();
      this.setStatus("error");
      return;
    }

    this.setStatus("active");
    cancelAnimationFrame(this.raf);
    this.loop();
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.landmarker) {
      try {
        this.landmarker.close();
      } catch {
        /* noop */
      }
      this.landmarker = null;
    }
    this.killStream();
    this.state.present = false;
    this.state.pinched = false;
    this.state.pinch = 0;
    this.setStatus("off");
  }

  private killStream() {
    if (this.video) {
      try {
        this.video.srcObject = null;
      } catch {
        /* noop */
      }
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const v = this.video;
    const lm = this.landmarker;
    if (!v || !lm || v.readyState < 2) return;

    let res: any = null;
    try {
      res = lm.detectForVideo(v, performance.now());
    } catch {
      return;
    }
    const lms: { x: number; y: number }[] | undefined = res?.landmarks?.[0];
    if (!lms || lms.length < 21) {
      this.state.present = false;
      this.state.pinched = false;
      this.draw(null);
      return;
    }

    this.state.present = true;
    const idx = lms[8];
    const nx = 1 - idx.x;
    const ny = idx.y;
    this.state.x += (nx - this.state.x) * 0.5;
    this.state.y += (ny - this.state.y) * 0.5;

    const handSize = dist(lms[0], lms[9]) || 0.0001;
    const pinchRatio = dist(lms[4], lms[8]) / handSize;
    const pinch = clamp01((0.52 - pinchRatio) / 0.3);
    this.state.pinch += (pinch - this.state.pinch) * 0.55;

    // hysteresis latch so pinches don't flicker
    if (!this.state.pinched && this.state.pinch > 0.74) this.state.pinched = true;
    else if (this.state.pinched && this.state.pinch < 0.36) this.state.pinched = false;

    const tips = [8, 12, 16, 20];
    const avg = tips.reduce((s, i) => s + dist(lms[0], lms[i]), 0) / tips.length / handSize;
    this.state.palm = clamp01((avg - 1.15) / 0.6);

    this.draw(lms);
  };

  private draw(lms: { x: number; y: number }[] | null) {
    const cv = this.canvas;
    if (!cv) return;
    const g = cv.getContext("2d");
    if (!g) return;
    const W = (cv.width = cv.clientWidth * 2 || 320);
    const H = (cv.height = cv.clientHeight * 2 || 240);
    g.clearRect(0, 0, W, H);
    if (!lms) return;

    const px = (p: { x: number; y: number }) => [(1 - p.x) * W, p.y * H] as const;
    const acc = this.accent;

    // skeleton links
    const links = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [5, 9], [9, 10], [10, 11], [11, 12],
      [9, 13], [13, 14], [14, 15], [15, 16],
      [13, 17], [17, 18], [18, 19], [19, 20],
      [0, 17],
    ];
    g.strokeStyle = "rgba(234,244,243,0.28)";
    g.lineWidth = 2;
    for (const [a, b] of links) {
      const [ax, ay] = px(lms[a]);
      const [bx, by] = px(lms[b]);
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
      g.stroke();
    }

    // pinch line
    const [t4x, t4y] = px(lms[4]);
    const [t8x, t8y] = px(lms[8]);
    g.strokeStyle = acc;
    g.globalAlpha = 0.35 + this.state.pinch * 0.65;
    g.lineWidth = 2 + this.state.pinch * 4;
    g.beginPath();
    g.moveTo(t4x, t4y);
    g.lineTo(t8x, t8y);
    g.stroke();
    g.globalAlpha = 1;

    // landmarks
    lms.forEach((p, i) => {
      const [x, y] = px(p);
      const tip = [4, 8, 12, 16, 20].includes(i);
      g.fillStyle = tip ? acc : "rgba(234,244,243,0.75)";
      g.beginPath();
      g.arc(x, y, tip ? 7 : 4.5, 0, Math.PI * 2);
      g.fill();
    });

    // pinch halo
    if (this.state.pinched) {
      g.strokeStyle = acc;
      g.lineWidth = 3;
      g.beginPath();
      g.arc((t4x + t8x) / 2, (t4y + t8y) / 2, 22, 0, Math.PI * 2);
      g.stroke();
    }
  }
}
