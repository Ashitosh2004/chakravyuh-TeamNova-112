/** Simplified, educational analog modulation models. */

export interface AMParams {
  Ac: number; // carrier amplitude
  fc: number; // carrier frequency
  fm: number; // message frequency
  m: number; // modulation index (0..1.5)
}

export function amAt(p: AMParams, t: number) {
  return p.Ac * (1 + p.m * Math.cos(2 * Math.PI * p.fm * t)) * Math.cos(2 * Math.PI * p.fc * t);
}

export function amEnvelope(p: AMParams, t: number) {
  return p.Ac * (1 + p.m * Math.cos(2 * Math.PI * p.fm * t));
}

/** Power efficiency of tone-modulated AM: m²/(2+m²). */
export function amEfficiency(m: number) {
  return (m * m) / (2 + m * m);
}

export function amBandwidth(fm: number) {
  return 2 * fm;
}

export function amStatus(m: number): "under" | "full" | "over" {
  if (m > 1) return "over";
  if (Math.abs(m - 1) < 1e-9) return "full";
  return "under";
}

export interface FMParams {
  Ac: number;
  fc: number;
  fm: number;
  beta: number; // modulation index Δf/fm
}

export function fmAt(p: FMParams, t: number) {
  return p.Ac * Math.cos(2 * Math.PI * p.fc * t + p.beta * Math.sin(2 * Math.PI * p.fm * t));
}

export function fmInstFrequency(p: FMParams, t: number) {
  return p.fc + p.beta * p.fm * Math.cos(2 * Math.PI * p.fm * t);
}

/** Carson's rule: B ≈ 2(Δf + fm) = 2fm(β + 1). */
export function carsonBandwidth(beta: number, fm: number) {
  return 2 * fm * (beta + 1);
}

/** Deterministic pseudo-random generator (mulberry32) so noise demos are reproducible. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gaussian noise via Box–Muller, deterministic per seed. */
export function gaussianNoise(n: number, sigma: number, seed = 42) {
  const r = seededRandom(seed);
  return Array.from({ length: n }, () => {
    const u = Math.max(r(), 1e-12);
    const v = r();
    return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  });
}

export function snrDb(signalPower: number, noisePower: number) {
  if (noisePower <= 0) return Infinity;
  return 10 * Math.log10(signalPower / noisePower);
}

/** Noise standard deviation required for a target SNR given signal power. */
export function sigmaForSnr(signalPower: number, targetDb: number) {
  return Math.sqrt(signalPower / 10 ** (targetDb / 10));
}

/** Ideal envelope detector output (simplified): |envelope|. */
export function envelopeDetect(p: AMParams, t: number) {
  return Math.abs(amEnvelope(p, t));
}

/** Average power (mean square) of a sampled signal. */
export function rmsPower(values: number[]) {
  return values.reduce((s, v) => s + v * v, 0) / Math.max(values.length, 1);
}
