import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Save,
  Check,
  Shuffle,
  ListMusic,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
} from 'lucide-react';
import type { AudiusTrack } from '../utils/audius';
import type { AudiusRepeatMode } from '../utils/audiusQueue';
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
  audiusActive: boolean;
  audiusTrack: AudiusTrack | null;
  audiusQueueCount: number;
  shuffleEnabled: boolean;
  repeatMode: AudiusRepeatMode;
  queueSaved: boolean;
  onToggleShuffle: () => void;
  onCycleRepeatMode: () => void;
  onSaveAudiusQueue: () => void;
  onOpenAudiusQueue: () => void;
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
  audiusActive,
  audiusTrack,
  audiusQueueCount,
  shuffleEnabled,
  repeatMode,
  queueSaved,
  onToggleShuffle,
  onCycleRepeatMode,
  onSaveAudiusQueue,
  onOpenAudiusQueue,
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
  const displayTitle = audiusActive && audiusTrack ? audiusTrack.title : track.title;
  const displayDuration = audiusActive && audiusTrack ? audiusTrack.durationSec : track.durationSec;

  return (
    <div
      className={`fixed bottom-4 left-1/2 z-20 -translate-x-1/2 w-[calc(100%-1rem)] sm:w-[min(920px,94vw)] mobile-dock-anchor transition-transform duration-200 ease-out ${
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
      <div className="bg-[#F5F5F2] border border-[#171717]/18 px-2 py-2 sm:px-4 sm:py-3 shadow-sm mobile-dock-surface">
        {mode === 'shelf' ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Shelf Step Navigation */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onStepShelf(-1)}
                aria-label="Previous record"
                className="inline-flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 border border-[#171717]/15 bg-white text-[#171717] hover:bg-[#171717] hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onStepShelf(1)}
                aria-label="Next record"
                className="inline-flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 border border-[#171717]/15 bg-white text-[#171717] hover:bg-[#171717] hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
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
                    className={`min-h-11 sm:min-h-0 px-2.5 py-1.5 text-xs font-mono-tech transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#171717] ${
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
                  className={`min-h-11 sm:min-h-0 px-2.5 py-1.5 text-xs font-mono-tech transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#171717] ${
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
            {audiusActive && (
              <>
                <div className="flex items-center justify-between gap-2 border border-[#648B72]/30 bg-[#E9F6EC] px-3 py-1.5 text-[10px] font-mono-tech text-[#24643A]" role="status">
                  <span>AUDIUS STREAM · BROWSER PLAYER ACTIVE</span>
                  <span>LIVE AUDIO VISUALIZER ACTIVE</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#171717]/10 pb-2" aria-label="Audius playback modes">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={onToggleShuffle}
                      aria-pressed={shuffleEnabled}
                      title="Shuffle upcoming tracks"
                      className={`inline-flex min-h-11 sm:min-h-0 items-center gap-1.5 border px-2 text-[10px] font-mono-tech transition-colors ${shuffleEnabled ? 'border-[#648B72] bg-[#E2EDE3] text-[#315A3B]' : 'border-[#171717]/20 bg-white text-[#454542] hover:bg-[#E7E7E2]'}`}
                    >
                      <Shuffle className="h-3.5 w-3.5" aria-hidden="true" /> SHUFFLE
                    </button>
                    <button
                      type="button"
                      onClick={onCycleRepeatMode}
                      aria-pressed={repeatMode !== 'off'}
                      title="Cycle Repeat Off, Repeat Queue, Repeat One"
                      className={`inline-flex min-h-11 sm:min-h-0 items-center gap-1.5 border px-2 text-[10px] font-mono-tech transition-colors ${repeatMode !== 'off' ? 'border-[#648B72] bg-[#E2EDE3] text-[#315A3B]' : 'border-[#171717]/20 bg-white text-[#454542] hover:bg-[#E7E7E2]'}`}
                    >
                      {repeatMode === 'one' ? <Repeat1 className="h-3.5 w-3.5" aria-hidden="true" /> : <Repeat className="h-3.5 w-3.5" aria-hidden="true" />}
                      {repeatMode === 'one' ? 'REPEAT ONE' : repeatMode === 'queue' ? 'REPEAT QUEUE' : 'REPEAT OFF'}
                    </button>
                    <button
                      type="button"
                      onClick={onSaveAudiusQueue}
                      title="Save queue to this browser"
                      className="inline-flex min-h-11 sm:min-h-0 items-center gap-1.5 border border-[#171717]/20 bg-white px-2 text-[10px] font-mono-tech text-[#454542] hover:bg-[#E7E7E2]"
                    >
                      {queueSaved ? <Check className="h-3.5 w-3.5 text-[#55725B]" aria-hidden="true" /> : <Save className="h-3.5 w-3.5" aria-hidden="true" />}
                      {queueSaved ? 'SAVED' : 'SAVE QUEUE'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenAudiusQueue}
                    className="inline-flex min-h-11 sm:min-h-0 items-center gap-1.5 bg-[#171717] px-2.5 text-[10px] font-mono-tech text-white hover:bg-[#30302D]"
                  >
                    <ListMusic className="h-3.5 w-3.5" aria-hidden="true" /> QUEUE ({audiusQueueCount})
                  </button>
                </div>
              </>
            )}
            {/* Row 1: Camera Inspection Sections + Side / Hardware Switches */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#171717]/10">
              <div
                className="flex min-w-0 max-w-full items-center gap-1 overflow-x-auto"
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
                      className={`min-h-11 sm:min-h-0 px-2.5 py-1 text-xs font-mono-tech transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#171717] ${
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
                <button
                  type="button"
                  onClick={onToggleVisualizer}
                  aria-pressed={showVisualizer}
                  className={`min-h-11 sm:min-h-0 px-2.5 py-1 text-[11px] font-mono-tech border transition-colors whitespace-nowrap shrink-0 ${
                    showVisualizer
                      ? 'border-[#171717] bg-[#171717] text-white'
                      : 'border-[#171717]/20 bg-white text-[#454542]'
                  }`}
                >
                  Spectrum: {showVisualizer ? 'ON' : 'OFF'}
                </button>

                {!audiusActive && activeRecord.format === 'cd' && (
                  <button
                    type="button"
                    onClick={onToggleAntiSkip}
                    className={`min-h-11 sm:min-h-0 px-2.5 py-1 text-[11px] font-mono-tech border transition-colors whitespace-nowrap shrink-0 ${
                      status.antiSkip
                        ? 'border-[#171717] bg-[#171717] text-white'
                        : 'border-[#171717]/20 bg-white text-[#454542]'
                    }`}
                  >
                    ESP: {status.antiSkip ? 'ON' : 'OFF'}
                  </button>
                )}

                {!audiusActive && activeRecord.format === 'vinyl' && (
                  <button
                    type="button"
                    onClick={onToggleRpm}
                    className="min-h-11 sm:min-h-0 px-2.5 py-1 text-[11px] font-mono-tech border border-[#171717]/20 bg-white text-[#171717] hover:border-[#171717] transition-colors whitespace-nowrap shrink-0"
                  >
                    {status.rpmMode} RPM
                  </button>
                )}

                {!audiusActive && <div className="flex items-center gap-1 bg-[#E7E7E2] p-0.5">
                  {(['A', 'B'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onToggleSide(s)}
                      className={`min-h-11 sm:min-h-0 px-2 py-1 text-[11px] font-mono-tech transition-colors whitespace-nowrap shrink-0 ${
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
                  aria-label={audiusActive ? 'Previous Audius track' : 'Previous edition'}
                  className="inline-flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 border border-[#171717]/15 bg-white text-[#171717] hover:bg-[#171717] hover:text-white transition-colors"
                >
                  <SkipBack className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={onTogglePlay}
                  aria-label={audiusActive ? 'Toggle Audius playback' : (status.isPlaying ? 'Pause playback' : 'Start playback')}
                  className="inline-flex items-center gap-1.5 px-4 min-h-11 sm:min-h-0 sm:h-9 bg-[#171717] text-[#F7F7F4] hover:bg-[#2E2E2B] transition-colors text-xs font-medium whitespace-nowrap shrink-0"
                >
                  {status.isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Play</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onStop}
                  aria-label={audiusActive ? 'Stop Audius playback' : 'Stop playback'}
                  className="inline-flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 border border-[#D93829]/40 bg-[#D93829] text-white hover:bg-[#BC2B1D] transition-colors"
                >
                  <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={onNextTrack}
                  aria-label={audiusActive ? 'Next Audius track' : 'Next edition'}
                  className="inline-flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 border border-[#171717]/15 bg-white text-[#171717] hover:bg-[#171717] hover:text-white transition-colors"
                >
                  <SkipForward className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <div className="flex items-center gap-3 font-mono-tech text-xs">
                <span className="flex min-w-0 flex-col">
                  <span className="text-[#171717] font-semibold truncate max-w-[180px]">{displayTitle}</span>
                  {audiusActive && audiusTrack && <span className="text-[10px] text-[#62625D] truncate max-w-[180px]">{audiusTrack.artist}</span>}
                </span>
                <span className="text-[#5C5C58] tabular-nums" data-testid="player-timer">
                  {formatLcdTime(status.elapsedSec)} / {formatDurationLabel(displayDuration)}
                </span>
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
                  className="w-20 sm:w-24 min-h-11 sm:min-h-0 accent-[#171717] cursor-pointer"
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
