import { SpeakingQuestion, WritingQuestion, WritingTask1AcademicPrompt } from '@/src/data/questions/bank';
import {
  ProviderDiagnostic,
  SpeakingFeedback,
  WritingFeedback,
  WritingFrameworkCoachFeedback,
  WritingFrameworkReadiness,
  WritingTask1Feedback,
} from '@/src/lib/ai/schemas';

export type PracticeRecordStatus = 'draft' | 'analyzed' | 'provider_failed';

export interface ProviderDiagnosticSummary {
  operation: ProviderDiagnostic['operation'];
  providerName: string;
  modelName?: string;
  fallbackUsed: boolean;
  failureKind?: ProviderDiagnostic['failureKind'];
  parseError?: string;
  validationErrors: string[];
  normalizedFields?: string[];
  timestamp: string;
}

interface PracticeRecordBase {
  id: string;
  module: 'speaking' | 'writing' | 'writing_task1';
  mode: 'practice';
  status: PracticeRecordStatus;
  question: string;
  questionId?: string;
  topic?: string;
  tags?: string[];
  taskType?: string;
  createdAt: string;
  updatedAt: string;
  analyzedAt?: string;
  providerDiagnostic?: ProviderDiagnosticSummary;
  obsidianMarkdown?: string;
}

export interface SpeakingPracticeRecord extends PracticeRecordBase {
  module: 'speaking';
  part: 1 | 2 | 3;
  questionData?: SpeakingQuestion;
  transcript: string;
  transcriptOrigin: 'speech' | 'manual';
  feedback?: SpeakingFeedback;
}

export interface WritingTask2PracticeRecord extends PracticeRecordBase {
  module: 'writing';
  task: 'task2';
  questionData?: WritingQuestion;
  phase: 'framework' | 'writing' | 'results';
  frameworkChat: { role: 'user' | 'ai'; text: string }[];
  frameworkInput: string;
  finalFrameworkSummary: string;
  frameworkSummaryGenerated?: boolean;
  frameworkReadiness?: WritingFrameworkReadiness;
  latestFrameworkCoach?: WritingFrameworkCoachFeedback;
  essay: string;
  feedback?: WritingFeedback;
  feedbackFallbackUsed?: boolean;
}

export interface WritingTask1QuickPlan {
  overview: string;
  keyFeatures: string;
  comparisons: string;
  paragraphPlan: string;
}

export interface WritingTask1PracticeRecord extends PracticeRecordBase {
  module: 'writing_task1';
  task: 'task1';
  questionData?: WritingTask1AcademicPrompt;
  taskType: string;
  topic: string;
  tags: string[];
  prompt: string;
  instruction: string;
  visualBrief: string;
  dataSummary: string[];
  quickPlan: WritingTask1QuickPlan;
  report: string;
  feedback?: WritingTask1Feedback;
}

export type PracticeRecord = SpeakingPracticeRecord | WritingTask2PracticeRecord | WritingTask1PracticeRecord;

export interface ActiveSpeakingPracticeSession {
  id: string;
  currentPart: 1 | 2 | 3;
  attemptsByPart: Partial<Record<1 | 2 | 3, SpeakingPracticeRecord>>;
  updatedAt: string;
}

const RECORDS_KEY = 'ielts_practice_records_v1';
const ACTIVE_SPEAKING_KEY = 'ielts_active_speaking_practice_v1';
const ACTIVE_WRITING_TASK2_KEY = 'ielts_active_writing_task2_practice_v1';
const ACTIVE_WRITING_TASK1_KEY = 'ielts_active_writing_task1_practice_v1';
export const IELTS_LOCAL_STORAGE_KEYS = [
  RECORDS_KEY,
  ACTIVE_SPEAKING_KEY,
  ACTIVE_WRITING_TASK2_KEY,
  ACTIVE_WRITING_TASK1_KEY,
  'ielts_profile',
  'ielts_sessions',
  'ielts_api_usage_v1',
  'ielts_provider_router_state_v1',
];

const nowIso = () => new Date().toISOString();
const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

const asOptionalString = (value: unknown) =>
  typeof value === 'string' ? value : undefined;

const asStatus = (value: unknown): PracticeRecordStatus =>
  value === 'analyzed' || value === 'provider_failed' || value === 'draft' ? value : 'draft';

const asSpeakingPart = (value: unknown): 1 | 2 | 3 =>
  value === 2 || value === 3 ? value : 1;

