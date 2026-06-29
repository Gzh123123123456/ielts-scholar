import assert from 'node:assert/strict';
import { writingTask1Academic } from '../src/data/questions/bank.ts';
import type { WritingTask1AcademicPrompt } from '../src/data/questions/bank.ts';
import { MockProvider } from '../src/lib/ai/providers/mockProvider.ts';
import { safeAnalyzeWritingTask1 } from '../src/lib/ai/safety.ts';
import type { WritingTask1Feedback } from '../src/lib/ai/schemas.ts';
import { buildTask1FeedbackDisplayModel } from '../src/lib/writingTask1DisplayModel.ts';
import {
  findLikelyTask1PromptMismatch,
  routeTask1FeedbackLevel,
} from '../src/lib/writingTask1SubmissionQuality.ts';
import {
  validateTask1AnalysisForRender,
  validateTask1TargetReportForDisplay,
} from '../src/lib/writingTask1AnalysisState.ts';

const tablePrompt = writingTask1Academic.find(prompt => prompt.id === 'wt1_table_health_001');
const linePrompt = writingTask1Academic.find(prompt => prompt.id === 'wt1_line_transport_001');

assert.ok(tablePrompt, 'Expected table health Task 1 prompt fixture to exist.');
assert.ok(linePrompt, 'Expected line transport Task 1 prompt fixture to exist.');

const report = [
  'The table compares the average waiting times, measured in minutes, at public clinics in four different districts in 2015 and 2025.',
  '',
  'Overall, waiting times decreased in three of the four areas over the period, while the West was the only district to experience an increase. In addition, the East had the longest waiting time in 2015, whereas the West ranked first in 2025. The South recorded the shortest waiting time in both years.',
  '',
  'In 2015, patients in the East waited for an average of 51 minutes, which was the highest figure among the four districts. This was followed by the West and the North, at 46 and 44 minutes respectively. By comparison, the South had the lowest waiting time, at 39 minutes.',
  '',
  'By 2025, the figure for the North had fallen considerably by 12 minutes to 32. A similar decline was seen in the South, where waiting time dropped from 39 to 28 minutes. The East also experienced a smaller reduction, from 51 to 45 minutes. In contrast, the average waiting time in the West rose by eight minutes to 54, making it the highest figure in 2025.',
].join('\n');

const promptSourceText = (prompt: WritingTask1AcademicPrompt) =>
  [prompt.instruction, prompt.visualBrief, ...prompt.data].join(' ');

const promptCandidate = (prompt: WritingTask1AcademicPrompt) => ({
  id: prompt.id,
  taskType: prompt.taskType,
  topic: prompt.topic,
  sourceText: promptSourceText(prompt),
});

const makeTableFeedback = (overrides: Partial<WritingTask1Feedback> = {}): WritingTask1Feedback => ({
  mode: 'practice',
  module: 'writing_task1',
  task: 'task1',
  taskType: tablePrompt.taskType,
  instruction: tablePrompt.instruction,
  visualBrief: tablePrompt.visualBrief,
  report,
  estimatedBand: 6.5,
  taskAchievement: {
    score: 6.5,
    feedback: 'The report covers the main changes and uses accurate data from the table.',
  },
  overviewFeedback: 'The overview is clear: waiting times dropped in three districts, while the West increased.',
  keyFeaturesFeedback: 'The report selects the East, West and South clearly, including the highest and lowest figures.',
  comparisonFeedback: 'The comparisons between districts and years are relevant, especially the contrast with the West.',
  dataAccuracyFeedback: 'The figures used in the report match the table, including 51, 45, 28 and 54 minutes.',
  coherenceFeedback: 'The four-paragraph structure is appropriate for this table task.',
  languageCorrections: [],
  mustFix: [],
  rewriteTask: 'Optional upgrade: replace "ranked first" with "recorded the longest waiting time".',
  reusableReportPatterns: [
    'Overall, X decreased in three of the four areas, while Y was the only category to increase.',
    'This was followed by A and B, at ... respectively.',
  ],
  improvedReport: 'The table compares average clinic waiting times in four districts in 2015 and 2025. Overall, waiting times fell in three districts, while the West was the only area to increase and became the slowest by 2025.',
  obsidianMarkdown: '',
  ...overrides,
});

const assertRenderable = (feedback: WritingTask1Feedback, message: string) => {
  const state = validateTask1AnalysisForRender({
    currentPrompt: tablePrompt,
    feedback,
    feedbackPromptId: tablePrompt.id,
    promptBank: writingTask1Academic,
  });
  assert.deepEqual(state, { kind: 'success' }, message);
};

const assertBlocked = (feedback: WritingTask1Feedback, expectedReasonPattern: RegExp, message: string) => {
  const state = validateTask1AnalysisForRender({
    currentPrompt: tablePrompt,
    feedback,
    feedbackPromptId: tablePrompt.id,
    promptBank: writingTask1Academic,
  });
  assert.equal(state.kind, 'incomplete', message);
  assert.match(state.reasons.join('\n'), expectedReasonPattern, message);
};

