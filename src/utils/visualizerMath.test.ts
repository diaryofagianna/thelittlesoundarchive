import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBandSummary,
  computeFrequencyBands,
  dampFrequencyBands,
  updatePeakHold,
} from './visualizerMath';

test('computeFrequencyBands returns zeros when paused or stopped', () => {
  const bins = new Uint8Array([200, 150, 100, 50]);
  const bands = computeFrequencyBands({
    rawBins: bins,
    bandCount: 16,
    isPlaying: false,
    elapsedSec: 2.5,
    volume: 0.8,
    level: 0.6,
  });
  assert.equal(bands.length, 16);
  assert.ok(bands.every((v) => v === 0));
});

test('computeFrequencyBands maps live FFT bins cleanly within [0, 1]', () => {
  const bins = new Uint8Array(64);
  for (let i = 0; i < bins.length; i++) {
    bins[i] = Math.max(0, 220 - i * 3);
  }
  const bands = computeFrequencyBands({
    rawBins: bins,
    bandCount: 24,
    isPlaying: true,
    elapsedSec: 1.2,
    volume: 0.75,
    level: 0.6,
  });
  assert.equal(bands.length, 24);
  assert.ok(bands.every((v) => v >= 0 && v <= 1));
  assert.ok(bands[0] > bands[23]);
});

test('computeFrequencyBands falls back to engine level contour when analyser bins are zeroed', () => {
  const zeroBins = new Uint8Array(64);
  const bands = computeFrequencyBands({
    rawBins: zeroBins,
    bandCount: 18,
    isPlaying: true,
    elapsedSec: 3.1,
    volume: 0.72,
    level: 0.55,
  });
  assert.equal(bands.length, 18);
  assert.ok(bands.some((v) => v > 0.05));
  assert.ok(bands.every((v) => v >= 0 && v <= 1));
});

test('dampFrequencyBands applies fast attack and smooth decay', () => {
  const attacked = dampFrequencyBands([0, 0], [1, 1], 0.05);
  const decayed = dampFrequencyBands([1, 1], [0, 0], 0.05);
  assert.ok(attacked[0] > 0.5);
  assert.ok(decayed[0] > 0.5 && decayed[0] < 1);
});

test('updatePeakHold captures peaks and decays gradually', () => {
  const captured = updatePeakHold([0.2, 0.8], [0.9, 0.3], 0.05);
  assert.equal(captured[0], 0.9);
  assert.ok(captured[1] < 0.8 && captured[1] > 0.75);
});

test('computeBandSummary averages low, mid, and high thirds accurately', () => {
  const summary = computeBandSummary([0.9, 0.9, 0.5, 0.5, 0.2, 0.2]);
  assert.ok(Math.abs(summary.low - 0.9) < 1e-6);
  assert.ok(Math.abs(summary.mid - 0.5) < 1e-6);
  assert.ok(Math.abs(summary.high - 0.2) < 1e-6);
  assert.equal(summary.peak, 0.9);
});