const asPhase = (value: unknown): WritingTask2PracticeRecord['phase'] =>
  value === 'writing' || value === 'results' || value === 'framework' ? value : 'framework';

const asFrameworkReadiness = (value: unknown): WritingFrameworkReadiness | undefined =>
  value === 'almost_ready' || value === 'ready_to_write' || value === 'not_ready' ? value : undefined;

const asFrameworkChat = (value: unknown): WritingTask2PracticeRecord['frameworkChat'] =>
  Array.isArray(value)
    ? value.filter(isObject).map((item): WritingTask2PracticeRecord['frameworkChat'][number] => ({
      role: item.role === 'user' ? 'user' : 'ai',
      text: asString(item.text),
    })).filter(item => item.text.trim())
    : [];

const asStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;

const asRequiredStringArray = (value: unknown) => asStringArray(value) || [];

const asModelAnswerAnnotationType = (
  value: unknown,
): NonNullable<WritingFeedback['modelAnswerAnnotations']>[number]['type'] =>
  value === 'expression_upgrade' ||
  value === 'sentence_repair' ||
  value === 'logic_repair' ||
  value === 'topic_vocabulary'
    ? value
    : 'topic_vocabulary';

const phraseLevel = (text: string, maxWords = 14) => {
  const cleaned = text.replace(/[.!?;:]+$/g, '').replace(/\s+/g, ' ').trim();
  const words = cleaned.split(' ').filter(Boolean);
  return words.length <= maxWords ? cleaned : words.slice(0, maxWords).join(' ');
};

const sanitizeTask2TopicVocabulary = (value: unknown): WritingFeedback['vocabularyUpgrade']['topicVocabulary'] =>
  Array.isArray(value)
    ? value.map((item): WritingFeedback['vocabularyUpgrade']['topicVocabulary'][number] | null => {
      if (typeof item === 'string') {
        const expression = phraseLevel(item, 8);
        return expression ? { expression, meaningZh: '', usageZh: '' } : null;
      }
      if (!isObject(item)) return null;
      const expression = phraseLevel(asString(item.expression ?? item.term ?? item.phrase), 8);
      if (!expression) return null;
      return {
        expression,
        meaningZh: asString(item.meaningZh ?? item.meaning),
        usageZh: asString(item.usageZh ?? item.usage ?? item.explanationZh),
        example: asOptionalString(item.example),
      };
    }).filter((item): item is WritingFeedback['vocabularyUpgrade']['topicVocabulary'][number] => Boolean(item))
    : [];

const sanitizeTask2ExpressionUpgrade = (
  item: unknown,
  categoryFallback?: 'from_essay' | 'argument_frame',
): WritingFeedback['vocabularyUpgrade']['expressionUpgrades'][number] | null => {
  if (typeof item === 'string') {
    const better = phraseLevel(item);
    return better ? { category: categoryFallback || 'argument_frame', better, explanationZh: '', reuseWhenZh: '' } : null;
  }
  if (!isObject(item)) return null;
  const original = phraseLevel(asString(item.original), 7);
  const better = phraseLevel(asString(item.better ?? item.frame ?? item.expression));
  if (!better) return null;
  return {
    category: item.category === 'from_essay' || item.type === 'from_essay' || original
      ? 'from_essay'
      : categoryFallback || 'argument_frame',
    original: original || undefined,
    better,
    explanationZh: asString(item.explanationZh),
    reuseWhenZh: asString(item.reuseWhenZh),
    example: asOptionalString(item.example),
  };
};

