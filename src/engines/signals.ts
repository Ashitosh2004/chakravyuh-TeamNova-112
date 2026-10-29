export type WaveShape = "sine" | "square" | "triangle" | "sawtooth";

export interface WaveParams {
  shape: WaveShape;
  amplitude: number;
  frequency: number; // Hz
  phase: number; // degrees
  offset?: number;
}

/** Value of a periodic waveform at time t (seconds). */
export function waveAt(p: WaveParams, t: number): number {
  const ph = (p.phase * Math.PI) / 180;
  const cycles = p.frequency * t + ph / (2 * Math.PI);
  const frac = cycles - Math.floor(cycles); // 0..1
  let v: number;
  switch (p.shape) {
    case "sine": v = Math.sin(2 * Math.PI * cycles); break;
    case "square": v = frac < 0.5 ? 1 : -1; break;
    case "triangle": v = frac < 0.5 ? 4 * frac - 1 : 3 - 4 * frac; break;
    case "sawtooth": v = 2 * frac - 1; break;
  }
  return p.amplitude * v + (p.offset ?? 0);
}

export function generateWave(p: WaveParams, duration: number, points = 600): { t: number; v: number }[] {
  return Array.from({ length: points }, (_, i) => {
    const t = (i / (points - 1)) * duration;
    return { t, v: waveAt(p, t) };
  });
}

export function samplePoints(p: WaveParams, fs: number, duration: number) {
  const n = Math.floor(duration * fs) + 1;
  return Array.from({ length: n }, (_, i) => {
    const t = i / fs;
    return { t, v: waveAt(p, t) };
  });
}

export function nyquistRate(fMax: number) {
  return 2 * fMax;
}

/** Apparent (aliased) frequency of a sinusoid f sampled at fs. */
export function aliasFrequency(f: number, fs: number) {
  const k = Math.round(f / fs);
  return Math.abs(f - k * fs);
}

/** Zero-order hold reconstruction value at t. */
export function zeroOrderHold(samples: { t: number; v: number }[], t: number) {
  let last = samples[0]?.v ?? 0;
  for (const s of samples) {
    if (s.t <= t) last = s.v;
    else break;
  }
  return last;
}

/** Uniform quantization to 2^bits levels across [-range, range]. */
export function quantize(v: number, bits: number, range: number) {
  const levels = 2 ** bits;
  const step = (2 * range) / (levels - 1);
  const clamped = Math.max(-range, Math.min(range, v));
  return Math.round((clamped + range) / step) * step - range;
}

export function rms(values: number[]) {
  return Math.sqrt(values.reduce((s, v) => s + v * v, 0) / Math.max(values.length, 1));
}
