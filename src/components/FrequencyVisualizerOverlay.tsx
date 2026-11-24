import { useEffect, useRef } from 'react';
import {
  computeBandSummary,
  dampFrequencyBands,
  updatePeakHold,
} from '../utils/visualizerMath';

interface FrequencyVisualizerOverlayProps {
  visible: boolean;
  isPlaying: boolean;
  accentColor: string;
  formatLabel: string;
  getFrequencyBands: (bandCount: number) => number[];
}

const BAND_COUNT = 24;

export function FrequencyVisualizerOverlay({
  visible,
  isPlaying,
  accentColor,
  formatLabel,
  getFrequencyBands,
}: FrequencyVisualizerOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lowRef = useRef<HTMLSpanElement | null>(null);
  const midRef = useRef<HTMLSpanElement | null>(null);
  const highRef = useRef<HTMLSpanElement | null>(null);

  const getBandsRef = useRef(getFrequencyBands);
  getBandsRef.current = getFrequencyBands;

  const accentRef = useRef(accentColor);
  accentRef.current = accentColor;

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let lastDrawTime = 0;
    let lastDomUpdate = 0;
    let smoothed = new Array<number>(BAND_COUNT).fill(0);
    let peaks = new Array<number>(BAND_COUNT).fill(0);

    const drawFrame = (now: number) => {
      if (disposed) return;

      const minInterval = prefersReduced ? 180 : 32;
      if (now - lastDrawTime >= minInterval) {
        const dt = Math.min(0.1, Math.max(0.008, (now - lastTime) / 1000));
        lastTime = now;
        lastDrawTime = now;

        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const cssW = canvas.clientWidth || 328;
        const cssH = canvas.clientHeight || 40;
        const targetW = Math.round(cssW * dpr);
        const targetH = Math.round(cssH * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        const rawTarget = getBandsRef.current(BAND_COUNT);
        smoothed = dampFrequencyBands(smoothed, rawTarget, dt);
        peaks = updatePeakHold(peaks, smoothed, dt);

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, cssW, cssH);

        // Subtle reference grid lines (0%, 50%, 100%)
        ctx.strokeStyle = 'rgba(23, 23, 23, 0.08)';
        ctx.lineWidth = 1;
        for (const yRatio of [0.25, 0.62, 0.96]) {
          const yLine = Math.round(cssH * yRatio) + 0.5;
          ctx.beginPath();
          ctx.moveTo(0, yLine);
          ctx.lineTo(cssW, yLine);
          ctx.stroke();
        }

        const gap = 3;
        const barW = Math.max(3, (cssW - gap * (BAND_COUNT - 1)) / BAND_COUNT);
        const maxBarH = cssH - 6;

        // 1. Draw 24 frequency bars + accent peak caps
        for (let i = 0; i < BAND_COUNT; i++) {
          const val = smoothed[i];
          const peakVal = peaks[i];
          const x = i * (barW + gap);
          const barH = Math.max(1.5, val * maxBarH);
          const y = cssH - 2 - barH;

          // Bar body in crisp charcoal
          ctx.fillStyle = val > 0.65 ? accentRef.current : '#171717';
          ctx.fillRect(x, y, barW, barH);

          // Peak hold tick
          const peakY = Math.max(1, cssH - 2 - peakVal * maxBarH - 2);
          ctx.fillStyle = accentRef.current;
          ctx.fillRect(x, peakY, barW, 1.5);
        }

        // 2. Subtle continuous crest contour line
        ctx.strokeStyle = 'rgba(23, 23, 23, 0.24)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < BAND_COUNT; i++) {
          const x = i * (barW + gap) + barW / 2;
          const y = cssH - 2 - smoothed[i] * maxBarH;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();

        // Update LOW/MID/HIGH readout via DOM refs at <= 8Hz (zero React re-renders)
        if (now - lastDomUpdate > 125) {
          lastDomUpdate = now;
          const summary = computeBandSummary(smoothed);
          if (lowRef.current) {
            lowRef.current.textContent = `${Math.round(summary.low * 100)}`;
          }
          if (midRef.current) {
            midRef.current.textContent = `${Math.round(summary.mid * 100)}`;
          }
          if (highRef.current) {
            highRef.current.textContent = `${Math.round(summary.high * 100)}`;
          }
        }
      }

      if (isPlaying) {
        rafId = requestAnimationFrame(drawFrame);
      } else {
        // Settle decay cleanly for a few frames when paused
        const stillActive = smoothed.some((v) => v > 0.01) || peaks.some((v) => v > 0.01);
        if (stillActive) {
          rafId = requestAnimationFrame(drawFrame);
        }
      }
    };

    rafId = requestAnimationFrame(drawFrame);
    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
    };
  }, [visible, isPlaying]);

  if (!visible) return null;

  return (
    <aside
      aria-label="Audio frequency spectrum analyzer"
      data-testid="frequency-visualizer"
      data-active={isPlaying ? 'true' : 'false'}
      className="pointer-events-none fixed left-1/2 bottom-[148px] md:bottom-auto md:top-5 z-20 -translate-x-1/2 w-[min(320px,90vw)] md:w-[348px] bg-[#F5F5F2] border border-[#171717]/18 px-3.5 py-2.5 shadow-sm transition-opacity duration-200"
    >
      <div className="flex items-center justify-between gap-4 text-[10px] font-mono-tech text-[#5C5C58] mb-1.5">
        <span className="font-semibold text-[#171717] tracking-wide">
          SPECTRUM · {formatLabel.toUpperCase()}
        </span>
        <div className="flex items-center gap-2.5 tabular-nums">
          <span>
            L <strong ref={lowRef} className="font-semibold text-[#171717]">00</strong>
          </span>
          <span>
            M <strong ref={midRef} className="font-semibold text-[#171717]">00</strong>
          </span>
          <span>
            H <strong ref={highRef} className="font-semibold text-[#171717]">00</strong>
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="block w-full h-[40px]"
        aria-hidden="true"
      />
    </aside>
  );
}
