import assert from 'node:assert/strict';
import {
  buildSpeakingEvidenceLedger,
  buildWritingTask1EvidenceLedger,
  buildWritingTask2EvidenceLedger,
  evidenceLedgerItemsToPart1Annotations,
  findEvidenceQuoteSpan,
  summarizeEvidenceLedger,
} from '../src/lib/evidenceLedger.ts';
import type {
  SpeakingFeedback,
  WritingFeedback,
  WritingTask1Feedback,
} from '../src/lib/ai/schemas.ts';

const baseSpeakingFeedback = (overrides: Partial<SpeakingFeedback>): SpeakingFeedback => ({
  mode: 'practice',
  module: 'speaking',
  part: 1,
  question: 'What is your favorite time of the day?',
  transcript: '',
  bandEstimateExcludingPronunciation: 6,
  scores: {
    fluencyCoherence: 6,
    lexicalResource: 6,
    grammaticalRangeAccuracy: 6,
    pronunciation: null,
    pronunciationNote: 'Not assessed.',
  },
  fatalErrors: [],
  naturalnessHints: [],
  band9Refinements: [],
  preservedStyle: [],
  upgradedAnswer: '',
  reusableExample: null,
  obsidianMarkdown: '',
  ...overrides,
});

const baseWritingTask2Feedback = (overrides: Partial<WritingFeedback>): WritingFeedback => ({
  mode: 'practice',
  module: 'writing',
  task: 'task2',
  question: 'Some people think cities should invest more in public transport. Discuss.',
  essay: '',
  scores: {
    taskResponse: 6,
    coherenceCohesion: 6,
    lexicalResource: 6,
    grammaticalRangeAccuracy: 6,
  },
  frameworkFeedback: [],
  essayLevelWarnings: [],
  sentenceFeedback: [],
  vocabularyUpgrade: {
    topicVocabulary: [],
    expressionUpgrades: [],
  },
  modelAnswer: '',
  reusableArguments: [],
  obsidianMarkdown: '',
  ...overrides,
});

const baseWritingTask1Feedback = (overrides: Partial<WritingTask1Feedback>): WritingTask1Feedback => ({
  mode: 'practice',
  module: 'writing_task1',
  task: 'task1',
  taskType: 'line graph',
  instruction: 'Summarise the information by selecting and reporting the main features.',
  visualBrief: 'A line graph.',
  report: '',
  estimatedBand: 6,
  taskAchievement: {
    score: 6,
    feedback: 'Needs a clearer overview.',
  },
  overviewFeedback: '',
  keyFeaturesFeedback: '',
  comparisonFeedback: '',
  dataAccuracyFeedback: '',
  coherenceFeedback: '',
  languageCorrections: [],
  mustFix: [],
  rewriteTask: '',
  reusableReportPatterns: [],
  improvedReport: '',
  obsidianMarkdown: '',
  ...overrides,
});

const speakingSingle = baseSpeakingFeedback({
  transcript: 'I prefer morning. because I usually get up early. I could have a delicious breakfast and start jogging.',
  fatalErrors: [
    {
      original: 'I prefer morning',
      correction: 'I prefer the morning',
      tag: 'article_naturalness',
      explanationZh: '开头表达需要冠词，更自然。',
    },
    {
      original: 'I could have a delicious breakfast',
      correction: 'I can have a nice breakfast',
      tag: 'modal_tense',
      explanationZh: '日常习惯不用 could。',
    },
  ],
  naturalnessHints: [
    {
      original: 'start jogging',
      better: 'go for a jog',
      tag: 'spoken_collocation',
      explanationZh: '更地道的口语搭配。',
    },
  ],
});
const speakingSingleLedger = buildSpeakingEvidenceLedger(speakingSingle);
assert.equal(summarizeEvidenceLedger(speakingSingleLedger).anchored, 3, 'single speaking repairs should anchor');
assert.equal(evidenceLedgerItemsToPart1Annotations(speakingSingleLedger).length, 3, 'anchored speaking evidence should convert to annotations');

const speakingThread = baseSpeakingFeedback({
  part: 1,
  sessionKind: 'part1_topic_thread',
  threadAnswers: [
    { questionId: 'q1', question: 'Do you like sports?', answer: 'I usually play basketball with my classmates.' },
    { questionId: 'q2', question: 'Who is your favorite player?', answer: 'My favorite player is LeBron James.' },
  ],
  threadFeedback: {
    topic: 'Sports',
    threadId: 'thread-1',
    questionCount: 2,
    mustFix: [],
    annotations: [
      {
        id: 'a1',
        questionRef: 'Q1',
        sourceQuote: 'play basketball with my classmates',
        combinedRepair: 'play basketball with my classmates after school',
        layers: [{
          severity: 'better_spoken_choice',
          issueType: 'detail',
          original: 'play basketball with my classmates',
          better: 'play basketball with my classmates after school',
          explanationZh: '增加一点具体语境。',
        }],
      },
    ],
    cleanRetryAnswers: [],
    answerByAnswerCoaching: [],
    highImpactPhraseFixes: [],
    materialBank: { myUsableMaterial: [], reusableSpokenLanguage: [] },
    optionalPolish: [],
    nextRetryFocusZh: '',
  },
});
const speakingThreadLedger = buildSpeakingEvidenceLedger(speakingThread);
assert.equal(speakingThreadLedger[0].sourceRef, 'Q1');
assert.equal(speakingThreadLedger[0].anchor.status, 'anchored');

