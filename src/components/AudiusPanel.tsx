import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ExternalLink, Headphones, LoaderCircle, Music2, Play, Search, X } from 'lucide-react';
import {
  getTrendingAudiusTracks,
  isAudiusConfigured,
  searchAudiusTracks,
  type AudiusTrack,
} from '../utils/audius';

interface AudiusPanelProps {
  onClose: () => void;
  onPlayTrack: (track: AudiusTrack, queue: AudiusTrack[]) => Promise<void>;
  currentTrackId: string | null;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--:--';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function AudiusPanel({ onClose, onPlayTrack, currentTrackId }: AudiusPanelProps) {
  const configured = isAudiusConfigured();
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<AudiusTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(currentTrackId);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

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
      await onPlayTrack(track, tracks);
      setMessage(`Now playing: ${track.title}`);
    } catch (caught) {
      setPlayingId(null);
      setError(caught instanceof Error ? caught.message : 'Could not play this Audius track.');
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
        className="max-h-[92vh] w-full max-w-[680px] overflow-y-auto border border-[#171717]/20 bg-[#F5F5F2] p-4 shadow-2xl sm:p-5"
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
              Search independent music and play public Audius tracks directly in the listening room. No listener sign-in required.
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

            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-[#777770]">
                {query.trim() ? 'SEARCH RESULTS' : 'TRENDING THIS WEEK'} · {tracks.length} TRACKS
              </p>
              <a href="https://audius.co/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-[#405E49] underline underline-offset-2">
                Audius <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>

            <div className="max-h-[48vh] overflow-y-auto border border-[#171717]/10 bg-white">
              {loading && tracks.length === 0 ? (
                <div className="flex min-h-28 items-center justify-center gap-2 text-xs text-[#777770]"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading tracks…</div>
              ) : tracks.length > 0 ? (
                <ul className="divide-y divide-[#171717]/10">
                  {tracks.map((track) => {
                    const isCurrent = playingId === track.id;
                    return (
                      <li key={track.id} className={`flex items-center gap-3 p-2.5 ${isCurrent ? 'bg-[#EFF3ED]' : 'hover:bg-[#F7F7F4]'}`}>
                        {track.artworkUrl ? (
                          <img src={track.artworkUrl} alt="" loading="lazy" className="h-12 w-12 shrink-0 object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-[#E7E7E2]"><Music2 className="h-5 w-5 text-[#777770]" /></div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-[#171717]">{track.title}</p>
                          <p className="mt-0.5 truncate text-[11px] text-[#62625D]">{track.artist}{track.genre ? ` · ${track.genre}` : ''}</p>
                          <p className="mt-0.5 font-mono-tech text-[10px] text-[#8A8A83]">{formatDuration(track.durationSec)}</p>
                        </div>
                        <a href={track.permalink} target="_blank" rel="noreferrer" aria-label={`Open ${track.title} on Audius`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-[#777770] hover:text-[#171717]">
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                        <button
                          type="button"
                          onClick={() => void handlePlay(track)}
                          className={`inline-flex h-9 shrink-0 items-center gap-1.5 px-3 text-[11px] font-semibold ${isCurrent ? 'bg-[#648B72] text-white' : 'bg-[#171717] text-white hover:bg-[#30302D]'}`}
                          aria-label={`Play ${track.title}`}
                        >
                          {isCurrent ? <Headphones className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                          {isCurrent ? 'Selected' : 'Play'}
                        </button>
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
