export type SpotifyContentType =
  | 'album'
  | 'artist'
  | 'episode'
  | 'playlist'
  | 'show'
  | 'track';

export interface SpotifyEmbedTarget {
  type: SpotifyContentType;
  id: string;
  embedUrl: string;
  openUrl: string;
}

const SUPPORTED_TYPES = new Set<SpotifyContentType>([
  'album',
  'artist',
  'episode',
  'playlist',
  'show',
  'track',
]);
const SPOTIFY_ID_PATTERN = /^[A-Za-z0-9]{22}$/;

/** Parse a Spotify share URL or URI without accepting arbitrary iframe origins. */
export function parseSpotifyLink(value: string): SpotifyEmbedTarget | null {
  const input = value.trim();
  if (!input) return null;

  let type: string | undefined;
  let id: string | undefined;

  if (input.startsWith('spotify:')) {
    const parts = input.split(':');
    if (parts.length === 3) {
      [, type, id] = parts;
    }
  } else {
    let url: URL;
    try {
      url = new URL(input.includes('://') ? input : `https://${input}`);
    } catch {
      return null;
    }

    if (url.protocol !== 'https:' || url.hostname !== 'open.spotify.com') {
      return null;
    }

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'embed') parts.shift();
    if (parts[0]?.startsWith('intl-')) parts.shift();
    [type, id] = parts;
  }

  if (!type || !SUPPORTED_TYPES.has(type as SpotifyContentType)) return null;
  if (!id || !SPOTIFY_ID_PATTERN.test(id)) return null;

  const contentType = type as SpotifyContentType;
  return {
    type: contentType,
    id,
    embedUrl: `https://open.spotify.com/embed/${contentType}/${id}?utm_source=generator&theme=0`,
    openUrl: `https://open.spotify.com/${contentType}/${id}`,
  };
}