const sanitizeWritingTask2Feedback = (value: unknown): WritingFeedback | undefined => {
  if (!isObject(value)) return undefined;
  const scores = isObject(value.scores) ? value.scores : {};
  const vocabularySource = isObject(value.vocabularyUpgrade) ? value.vocabularyUpgrade : {};
  const expressionUpgrades = [
    ...(Array.isArray(vocabularySource.expressionUpgrades) ? vocabularySource.expressionUpgrades : [])
      .map(item => sanitizeTask2ExpressionUpgrade(item)),
    ...(Array.isArray(vocabularySource.userWordingUpgrades) ? vocabularySource.userWordingUpgrades : [])
      .map(item => sanitizeTask2ExpressionUpgrade(item, 'from_essay')),
    ...(Array.isArray(vocabularySource.collocationUpgrades) ? vocabularySource.collocationUpgrades : [])
      .map(item => sanitizeTask2ExpressionUpgrade(item, 'argument_frame')),
    ...(Array.isArray(vocabularySource.reusableSentenceFrames) ? vocabularySource.reusableSentenceFrames : [])
      .map(item => sanitizeTask2ExpressionUpgrade(item, 'argument_frame')),
  ]
    .filter((item): item is WritingFeedback['vocabularyUpgrade']['expressionUpgrades'][number] => Boolean(item))
    .filter((item, index, items) => items.findIndex(candidate => candidate.better.toLowerCase() === item.better.toLowerCase()) === index);

  return {
    ...(value as Partial<WritingFeedback>),
    mode: 'practice',
    module: 'writing',
    task: 'task2',
    question: asString(value.question),
    essay: asString(value.essay),
    scores: {
      taskResponse: typeof scores.taskResponse === 'number' ? scores.taskResponse : 0,
      coherenceCohesion: typeof scores.coherenceCohesion === 'number' ? scores.coherenceCohesion : 0,
      lexicalResource: typeof scores.lexicalResource === 'number' ? scores.lexicalResource : 0,
      grammaticalRangeAccuracy: typeof scores.grammaticalRangeAccuracy === 'number' ? scores.grammaticalRangeAccuracy : 0,
    },
    frameworkFeedback: Array.isArray(value.frameworkFeedback) ? value.frameworkFeedback as WritingFeedback['frameworkFeedback'] : [],
    essayLevelWarnings: Array.isArray(value.essayLevelWarnings) ? value.essayLevelWarnings as WritingFeedback['essayLevelWarnings'] : [],
    sentenceFeedback: Array.isArray(value.sentenceFeedback)
      ? value.sentenceFeedback.filter(isObject).map((item, index): WritingFeedback['sentenceFeedback'][number] => ({
        ...(item as Partial<WritingFeedback['sentenceFeedback'][number]>),
        id: asString(item.id, `C${index + 1}`),
        correctionNumber: typeof item.correctionNumber === 'number' ? item.correctionNumber : index + 1,
        paragraph: asOptionalString(item.paragraph),
        sourceQuote: asString(item.sourceQuote, asString(item.original)) || undefined,
        issueType: asOptionalString(item.issueType),
        severity: item.severity === 'major' || item.severity === 'medium' || item.severity === 'minor' || item.severity === 'polish'
          ? item.severity
          : item.severity === 'fatal'
            ? 'major'
            : item.severity === 'naturalness' || item.severity === 'preserved'
              ? 'polish'
              : undefined,
        original: asString(item.original),
        correction: asString(item.correction),
        dimension: item.dimension === 'TR' || item.dimension === 'CC' || item.dimension === 'LR' || item.dimension === 'GRA' ? item.dimension : 'GRA',
        tag: asString(item.tag, 'provider_safety'),
        explanationZh: asString(item.explanationZh),
        microUpgrades: Array.isArray(item.microUpgrades) ? item.microUpgrades as WritingFeedback['sentenceFeedback'][number]['microUpgrades'] : [],
      }))
      : [],
    vocabularyUpgrade: {
      topicVocabulary: sanitizeTask2TopicVocabulary(vocabularySource.topicVocabulary),
      expressionUpgrades,
    },
    modelAnswer: asString(value.modelAnswer),
    modelAnswerAnnotations: Array.isArray(value.modelAnswerAnnotations)
      ? value.modelAnswerAnnotations.filter(isObject).map(item => ({
        quote: asString(item.quote),
        type: asModelAnswerAnnotationType(item.type),
        labelZh: asString(item.labelZh),
      })).filter(item => item.quote)
      : [],
    modelAnswerPersonalized: Boolean(value.modelAnswerPersonalized),
    modelAnswerTargetLevel: asOptionalString(value.modelAnswerTargetLevel),
    reusableArguments: Array.isArray(value.reusableArguments) ? value.reusableArguments as WritingFeedback['reusableArguments'] : [],
    obsidianMarkdown: asString(value.obsidianMarkdown),
  };
};

const asTask1QuickPlan = (value: unknown): WritingTask1QuickPlan => {
  const source = isObject(value) ? value : {};
  return {
    overview: asString(source.overview),
    keyFeatures: asString(source.keyFeatures),
    comparisons: asString(source.comparisons),
    paragraphPlan: asString(source.paragraphPlan),
  };
};

