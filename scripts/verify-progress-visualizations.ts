import assert from 'node:assert/strict';
import { buildProgressAnalytics } from '../src/lib/progressAnalytics.ts';
import { getProgressDemoRecords } from '../src/lib/progressDemoData.ts';

const demoRecords = getProgressDemoRecords();
const analytics = buildProgressAnalytics(demoRecords);

assert.equal(analytics.trajectory.length, 11, 'every analyzed demo record should become one observed point');
assert.deepEqual(
  analytics.trajectory.map(point => point.timestamp),
  [...analytics.trajectory.map(point => point.timestamp)].sort((a, b) => a - b),
  'trajectory points should be chronological',
);
assert.equal(analytics.trajectory.filter(point => point.series === 'speaking').length, 4);
assert.equal(analytics.trajectory.filter(point => point.series === 'writingTask1').length, 3);
assert.equal(analytics.trajectory.filter(point => point.series === 'writingTask2').length, 4);

assert.equal(analytics.criteria.speaking?.sourceRecordId, 'demo-speaking-4');
assert.equal(analytics.criteria.speaking?.criteria.length, 3, 'Speaking profile must not fabricate pronunciation');
assert.ok(analytics.criteria.speaking?.note.toLowerCase().includes('pronunciation is excluded'));
assert.equal(analytics.criteria.writingTask2?.sourceRecordId, 'demo-writing-task2-4');
assert.equal(analytics.criteria.writingTask2?.criteria.length, 4);

assert.equal(analytics.coverage.speaking.data.find(item => item.category === 'Technology')?.attempts, 1);
assert.equal(analytics.coverage.writingTask1.data.find(item => item.category === 'line graph')?.attempts, 2);
assert.equal(analytics.coverage.writingTask2.data.find(item => item.category === 'Education')?.attempts, 2);
assert.ok(analytics.coverage.speaking.data.some(item => item.attempts === 0), 'zero-count categories must remain visible');
assert.ok(analytics.coverage.writingTask1.data.some(item => item.attempts === 0));
assert.ok(analytics.coverage.writingTask2.data.some(item => item.attempts === 0));

const empty = buildProgressAnalytics([]);
assert.equal(empty.trajectory.length, 0);
assert.equal(empty.criteria.speaking, undefined);
assert.equal(empty.criteria.writingTask2, undefined);
assert.ok(Object.values(empty.coverage).every(group => group.data.every(item => item.attempts === 0)));

console.log('verify:progress-visualizations passed');