assertRenderable(
  makeTableFeedback({
    overviewFeedback: 'The overview is clear: waiting times dropped in three districts, while the West rose.',
  }),
  'A valid table report must not be blocked because it uses normal trend language such as "dropped".',
);

assertBlocked(
  makeTableFeedback({
    overviewFeedback: 'Cars remained the most common mode, buses declined steadily, and cycling rose sharply.',
    keyFeaturesFeedback: 'Cycling almost quadrupled and bus commuting dropped across the period.',
    comparisonFeedback: 'The report should compare cars, buses and bicycles by 2020.',
  }),
  /off-task entities/i,
  'Line-graph transport contamination must fail closed on the clinic table prompt.',
);

assertBlocked(
  makeTableFeedback({
    estimatedBand: 0,
    overviewFeedback: 'Overview feedback was incomplete; please retry analysis.',
  }),
  /valid IELTS band estimate|incomplete diagnosis/i,
  'Malformed provider output must not render as learner-facing diagnosis.',
);

const mismatchFromLinePrompt = findLikelyTask1PromptMismatch(
  report,
  promptCandidate(linePrompt),
  writingTask1Academic.map(promptCandidate),
);
assert.equal(
  mismatchFromLinePrompt?.suggestedPrompt.id,
  tablePrompt.id,
  'When the selected prompt is the transport line graph, the clinic report should suggest the table prompt.',
);

const mismatchFromTablePrompt = findLikelyTask1PromptMismatch(
  report,
  promptCandidate(tablePrompt),
  writingTask1Academic.map(promptCandidate),
);
assert.equal(
  mismatchFromTablePrompt,
  null,
  'The clinic report should not be treated as a mismatch when the clinic table prompt is selected.',
);

assert.equal(
  routeTask1FeedbackLevel(6.5, {
    kind: 'analyzable',
    route: 'coverage_repair',
    wordCount: 170,
    reasons: [],
    nextSteps: [],
  }),
  'optional_upgrade',
  'A complete 6.5 Task 1 report should enter the optional-upgrade path, not coverage repair.',
);

const tableDisplayModel = buildTask1FeedbackDisplayModel({
  prompt: tablePrompt,
  feedback: makeTableFeedback(),
  route: 'optional_upgrade',
});
assert.equal(
  tableDisplayModel.verdictLabel,
  'Optional Upgrade',
  'A complete 6.5 Task 1 report should show an optional-upgrade verdict label.',
);
assert.match(
  tableDisplayModel.verdictText,
  /基本达标|不需要重写/,
  'The optional-upgrade verdict should read like learner-facing feedback, not an internal state.',
);
assert.doesNotMatch(
  tableDisplayModel.verdictText,
  /救火|coverage repair|repair/i,
  'The optional-upgrade verdict should not use rescue/repair language.',
);
assert.equal(
  tableDisplayModel.mustFixItems.length,
  0,
  'No required-fix module should be produced when provider mustFix is empty.',
);
assert.ok(
  tableDisplayModel.optionalUpgrades.length >= 2,
  'The display model should produce concise optional upgrades for a solid report.',
);
assert.ok(
  tableDisplayModel.reusablePatterns.length >= 3,
  'Reusable patterns should feel useful, not like an empty provider field.',
);

assert.deepEqual(
  validateTask1TargetReportForDisplay({
    currentPrompt: tablePrompt,
    feedback: makeTableFeedback({
      improvedReport: 'Overall, waiting times fell in most districts, with the South registering the most substantial reduction.',
    }),
  }).kind,
  'invalid',
  'An optimized report that misidentifies the largest decrease must be hidden.',
);

assert.deepEqual(
  validateTask1TargetReportForDisplay({
    currentPrompt: tablePrompt,
    feedback: makeTableFeedback({
      improvedReport: 'Overall, waiting times fell in most districts, with the North registering the largest reduction.',
    }),
  }),
  { kind: 'valid' },
  'An optimized report with the correct largest decrease should be displayable.',
);

const mockResult = await safeAnalyzeWritingTask1(new MockProvider(), 'mock', {
  task: 'task1',
  taskType: tablePrompt.taskType,
  instruction: tablePrompt.instruction,
  visualBrief: tablePrompt.visualBrief,
  dataSummary: tablePrompt.data.join('\n'),
  report,
  expectedOverview: tablePrompt.expectedOverview,
  expectedKeyFeatures: tablePrompt.expectedKeyFeatures,
  expectedComparisons: tablePrompt.expectedComparisons,
  commonTraps: tablePrompt.commonTraps,
  reusablePatterns: tablePrompt.reusablePatterns,
});

assertRenderable(
  mockResult.feedback,
  'The local mock/fallback Task 1 analysis must pass the same render gate as provider output.',
);
assert.equal(
  mockResult.diagnostic.failureKind,
  undefined,
  'The mock/fallback Task 1 analysis should not report a parse_or_schema failure.',
);

console.info('verify:writing-task1 passed');