const sanitizeSpeakingFeedback = (value: unknown): SpeakingFeedback | undefined => {
  if (!isObject(value)) return undefined;
  const scores = isObject(value.scores) ? value.scores : {};
  const reusableExample = isObject(value.reusableExample)
    ? {
      example: asString(value.reusableExample.example),
      canBeReusedFor: Array.isArray(value.reusableExample.canBeReusedFor)
        ? value.reusableExample.canBeReusedFor.filter((item): item is string => typeof item === 'string')
        : [],
      explanationZh: asString(value.reusableExample.explanationZh),
    }
    : null;

  return {
    ...(value as Partial<SpeakingFeedback>),
    mode: 'practice',
    module: 'speaking',
    part: asSpeakingPart(value.part),
    question: asString(value.question),
    transcript: asString(value.transcript),
    bandEstimateExcludingPronunciation: typeof value.bandEstimateExcludingPronunciation === 'number'
      ? value.bandEstimateExcludingPronunciation
      : 0,
    scores: {
      fluencyCoherence: typeof scores.fluencyCoherence === 'number' ? scores.fluencyCoherence : 0,
      lexicalResource: typeof scores.lexicalResource === 'number' ? scores.lexicalResource : 0,
      grammaticalRangeAccuracy: typeof scores.grammaticalRangeAccuracy === 'number' ? scores.grammaticalRangeAccuracy : 0,
      pronunciation: null,
      pronunciationNote: asString(scores.pronunciationNote, 'Pronunciation is not formally assessed in V1.'),
    },
    fatalErrors: Array.isArray(value.fatalErrors) ? value.fatalErrors as SpeakingFeedback['fatalErrors'] : [],
    naturalnessHints: Array.isArray(value.naturalnessHints) ? value.naturalnessHints as SpeakingFeedback['naturalnessHints'] : [],
    band9Refinements: Array.isArray(value.band9Refinements) ? value.band9Refinements as SpeakingFeedback['band9Refinements'] : [],
    preservedStyle: Array.isArray(value.preservedStyle) ? value.preservedStyle as SpeakingFeedback['preservedStyle'] : [],
    upgradedAnswer: asString(value.upgradedAnswer),
    reusableExample,
    obsidianMarkdown: asString(value.obsidianMarkdown),
  };
};

const sanitizeSpeakingRecord = (value: unknown): SpeakingPracticeRecord | null => {
  if (!isObject(value) || value.module !== 'speaking') return null;
  const id = asString(value.id);
  const question = asString(value.question);
  if (!id || !question) return null;
  const timestamp = asString(value.updatedAt, asString(value.createdAt, nowIso()));

  return {
    ...(value as Partial<SpeakingPracticeRecord>),
    id,
    module: 'speaking',
    mode: 'practice',
    status: asStatus(value.status),
    part: asSpeakingPart(value.part),
    question,
    questionId: asOptionalString(value.questionId),
    topic: asOptionalString(value.topic),
    tags: asStringArray(value.tags),
    createdAt: asString(value.createdAt, timestamp),
    updatedAt: timestamp,
    analyzedAt: asOptionalString(value.analyzedAt),
    transcript: asString(value.transcript),
    transcriptOrigin: value.transcriptOrigin === 'speech' ? 'speech' : 'manual',
    feedback: sanitizeSpeakingFeedback(value.feedback),
    obsidianMarkdown: asOptionalString(value.obsidianMarkdown),
  };
};

const sanitizeWritingTask2Record = (value: unknown): WritingTask2PracticeRecord | null => {
  if (!isObject(value) || value.module !== 'writing') return null;
  const id = asString(value.id);
  const question = asString(value.question);
  if (!id || !question) return null;
  const timestamp = asString(value.updatedAt, asString(value.createdAt, nowIso()));

  return {
    ...(value as Partial<WritingTask2PracticeRecord>),
    id,
    module: 'writing',
    mode: 'practice',
    status: asStatus(value.status),
    task: 'task2',
    question,
    questionId: asOptionalString(value.questionId),
    topic: asOptionalString(value.topic),
    tags: asStringArray(value.tags),
    taskType: asOptionalString(value.taskType),
    createdAt: asString(value.createdAt, timestamp),
    updatedAt: timestamp,
    analyzedAt: asOptionalString(value.analyzedAt),
    phase: asPhase(value.phase),
    frameworkChat: asFrameworkChat(value.frameworkChat),
    frameworkInput: asString(value.frameworkInput),
    finalFrameworkSummary: asString(value.finalFrameworkSummary),
    frameworkSummaryGenerated: Boolean(value.frameworkSummaryGenerated),
    frameworkReadiness: asFrameworkReadiness(value.frameworkReadiness),
    latestFrameworkCoach: isObject(value.latestFrameworkCoach)
      ? value.latestFrameworkCoach as unknown as WritingFrameworkCoachFeedback
      : undefined,
    essay: asString(value.essay),
    feedback: sanitizeWritingTask2Feedback(value.feedback),
    feedbackFallbackUsed: Boolean(value.feedbackFallbackUsed),
  };
};