const speakingPart2 = baseSpeakingFeedback({
  part: 2,
  question: 'Describe a famous person you admire.',
  transcript: 'I want to talk about LeBron James because he is very famous and he works hard.',
  part2Feedback: {
    materialType: 'person',
    annotations: [
      {
        id: 'p2-a1',
        questionRef: 'PART 2',
        sourceQuote: 'he is very famous',
        combinedRepair: 'he is one of the most influential basketball players in the world',
        layers: [{
          severity: 'better_spoken_choice',
          issueType: 'specificity',
          original: 'he is very famous',
          better: 'he is one of the most influential basketball players in the world',
          explanationZh: 'Part 2 人物素材需要更具体。',
        }],
      },
    ],
    storyModules: [],
    languageSignals: [],
    priorityFocusZh: '',
    nextSpeakableVersion: '',
    nextSpeakableVersionHighlights: [],
  },
});
assert.equal(buildSpeakingEvidenceLedger(speakingPart2)[0].anchor.status, 'anchored');

const speakingPart3 = baseSpeakingFeedback({
  part: 3,
  sessionKind: 'part3_discussion_thread',
  transcript: 'Q1: I think athletes influence young people. Q2: It depend on their behavior.',
  threadAnswers: [
    { questionId: 'p3-q1', question: 'Do athletes influence young people?', answer: 'I think athletes influence young people.' },
    { questionId: 'p3-q2', question: 'Does it always have a positive effect?', answer: 'It depend on their behavior.' },
  ],
  fatalErrors: [{
    original: 'It depend on their behavior',
    correction: 'It depends on their behavior',
    tag: 'third_person_singular',
    explanationZh: '第三人称单数需要 depends。',
  }],
});
const part3Ledger = buildSpeakingEvidenceLedger(speakingPart3);
assert.equal(part3Ledger[0].sourceRef, 'Q2', 'part3 generic repair should attach to the answer where it appears');
assert.equal(part3Ledger[0].anchor.status, 'anchored');

const writingTask2 = baseWritingTask2Feedback({
  essay: 'Many people thinks public transport is useful. It can reduce traffic.',
  sentenceFeedback: [
    {
      id: 'C1',
      correctionNumber: 1,
      paragraph: 'Introduction',
      sourceQuote: 'people thinks',
      issueType: 'subject_verb_agreement',
      severity: 'major',
      primaryIssue: 'Subject-verb agreement',
      secondaryIssues: [],
      microUpgrades: [],
      original: 'Many people thinks public transport is useful.',
      correction: 'Many people think public transport is useful.',
      dimension: 'GRA',
      tag: 'grammar',
      explanationZh: 'people 是复数，动词用 think。',
    },
  ],
  vocabularyUpgrade: {
    topicVocabulary: [],
    expressionUpgrades: [{
      category: 'from_essay',
      original: 'useful',
      better: 'beneficial',
      explanationZh: '更正式。',
      reuseWhenZh: '讨论好处时。',
    }],
  },
});
const writingTask2Ledger = buildWritingTask2EvidenceLedger(writingTask2);
assert.equal(summarizeEvidenceLedger(writingTask2Ledger).anchored, 2, 'task2 sentence and expression evidence should anchor');

const writingTask1 = baseWritingTask1Feedback({
  report: 'Overall, the figure increase significantly from 2000 to 2020.',
  languageCorrections: [{
    original: 'the figure increase',
    correction: 'the figure increased',
    explanation: '过去时间范围需要过去式。',
  }],
});
assert.equal(buildWritingTask1EvidenceLedger(writingTask1)[0].anchor.status, 'anchored');

assert.equal(
  findEvidenceQuoteSpan('This answer repeats because because twice.', 'because').status,
  'unanchored',
  'ambiguous repeated short evidence should not be treated as stable',
);
assert.equal(
  findEvidenceQuoteSpan('The real text is here.', 'missing evidence').reason,
  'not_found',
  'missing evidence should stay visible to verification as not_found',
);

console.log('Evidence ledger verification passed.');
