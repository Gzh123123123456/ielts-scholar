import assert from 'node:assert/strict';
import {
  buildFeedbackHistoryReplayReport,
  extractPracticeRecordsFromBackupPayload,
} from '../src/lib/feedbackHistoryReplay.ts';

const now = '2026-06-15T00:00:00.000Z';

const speakingFeedback = {
  mode: 'practice',
  module: 'speaking',
  part: 2,
  question: 'Describe a memorable trip.',
  transcript: 'I go to Beijing last year and it is very fun. I meet many people and take many photo.',
  bandEstimateExcludingPronunciation: 5.5,
  scores: {
    fluencyCoherence: 5.5,
    lexicalResource: 5.5,
    grammaticalRangeAccuracy: 5,
    pronunciation: null,
    pronunciationNote: 'Not formally assessed.',
  },
  fatalErrors: [{
    original: 'I go to Beijing last year',
    correction: 'I went to Beijing last year',
    tag: 'tense',
    explanationZh: 'Past trip needs past tense.',
  }],
  naturalnessHints: [],
  band9Refinements: [],
  preservedStyle: [],
  upgradedAnswer: 'I went to Beijing last year, and it was a really memorable trip.',
  part2Feedback: {
    materialType: 'experience_event',
    annotations: [{
      id: 'a1',
      questionRef: 'PART 2',
      sourceQuote: 'I go to Beijing last year',
      combinedRepair: 'I went to Beijing last year',
      layers: [{
        severity: 'must_fix',
        issueType: 'tense',
        original: 'I go to Beijing last year',
        better: 'I went to Beijing last year',
        explanationZh: 'Past trip needs past tense.',
      }],
    }],
    storyModules: [],
    languageSignals: [],
    priorityFocusZh: 'Fix tense.',
    nextSpeakableVersion: 'I went to Beijing last year, and it was a really memorable trip.',
    nextSpeakableVersionHighlights: [],
  },
  reusableExample: null,
  obsidianMarkdown: '',
};

const backupPayload = {
  formatVersion: 2,
  capturedAt: now,
  origin: 'http://localhost:3000',
  indexedDb: {
    practiceRecords: [{
      id: 'history_speaking_1',
      module: 'speaking',
      mode: 'practice',
      status: 'analyzed',
      part: 2,
      question: 'Describe a memorable trip.',
      createdAt: now,
      updatedAt: now,
      analyzedAt: now,
      transcript: 'I go to Beijing last year and it is very fun. I meet many people and take many photo.',
      transcriptOrigin: 'manual',
      feedback: speakingFeedback,
    }],
    activeStates: [],
    legacySessionsArchive: [{ archiveKey: 'legacy_1', rawPayload: { id: 'legacy_1' } }],
    meta: [],
  },
  localStorage: {},
  sessionStorage: {},
};

const { records, source } = extractPracticeRecordsFromBackupPayload(backupPayload);
assert.equal(source.canonicalRecordsFound, 1);
assert.equal(source.legacySessionArchiveFound, 1);
assert.equal(records.length, 1);

const report = buildFeedbackHistoryReplayReport(records, {
  limit: 8,
  modules: ['speaking'],
  speakingParts: [1, 2, 3],
  includePackets: false,
  includeTeacherJudgePrompts: false,
}, source);

assert.equal(report.totals.candidateRecords, 1);
assert.equal(report.totals.sampledRecords, 1);
assert.equal(report.cases[0].record.id, 'history_speaking_1');
assert.equal(report.cases[0].record.part, 2);
assert.equal(report.cases[0].packet, undefined);
assert(report.totals.teacherJudgeNeeded >= 1);

console.log('Feedback history replay verification passed.');