const sanitizeWritingTask1Feedback = (value: unknown): WritingTask1Feedback | undefined => {
  if (!isObject(value)) return undefined;
  const taskAchievement = isObject(value.taskAchievement) ? value.taskAchievement : {};
  return {
    ...(value as Partial<WritingTask1Feedback>),
    mode: 'practice',
    module: 'writing_task1',
    task: 'task1',
    taskType: asString(value.taskType),
    instruction: asString(value.instruction),
    visualBrief: asString(value.visualBrief),
    report: asString(value.report),
    estimatedBand: typeof value.estimatedBand === 'number' ? value.estimatedBand : 0,
    taskAchievement: {
      score: typeof taskAchievement.score === 'number' ? taskAchievement.score : 0,
      feedback: asString(taskAchievement.feedback),
    },
    overviewFeedback: asString(value.overviewFeedback),
    keyFeaturesFeedback: asString(value.keyFeaturesFeedback),
    comparisonFeedback: asString(value.comparisonFeedback),
    dataAccuracyFeedback: asString(value.dataAccuracyFeedback),
    coherenceFeedback: asString(value.coherenceFeedback),
    languageCorrections: Array.isArray(value.languageCorrections)
      ? value.languageCorrections as WritingTask1Feedback['languageCorrections']
      : [],
    mustFix: asRequiredStringArray(value.mustFix),
    rewriteTask: asString(value.rewriteTask),
    reusableReportPatterns: asRequiredStringArray(value.reusableReportPatterns),
    improvedReport: asString(value.improvedReport),
    modelExcerpt: asOptionalString(value.modelExcerpt),
    obsidianMarkdown: asString(value.obsidianMarkdown),
  };
};

const sanitizeWritingTask1Record = (value: unknown): WritingTask1PracticeRecord | null => {
  if (!isObject(value) || value.module !== 'writing_task1') return null;
  const id = asString(value.id);
  const instruction = asString(value.instruction, asString(value.question));
  if (!id || !instruction) return null;
  const timestamp = asString(value.updatedAt, asString(value.createdAt, nowIso()));

  return {
    ...(value as Partial<WritingTask1PracticeRecord>),
    id,
    module: 'writing_task1',
    mode: 'practice',
    status: asStatus(value.status),
    task: 'task1',
    question: asString(value.question, instruction),
    questionId: asOptionalString(value.questionId),
    topic: asString(value.topic, 'Academic Task 1'),
    tags: asRequiredStringArray(value.tags),
    taskType: asString(value.taskType, 'Academic Task 1'),
    createdAt: asString(value.createdAt, timestamp),
    updatedAt: timestamp,
    analyzedAt: asOptionalString(value.analyzedAt),
    instruction,
    prompt: asString(value.prompt, instruction),
    visualBrief: asString(value.visualBrief),
    dataSummary: asRequiredStringArray(value.dataSummary),
    quickPlan: asTask1QuickPlan(value.quickPlan),
    report: asString(value.report),
    feedback: sanitizeWritingTask1Feedback(value.feedback),
    obsidianMarkdown: asOptionalString(value.obsidianMarkdown),
  };
};

const sanitizePracticeRecord = (value: unknown): PracticeRecord | null =>
  isObject(value) && value.module === 'speaking'
    ? sanitizeSpeakingRecord(value)
    : isObject(value) && value.module === 'writing_task1'
      ? sanitizeWritingTask1Record(value)
      : sanitizeWritingTask2Record(value);

const sortTimestamp = (record: PracticeRecord) =>
  record.analyzedAt || record.createdAt || record.updatedAt || '';

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};

const readJsonArray = (key: string): unknown[] => {
  const value = readJson<unknown>(key, []);
  return Array.isArray(value) ? value : [];
};

const writeJson = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const removeJson = (key: string) => {
  localStorage.removeItem(key);
};

export const createRecordId = (prefix: string) => `${prefix}_${Date.now()}`;

export const summarizeDiagnostic = (diagnostic: ProviderDiagnostic): ProviderDiagnosticSummary => ({
  operation: diagnostic.operation,
  providerName: diagnostic.providerName,
  modelName: diagnostic.modelName,
  fallbackUsed: diagnostic.fallbackUsed,
  failureKind: diagnostic.failureKind,
  parseError: diagnostic.parseError,
  validationErrors: diagnostic.validationErrors,
  normalizedFields: diagnostic.normalizedFields,
  timestamp: diagnostic.timestamp,
});

