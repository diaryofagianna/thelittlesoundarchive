export interface BandEnergySummary {
  low: number;
  mid: number;
  high: number;
  peak: number;
}

/**
 * Maps raw AnalyserNode frequency bins (or active engine level/elapsed time when
 * Web Audio output is suspended/muted) into normalized [0..1] visualizer bands.
 */
export function computeFrequencyBands(params: {
  rawBins: Uint8Array | null;
  bandCount: number;
  isPlaying: boolean;
  elapsedSec: number;
  volume: number;
  level: number;
  accentSeed?: number;
}): number[] {
  const {
    rawBins,
    bandCount,
    isPlaying,
    elapsedSec,
    volume,
    level,
    accentSeed = 1,
  } = params;

  const out = new Array<number>(bandCount).fill(0);
  if (!isPlaying || bandCount <= 0) {
    return out;
  }

  let hasLiveSignal = false;
  if (rawBins && rawBins.length > 0) {
    for (let i = 0; i < rawBins.length; i++) {
      if (rawBins[i] > 2) {
        hasLiveSignal = true;
        break;
      }
    }
  }

  const gainScale = Math.max(0.08, Math.min(1.15, volume * 1.15));

  if (hasLiveSignal && rawBins) {
    const usableBins = Math.max(bandCount, Math.floor(rawBins.length * 0.72));
    for (let b = 0; b < bandCount; b++) {
      // Logarithmic-leaning index mapping so bass & mid bands feel rich
      const t0 = Math.pow(b / bandCount, 1.35);
      const t1 = Math.pow((b + 1) / bandCount, 1.35);
      const startIdx = Math.min(usableBins - 1, Math.floor(t0 * usableBins));
      const endIdx = Math.max(
        startIdx + 1,
        Math.min(usableBins, Math.ceil(t1 * usableBins))
      );

      let sum = 0;
      for (let idx = startIdx; idx < endIdx; idx++) {
        sum += rawBins[idx];
      }
      const avg = sum / ((endIdx - startIdx) * 255);
      // Slight high-frequency tilt compensation
      const tilt = 1 + (b / bandCount) * 0.38;
      out[b] = Math.max(0, Math.min(1, avg * tilt * 1.45));
    }
    return out;
  }

  // Harmonic contour driven by the engine's live `level`, `elapsedSec`, and `volume`
  const clampedLevel = Math.max(0.05, Math.min(1, level));
  for (let b = 0; b < bandCount; b++) {
    const norm = b / Math.max(1, bandCount - 1);
    const bassEnvelope = Math.exp(-norm * 2.1) * 0.55 + 0.35;
    const waveA = Math.abs(
      Math.sin(elapsedSec * (3.6 + norm * 4.5) + b * 0.45 + accentSeed)
    );
    const waveB = Math.abs(
      Math.cos(elapsedSec * (2.1 + norm * 2.8) - b * 0.28)
    );
    const val = clampedLevel * bassEnvelope * (0.45 + 0.55 * (waveA * 0.65 + waveB * 0.35)) * gainScale;
    out[b] = Math.max(0.04, Math.min(1, val));
  }

  return out;
}

export function dampFrequencyBands(
  prev: number[],
  target: number[],
  dt: number
): number[] {
  const safeDt = Math.min(0.1, Math.max(0.001, dt));
  const out = new Array<number>(target.length);
  for (let i = 0; i < target.length; i++) {
    const p = prev[i] ?? 0;
    const t = target[i] ?? 0;
    const rate = t > p ? 18 : 8.5; // Fast attack, smooth analog decay
    const factor = 1 - Math.exp(-rate * safeDt);
    out[i] = p + (t - p) * factor;
  }
  return out;
}

export function updatePeakHold(
  prevPeaks: number[],
  bands: number[],
  dt: number
): number[] {
  const safeDt = Math.min(0.1, Math.max(0.001, dt));
  const drop = 0.42 * safeDt;
  const out = new Array<number>(bands.length);
  for (let i = 0; i < bands.length; i++) {
    const current = bands[i] ?? 0;
    const prev = prevPeaks[i] ?? 0;
    out[i] = current >= prev ? current : Math.max(current, prev - drop);
  }
  return out;
}

export function computeBandSummary(bands: number[]): BandEnergySummary {
  if (bands.length === 0) {
    return { low: 0, mid: 0, high: 0, peak: 0 };
  }
  const third = Math.max(1, Math.floor(bands.length / 3));
  let lowSum = 0;
  let midSum = 0;
  let highSum = 0;
  let peak = 0;

  for (let i = 0; i < bands.length; i++) {
    const v = Math.max(0, Math.min(1, bands[i]));
    if (v > peak) peak = v;
    if (i < third) {
      lowSum += v;
    } else if (i < third * 2) {
      midSum += v;
    } else {
      highSum += v;
    }
  }

  const highCount = Math.max(1, bands.length - third * 2);
  return {
    low: lowSum / third,
    mid: midSum / third,
    high: highSum / highCount,
    peak,
  };
}
