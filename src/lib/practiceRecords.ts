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

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
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
  readJson<PracticeRecord[]>(RECORDS_KEY, [])
    .sort((a, b) => (
      (b.analyzedAt || b.createdAt || b.updatedAt).localeCompare(a.analyzedAt || a.createdAt || a.updatedAt)
    ))
    .slice(0, limit);

export const upsertPracticeRecord = (record: PracticeRecord) => {
  const records = readJson<PracticeRecord[]>(RECORDS_KEY, []);
  const existing = records.find(item => item.id === record.id);
  const nextRecord = {
    ...existing,
    ...record,
    createdAt: record.createdAt || existing?.createdAt || nowIso(),
    updatedAt: record.updatedAt || nowIso(),
    analyzedAt: record.analyzedAt || existing?.analyzedAt,
    providerDiagnostic: record.providerDiagnostic || existing?.providerDiagnostic,
    obsidianMarkdown: record.obsidianMarkdown || existing?.obsidianMarkdown,
  } as PracticeRecord;
  const next = [nextRecord, ...records.filter(item => item.id !== record.id)]
    .sort((a, b) => (
      (b.analyzedAt || b.createdAt || b.updatedAt).localeCompare(a.analyzedAt || a.createdAt || a.updatedAt)
    ))
    .slice(0, 80);
  writeJson(RECORDS_KEY, next);
};

export const deletePracticeRecord = (
  recordId: string,
  module?: PracticeRecord['module'],
) => {
  const records = readJson<PracticeRecord[]>(RECORDS_KEY, []);
  const next = records.filter(record => (
    record.id !== recordId || (module ? record.module !== module : false)
  ));
  writeJson(RECORDS_KEY, next);
};

export const getActiveSpeakingSession = (): ActiveSpeakingPracticeSession | null =>
  readJson<ActiveSpeakingPracticeSession | null>(ACTIVE_SPEAKING_KEY, null);

export const saveActiveSpeakingSession = (session: ActiveSpeakingPracticeSession) => {
  writeJson(ACTIVE_SPEAKING_KEY, { ...session, updatedAt: nowIso() });
};

export const getActiveWritingTask2 = (): WritingTask2PracticeRecord | null =>
  readJson<WritingTask2PracticeRecord | null>(ACTIVE_WRITING_TASK2_KEY, null);

export const saveActiveWritingTask2 = (attempt: WritingTask2PracticeRecord) => {
  writeJson(ACTIVE_WRITING_TASK2_KEY, { ...attempt, updatedAt: nowIso() });
};
