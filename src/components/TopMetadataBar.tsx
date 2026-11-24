import { ArrowLeft, Disc3, ImagePlus, Music2 } from 'lucide-react';
import type { AppMode, MediaRecord, MediaSide } from '../types/media';
import { formatDurationLabel } from '../utils/shelfMath';
import type { AudiusTrack } from '../utils/audius';

interface TopMetadataBarProps {
  mode: AppMode;
  record: MediaRecord;
  side: MediaSide;
  totalCount: number;
  hoverHint: string | null;
  onOpenPlayer: () => void;
  onBackToShelf: () => void;
  onOpenCoverEditor: () => void;
  onOpenAudius: () => void;
  audiusTrack: AudiusTrack | null;
}

export function TopMetadataBar({
  mode,
  record,
  side,
  totalCount,
  hoverHint,
  onOpenPlayer,
  onBackToShelf,
  onOpenCoverEditor,
  onOpenAudius,
  audiusTrack,
}: TopMetadataBarProps) {
  const activeTrack = side === 'A' ? record.sideA : record.sideB;
  const externalTrack = mode === 'player' ? audiusTrack : null;
  const formatLabel =
    record.format === 'cd'
      ? 'COMPACT DISC'
      : record.format === 'cassette'
      ? 'CASSETTE TAPE'
      : 'VINYL LP';

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-2 px-3 py-3 sm:gap-8 sm:px-8 sm:py-6 mobile-safe-header">
      {/* Left: Editorial record & technical metadata block */}
      <div className="pointer-events-auto min-w-0 flex-1 max-w-sm">
        <div className="flex flex-wrap items-center gap-1 text-[9px] sm:gap-2 sm:text-[11px] font-mono-tech text-[#5C5C58] tracking-wide">
          <span>THE LITTLE SOUND ARCHIVE</span>
          <span aria-hidden="true">·</span>
          <span>{externalTrack ? 'AUDIUS STREAM' : record.catalogCode}</span>
        </div>

        <h1 className="mt-1 text-lg sm:mt-1.5 sm:text-2xl md:text-3xl font-bold tracking-tight text-[#171717] leading-tight">
          {externalTrack?.title ?? record.title}
        </h1>

        <dl className="mt-2 grid grid-cols-[48px_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-[9px] sm:mt-3 sm:grid-cols-[88px_1fr] sm:gap-y-1 sm:text-[11px] font-mono-tech">
          <dt className="text-[#6B6B66]">ARTIST</dt>
          <dd className="text-[#171717] font-medium truncate">{externalTrack?.artist ?? record.artist}</dd>

          <dt className="text-[#6B6B66]">FORMAT</dt>
          <dd className="text-[#171717] font-medium">
            {externalTrack ? 'STREAMING AUDIO' : `${formatLabel} · SIDE ${side}`}
          </dd>

          <dt className="text-[#6B6B66]">TRACK</dt>
          <dd className="text-[#171717] font-medium truncate">
            {externalTrack ? `${externalTrack.title} (${formatDurationLabel(externalTrack.durationSec)})` : `${activeTrack.title} (${formatDurationLabel(activeTrack.durationSec)})`}
          </dd>
        </dl>

        {hoverHint && mode === 'shelf' && (
          <p className="mt-2.5 font-mono-tech text-[11px] text-[#E14D2A]">
            {hoverHint}
          </p>
        )}
      </div>

      {/* Right: Large Index Number + Single Primary Contextual Action */}
      <div className="pointer-events-auto flex shrink-0 min-w-0 max-w-[48%] flex-col items-end gap-2 sm:max-w-none sm:gap-3">
        <div className="flex items-baseline gap-2">
          <span
            className="font-mono-tech text-2xl sm:text-3xl md:text-5xl font-semibold tracking-tight text-[#171717] tabular-nums leading-none"
            data-testid="active-index-readout"
          >
            {record.indexNumber}
          </span>
          <span className="font-mono-tech text-[10px] sm:text-xs text-[#6B6B66] tabular-nums">
            / {String(totalCount).padStart(2, '0')}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
          <button
            type="button"
            onClick={onOpenAudius}
            aria-label="Browse Audius music"
            className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-0 min-w-11 sm:min-w-0 justify-center px-2.5 py-2 text-[10px] sm:px-3 sm:text-xs font-medium text-[#171717] bg-white/90 border border-[#171717]/15 hover:border-[#648B72]/70 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
          >
            <Music2 className="w-3.5 h-3.5 text-[#648B72]" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Audius</span>
          </button>
          <button
            type="button"
            aria-label="Open cover art editor"
            onClick={onOpenCoverEditor}
            className="inline-flex min-h-11 sm:min-h-0 min-w-11 sm:min-w-0 items-center justify-center gap-1.5 px-2.5 py-2 text-[10px] sm:px-3 sm:text-xs font-medium text-[#171717] bg-[#F6F6F3] border border-[#171717]/15 hover:border-[#171717]/40 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
          >
            <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Cover Art</span>
          </button>

          {mode === 'shelf' ? (
            <button
              type="button"
              aria-label="Load record in player"
              onClick={onOpenPlayer}
              className="inline-flex min-h-11 sm:min-h-0 min-w-11 sm:min-w-0 items-center justify-center gap-1.5 px-2.5 py-2 text-[10px] sm:px-4 sm:text-xs font-medium text-[#F7F7F4] bg-[#171717] hover:bg-[#2C2C2A] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
            >
              <Disc3 className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Load in Player</span>
            </button>
          ) : (
            <button
              type="button"
              aria-label="Back to shelf"
              onClick={onBackToShelf}
              className="inline-flex min-h-11 sm:min-h-0 min-w-11 sm:min-w-0 items-center justify-center gap-1.5 px-2.5 py-2 text-[10px] sm:px-4 sm:text-xs font-medium text-[#F7F7F4] bg-[#171717] hover:bg-[#2C2C2A] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Back to Shelf</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
