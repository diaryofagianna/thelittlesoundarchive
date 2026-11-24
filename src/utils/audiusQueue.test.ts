import assert from 'node:assert/strict';
import test from 'node:test';
import type { AudiusTrack } from './audius.ts';
import {
  AUDIUS_QUEUE_STORAGE_KEY,
  appendUniqueAudiusTracks,
  cycleAudiusRepeatMode,
  findAudiusQueueIndex,
  getNextAudiusQueueTrack,
  loadAudiusQueueState,
  removeAudiusQueueTrack,
  saveAudiusQueueState,
  shuffleAudiusQueue,
} from './audiusQueue.ts';

function track(id: string): AudiusTrack {
  return {
    id,
    title: `Track ${id}`,
    artist: 'Test artist',
    artistHandle: 'testartist',
    durationSec: 180,
    artworkUrl: null,
    permalink: `https://audius.co/test/${id}`,
    genre: 'Electronic',
    isStreamable: true,
    isStreamGated: false,
  };
}

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(AUDIUS_QUEUE_STORAGE_KEY, initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

test('adds multiple tracks while ignoring duplicate IDs', () => {
  const first = track('one');
  const second = track('two');
  const result = appendUniqueAudiusTracks([first], [second, first, second]);
  assert.deepEqual(result.queue, [first, second]);
  assert.equal(result.addedCount, 1);
});

test('does not allocate a new queue when every track is already queued', () => {
  const first = track('one');
  const originalQueue = [first];
  const result = appendUniqueAudiusTracks(originalQueue, [first]);
  assert.equal(result.queue, originalQueue);
  assert.equal(result.addedCount, 0);
});

test('does not allow the currently playing track to be removed', () => {
  const queue = [track('one'), track('two')];
  assert.equal(removeAudiusQueueTrack(queue, 'one', 'one'), queue);
  assert.deepEqual(removeAudiusQueueTrack(queue, 'two', 'one'), [queue[0]]);
});

test('finds current queue position and handles an empty current ID', () => {
  const queue = [track('one'), track('two')];
  assert.equal(findAudiusQueueIndex(queue, 'two'), 1);
  assert.equal(findAudiusQueueIndex(queue, null), -1);
  assert.equal(findAudiusQueueIndex(queue, 'missing'), -1);
});

test('shuffle preserves the current track and only changes upcoming items', () => {
  const queue = [track('played'), track('current'), track('a'), track('b'), track('c')];
  const shuffled = shuffleAudiusQueue(queue, 'current', () => 0);
  assert.deepEqual(shuffled.slice(0, 2), queue.slice(0, 2));
  assert.deepEqual(shuffled.slice(2).map((item) => item.id), ['b', 'c', 'a']);
});

test('repeat one repeats the current item and repeat queue wraps at the end', () => {
  const queue = [track('one'), track('two')];
  assert.equal(getNextAudiusQueueTrack(queue, 'two', 'one')?.id, 'two');
  assert.equal(getNextAudiusQueueTrack(queue, 'two', 'queue')?.id, 'one');
  assert.equal(getNextAudiusQueueTrack(queue, 'two', 'off'), null);
});

test('normal queue playback advances and starts at the first item when current is absent', () => {
  const queue = [track('one'), track('two')];
  assert.equal(getNextAudiusQueueTrack(queue, 'one', 'off')?.id, 'two');
  assert.equal(getNextAudiusQueueTrack(queue, null, 'off')?.id, 'one');
  assert.equal(getNextAudiusQueueTrack([], null, 'queue'), null);
});

test('repeat mode cycles off, queue, one, off', () => {
  assert.equal(cycleAudiusRepeatMode('off'), 'queue');
  assert.equal(cycleAudiusRepeatMode('queue'), 'one');
  assert.equal(cycleAudiusRepeatMode('one'), 'off');
});

test('saves and restores queue and playback preferences from localStorage-compatible storage', () => {
  const storage = memoryStorage();
  const state = {
    queue: [track('one'), track('two')],
    shuffleEnabled: true,
    repeatMode: 'queue' as const,
  };
  assert.equal(saveAudiusQueueState(state, storage), true);
  assert.deepEqual(loadAudiusQueueState(storage), state);
});

test('ignores invalid saved data and filters malformed or duplicate tracks', () => {
  const invalid = memoryStorage('{not-json');
  assert.deepEqual(loadAudiusQueueState(invalid), { queue: [], shuffleEnabled: false, repeatMode: 'off' });

  const encoded = JSON.stringify({
    version: 1,
    queue: [track('one'), { id: 'bad' }, track('one'), track('two')],
    shuffleEnabled: 'yes',
    repeatMode: 'invalid',
  });
  const restored = loadAudiusQueueState(memoryStorage(encoded));
  assert.deepEqual(restored.queue.map((item) => item.id), ['one', 'two']);
  assert.equal(restored.shuffleEnabled, false);
  assert.equal(restored.repeatMode, 'off');
});

test('storage failures do not throw into the music player', () => {
  const blocked = {
    getItem: () => { throw new Error('Storage denied'); },
    setItem: () => { throw new Error('Quota exceeded'); },
  };
  assert.deepEqual(loadAudiusQueueState(blocked), { queue: [], shuffleEnabled: false, repeatMode: 'off' });
  assert.equal(saveAudiusQueueState({ queue: [track('one')], shuffleEnabled: false, repeatMode: 'off' }, blocked), false);
});
