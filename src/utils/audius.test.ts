import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAudiusTrack } from './audius.ts';

test('normalizes a streamable Audius track and its artist metadata', () => {
  const track = normalizeAudiusTrack({
    id: 'track-123',
    title: '  Quiet Morning  ',
    duration: 186,
    permalink: '/artist/quiet-morning',
    genre: 'Electronic',
    is_streamable: true,
    is_stream_gated: false,
    artwork: { _480x480: 'https://cdn.audius.co/artwork.jpg' },
    user: { name: 'Little Artist', handle: 'littleartist' },
  });

  assert.deepEqual(track, {
    id: 'track-123',
    title: 'Quiet Morning',
    artist: 'Little Artist',
    artistHandle: 'littleartist',
    durationSec: 186,
    artworkUrl: 'https://cdn.audius.co/artwork.jpg',
    permalink: 'https://audius.co/artist/quiet-morning',
    genre: 'Electronic',
    isStreamable: true,
    isStreamGated: false,
  });
});

test('rejects records without an id or title', () => {
  assert.equal(normalizeAudiusTrack({ title: 'Missing ID' }), null);
  assert.equal(normalizeAudiusTrack({ id: 'track-1', title: '   ' }), null);
});

test('marks non-streamable and gated records without changing their flags', () => {
  const notStreamable = normalizeAudiusTrack({ id: 'a', title: 'A', is_streamable: false });
  const gated = normalizeAudiusTrack({ id: 'b', title: 'B', is_stream_gated: true });
  assert.equal(notStreamable?.isStreamable, false);
  assert.equal(gated?.isStreamGated, true);
});

test('does not trust an external or unsafe track permalink', () => {
  const external = normalizeAudiusTrack({ id: 'a', title: 'A', permalink: 'https://evil.example/track' });
  const unsafe = normalizeAudiusTrack({ id: 'b', title: 'B', permalink: 'javascript:alert(1)' });
  assert.equal(external?.permalink, 'https://audius.co/');
  assert.equal(unsafe?.permalink, 'https://audius.co/');
});
