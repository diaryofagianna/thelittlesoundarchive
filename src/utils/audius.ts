/**
 * Public, read-only Audius catalog integration for The Little Sound Archive.
 * The API key is a public client identifier and is safe to expose in the browser.
 * Never add an Audius API secret or Bearer Token to this frontend.
 */

const AUDIUS_API_BASE = 'https://api.audius.co/v1';
const AUDIUS_APP_NAME = 'diaryofagianna';
const AUDIUS_API_KEY = (import.meta.env?.VITE_AUDIUS_API_KEY ?? '').trim();

export interface AudiusTrack {
  id: string;
  title: string;
  artist: string;
  artistHandle: string;
  durationSec: number;
  artworkUrl: string | null;
  permalink: string;
  genre: string | null;
  isStreamable: boolean;
  isStreamGated: boolean;
}

interface AudiusRawTrack {
  id?: string | number;
  title?: string;
  duration?: number;
  duration_seconds?: number;
  permalink?: string;
  genre?: string | null;
  isStreamable?: boolean | string;
  is_streamable?: boolean | string;
  isStreamGated?: boolean;
  is_stream_gated?: boolean;
  artwork?: Record<string, string | undefined> | null;
  user?: {
    name?: string;
    handle?: string;
  } | null;
}

interface AudiusResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export function isAudiusConfigured(): boolean {
  return AUDIUS_API_KEY.length > 0;
}

export function normalizeAudiusTrack(raw: AudiusRawTrack): AudiusTrack | null {
  if (raw.id === undefined || raw.id === null || !raw.title?.trim()) return null;

  const isStreamable = raw.isStreamable !== false && raw.is_streamable !== false &&
    raw.isStreamable !== 'false' && raw.is_streamable !== 'false';
  const isStreamGated = raw.isStreamGated === true || raw.is_stream_gated === true;
  const artwork = raw.artwork;
  const artworkUrl = artwork?._480x480 ?? artwork?._1000x1000 ?? artwork?._150x150 ??
    artwork?.['480x480'] ?? artwork?.['1000x1000'] ?? artwork?.['150x150'] ?? null;
  let permalink = 'https://audius.co/';
  if (raw.permalink) {
    try {
      const candidate = new URL(raw.permalink, 'https://audius.co');
      if (candidate.protocol === 'https:' && (candidate.hostname === 'audius.co' || candidate.hostname.endsWith('.audius.co'))) {
        permalink = candidate.toString();
      }
    } catch {
      // Ignore malformed third-party permalink data and keep the safe Audius home link.
    }
  }

  return {
    id: String(raw.id),
    title: raw.title.trim(),
    artist: raw.user?.name?.trim() || 'Independent artist',
    artistHandle: raw.user?.handle?.trim() || '',
    durationSec: Math.max(0, Number(raw.duration ?? raw.duration_seconds ?? 0) || 0),
    artworkUrl: artworkUrl && /^https:\/\//i.test(artworkUrl) ? artworkUrl : null,
    permalink,
    genre: raw.genre?.trim() || null,
    isStreamable,
    isStreamGated,
  };
}

function requireApiKey(): string {
  if (!AUDIUS_API_KEY) {
    throw new Error('Audius is not configured yet. Add VITE_AUDIUS_API_KEY to your .env file and restart the dev server.');
  }
  return AUDIUS_API_KEY;
}

async function requestAudius<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  signal?: AbortSignal,
): Promise<T> {
  const apiKey = requireApiKey();
  const url = new URL(`${AUDIUS_API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'x-api-key': apiKey,
    },
    signal,
  });

  if (response.status === 429) {
    throw new Error('Audius rate limit reached. Please wait a moment and try again.');
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Audius request failed (${response.status})${detail ? `: ${detail.slice(0, 160)}` : ''}`);
  }

  const payload = await response.json() as AudiusResponse<T>;
  if (payload.error) throw new Error(payload.error);
  if (payload.data === undefined || payload.data === null) {
    throw new Error(payload.message || 'Audius returned an empty response.');
  }
  return payload.data;
}

function playableTracks(items: AudiusRawTrack[]): AudiusTrack[] {
  return items
    .map(normalizeAudiusTrack)
    .filter((track): track is AudiusTrack => Boolean(track && track.isStreamable && !track.isStreamGated));
}

export async function searchAudiusTracks(
  query: string,
  limit = 20,
  signal?: AbortSignal,
): Promise<AudiusTrack[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return getTrendingAudiusTracks(limit, signal);
  const items = await requestAudius<AudiusRawTrack[]>(
    '/tracks/search',
    { query: normalizedQuery, limit: Math.max(1, Math.min(50, limit)), sort_method: 'relevant' },
    signal,
  );
  return playableTracks(items);
}

export async function getTrendingAudiusTracks(
  limit = 20,
  signal?: AbortSignal,
): Promise<AudiusTrack[]> {
  const items = await requestAudius<AudiusRawTrack[]>(
    '/tracks/trending',
    { time: 'week', limit: Math.max(1, Math.min(50, limit)) },
    signal,
  );
  return playableTracks(items);
}

/**
 * HTMLMediaElement cannot attach custom request headers. Audius supports the
 * public API key as a query parameter for stream URLs; this key is intentionally
 * public. The stream endpoint serves the MP3 and supports normal media playback.
 */
export function getAudiusTrackStreamUrl(trackId: string): string {
  const apiKey = requireApiKey();
  if (!trackId.trim()) throw new Error('A valid Audius track ID is required.');
  const url = new URL(`${AUDIUS_API_BASE}/tracks/${encodeURIComponent(trackId)}/stream`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('app_name', AUDIUS_APP_NAME);
  return url.toString();
}
