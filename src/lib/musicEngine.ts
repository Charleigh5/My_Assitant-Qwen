import type { PersonaId } from "./personas";

export type Genre = "lofi" | "synthwave" | "house" | "ambient";

export const GENRE_LABEL: Record<Genre, string> = {
  lofi: "LO-FI",
  synthwave: "SYNTHWAVE",
  house: "HOUSE",
  ambient: "AMBIENT",
};

export interface Track {
  id: string;
  title: string;
  genre: Genre;
  rootName: string;
  scaleName: string;
  bpm: number;
  seed: number;
  swing: number;
  persona: PersonaId;
  chords: number[][];
  bass: (number | null)[];
  melody: (number | null)[];
  kick: number[];
  snare: number[];
  hat: number[];
  openHat: number[];
}

export interface StepEvent {
  step: number;
  bar: number;
  time: number;
  beat: boolean;
}

const STEPS = 64;
const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROOTS = [
  { name: "C", m: 48 },
  { name: "D", m: 50 },
  { name: "E♭", m: 51 },
  { name: "E", m: 52 },
  { name: "F", m: 53 },
  { name: "G", m: 55 },
  { name: "A", m: 57 },
  { name: "B♭", m: 58 },
];

const SCALES: Record<string, number[]> = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
};

const PENT: Record<string, number[]> = {
  minor: [0, 3, 5, 7, 10],
  dorian: [0, 3, 5, 7, 9],
  major: [0, 2, 4, 7, 9],
};

const PROGS: Record<Genre, number[][]> = {
  lofi: [
    [0, 5, 3, 4],
    [0, 3, 5, 4],
    [0, 5, 2, 3],
  ],
  synthwave: [
    [0, 5, 2, 6],
    [0, 3, 5, 6],
    [0, 6, 5, 6],
  ],
  house: [
    [0, 0, 5, 6],
    [0, 3, 0, 6],
    [0, 5, 3, 6],
  ],
  ambient: [
    [0, 5, 3, 2],
    [0, 3, 5, 4],
    [0, 2, 5, 3],
  ],
};

const BPM_RANGE: Record<Genre, [number, number]> = {
  lofi: [74, 88],
  synthwave: [98, 114],
  house: [120, 127],
  ambient: [60, 70],
};

const TITLES: Record<Genre, string[]> = {
  lofi: ["Rainy Terminal", "Midnight Commit", "Paper Planets", "Static Bloom", "Slow Deployment", "Dusty Router", "Tea at the Stack"],
  synthwave: ["Neon Interstate", "Chrome Sunset", "Laser Meridian", "Grid Runner", "Turbo Mirage", "Night Circuit", "Analog Hearts"],
  house: ["Warehouse Sun", "Pulse Doctrine", "Mirrorball Logic", "Deep End Dispatch", "Strobe Garden", "Four on the Floor", "Velvet Payload"],
  ambient: ["Glass Horizon", "Sleeping Servers", "Vapor Field", "Low Tide Memory", "Airborne Archive", "Quiet Orbit", "Slow Light"],
};

function buildChord(rootMidi: number, scale: number[], degree: number, seventh: boolean, add9: boolean) {
  const pick = (i: number) => rootMidi + scale[i % scale.length] + 12 * Math.floor(i / scale.length);
  const notes = [pick(degree), pick(degree + 2), pick(degree + 4)];
  if (seventh) notes.push(pick(degree + 6));
  if (add9) notes.push(pick(degree + 1) + 12);
  return notes;
}

export interface GenOptions {
  genre?: Genre;
  bpm?: number;
  persona: PersonaId;
  seed?: number;
}

