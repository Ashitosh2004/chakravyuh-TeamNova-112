/** Simplified deterministic network model for the communication-network scenario. */

export interface NetworkParams {
  signalDbm: number; // received signal strength, e.g. -40 .. -100
  noiseDbm: number; // noise floor, e.g. -110 .. -70
  bandwidthMHz: number; // channel bandwidth
  offeredLoadMbps: number; // traffic offered by users
  hops: number; // number of hops
  perHopDelayMs: number; // processing + propagation per hop
}

export interface NetworkResult {
  snrDb: number;
  capacityMbps: number; // Shannon capacity
  packetLoss: number; // 0..1
  throughputMbps: number;
  utilization: number; // offered / capacity
  latencyMs: number;
  quality: "excellent" | "good" | "fair" | "poor";
  explanations: string[];
}

export function shannonCapacityMbps(bandwidthMHz: number, snrDb: number) {
  const snr = 10 ** (snrDb / 10);
  return bandwidthMHz * Math.log2(1 + snr);
}

/** Packet error from SNR (logistic approximation: 50% at 5 dB). */
export function packetLossFromSnr(snrDb: number) {
  return 1 / (1 + Math.exp((snrDb - 5) / 1.5));
}

export function simulateNetwork(p: NetworkParams): NetworkResult {
  const snrDb = p.signalDbm - p.noiseDbm;
  const capacityMbps = Math.max(0, shannonCapacityMbps(p.bandwidthMHz, snrDb));
  const radioLoss = packetLossFromSnr(snrDb);
  const utilization = capacityMbps > 0 ? p.offeredLoadMbps / capacityMbps : Infinity;
  const congestionLoss = utilization > 1 ? 1 - 1 / utilization : 0;
  const packetLoss = Math.min(1, 1 - (1 - radioLoss) * (1 - congestionLoss));
  const throughputMbps = Math.min(p.offeredLoadMbps, capacityMbps) * (1 - radioLoss);
  // M/M/1-style queueing delay grows as utilization → 1 (capped).
  const rho = Math.min(utilization, 0.99);
  const queueMs = p.hops * p.perHopDelayMs * (rho / (1 - rho));
  const latencyMs = p.hops * p.perHopDelayMs + queueMs;
  const quality: NetworkResult["quality"] =
    packetLoss < 0.01 && latencyMs < 50 ? "excellent" : packetLoss < 0.05 && latencyMs < 120 ? "good" : packetLoss < 0.2 ? "fair" : "poor";
  const explanations = [
    `SNR = signal − noise = ${p.signalDbm} − (${p.noiseDbm}) = ${snrDb.toFixed(1)} dB.`,
    `Shannon capacity C = B·log₂(1+SNR) = ${capacityMbps.toFixed(1)} Mbps for ${p.bandwidthMHz} MHz.`,
    `Radio packet loss ≈ ${(radioLoss * 100).toFixed(2)}% (falls sharply once SNR exceeds ~10 dB).`,
    utilization > 1
      ? `Offered load exceeds capacity (utilization ${(utilization * 100).toFixed(0)}%): queues overflow and ${(congestionLoss * 100).toFixed(0)}% of packets are dropped.`
      : `Link utilization is ${(utilization * 100).toFixed(0)}%; queueing delay grows as utilization approaches 100%.`,
    `Latency = ${p.hops} hops × ${p.perHopDelayMs} ms + queueing ${queueMs.toFixed(1)} ms = ${latencyMs.toFixed(1)} ms.`,
  ];
  return { snrDb, capacityMbps, packetLoss, throughputMbps, utilization, latencyMs, quality, explanations };
}
