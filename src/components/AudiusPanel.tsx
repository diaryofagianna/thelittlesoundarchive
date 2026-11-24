import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Check,
  ExternalLink,
  Headphones,
  ListMusic,
  LoaderCircle,
  Music2,
  Play,
  Plus,
  Repeat,
  Repeat1,
  Save,
  Search,
  Shuffle,
  Trash2,
  X,
} from 'lucide-react';
import type { AudiusRepeatMode } from '../utils/audiusQueue';
import {
  getTrendingAudiusTracks,
  isAudiusConfigured,
  searchAudiusTracks,
  type AudiusTrack,
} from '../utils/audius';

interface AudiusPanelProps {
  initialTab?: 'browse' | 'queue';
  shuffleEnabled: boolean;
  repeatMode: AudiusRepeatMode;
  queueSaved: boolean;
  onToggleShuffle: () => void;
  onCycleRepeatMode: () => void;
  onSaveQueue: () => void;
  onClose: () => void;
  onPlayTrack: (track: AudiusTrack) => Promise<void>;
  onPlayQueue: () => Promise<void>;
  onAddTracks: (tracks: AudiusTrack[]) => number;
  onRemoveTrack: (trackId: string) => void;
  onClearQueue: () => void;
  currentTrackId: string | null;
  queue: AudiusTrack[];
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--:--';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function AudiusPanel({
  initialTab = 'browse',
  shuffleEnabled,
  repeatMode,
  queueSaved,
  onToggleShuffle,
  onCycleRepeatMode,
  onSaveQueue,
  onClose,
  onPlayTrack,
  onPlayQueue,
  onAddTracks,
  onRemoveTrack,
  onClearQueue,
  currentTrackId,
  queue,
}: AudiusPanelProps) {
  const configured = isAudiusConfigured();
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<AudiusTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(currentTrackId);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'browse' | 'queue'>(initialTab);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const queuedIds = useMemo(() => new Set(queue.map((track) => track.id)), [queue]);

  useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!configured) return;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    void getTrendingAudiusTracks(20, controller.signal)
      .then((results) => {
        if (active) setTracks(results);
      })
      .catch((caught) => {
        if (active && !controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : 'Could not load Audius tracks.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [configured]);

  useEffect(() => setPlayingId(currentTrackId), [currentTrackId]);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const results = query.trim()
        ? await searchAudiusTracks(query, 20)
        : await getTrendingAudiusTracks(20);
      setTracks(results);
      if (results.length === 0) setMessage('No publicly streamable tracks found. Try another search.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Audius search failed.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = async (track: AudiusTrack) => {
    setError('');
    setMessage('Loading audio stream…');
    setPlayingId(track.id);
    try {
      await onPlayTrack(track);
      setMessage(`Now playing: ${track.title}`);
    } catch (caught) {
      setPlayingId(currentTrackId);
      setError(caught instanceof Error ? caught.message : 'Could not play this Audius track.');
      setMessage('');
    }
  };

  const handleAdd = (items: AudiusTrack[]) => {
    const added = onAddTracks(items);
    setError('');
    setMessage(added > 0
      ? `${added} ${added === 1 ? 'track' : 'tracks'} added to your queue.`
      : 'Those tracks are already in your queue.');
  };

  const handlePlayQueue = async () => {
    setError('');
    setMessage('Starting your queue…');
    try {
      await onPlayQueue();
      setMessage('Queue playback started.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start the queue.');
      setMessage('');
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#171717]/35 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="audius-panel-title"
        className="max-h-[92vh] w-full max-w-[720px] overflow-y-auto border border-[#171717]/20 bg-[#F5F5F2] p-4 shadow-2xl sm:p-5"
      >
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[10px] font-mono-tech tracking-[0.16em] text-[#648B72]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#648B72]" />
              OPEN MUSIC CATALOG · AUDIUS
            </div>
            <h2 id="audius-panel-title" className="text-lg font-semibold tracking-tight text-[#171717]">
              Find something to listen to
            </h2>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-[#62625D]">
              Add several independent tracks to your listening queue and let them play one after another. No listener sign-in required.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Audius panel"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-[#171717]/15 bg-white text-[#454542] hover:bg-[#E7E7E2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        {!configured ? (
          <div className="border-l-2 border-[#B77B28] bg-[#FAF5E8] px-3 py-3 text-[11px] leading-relaxed text-[#6D4B1C]">
            <p className="font-semibold">Audius API setup required</p>
            <p className="mt-1">Create a free API key at <a className="underline" href="https://api.audius.co/plans" target="_blank" rel="noreferrer">api.audius.co/plans</a>, then add this to your local <code>.env.local</code> and your deployment environment:</p>
            <pre className="mt-2 overflow-x-auto bg-white/70 p-2 text-[10px]">VITE_AUDIUS_API_KEY=your_public_api_key</pre>
            <p className="mt-2">The API key is a public client key. Never put an API secret or Bearer Token in frontend environment variables.</p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-1 border-b border-[#171717]/15" role="tablist" aria-label="Audius library">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'browse'}
                onClick={() => setActiveTab('browse')}
                className={`px-3 py-2 text-xs font-medium transition-colors ${activeTab === 'browse' ? 'border-b-2 border-[#648B72] text-[#171717]' : 'text-[#777770] hover:text-[#171717]'}`}
              >
                Browse tracks
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'queue'}
                onClick={() => setActiveTab('queue')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${activeTab === 'queue' ? 'border-b-2 border-[#648B72] text-[#171717]' : 'text-[#777770] hover:text-[#171717]'}`}
              >
                <ListMusic className="h-3.5 w-3.5" aria-hidden="true" />
                Queue <span className="font-mono-tech text-[10px]">({queue.length})</span>
              </button>
            </div>

            {activeTab === 'browse' ? (
              <>
                <form onSubmit={(event) => void handleSearch(event)} className="mb-3 flex flex-col gap-2 sm:flex-row">
                  <label htmlFor="audius-search" className="sr-only">Search Audius tracks</label>
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777770]" aria-hidden="true" />
                    <input
                      ref={inputRef}
                      id="audius-search"
                      type="search"
                      autoComplete="off"
                      placeholder="Search tracks, artists or moods…"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      className="h-10 w-full border border-[#171717]/20 bg-white pl-9 pr-3 text-xs text-[#171717] outline-none placeholder:text-[#969690] focus:border-[#648B72] focus:ring-1 focus:ring-[#648B72]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex h-10 items-center justify-center gap-2 bg-[#171717] px-4 text-xs font-medium text-white transition-colors hover:bg-[#30302D] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
                    Search Audius
                  </button>
                </form>

                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-[#777770]">
                    {query.trim() ? 'SEARCH RESULTS' : 'TRENDING THIS WEEK'} · {tracks.length} TRACKS
                  </p>
                  <div className="flex items-center gap-3">
                    {tracks.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleAdd(tracks)}
                        className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#405E49] hover:text-[#171717]"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        Add all results
                      </button>
                    )}
                    <a href="https://audius.co/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-[#405E49] underline underline-offset-2">
                      Audius <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  </div>
                </div>

                <div className="max-h-[48vh] overflow-y-auto border border-[#171717]/10 bg-white">
                  {loading && tracks.length === 0 ? (
                    <div className="flex min-h-28 items-center justify-center gap-2 text-xs text-[#777770]"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading tracks…</div>
                  ) : tracks.length > 0 ? (
                    <ul className="divide-y divide-[#171717]/10">
                      {tracks.map((track) => {
                        const isCurrent = playingId === track.id;
                        const isQueued = queuedIds.has(track.id);
                        return (
                          <li key={track.id} className={`flex items-center gap-2 p-2.5 sm:gap-3 ${isCurrent ? 'bg-[#EFF3ED]' : 'hover:bg-[#F7F7F4]'}`}>
                            {track.artworkUrl ? (
                              <img src={track.artworkUrl} alt="" loading="lazy" className="h-11 w-11 shrink-0 object-cover sm:h-12 sm:w-12" />
                            ) : (
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#E7E7E2] sm:h-12 sm:w-12"><Music2 className="h-5 w-5 text-[#777770]" /></div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-[#171717]">{track.title}</p>
                              <p className="mt-0.5 truncate text-[11px] text-[#62625D]">{track.artist}{track.genre ? ` · ${track.genre}` : ''}</p>
                              <p className="mt-0.5 font-mono-tech text-[10px] text-[#8A8A83]">{formatDuration(track.durationSec)}</p>
                            </div>
                            <a href={track.permalink} target="_blank" rel="noreferrer" aria-label={`Open ${track.title} on Audius`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-[#777770] hover:text-[#171717]">
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            </a>
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleAdd([track])}
                                disabled={isQueued}
                                aria-label={isQueued ? `${track.title} is already queued` : `Add ${track.title} to queue`}
                                title={isQueued ? 'Already in queue' : 'Add to queue'}
                                className="inline-flex h-9 w-9 items-center justify-center border border-[#171717]/15 bg-white text-[#405E49] hover:bg-[#EFF3ED] disabled:cursor-default disabled:opacity-60"
                              >
                                {isQueued ? <Check className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handlePlay(track)}
                                className={`inline-flex h-9 shrink-0 items-center gap-1.5 px-2.5 text-[11px] font-semibold sm:px-3 ${isCurrent ? 'bg-[#648B72] text-white' : 'bg-[#171717] text-white hover:bg-[#30302D]'}`}
                                aria-label={`Play ${track.title}`}
                              >
                                {isCurrent ? <Headphones className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                                {isCurrent ? 'Selected' : 'Play'}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="flex min-h-28 flex-col items-center justify-center px-4 text-center">
                      <Music2 className="mb-2 h-5 w-5 text-[#84847D]" aria-hidden="true" />
                      <p className="text-xs font-medium text-[#454542]">No tracks to show yet</p>
                      <p className="mt-1 text-[11px] text-[#777770]">Search for an artist, a track or a mood.</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <section aria-label="Your Audius play queue">
                <div className="mb-3 grid grid-cols-1 gap-2 border border-[#171717]/10 bg-[#EFEEE9] p-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={onToggleShuffle}
                    aria-pressed={shuffleEnabled}
                    className={`inline-flex h-9 items-center justify-center gap-2 border px-3 text-[11px] font-medium transition-colors ${shuffleEnabled ? 'border-[#648B72] bg-[#E2EDE3] text-[#315A3B]' : 'border-[#171717]/15 bg-white text-[#454542] hover:bg-[#F7F7F4]'}`}
                  >
                    <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
                    Shuffle {shuffleEnabled ? 'On' : 'Off'}
                  </button>
                  <button
                    type="button"
                    onClick={onCycleRepeatMode}
                    aria-pressed={repeatMode !== 'off'}
                    title="Cycle Repeat Off, Repeat Queue, Repeat One"
                    className={`inline-flex h-9 items-center justify-center gap-2 border px-3 text-[11px] font-medium transition-colors ${repeatMode !== 'off' ? 'border-[#648B72] bg-[#E2EDE3] text-[#315A3B]' : 'border-[#171717]/15 bg-white text-[#454542] hover:bg-[#F7F7F4]'}`}
                  >
                    {repeatMode === 'one' ? <Repeat1 className="h-3.5 w-3.5" aria-hidden="true" /> : <Repeat className="h-3.5 w-3.5" aria-hidden="true" />}
                    {repeatMode === 'one' ? 'Repeat One' : repeatMode === 'queue' ? 'Repeat Queue' : 'Repeat Off'}
                  </button>
                  <button
                    type="button"
                    onClick={onSaveQueue}
                    className="inline-flex h-9 items-center justify-center gap-2 border border-[#171717]/15 bg-white px-3 text-[11px] font-medium text-[#454542] transition-colors hover:bg-[#F7F7F4]"
                  >
                    {queueSaved ? <Check className="h-3.5 w-3.5 text-[#55725B]" aria-hidden="true" /> : <Save className="h-3.5 w-3.5" aria-hidden="true" />}
                    {queueSaved ? 'Saved to this browser' : 'Save queue'}
                  </button>
                </div>

                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-[#777770]">UP NEXT · {queue.length} TRACKS</p>
                    <p className="mt-1 text-[11px] text-[#62625D]">Tracks play in the displayed order. Shuffle changes upcoming tracks; Repeat controls what happens at the end.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handlePlayQueue()}
                      disabled={queue.length === 0}
                      className="inline-flex h-9 items-center gap-1.5 bg-[#171717] px-3 text-[11px] font-semibold text-white hover:bg-[#30302D] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      Play queue
                    </button>
                    <button
                      type="button"
                      onClick={onClearQueue}
                      disabled={queue.length === 0}
                      className="inline-flex h-9 items-center gap-1.5 border border-[#171717]/20 bg-white px-3 text-[11px] text-[#454542] hover:bg-[#E7E7E2] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-[48vh] overflow-y-auto border border-[#171717]/10 bg-white">
                  {queue.length > 0 ? (
                    <ol className="divide-y divide-[#171717]/10">
                      {queue.map((track, index) => {
                        const isCurrent = currentTrackId === track.id;
                        return (
                          <li key={track.id} className={`flex items-center gap-2 p-2.5 sm:gap-3 ${isCurrent ? 'bg-[#EFF3ED]' : ''}`}>
                            <span className="w-5 shrink-0 text-center font-mono-tech text-[10px] text-[#8A8A83]">{String(index + 1).padStart(2, '0')}</span>
                            {track.artworkUrl ? (
                              <img src={track.artworkUrl} alt="" loading="lazy" className="h-10 w-10 shrink-0 object-cover" />
                            ) : (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#E7E7E2]"><Music2 className="h-4 w-4 text-[#777770]" /></div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-[#171717]">{track.title}</p>
                              <p className="mt-0.5 truncate text-[11px] text-[#62625D]">{track.artist} · {formatDuration(track.durationSec)}</p>
                              {isCurrent && <p className="mt-0.5 text-[9px] font-mono-tech tracking-wide text-[#55725B]">CURRENT TRACK</p>}
                            </div>
                            <button
                              type="button"
                              onClick={() => void handlePlay(track)}
                              aria-label={`Play ${track.title} from queue`}
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center bg-[#171717] text-white hover:bg-[#30302D]"
                            >
                              {isCurrent ? <Headphones className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemoveTrack(track.id)}
                              disabled={isCurrent}
                              aria-label={isCurrent ? 'The current track cannot be removed' : `Remove ${track.title} from queue`}
                              title={isCurrent ? 'Current track cannot be removed' : 'Remove from queue'}
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-[#777770] hover:bg-[#F5E9E7] hover:text-[#A33D32] disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <div className="flex min-h-32 flex-col items-center justify-center px-4 text-center">
                      <ListMusic className="mb-2 h-6 w-6 text-[#84847D]" aria-hidden="true" />
                      <p className="text-xs font-medium text-[#454542]">Your queue is empty</p>
                      <p className="mt-1 max-w-xs text-[11px] text-[#777770]">Browse Audius and use the + button to add several tracks, or add every track from a search.</p>
                      <button type="button" onClick={() => setActiveTab('browse')} className="mt-3 text-[11px] font-semibold text-[#405E49] underline underline-offset-2">Browse tracks</button>
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        )}

        {message && <p role="status" className="mt-3 text-[10px] leading-relaxed text-[#55725B]">{message}</p>}
        {error && <p role="alert" className="mt-3 text-[11px] leading-relaxed text-[#B42318]">{error}</p>}

        <div className="mt-3 border border-[#171717]/10 bg-[#EFEEE9] px-3 py-2 text-[10px] leading-relaxed text-[#62625D]">
          Tracks remain hosted by Audius and their creators. Artist/title attribution and a link to the source are shown; streaming availability and usage rights are determined by each track's settings and applicable license. Please use tracks that are authorized for your intended use.
        </div>
      </section>
    </div>
  );
}
