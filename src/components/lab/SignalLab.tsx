import { useMemo, useState } from "react";

import { Switch } from "@/components/ui/switch";
import type { Simulation } from "@/content/catalog";
import { aliasFrequency, generateWave, nyquistRate, quantize, samplePoints, zeroOrderHold, type WaveShape } from "@/engines/signals";
import { cn } from "@/lib/utils";
import { LabWorkspace, SliderRow, Stat } from "./LabWorkspace";
import { Plot } from "./Plot";

const DEF = { shape: "sine" as WaveShape, amplitude: 1, frequency: 3, phase: 0, fs: 20, bits: 3, sampling: true, quant: false, recon: true };

export function SignalLab({ sim }: { sim: Simulation }) {
  const [s, setS] = useState(DEF);
  const set = (p: Partial<typeof DEF>) => setS((x) => ({ ...x, ...p }));
  const [target, setTarget] = useState<number | null>(null);
  const dur = 1;
  const wave = { shape: s.shape, amplitude: s.amplitude, frequency: s.frequency, phase: s.phase };
  const cont = useMemo(() => generateWave(wave, dur, 800), [s.shape, s.amplitude, s.frequency, s.phase]);
  const samples = useMemo(() => samplePoints(wave, s.fs, dur).map((p) => ({ t: p.t, v: s.quant ? quantize(p.v, s.bits, Math.max(s.amplitude, 0.01)) : p.v })), [s]);
  const recon = useMemo(() => cont.map((p) => ({ t: p.t, v: zeroOrderHold(samples, p.t) })), [cont, samples]);
  const nyq = nyquistRate(s.frequency);
  const ok = s.fs > nyq;
  const alias = aliasFrequency(s.frequency, s.fs);

  const series = [
    { label: `${s.shape} — continuous`, className: s.sampling ? "stroke-muted-foreground" : "stroke-signal", points: cont },
    ...(s.sampling ? [{ label: `Samples (fs = ${s.fs} Hz)${s.quant ? `, ${s.bits}-bit` : ""}`, className: "stroke-signal", points: samples, dots: true, dashed: true }] : []),
    ...(s.sampling && s.recon ? [{ label: "Zero-order-hold reconstruction", className: "stroke-success", points: recon }] : []),
  ];

  return (
    <LabWorkspace
      sim={sim}
      onReset={() => { setS(DEF); setTarget(null); }}
      instructions={["Pick a waveform and adjust amplitude, frequency and phase.", "Enable sampling and lower fs below 2f to observe aliasing.", "Turn on quantization and reduce the bit depth to see step error.", "Compare the reconstruction with the original."]}
      examples={[{ label: "Aliasing example", apply: () => setS({ ...DEF, frequency: 9, fs: 10 }) }, { label: "Well sampled", apply: () => setS({ ...DEF, frequency: 2, fs: 40 }) }, { label: "Coarse quantization", apply: () => setS({ ...DEF, quant: true, bits: 2, fs: 40 }) }]}
      controls={
        <div>
          <div className="mb-3 grid grid-cols-2 gap-1">{(["sine", "square", "triangle", "sawtooth"] as WaveShape[]).map((w) => <button key={w} aria-pressed={s.shape === w} onClick={() => set({ shape: w })} className={cn("rounded-md border py-1.5 text-xs capitalize", s.shape === w ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}>{w}</button>)}</div>
          <SliderRow id="amp" label="Amplitude" value={s.amplitude} min={0.1} max={2} step={0.1} unit="V" onChange={(v) => set({ amplitude: v })} />
          <SliderRow id="freq" label="Frequency f" value={s.frequency} min={1} max={20} step={1} unit="Hz" onChange={(v) => set({ frequency: v })} />
          <SliderRow id="ph" label="Phase" value={s.phase} min={-180} max={180} step={15} unit="°" onChange={(v) => set({ phase: v })} />
          <label className="mb-2 flex items-center justify-between text-xs">Sampling <Switch checked={s.sampling} onCheckedChange={(v) => set({ sampling: v })} /></label>
          {s.sampling && <>
            <SliderRow id="fs" label="Sampling rate fs" value={s.fs} min={2} max={80} step={1} unit="Hz" onChange={(v) => set({ fs: v })} />
            <label className="mb-2 flex items-center justify-between text-xs">Reconstruction <Switch checked={s.recon} onCheckedChange={(v) => set({ recon: v })} /></label>
            <label className="mb-2 flex items-center justify-between text-xs">Quantization <Switch checked={s.quant} onCheckedChange={(v) => set({ quant: v })} /></label>
            {s.quant && <SliderRow id="bits" label="Bits" value={s.bits} min={1} max={8} step={1} onChange={(v) => set({ bits: v })} />}
          </>}
        </div>
      }
      canvas={<Plot ariaLabel="Signal plot" tMax={dur} vMax={2.2} height={280} series={series} />}
      outputs={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Period T" value={`${(1000 / s.frequency).toFixed(1)} ms`} />
          <Stat label="Nyquist rate" value={`${nyq} Hz`} />
          {s.sampling && <Stat label="fs vs 2f" value={ok ? "OK" : "Aliasing"} tone={ok ? "ok" : "bad"} />}
          {s.sampling && <Stat label="Apparent freq" value={`${s.shape === "sine" ? alias.toFixed(1) : "—"} Hz`} tone={alias !== s.frequency && s.shape === "sine" ? "warn" : undefined} />}
          {s.quant && <Stat label="Levels" value={2 ** s.bits} />}
        </div>
      }
      explanation={
        <div className="space-y-2">
          <p>x(t) = {s.amplitude.toFixed(1)}·{s.shape}(2π·{s.frequency}·t + {s.phase}°). Increasing frequency packs more cycles into the window (shorter period T = 1/f); phase shifts the waveform left or right; amplitude scales it vertically.</p>
          {s.sampling && <p>{ok ? `fs = ${s.fs} Hz exceeds 2f = ${nyq} Hz, so the samples capture the signal.` : `fs = ${s.fs} Hz is below 2f = ${nyq} Hz — aliasing. A sine at ${s.frequency} Hz appears as ${alias.toFixed(1)} Hz.`} {s.shape !== "sine" && "Non-sine waves contain harmonics above f, so they need even higher sampling rates to be captured faithfully."}</p>}
          {s.quant && <p>With {s.bits} bits there are {2 ** s.bits} levels; each sample is rounded to the nearest level, producing quantization error of at most ±Δ/2.</p>}
        </div>
      }
      challenge={
        target === null ? <button className="text-sm font-medium text-signal underline" onClick={() => { const f = 2 + Math.floor(Math.random() * 10); setTarget(f); setS({ ...DEF, frequency: f, fs: 4 }); }}>Start: find the minimum valid fs</button> : (
          <div className="space-y-2 text-sm">
            <p>For a {target} Hz sine, set fs to the <strong>smallest integer</strong> rate that avoids aliasing.</p>
            {s.frequency !== target ? <p className="text-muted-foreground">Keep frequency at {target} Hz.</p> : s.fs === 2 * target + 1 ? <p className="font-medium text-success" role="status">Correct — fs must be strictly greater than {2 * target} Hz.</p> : <p className="text-muted-foreground">Current fs = {s.fs} Hz. {s.fs <= 2 * target ? "Too low." : "Valid, but can you go lower?"}</p>}
          </div>
        )
      }
    />
  );
}