export const getPracticeRecords = (limit = 12): PracticeRecord[] =>
  readJsonArray(RECORDS_KEY)
    .map(sanitizePracticeRecord)
    .filter((record): record is PracticeRecord => Boolean(record))
    .filter(record => record.status !== 'draft')
    .sort((a, b) => sortTimestamp(b).localeCompare(sortTimestamp(a)))
    .slice(0, limit);

export const upsertPracticeRecord = (record: PracticeRecord) => {
  if (record.status === 'draft') return;
  const rawRecords = readJsonArray(RECORDS_KEY);
  const validRecords = rawRecords
    .map(sanitizePracticeRecord)
    .filter((item): item is PracticeRecord => Boolean(item));
  const preservedUnknownRecords = rawRecords.filter(item => !sanitizePracticeRecord(item));
  const existing = validRecords.find(item => item.id === record.id);
  const nextRecord = {
    ...existing,
    ...record,
    createdAt: record.createdAt || existing?.createdAt || nowIso(),
    updatedAt: record.updatedAt || existing?.updatedAt || nowIso(),
    analyzedAt: record.analyzedAt || existing?.analyzedAt,
    providerDiagnostic: record.providerDiagnostic || existing?.providerDiagnostic,
    obsidianMarkdown: record.obsidianMarkdown || existing?.obsidianMarkdown,
  } as PracticeRecord;
  const next = [
    ...[nextRecord, ...validRecords.filter(item => item.id !== record.id)]
      .sort((a, b) => sortTimestamp(b).localeCompare(sortTimestamp(a))),
    ...preservedUnknownRecords,
  ];
  writeJson(RECORDS_KEY, next);
};

export const deletePracticeRecord = (
  recordId: string,
  module?: PracticeRecord['module'],
) => {
  const records = readJsonArray(RECORDS_KEY);
  const next = records.filter(record => (
    !isObject(record) || record.id !== recordId || (module ? record.module !== module : false)
  ));
  writeJson(RECORDS_KEY, next);
};

export const getActiveSpeakingSession = (): ActiveSpeakingPracticeSession | null =>
  (() => {
    const active = readJson<unknown>(ACTIVE_SPEAKING_KEY, null);
    if (!isObject(active) || !isObject(active.attemptsByPart)) return null;

    const attemptsByPart: ActiveSpeakingPracticeSession['attemptsByPart'] = {};
    ([1, 2, 3] as const).forEach(part => {
      const record = sanitizeSpeakingRecord(active.attemptsByPart?.[part]);
      if (record) attemptsByPart[part] = record;
    });

    return {
      id: asString(active.id, createRecordId('speaking_session')),
      currentPart: asSpeakingPart(active.currentPart),
      attemptsByPart,
      updatedAt: asString(active.updatedAt, nowIso()),
    };
  })();

export const saveActiveSpeakingSession = (session: ActiveSpeakingPracticeSession) => {
  writeJson(ACTIVE_SPEAKING_KEY, { ...session, updatedAt: nowIso() });
};

export const getActiveWritingTask2 = (): WritingTask2PracticeRecord | null =>
  sanitizeWritingTask2Record(readJson<unknown>(ACTIVE_WRITING_TASK2_KEY, null));

export const saveActiveWritingTask2 = (attempt: WritingTask2PracticeRecord) => {
  writeJson(ACTIVE_WRITING_TASK2_KEY, attempt);
};

export const deleteActiveWritingTask2 = (recordId: string) => {
  const active = getActiveWritingTask2();
  if (active?.id === recordId) {
    removeJson(ACTIVE_WRITING_TASK2_KEY);
  }
};

export const getActiveWritingTask1 = (): WritingTask1PracticeRecord | null =>
  sanitizeWritingTask1Record(readJson<unknown>(ACTIVE_WRITING_TASK1_KEY, null));

export const saveActiveWritingTask1 = (attempt: WritingTask1PracticeRecord) => {
  writeJson(ACTIVE_WRITING_TASK1_KEY, attempt);
};

export const deleteActiveWritingTask1 = (recordId: string) => {
  const active = getActiveWritingTask1();
  if (active?.id === recordId) {
    removeJson(ACTIVE_WRITING_TASK1_KEY);
  }
};

export const clearAllIeltsLocalData = () => {
  IELTS_LOCAL_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
};
