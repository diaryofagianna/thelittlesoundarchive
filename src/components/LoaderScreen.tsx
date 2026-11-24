import { useEffect, useState } from 'react';

interface LoaderScreenProps {
  onComplete: () => void;
}

export function LoaderScreen({ onComplete }: LoaderScreenProps) {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    let rafId = 0;
    const start = performance.now();
    const duration = 950;

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Ease-out cubic count to 100
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(eased * 100);
      setPercent(next);

      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        window.setTimeout(onComplete, 180);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between bg-[#EDEDEA] p-8 text-[#171717] studio-backdrop-grid"
      data-testid="loader-screen"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono-tech text-xs tracking-wider text-[#5C5C58]">
            THE LITTLE SOUND ARCHIVE
          </p>
          <h1 className="mt-1 text-lg font-semibold tracking-tight text-[#171717]">
            Physical Media &amp; Hardware Archive
          </h1>
        </div>
        <button
          type="button"
          onClick={onComplete}
          className="px-4 py-2 text-xs font-medium text-[#171717] border border-[#171717]/20 bg-[#F7F7F4] hover:bg-[#171717] hover:text-[#F7F7F4] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
        >
          Skip Intro
        </button>
      </div>

      <div className="flex items-end justify-between border-t border-[#171717]/15 pt-6">
        <div className="font-mono-tech text-xs text-[#5C5C58]">
          CALIBRATING 3D SHELF · 09 EDITIONS
        </div>
        <div
          className="font-mono-tech text-6xl sm:text-7xl font-semibold tracking-tight tabular-nums leading-none"
          aria-live="polite"
        >
          {String(percent).padStart(3, '0')}
        </div>
      </div>
    </div>
  );
}
