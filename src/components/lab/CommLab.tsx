import { useMemo, useState } from "react";

import { Switch } from "@/components/ui/switch";
import type { Simulation } from "@/content/catalog";
import { amAt, amBandwidth, amEfficiency, amEnvelope, amStatus, carsonBandwidth, envelopeDetect, fmAt, gaussianNoise, rmsPower, sigmaForSnr, snrDb } from "@/engines/communication";
import { cn } from "@/lib/utils";
import { LabWorkspace, SliderRow, Stat } from "./LabWorkspace";
import { Plot } from "./Plot";

const DEF = { mode: "AM" as "AM" | "FM", Ac: 1, fc: 25, fm: 2, m: 0.6, beta: 4, noise: false, snr: 15, demod: false };
const N = 1000;

export function CommLab({ sim }: { sim: Simulation }) {
  const [s, setS] = useState(DEF);
  const set = (p: Partial<typeof DEF>) => setS((x) => ({ ...x, ...p }));
  const ts = useMemo(() => Array.from({ length: N }, (_, i) => i / (N - 1)), []);
  const data = useMemo(() => {
    const clean = ts.map((t) => (s.mode === "AM" ? amAt({ Ac: s.Ac, fc: s.fc, fm: s.fm, m: s.m }, t) : fmAt({ Ac: s.Ac, fc: s.fc, fm: s.fm, beta: s.beta }, t)));
    const sp = rmsPower(clean);
    const noise = s.noise ? gaussianNoise(N, sigmaForSnr(sp, s.snr), 7) : new Array(N).fill(0);
    const rx = clean.map((v, i) => v + noise[i]);
    const measured = s.noise ? snrDb(sp, rmsPower(noise)) : Infinity;
    return { clean, rx, measured };
  }, [s, ts]);

  const msg = ts.map((t) => ({ t, v: s.Ac * Math.cos(2 * Math.PI * s.fm * t) * (s.mode === "AM" ? s.m : 1) }));
  const series = [
    { label: s.noise ? "Received (signal + noise)" : `${s.mode} signal`, className: "stroke-signal", points: ts.map((t, i) => ({ t, v: data.rx[i] })) },
    ...(s.mode === "AM" ? [{ label: "Envelope", className: "stroke-success", dashed: true, points: ts.map((t) => ({ t, v: amEnvelope({ Ac: s.Ac, fc: s.fc, fm: s.fm, m: s.m }, t) })) }] : []),
  ];
  const status = amStatus(s.m);

  return (
    <LabWorkspace
      sim={sim}
      onReset={() => setS(DEF)}
      note="Simplified educational models: ideal tone modulation, additive white Gaussian noise with a fixed seed, ideal envelope detector. Not a telecom-grade simulator."
      instructions={["Choose AM or FM.", "Adjust the carrier and message frequencies.", "Change the modulation index — watch the envelope (AM) or the frequency swing (FM).", "Add noise and lower the SNR to see how reception degrades."]}
      examples={[{ label: "AM over-modulated", apply: () => setS({ ...DEF, m: 1.4 }) }, { label: "Wideband FM", apply: () => setS({ ...DEF, mode: "FM", beta: 8 }) }, { label: "Noisy channel (5 dB)", apply: () => setS({ ...DEF, noise: true, snr: 5 }) }]}
      controls={
        <div>
          <div className="mb-3 grid grid-cols-2 gap-1">{(["AM", "FM"] as const).map((m) => <button key={m} aria-pressed={s.mode === m} onClick={() => set({ mode: m })} className={cn("rounded-md border py-1.5 text-xs", s.mode === m ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}>{m}</button>)}</div>
          <SliderRow id="ac" label="Carrier amplitude Ac" value={s.Ac} min={0.2} max={1.5} step={0.1} unit="V" onChange={(v) => set({ Ac: v })} />
          <SliderRow id="fc" label="Carrier frequency fc" value={s.fc} min={10} max={60} step={1} unit="Hz" onChange={(v) => set({ fc: v })} />
          <SliderRow id="fm" label="Message frequency fm" value={s.fm} min={1} max={8} step={1} unit="Hz" onChange={(v) => set({ fm: v })} />
          {s.mode === "AM" ? <SliderRow id="m" label="Modulation index m" value={s.m} min={0} max={1.5} step={0.05} onChange={(v) => set({ m: v })} /> : <SliderRow id="beta" label="FM index β" value={s.beta} min={0} max={12} step={0.5} onChange={(v) => set({ beta: v })} />}
          <label className="mb-2 flex items-center justify-between text-xs">Add channel noise <Switch checked={s.noise} onCheckedChange={(v) => set({ noise: v })} /></label>
          {s.noise && <SliderRow id="snr" label="Target SNR" value={s.snr} min={-5} max={40} step={1} unit="dB" onChange={(v) => set({ snr: v })} />}
          {s.mode === "AM" && <label className="flex items-center justify-between text-xs">Show demodulated output <Switch checked={s.demod} onCheckedChange={(v) => set({ demod: v })} /></label>}
        </div>
      }
      canvas={
        <div className="space-y-3">
          <Plot ariaLabel="Message signal" tMax={1} vMax={1.6} height={110} series={[{ label: "Message m(t)", className: "stroke-chart-1", points: msg }]} />
          <Plot ariaLabel="Modulated signal" tMax={1} vMax={Math.max(2.6, s.Ac * (1 + s.m) * 1.3)} height={220} series={series} />
          {s.mode === "AM" && s.demod && <Plot ariaLabel="Demodulated output" tMax={1} vMax={Math.max(2.6, s.Ac * (1 + s.m) * 1.3)} height={110} series={[{ label: "Envelope detector output |envelope|", className: "stroke-success", points: ts.map((t) => ({ t, v: envelopeDetect({ Ac: s.Ac, fc: s.fc, fm: s.fm, m: s.m }, t) })) }]} />}
        </div>
      }
      outputs={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {s.mode === "AM" ? <>
            <Stat label="Modulation" value={status === "over" ? "Over" : status === "full" ? "100%" : "Under"} tone={status === "over" ? "bad" : "ok"} />
            <Stat label="Bandwidth" value={`${amBandwidth(s.fm)} Hz`} />
            <Stat label="Efficiency η" value={`${(amEfficiency(Math.min(s.m, 1)) * 100).toFixed(1)}%`} />
            <Stat label="Sidebands" value={`${s.fc - s.fm} / ${s.fc + s.fm} Hz`} />
          </> : <>
            <Stat label="Peak deviation Δf" value={`${(s.beta * s.fm).toFixed(1)} Hz`} />
            <Stat label="Carson bandwidth" value={`${carsonBandwidth(s.beta, s.fm).toFixed(1)} Hz`} />
            <Stat label="Freq range" value={`${(s.fc - s.beta * s.fm).toFixed(0)}–${(s.fc + s.beta * s.fm).toFixed(0)} Hz`} tone={s.fc - s.beta * s.fm < 0 ? "warn" : undefined} />
          </>}
          {s.noise && <Stat label="Measured SNR" value={`${data.measured.toFixed(1)} dB`} tone={data.measured > 15 ? "ok" : data.measured > 5 ? "warn" : "bad"} />}
        </div>
      }
      explanation={
        s.mode === "AM" ? (
          <p>s(t) = Ac[1 + m·cos(2πfm·t)]·cos(2πfc·t). With m = {s.m.toFixed(2)}, the envelope swings between {(s.Ac * (1 - s.m)).toFixed(2)} and {(s.Ac * (1 + s.m)).toFixed(2)} V. {status === "over" ? "Because m > 1 the envelope crosses zero — an envelope detector would distort the message." : "The envelope stays positive, so an envelope detector can recover the message."} {s.demod && "The detector output tracks |envelope|; with over-modulation the recovered shape is folded and no longer matches the message."} {s.noise && `At ${s.snr} dB SNR the noise ${s.snr < 10 ? "visibly corrupts the envelope" : "is small relative to the signal"}.`}</p>
        ) : (
          <p>s(t) = Ac·cos(2πfc·t + β·sin 2πfm·t). The amplitude is constant; the zero-crossings bunch together and spread apart as the instantaneous frequency swings ±{(s.beta * s.fm).toFixed(1)} Hz around {s.fc} Hz. Larger β widens the bandwidth (Carson ≈ {carsonBandwidth(s.beta, s.fm).toFixed(0)} Hz) but improves noise immunity.</p>
        )
      }
      challenge={<p className="text-sm">Set AM so that efficiency is exactly 33.3% while avoiding over-modulation. {s.mode === "AM" && Math.abs(s.m - 1) < 1e-9 ? <strong className="text-success">Solved — m = 1 gives the maximum η = 1/3.</strong> : <span className="text-muted-foreground">Hint: η = m²/(2+m²).</span>}</p>}
    />
  );
}
