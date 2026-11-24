import type { AudiusTrack } from './audius';

export type AudiusRepeatMode = 'off' | 'one' | 'queue';

export interface AudiusQueueAppendResult {
  queue: AudiusTrack[];
  addedCount: number;
}

export interface PersistedAudiusQueueState {
  queue: AudiusTrack[];
  shuffleEnabled: boolean;
  repeatMode: AudiusRepeatMode;
}

export const AUDIUS_QUEUE_STORAGE_KEY = 'the-little-sound-archive.audius-queue.v1';
const STORAGE_VERSION = 1;
const MAX_PERSISTED_TRACKS = 100;
const EMPTY_STATE: PersistedAudiusQueueState = {
  queue: [],
  shuffleEnabled: false,
  repeatMode: 'off',
};

type QueueStorage = Pick<Storage, 'getItem' | 'setItem'>;

function getStorage(storage?: QueueStorage | null): QueueStorage | null {
  if (storage !== undefined) return storage;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeStoredTrack(value: unknown): AudiusTrack | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const artist = typeof value.artist === 'string' ? value.artist.trim() : '';
  if (!id || !title || !artist || id.length > 200 || title.length > 300 || artist.length > 300) return null;

  const permalinkInput = typeof value.permalink === 'string' ? value.permalink : '';
  let permalink = 'https://audius.co/';
  try {
    const candidate = new URL(permalinkInput, 'https://audius.co');
    if (candidate.protocol === 'https:' && (candidate.hostname === 'audius.co' || candidate.hostname.endsWith('.audius.co'))) {
      permalink = candidate.toString();
    }
  } catch {
    // Persist only safe Audius source links.
  }

  const artworkInput = typeof value.artworkUrl === 'string' ? value.artworkUrl : null;
  const artworkUrl = artworkInput && /^https:\/\//i.test(artworkInput) ? artworkInput.slice(0, 2048) : null;
  const duration = Number(value.durationSec);

  return {
    id,
    title,
    artist,
    artistHandle: typeof value.artistHandle === 'string' ? value.artistHandle.slice(0, 120) : '',
    durationSec: Number.isFinite(duration) ? Math.max(0, Math.min(duration, 24 * 60 * 60)) : 0,
    artworkUrl,
    permalink,
    genre: typeof value.genre === 'string' ? value.genre.slice(0, 120) : null,
    isStreamable: value.isStreamable !== false,
    isStreamGated: value.isStreamGated === true,
  };
}

/** Append tracks without duplicating IDs already present in the play queue. */
export function appendUniqueAudiusTracks(
  queue: AudiusTrack[],
  tracks: AudiusTrack[],
): AudiusQueueAppendResult {
  const seen = new Set(queue.map((track) => track.id));
  const additions = tracks.filter((track) => {
    if (seen.has(track.id)) return false;
    seen.add(track.id);
    return true;
  });

  return {
    queue: additions.length > 0 ? [...queue, ...additions] : queue,
    addedCount: additions.length,
  };
}

/** Keep the current item in place and shuffle only the tracks that have not played yet. */
export function shuffleAudiusQueue(
  queue: AudiusTrack[],
  currentTrackId: string | null,
  random: () => number = Math.random,
): AudiusTrack[] {
  const currentIndex = findAudiusQueueIndex(queue, currentTrackId);
  const splitIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
  const prefix = queue.slice(0, splitIndex);
  const upcoming = queue.slice(splitIndex);

  for (let index = upcoming.length - 1; index > 0; index -= 1) {
    const sample = Math.min(0.999999999, Math.max(0, random()));
    const swapIndex = Math.floor(sample * (index + 1));
    [upcoming[index], upcoming[swapIndex]] = [upcoming[swapIndex], upcoming[index]];
  }

  return [...prefix, ...upcoming];
}

/** Resolve the next item for automatic end-of-track playback. */
export function getNextAudiusQueueTrack(
  queue: AudiusTrack[],
  currentTrackId: string | null,
  repeatMode: AudiusRepeatMode,
): AudiusTrack | null {
  if (queue.length === 0) return null;
  const currentIndex = findAudiusQueueIndex(queue, currentTrackId);

  if (repeatMode === 'one' && currentIndex >= 0) return queue[currentIndex] ?? null;
  if (currentIndex < 0) return queue[0] ?? null;
  if (currentIndex < queue.length - 1) return queue[currentIndex + 1] ?? null;
  if (repeatMode === 'queue') return queue[0] ?? null;
  return null;
}

export function cycleAudiusRepeatMode(mode: AudiusRepeatMode): AudiusRepeatMode {
  if (mode === 'off') return 'queue';
  if (mode === 'queue') return 'one';
  return 'off';
}

/** Keep the currently playing item in place; any other queue item can be removed. */
export function removeAudiusQueueTrack(
  queue: AudiusTrack[],
  trackId: string,
  currentTrackId: string | null,
): AudiusTrack[] {
  if (trackId === currentTrackId) return queue;
  return queue.filter((track) => track.id !== trackId);
}

export function findAudiusQueueIndex(queue: AudiusTrack[], trackId: string | null): number {
  if (!trackId) return -1;
  return queue.findIndex((track) => track.id === trackId);
}

/** Load a validated, versioned queue snapshot. Playback is never auto-started on page load. */
export function loadAudiusQueueState(storage?: QueueStorage | null): PersistedAudiusQueueState {
  const target = getStorage(storage);
  if (!target) return { ...EMPTY_STATE, queue: [] };

  try {
    const raw = target.getItem(AUDIUS_QUEUE_STORAGE_KEY);
    if (!raw) return { ...EMPTY_STATE, queue: [] };
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.queue)) {
      return { ...EMPTY_STATE, queue: [] };
    }

    const normalized = parsed.queue
      .map(normalizeStoredTrack)
      .filter((track): track is AudiusTrack => Boolean(track))
      .slice(0, MAX_PERSISTED_TRACKS);
    const uniqueQueue = appendUniqueAudiusTracks([], normalized).queue;
    const repeatMode: AudiusRepeatMode = parsed.repeatMode === 'one' || parsed.repeatMode === 'queue'
      ? parsed.repeatMode
      : 'off';

    return {
      queue: uniqueQueue,
      shuffleEnabled: parsed.shuffleEnabled === true,
      repeatMode,
    };
  } catch {
    // Storage can be unavailable or contain malformed JSON; start with a safe empty queue.
    return { ...EMPTY_STATE, queue: [] };
  }
}

/** Persist only public track metadata and playback preferences; never credentials or stream URLs. */
export function saveAudiusQueueState(
  state: PersistedAudiusQueueState,
  storage?: QueueStorage | null,
): boolean {
  const target = getStorage(storage);
  if (!target) return false;

  try {
    const queue = appendUniqueAudiusTracks([], state.queue)
      .queue
      .slice(0, MAX_PERSISTED_TRACKS);
    target.setItem(AUDIUS_QUEUE_STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION,
      savedAt: new Date().toISOString(),
      queue,
      shuffleEnabled: state.shuffleEnabled,
      repeatMode: state.repeatMode,
    }));
    return true;
  } catch {
    // QuotaExceededError and browser privacy restrictions must not break playback.
    return false;
  }
}
