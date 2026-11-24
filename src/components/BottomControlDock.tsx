import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
} from 'lucide-react';
import type {
  AppMode,
  FilterMode,
  MediaRecord,
  MediaSide,
  PlayerSection,
  PlayerStatusSnapshot,
} from '../types/media';
import {
  formatDurationLabel,
  formatLcdTime,
  getSectionOptionsForFormat,
} from '../utils/shelfMath';

interface BottomControlDockProps {
  mode: AppMode;
  collapsed: boolean;
  onToggleCollapse: () => void;
  filter: FilterMode;
  onChangeFilter: (f: FilterMode) => void;
  activeRecord: MediaRecord;
  section: PlayerSection;
  onChangeSection: (s: PlayerSection) => void;
  status: PlayerStatusSnapshot;
  spotifyControlActive: boolean;
  onStepShelf: (delta: number) => void;
  onTogglePlay: () => void;
  onStop: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onToggleSide: (side: MediaSide) => void;
  onChangeVolume: (vol: number) => void;
  onToggleAntiSkip: () => void;
  onToggleRpm: () => void;
  showVisualizer: boolean;
  onToggleVisualizer: () => void;
}

export function BottomControlDock({
  mode,
  collapsed,
  onToggleCollapse,
  filter,
  onChangeFilter,
  activeRecord,
  section,
  onChangeSection,
  status,
  spotifyControlActive,
  onStepShelf,
  onTogglePlay,
  onStop,
  onNextTrack,
  onPrevTrack,
  onToggleSide,
  onChangeVolume,
  onToggleAntiSkip,
  onToggleRpm,
  showVisualizer,
  onToggleVisualizer,
}: BottomControlDockProps) {
  const sectionOptions = getSectionOptionsForFormat(activeRecord.format);
  const track = status.side === 'A' ? activeRecord.sideA : activeRecord.sideB;

  return (
    <div
      className={`fixed bottom-4 left-1/2 z-20 -translate-x-1/2 w-[min(920px,94vw)] transition-transform duration-200 ease-out ${
        collapsed ? 'translate-y-[calc(100%-30px)]' : 'translate-y-0'
      }`}
    >
      {/* Top center collapse/expand tab */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono-tech text-[#454542] bg-[#F5F5F2] border border-b-0 border-[#171717]/15 hover:text-[#171717] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
        >
          {collapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Hide Controls</span>
            </>
          )}
        </button>
      </div>

      {/* Main Dock Surface (solid opaque surface — no backdrop-filter over WebGL) */}
      <div className="bg-[#F5F5F2] border border-[#171717]/18 px-4 py-3 shadow-sm">
        {mode === 'shelf' ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Shelf Step Navigation */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onStepShelf(-1)}
                aria-label="Previous record"
                className="inline-flex items-center justify-center w-9 h-9 border border-[#171717]/15 bg-white text-[#171717] hover:bg-[#171717] hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onStepShelf(1)}
                aria-label="Next record"
                className="inline-flex items-center justify-center w-9 h-9 border border-[#171717]/15 bg-white text-[#171717] hover:bg-[#171717] hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
              >
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
              <span className="ml-2 hidden sm:inline font-mono-tech text-[11px] text-[#5C5C58] whitespace-nowrap">
                SCROLL TO BROWSE · DRAG TO SPIN · CLICK TO LOAD
              </span>
            </div>

            {/* Format Filter Segmented Tabs */}
            <div
              className="flex items-center gap-1 bg-[#E7E7E2] p-1"
              role="group"
              aria-label="Filter media format"
            >
              {(
                [
                  { id: 'all', label: 'All (09)' },
                  { id: 'cd', label: 'CD' },
                  { id: 'cassette', label: 'Tape' },
                  { id: 'vinyl', label: 'Vinyl' },
                ] as const
              ).map((tab) => {
                const active = filter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onChangeFilter(tab.id)}
                    className={`px-3 py-1.5 text-xs font-mono-tech transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#171717] ${
                      active
                        ? 'bg-[#171717] text-[#F7F7F4]'
                        : 'text-[#454542] hover:text-[#171717]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Side A / Side B Switch */}
            <div
              className="flex items-center gap-1 bg-[#E7E7E2] p-1"
              role="group"
              aria-label="Select media side"
            >
              {(['A', 'B'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onToggleSide(s)}
                  className={`px-2.5 py-1.5 text-xs font-mono-tech transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#171717] ${
                    status.side === s
                      ? 'bg-white text-[#171717] font-semibold'
                      : 'text-[#5C5C58] hover:text-[#171717]'
                  }`}
                >
                  Side {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {spotifyControlActive && (
              <div className="flex items-center justify-between gap-2 border border-[#1DB954]/30 bg-[#E9F6EC] px-3 py-1.5 text-[10px] font-mono-tech text-[#24643A]" role="status">
                <span>SPOTIFY CONNECT · REMOTE CONTROL ACTIVE</span>
                <span>3D PLAYBACK ANIMATION DISABLED</span>
              </div>
            )}
            {/* Row 1: Camera Inspection Sections + Side / Hardware Switches */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#171717]/10">
              <div
                className="flex items-center gap-1 overflow-x-auto"
                role="group"
                aria-label="Hardware inspection view"
              >
                {sectionOptions.map((opt) => {
                  const active = section === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChangeSection(opt.id)}
                      className={`px-2.5 py-1 text-xs font-mono-tech transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#171717] ${
                        active
                          ? 'bg-[#171717] text-[#F7F7F4]'
                          : 'text-[#454542] hover:text-[#171717] hover:bg-[#E7E7E2]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                {!spotifyControlActive && <button
                  type="button"
                  onClick={onToggleVisualizer}
                  aria-pressed={showVisualizer}
                  className={`px-2.5 py-1 text-[11px] font-mono-tech border transition-colors whitespace-nowrap shrink-0 ${
                    showVisualizer
                      ? 'border-[#171717] bg-[#171717] text-white'
                      : 'border-[#171717]/20 bg-white text-[#454542]'
                  }`}
                >
                  Spectrum: {showVisualizer ? 'ON' : 'OFF'}
                </button>}

                {!spotifyControlActive && activeRecord.format === 'cd' && (
                  <button
                    type="button"
                    onClick={onToggleAntiSkip}
                    className={`px-2.5 py-1 text-[11px] font-mono-tech border transition-colors whitespace-nowrap shrink-0 ${
                      status.antiSkip
                        ? 'border-[#171717] bg-[#171717] text-white'
                        : 'border-[#171717]/20 bg-white text-[#454542]'
                    }`}
                  >
                    ESP: {status.antiSkip ? 'ON' : 'OFF'}
                  </button>
                )}

                {!spotifyControlActive && activeRecord.format === 'vinyl' && (
                  <button
                    type="button"
                    onClick={onToggleRpm}
                    className="px-2.5 py-1 text-[11px] font-mono-tech border border-[#171717]/20 bg-white text-[#171717] hover:border-[#171717] transition-colors whitespace-nowrap shrink-0"
                  >
                    {status.rpmMode} RPM
                  </button>
                )}

                {!spotifyControlActive && <div className="flex items-center gap-1 bg-[#E7E7E2] p-0.5">
                  {(['A', 'B'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onToggleSide(s)}
                      className={`px-2 py-1 text-[11px] font-mono-tech transition-colors whitespace-nowrap shrink-0 ${
                        status.side === s
                          ? 'bg-white text-[#171717] font-semibold'
                          : 'text-[#5C5C58] hover:text-[#171717]'
                      }`}
                    >
                      Side {s}
                    </button>
                  ))}
                </div>}
              </div>
            </div>

            {/* Row 2: Tactile Transport Controls + Elapsed Readout + Volume Slider */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onPrevTrack}
                  aria-label={spotifyControlActive ? 'Previous Spotify track' : 'Previous edition'}
                  className="inline-flex items-center justify-center w-9 h-9 border border-[#171717]/15 bg-white text-[#171717] hover:bg-[#171717] hover:text-white transition-colors"
                >
                  <SkipBack className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={onTogglePlay}
                  aria-label={spotifyControlActive ? 'Toggle Spotify playback' : (status.isPlaying ? 'Pause playback' : 'Start playback')}
                  className="inline-flex items-center gap-1.5 px-4 h-9 bg-[#171717] text-[#F7F7F4] hover:bg-[#2E2E2B] transition-colors text-xs font-medium whitespace-nowrap shrink-0"
                >
                  {status.isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{spotifyControlActive ? 'Play / Pause' : 'Play'}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onStop}
                  aria-label={spotifyControlActive ? 'Pause Spotify playback' : 'Stop playback'}
                  className="inline-flex items-center justify-center w-9 h-9 border border-[#D93829]/40 bg-[#D93829] text-white hover:bg-[#BC2B1D] transition-colors"
                >
                  <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={onNextTrack}
                  aria-label={spotifyControlActive ? 'Next Spotify track' : 'Next edition'}
                  className="inline-flex items-center justify-center w-9 h-9 border border-[#171717]/15 bg-white text-[#171717] hover:bg-[#171717] hover:text-white transition-colors"
                >
                  <SkipForward className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <div className="flex items-center gap-3 font-mono-tech text-xs">
                <span className="text-[#171717] font-semibold truncate max-w-[160px]">
                  {spotifyControlActive ? 'Spotify Connect device' : track.title}
                </span>
                {!spotifyControlActive && <span className="text-[#5C5C58] tabular-nums" data-testid="player-timer">
                  {formatLcdTime(status.elapsedSec)} / {formatDurationLabel(track.durationSec)}
                </span>}
              </div>

              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-[#454542]" aria-hidden="true" />
                <label htmlFor="player-volume-slider" className="sr-only">
                  Playback Volume
                </label>
                <input
                  id="player-volume-slider"
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(status.volume * 100)}
                  onChange={(e) => onChangeVolume(Number(e.target.value) / 100)}
                  className="w-24 accent-[#171717] cursor-pointer"
                />
                <span className="font-mono-tech text-[11px] text-[#5C5C58] w-8 text-right tabular-nums">
                  {Math.round(status.volume * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