export function generateTrack(opts: GenOptions): Track {
  const seed = opts.seed ?? Math.floor(Math.random() * 1_000_000_000);
  const rnd = mulberry32(seed);
  const genre = opts.genre ?? (["lofi", "synthwave", "house", "ambient"] as Genre[])[Math.floor(rnd() * 4)];
  const root = ROOTS[Math.floor(rnd() * ROOTS.length)];
  const scaleName = genre === "house" ? "dorian" : genre === "ambient" ? "major" : "minor";
  const scale = SCALES[scaleName];
  const pent = PENT[scaleName];
  const [lo, hi] = BPM_RANGE[genre];
  const bpm = opts.bpm ?? lo + Math.floor(rnd() * (hi - lo + 1));
  const swing = genre === "lofi" ? 0.13 : genre === "house" ? 0.04 : 0;
  const progPool = PROGS[genre];
  const prog = progPool[Math.floor(rnd() * progPool.length)];
  const chords = prog.map((d) => buildChord(root.m, scale, d, genre === "lofi", genre === "ambient"));

  const bass: (number | null)[] = new Array(STEPS).fill(null);
  const melody: (number | null)[] = new Array(STEPS).fill(null);
  const kick = new Array(STEPS).fill(0);
  const snare = new Array(STEPS).fill(0);
  const hat = new Array(STEPS).fill(0);
  const openHat = new Array(STEPS).fill(0);

  let prevMel = root.m + 24 + pent[Math.floor(rnd() * pent.length)];

  for (let bar = 0; bar < 4; bar++) {
    const chordRoot = chords[bar][0];
    const arp = chords[bar].map((n) => n + 12);
    for (let s = 0; s < 16; s++) {
      const i = bar * 16 + s;

      if (genre === "lofi") {
        if (s === 0) kick[i] = 1;
        if (s === 10) kick[i] = 0.9;
        if (s === 7 && rnd() < 0.35) kick[i] = 0.75;
        if (s === 4 || s === 12) snare[i] = 0.8;
        if (s % 2 === 0 && rnd() > 0.14) hat[i] = 0.3 + rnd() * 0.3;
        if (s === 0) bass[i] = chordRoot - 12;
        if (s === 10) bass[i] = chordRoot - 12;
        if (s === 14 && rnd() < 0.45) bass[i] = chordRoot - 5;
        if ([0, 3, 6, 8, 11, 14].includes(s) && rnd() < 0.55) {
          prevMel = rnd() < 0.6
            ? chords[bar][Math.floor(rnd() * chords[bar].length)] + 12
            : root.m + 24 + pent[Math.floor(rnd() * pent.length)];
          melody[i] = prevMel;
        }
      } else if (genre === "synthwave") {
        if (s % 8 === 0) kick[i] = 1;
        if (s === 14 && bar % 2 === 1 && rnd() < 0.6) kick[i] = 0.7;
        if (s === 4 || s === 12) snare[i] = 0.95;
        if (s % 2 === 0) hat[i] = s % 4 === 2 ? 0.5 : 0.35;
        if (s === 14 && rnd() < 0.55) openHat[i] = 0.45;
        if (s % 2 === 0) bass[i] = s === 14 && rnd() < 0.4 ? chordRoot : chordRoot - 12;
        if (s % 2 === 0 && rnd() < 0.92) {
          melody[i] = arp[(s / 2) % arp.length] + (rnd() < 0.15 ? 12 : 0);
        }
      } else if (genre === "house") {
        if (s % 4 === 0) kick[i] = 1;
        if (s === 4 || s === 12) snare[i] = 0.85;
        if (s % 4 === 2) openHat[i] = 0.55;
        if (s % 2 === 1) hat[i] = 0.28 + rnd() * 0.16;
        if (s % 4 === 2) bass[i] = chordRoot - 12;
        if (s % 4 === 0 && s !== 0 && rnd() < 0.5) bass[i] = chordRoot - 12;
        if (s === 14 && rnd() < 0.3) bass[i] = chordRoot;
        if ([2, 6, 10, 14].includes(s) && rnd() < 0.5) {
          melody[i] = chords[bar][Math.floor(rnd() * chords[bar].length)] + 24;
        }
      } else {
        // ambient
        if (bar % 2 === 0 && s === 0) kick[i] = 0.45;
        if (s === 8) hat[i] = 0.14;
        if (s === 0) bass[i] = chordRoot - 12;
        if (s === 0 && rnd() < 0.72) melody[i] = chords[bar][Math.floor(rnd() * chords[bar].length)] + 24;
        if (s === 8 && rnd() < 0.4) melody[i] = root.m + 36 + pent[Math.floor(rnd() * pent.length)];
      }
    }
  }

  const titles = TITLES[genre];
  const title = titles[Math.floor(rnd() * titles.length)];

  return {
    id: `${seed.toString(36)}-${genre}`,
    title,
    genre,
    rootName: root.name,
    scaleName,
    bpm,
    seed,
    swing,
    persona: opts.persona,
    chords,
    bass,
    melody,
    kick,
    snare,
    hat,
    openHat,
  };
}

/* ================= AUDIO ENGINE ================= */

class MusicEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private wet: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private vinylGain: GainNode | null = null;
  private vinylSrc: AudioBufferSourceNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private track: Track | null = null;
  private step = 0;
  private nextTime = 0;
  private stepListeners = new Set<(e: StepEvent) => void>();
  private stateListeners = new Set<(playing: boolean) => void>();
  private levelBuf: Uint8Array | null = null;
  private pendingVolume = 0.85;
  isPlaying = false;

  private ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.pendingVolume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    master.connect(comp);
    comp.connect(analyser);
    analyser.connect(ctx.destination);
    this.master = master;
    this.analyser = analyser;
    this.levelBuf = new Uint8Array(analyser.frequencyBinCount);

    // feedback delay bus
    const wetIn = ctx.createGain();
    wetIn.gain.value = 1;
    const delay = ctx.createDelay(1.2);
    delay.delayTime.value = 0.29;
    const fb = ctx.createGain();
    fb.gain.value = 0.36;
    const dampen = ctx.createBiquadFilter();
    dampen.type = "lowpass";
    dampen.frequency.value = 2600;
    const wetOut = ctx.createGain();
    wetOut.gain.value = 0.3;
    wetIn.connect(delay);
    delay.connect(dampen);
    dampen.connect(fb);
    fb.connect(delay);
    dampen.connect(wetOut);
    wetOut.connect(master);
    this.wet = wetIn;

    // shared noise buffer
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  }

  private setVinyl(on: boolean) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    if (on && !this.vinylSrc) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 3600;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      src.connect(lp);
      lp.connect(g);
      g.connect(this.master);
      src.start();
      g.gain.setTargetAtTime(0.011, t, 0.4);
      this.vinylSrc = src;
      this.vinylGain = g;
    } else if (!on && this.vinylSrc && this.vinylGain) {
      this.vinylGain.gain.setTargetAtTime(0, t, 0.15);
      const src = this.vinylSrc;
      setTimeout(() => {
        try { src.stop(); } catch { /* already stopped */ }
      }, 900);
      this.vinylSrc = null;
      this.vinylGain = null;
    }
  }

  play(track: Track) {
    this.ensure();
    const ctx = this.ctx!;
    void ctx.resume();
    this.track = track;
    if (this.isPlaying) return;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.1;
    this.isPlaying = true;
    this.timer = setInterval(this.tick, 25);
    if (track.genre === "lofi") this.setVinyl(true);
    this.stateListeners.forEach((cb) => cb(true));
  }

  stop() {
    if (!this.isPlaying) return;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.isPlaying = false;
    this.setVinyl(false);
    this.stateListeners.forEach((cb) => cb(false));
  }

  setTrack(track: Track) {
    this.track = track;
    if (this.isPlaying) this.setVinyl(track.genre === "lofi");
  }

  setVolume(v: number) {
    this.pendingVolume = v;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03);
    }
  }

  onStep(cb: (e: StepEvent) => void) {
    this.stepListeners.add(cb);
    return () => { this.stepListeners.delete(cb); };
  }

  onState(cb: (playing: boolean) => void) {
    this.stateListeners.add(cb);
    return () => { this.stateListeners.delete(cb); };
  }

  now(): number | null {
    return this.ctx ? this.ctx.currentTime : null;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  getLevel(): number {
    if (!this.analyser || !this.levelBuf) return 0;
    this.analyser.getByteFrequencyData(this.levelBuf as Uint8Array<ArrayBuffer>);
    let sum = 0;
    for (let i = 0; i < this.levelBuf.length; i++) sum += this.levelBuf[i];
    return sum / this.levelBuf.length / 255;
  }

  /* ---------- scheduler ---------- */

  private tick = () => {
    if (!this.ctx || !this.track) return;
    const ahead = this.ctx.currentTime + 0.14;
    while (this.nextTime < ahead) {
      this.scheduleStep(this.step, this.nextTime);
      this.nextTime += 60 / this.track.bpm / 4;
      this.step = (this.step + 1) % STEPS;
    }
  };

  private scheduleStep(step: number, time: number) {
    const tr = this.track;
    if (!tr) return;
    const sps = 60 / tr.bpm / 4;
    const t = time + (step % 2 === 1 ? tr.swing * sps : 0);
    const bar = step >> 4;
    const s = step & 15;

    if (tr.kick[step]) this.kick(t, tr.kick[step], tr.genre === "house");
    if (tr.snare[step]) this.snare(t, tr.snare[step]);
    if (tr.hat[step]) this.hat(t, tr.hat[step], false);
    if (tr.openHat[step]) this.hat(t, tr.openHat[step], true);
    if (s === 0) this.pad(t, tr.chords[bar], sps * 16 * 0.97, tr.genre);
    if (tr.bass[step] != null) {
      const dur = tr.genre === "ambient" ? sps * 14 : tr.genre === "house" ? sps * 1.7 : tr.genre === "synthwave" ? sps * 1.8 : sps * 3.2;
      this.bassNote(t, tr.bass[step]!, dur, tr.genre);
    }
    if (tr.melody[step] != null) {
      const dur = tr.genre === "ambient" ? sps * 12 : tr.genre === "house" ? sps * 1.1 : tr.genre === "synthwave" ? sps * 1.6 : sps * 2.6;
      this.lead(t, tr.melody[step]!, dur, tr.genre);
    }

    this.stepListeners.forEach((cb) => cb({ step, bar, time: t, beat: s % 4 === 0 }));
  }

  /* ---------- instruments ---------- */

  private kick(t: number, vel: number, punchy: boolean) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(punchy ? 170 : 150, t);
    osc.frequency.exponentialRampToValueAtTime(punchy ? 48 : 42, t + 0.1);
    g.gain.setValueAtTime(0.9 * vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    osc.connect(g);
    g.connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.3);
    if (punchy) {
      // click transient
      const n = ctx.createBufferSource();
      n.buffer = this.noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 900;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.25 * vel, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      n.connect(hp); hp.connect(ng); ng.connect(this.master!);
      n.start(t); n.stop(t + 0.05);
    }
  }

  private snare(t: number, vel: number) {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5 * vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    n.connect(bp); bp.connect(g); g.connect(this.master!);
    n.start(t); n.stop(t + 0.2);

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(196, t);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.25 * vel, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(og); og.connect(this.master!);
    osc.start(t); osc.stop(t + 0.12);
  }

  private hat(t: number, vel: number, open: boolean) {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7400;
    const g = ctx.createGain();
    const decay = open ? 0.32 : 0.055;
    g.gain.setValueAtTime(0.32 * vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    n.connect(hp); hp.connect(g); g.connect(this.master!);
    n.start(t); n.stop(t + decay + 0.05);
  }

  private bassNote(t: number, midi: number, dur: number, genre: Genre) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = genre === "lofi" || genre === "ambient" ? "triangle" : "sawtooth";
    osc.frequency.value = midiHz(midi);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = genre === "lofi" ? 380 : genre === "ambient" ? 300 : 620;
    lp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.015);
    g.gain.setTargetAtTime(0.22, t + 0.05, 0.08);
    g.gain.setTargetAtTime(0, t + dur, 0.05);
    osc.connect(lp); lp.connect(g); g.connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.4);
  }

  private pad(t: number, notes: number[], dur: number, genre: Genre) {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = genre === "synthwave" ? 1500 : genre === "house" ? 1100 : 820;
    lp.Q.value = 0.4;
    const bus = ctx.createGain();
    bus.gain.value = 1;
    lp.connect(bus);
    bus.connect(this.master!);
    const attack = genre === "ambient" ? 1.4 : 0.3;
    const per = genre === "ambient" ? 0.05 : 0.042;

    notes.forEach((m) => {
      [-6, 6].forEach((cents) => {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = midiHz(m);
        osc.detune.value = cents;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(per, t + attack);
        g.gain.setValueAtTime(per, t + Math.max(attack, dur - 0.5));
        g.gain.linearRampToValueAtTime(0, t + dur + 0.7);
        osc.connect(g);
        g.connect(lp);
        osc.start(t);
        osc.stop(t + dur + 0.9);
      });
    });

    if (genre === "ambient") {
      const send = ctx.createGain();
      send.gain.value = 0.5;
      bus.connect(send);
      send.connect(this.wet!);
    }
  }

  private lead(t: number, midi: number, dur: number, genre: Genre) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = genre === "lofi" ? "triangle" : genre === "ambient" ? "sine" : genre === "synthwave" ? "sawtooth" : "square";
    osc.frequency.value = midiHz(midi);
    if (genre === "synthwave") osc.detune.value = 5;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = genre === "synthwave" ? 3200 : 2400;
    const g = ctx.createGain();
    const peak = genre === "ambient" ? 0.13 : 0.16;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + Math.max(dur, 0.12));
    osc.connect(lp); lp.connect(g); g.connect(this.master!);
    osc.start(t);
    osc.stop(t + Math.max(dur, 0.12) + 0.1);

    const send = ctx.createGain();
    send.gain.value = genre === "ambient" ? 0.9 : genre === "lofi" ? 0.45 : 0.35;
    g.connect(send);
    send.connect(this.wet!);
  }
}

export const engine = new MusicEngine();
