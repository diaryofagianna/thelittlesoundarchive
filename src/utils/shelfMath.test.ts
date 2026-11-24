import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_CATALOG } from '../data/catalog';
import {
  clampShelfScroll,
  computeShelfTransform,
  filterRecords,
  formatDurationLabel,
  formatLcdTime,
  getCameraPoseForState,
  getNextRecordIndex,
  getPrevRecordIndex,
  getSectionOptionsForFormat,
  nearestShelfIndex,
} from './shelfMath';

test('filterRecords filters correctly by format', () => {
  assert.equal(filterRecords(INITIAL_CATALOG, 'all').length, 9);
  assert.equal(filterRecords(INITIAL_CATALOG, 'cd').length, 3);
  assert.equal(filterRecords(INITIAL_CATALOG, 'cassette').length, 3);
  assert.equal(filterRecords(INITIAL_CATALOG, 'vinyl').length, 3);
  assert.ok(filterRecords(INITIAL_CATALOG, 'cd').every((r) => r.format === 'cd'));
});

test('clampShelfScroll and nearestShelfIndex respect bounds', () => {
  assert.equal(clampShelfScroll(-2.5, 9), 0);
  assert.equal(clampShelfScroll(12.3, 9), 8);
  assert.equal(clampShelfScroll(3.4, 9), 3.4);
  assert.equal(clampShelfScroll(2, 1), 0);

  assert.equal(nearestShelfIndex(2.49, 9), 2);
  assert.equal(nearestShelfIndex(2.51, 9), 3);
  assert.equal(nearestShelfIndex(-1, 9), 0);
});

test('computeShelfTransform centers focused item and recesses neighbors', () => {
  const center = computeShelfTransform(2, 2);
  const rightNeighbor = computeShelfTransform(3, 2);
  const leftNeighbor = computeShelfTransform(1, 2);

  assert.equal(center.x, 0);
  assert.equal(center.isFocused, true);
  assert.ok(center.z > rightNeighbor.z);
  assert.ok(center.scale > rightNeighbor.scale);
  assert.ok(rightNeighbor.x > 0);
  assert.ok(leftNeighbor.x < 0);
  assert.equal(rightNeighbor.isFocused, false);
});

test('formatLcdTime and formatDurationLabel format tabular timestamps', () => {
  assert.equal(formatLcdTime(0), '0.00.00');
  assert.equal(formatLcdTime(1.7), '0.01.70');
  assert.equal(formatLcdTime(65.05), '1.05.05');
  assert.equal(formatDurationLabel(194), '03:14');
  assert.equal(formatDurationLabel(-5), '00:00');
});

test('camera poses and section labels exist for all formats and modes', () => {
  const shelfPose = getCameraPoseForState('shelf', 'cd', 'overview');
  assert.deepEqual(shelfPose.target, [0, 0.02, 0]);

  for (const format of ['cd', 'cassette', 'vinyl'] as const) {
    const sections = getSectionOptionsForFormat(format);
    assert.equal(sections.length, 5);
    for (const sec of sections) {
      const pose = getCameraPoseForState('player', format, sec.id);
      assert.equal(pose.position.length, 3);
      assert.equal(pose.target.length, 3);
    }
  }
});

test('wrap-around next and prev index helpers cycle cleanly', () => {
  assert.equal(getNextRecordIndex(8, 9), 0);
  assert.equal(getNextRecordIndex(0, 9), 1);
  assert.equal(getPrevRecordIndex(0, 9), 8);
  assert.equal(getPrevRecordIndex(4, 9), 3);
});
