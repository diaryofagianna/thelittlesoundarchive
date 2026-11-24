import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSpotifyLink } from './spotify';

const id = '4uLU6hMCjMI75M1A2tKUQC';

test('parses a Spotify track URL and ignores share query parameters', () => {
  const result = parseSpotifyLink(`https://open.spotify.com/track/${id}?si=abc123`);
  assert.equal(result?.type, 'track');
  assert.equal(result?.id, id);
  assert.equal(result?.embedUrl, `https://open.spotify.com/embed/track/${id}?utm_source=generator&theme=0`);
});

test('parses an embed URL with a locale prefix', () => {
  const result = parseSpotifyLink(`https://open.spotify.com/embed/intl-us/playlist/${id}`);
  assert.equal(result?.type, 'playlist');
  assert.equal(result?.id, id);
});

test('parses Spotify URI syntax', () => {
  assert.equal(parseSpotifyLink(`spotify:album:${id}`)?.openUrl, `https://open.spotify.com/album/${id}`);
});

test('rejects non-Spotify hosts and non-HTTPS URLs', () => {
  assert.equal(parseSpotifyLink(`https://evil.example/track/${id}`), null);
  assert.equal(parseSpotifyLink(`http://open.spotify.com/track/${id}`), null);
});

test('rejects unsupported types and malformed IDs', () => {
  assert.equal(parseSpotifyLink(`https://open.spotify.com/user/${id}`), null);
  assert.equal(parseSpotifyLink('https://open.spotify.com/track/not-an-id'), null);
  assert.equal(parseSpotifyLink(''), null);
});
