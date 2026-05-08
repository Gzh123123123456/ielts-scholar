import { SpeakingQuestion, WritingQuestion } from '@/src/data/questions/bank';
import { ProviderDiagnostic, SpeakingFeedback, WritingFeedback } from '@/src/lib/ai/schemas';

export type PracticeRecordStatus = 'draft' | 'analyzed' | 'provider_failed';

export interface ProviderDiagnosticSummary {
  operation: ProviderDiagnostic['operation'];
  providerName: string;
  fallbackUsed: boolean;
  failureKind?: ProviderDiagnostic['failureKind'];
  parseError?: string;
  validationErrors: string[];
  normalizedFields?: string[];
  timestamp: string;
}

interface PracticeRecordBase {
  id: string;
  module: 'speaking' | 'writing';
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
  essay: string;
  feedback?: WritingFeedback;
  feedbackFallbackUsed?: boolean;
}

export type PracticeRecord = SpeakingPracticeRecord | WritingTask2PracticeRecord;

export interface ActiveSpeakingPracticeSession {
  id: string;
  currentPart: 1 | 2 | 3;
  attemptsByPart: Partial<Record<1 | 2 | 3, SpeakingPracticeRecord>>;
  updatedAt: string;
}

const RECORDS_KEY = 'ielts_practice_records_v1';
const ACTIVE_SPEAKING_KEY = 'ielts_active_speaking_practice_v1';
const ACTIVE_WRITING_TASK2_KEY = 'ielts_active_writing_task2_practice_v1';

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

const asFrameworkChat = (value: unknown): WritingTask2PracticeRecord['frameworkChat'] =>
  Array.isArray(value)
    ? value.filter(isObject).map((item): WritingTask2PracticeRecord['frameworkChat'][number] => ({
      role: item.role === 'user' ? 'user' : 'ai',
      text: asString(item.text),
    })).filter(item => item.text.trim())
    : [];

const asStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;

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
    essay: asString(value.essay),
    feedbackFallbackUsed: Boolean(value.feedbackFallbackUsed),
  };
};

const sanitizePracticeRecord = (value: unknown): PracticeRecord | null =>
  isObject(value) && value.module === 'speaking'
    ? sanitizeSpeakingRecord(value)
    : sanitizeWritingTask2Record(value);

const sortTimestamp = (record: PracticeRecord) =>
  record.analyzedAt || record.updatedAt || record.createdAt || '';

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
    .sort((a, b) => sortTimestamp(b).localeCompare(sortTimestamp(a)))
    .slice(0, limit);

export const upsertPracticeRecord = (record: PracticeRecord) => {
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
    updatedAt: record.updatedAt || nowIso(),
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
  writeJson(ACTIVE_WRITING_TASK2_KEY, { ...attempt, updatedAt: nowIso() });
};

export const deleteActiveWritingTask2 = (recordId: string) => {
  const active = getActiveWritingTask2();
  if (active?.id === recordId) {
    removeJson(ACTIVE_WRITING_TASK2_KEY);
  }
};
