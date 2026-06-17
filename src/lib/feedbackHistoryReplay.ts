import type {
  PracticeRecord,
  SpeakingPracticeRecord,
  WritingTask1PracticeRecord,
  WritingTask2PracticeRecord,
} from './practiceRecords';
import { sanitizePracticeRecord } from './practiceRecords';
import type { SpeakingFeedback, SpeakingThreadAnswer } from './ai/schemas';
import {
  buildSpeakingFeedbackJudgePacket,
  buildTeacherJudgePrompt,
  buildWritingTask1FeedbackJudgePacket,
  buildWritingTask2FeedbackJudgePacket,
  FeedbackJudgePacket,
  HardSafetyJudgeResult,
  runHardSafetyFeedbackJudge,
} from './feedbackJudgeHarness';

export type FeedbackHistoryReplayModule = 'speaking' | 'writing' | 'writing_task1';

export interface FeedbackHistoryReplayOptions {
  limit?: number;
  modules?: FeedbackHistoryReplayModule[];
  speakingParts?: Array<1 | 2 | 3>;
  includePackets?: boolean;
  includeTeacherJudgePrompts?: boolean;
}

export interface FeedbackHistoryReplaySourceSummary {
  canonicalRecordsFound: number;
  legacyRecordsFound: number;
  sanitizedRecords: number;
  duplicateRecordsSkipped: number;
  unsupportedRecordsSkipped: number;
  legacySessionArchiveFound: number;
}

export interface FeedbackHistoryReplayRecordSummary {
  id: string;
  module: PracticeRecord['module'];
  status: PracticeRecord['status'];
  title: string;
  timestamp: string;
  question: string;
  topic?: string;
  part?: 1 | 2 | 3;
  sessionKind?: SpeakingPracticeRecord['sessionKind'];
  task?: 'task1' | 'task2';
  score?: number;
  wordCount: number;
  bucket: string;
  sampledReason: 'bucket_latest' | 'recent_fill';
}

export interface FeedbackHistoryReplayCase {
  record: FeedbackHistoryReplayRecordSummary;
  hardSafety: HardSafetyJudgeResult;
  packet?: FeedbackJudgePacket;
  teacherJudgePrompt?: string;
}

export interface FeedbackHistoryReplayReport {
  generatedAt: string;
  options: Required<FeedbackHistoryReplayOptions>;
  source: FeedbackHistoryReplaySourceSummary;
  totals: {
    candidateRecords: number;
    sampledRecords: number;
    mustFixFindings: number;
    shouldFixFindings: number;
    teacherJudgeNeeded: number;
  };
  skipped: {
    missingFeedback: number;
    unsupportedModule: number;
    filteredOut: number;
  };
  cases: FeedbackHistoryReplayCase[];
}

const DEFAULT_LIMIT = 24;

const compact = (value = '') => value.replace(/\s+/g, ' ').trim();

const wordCount = (value = '') => compact(value).split(/\s+/).filter(Boolean).length;

const timestampForRecord = (record: PracticeRecord) =>
  record.analyzedAt || record.updatedAt || record.createdAt || '';

const scoreForRecord = (record: PracticeRecord) => {
  if (record.module === 'speaking') return record.feedback?.bandEstimateExcludingPronunciation;
  if (record.module === 'writing') {
    const scores = record.feedback?.scores;
    if (!scores) return undefined;
    const values = [
      scores.taskResponse,
      scores.coherenceCohesion,
      scores.lexicalResource,
      scores.grammaticalRangeAccuracy,
    ].filter((score): score is number => Number.isFinite(score));
    return values.length ? Math.round((values.reduce((sum, score) => sum + score, 0) / values.length) * 2) / 2 : undefined;
  }
  return record.feedback?.estimatedBand;
};

const recordTitle = (record: PracticeRecord) => {
  if (record.module === 'speaking') {
    const kind = record.sessionKind === 'part1_topic_thread'
      ? 'Part 1 topic thread'
      : record.sessionKind === 'part3_discussion_thread'
        ? 'Part 3 discussion thread'
        : `Part ${record.part}`;
    return `${kind}: ${record.topic || record.question || record.id}`;
  }
  if (record.module === 'writing_task1') return `Writing Task 1: ${record.topic || record.taskType || record.id}`;
  return `Writing Task 2: ${record.topic || record.question || record.id}`;
};

const recordText = (record: PracticeRecord) => {
  if (record.module === 'speaking') {
    return record.threadAnswers?.length
      ? record.threadAnswers.map(answer => `${answer.question} ${answer.transcript}`).join(' ')
      : record.transcript;
  }
  if (record.module === 'writing_task1') return record.report;
  return record.essay;
};

const recordBucket = (record: PracticeRecord) => {
  if (record.module === 'speaking') {
    return `speaking:p${record.part}:${record.sessionKind || 'single_question'}`;
  }
  if (record.module === 'writing_task1') return `writing_task1:${record.taskType || 'unknown'}`;
  return `writing:${record.task || 'task2'}`;
};

const hasUsableFeedback = (record: PracticeRecord) => {
  if (record.status !== 'analyzed') return false;
  if (record.module === 'speaking') return Boolean(record.feedback);
  if (record.module === 'writing') return Boolean(record.feedback);
  if (record.module === 'writing_task1') return Boolean(record.feedback);
  return false;
};

const moduleMatches = (record: PracticeRecord, modules: FeedbackHistoryReplayModule[]) =>
  modules.includes(record.module as FeedbackHistoryReplayModule);

const speakingPartMatches = (record: PracticeRecord, parts: Array<1 | 2 | 3>) =>
  record.module !== 'speaking' || parts.includes(record.part);

const toSpeakingThreadAnswers = (record: SpeakingPracticeRecord): SpeakingThreadAnswer[] | undefined =>
  record.threadAnswers?.map(answer => ({
    questionId: answer.questionId,
    question: answer.question,
    answer: answer.transcript,
  }));

const feedbackForSpeakingRecord = (record: SpeakingPracticeRecord): SpeakingFeedback | null => {
  if (!record.feedback) return null;
  return {
    ...record.feedback,
    part: record.part || record.feedback.part,
    sessionKind: record.sessionKind || record.feedback.sessionKind,
    topic: record.feedback.topic || record.topic,
    threadId: record.feedback.threadId || record.threadId,
    question: record.feedback.question || record.question,
    transcript: record.feedback.transcript || record.transcript,
    threadAnswers: record.feedback.threadAnswers || toSpeakingThreadAnswers(record),
  };
};

const buildPacketForRecord = (record: PracticeRecord): FeedbackJudgePacket | null => {
  const id = `history-${record.id}`;
  const title = recordTitle(record);
  if (record.module === 'speaking') {
    const feedback = feedbackForSpeakingRecord(record);
    if (!feedback) return null;
    return buildSpeakingFeedbackJudgePacket({
      id,
      title,
      feedback,
      threadAnswers: toSpeakingThreadAnswers(record),
    });
  }
  if (record.module === 'writing') {
    const typed = record as WritingTask2PracticeRecord;
    if (!typed.feedback) return null;
    return buildWritingTask2FeedbackJudgePacket({
      id,
      title,
      feedback: {
        ...typed.feedback,
        question: typed.feedback.question || typed.question,
        essay: typed.feedback.essay || typed.essay,
      },
    });
  }
  if (record.module === 'writing_task1') {
    const typed = record as WritingTask1PracticeRecord;
    if (!typed.feedback) return null;
    return buildWritingTask1FeedbackJudgePacket({
      id,
      title,
      feedback: {
        ...typed.feedback,
        instruction: typed.feedback.instruction || typed.instruction,
        report: typed.feedback.report || typed.report,
      },
    });
  }
  return null;
};

const normalizeOptions = (options: FeedbackHistoryReplayOptions = {}): Required<FeedbackHistoryReplayOptions> => ({
  limit: Math.max(1, Math.floor(options.limit || DEFAULT_LIMIT)),
  modules: options.modules?.length ? options.modules : ['speaking'],
  speakingParts: options.speakingParts?.length ? options.speakingParts : [1, 2, 3],
  includePackets: options.includePackets ?? true,
  includeTeacherJudgePrompts: options.includeTeacherJudgePrompts ?? false,
});

const summarizeRecord = (
  record: PracticeRecord,
  sampledReason: FeedbackHistoryReplayRecordSummary['sampledReason'],
): FeedbackHistoryReplayRecordSummary => ({
  id: record.id,
  module: record.module,
  status: record.status,
  title: recordTitle(record),
  timestamp: timestampForRecord(record),
  question: record.question,
  topic: record.topic,
  part: record.module === 'speaking' ? record.part : undefined,
  sessionKind: record.module === 'speaking' ? record.sessionKind : undefined,
  task: record.module === 'writing_task1' ? 'task1' : record.module === 'writing' ? 'task2' : undefined,
  score: scoreForRecord(record),
  wordCount: wordCount(recordText(record)),
  bucket: recordBucket(record),
  sampledReason,
});

export const buildFeedbackHistoryReplayReport = (
  records: PracticeRecord[],
  optionsInput: FeedbackHistoryReplayOptions = {},
  source: FeedbackHistoryReplaySourceSummary = {
    canonicalRecordsFound: records.length,
    legacyRecordsFound: 0,
    sanitizedRecords: records.length,
    duplicateRecordsSkipped: 0,
    unsupportedRecordsSkipped: 0,
    legacySessionArchiveFound: 0,
  },
): FeedbackHistoryReplayReport => {
  const options = normalizeOptions(optionsInput);
  let missingFeedback = 0;
  let unsupportedModule = 0;
  let filteredOut = 0;

  const candidates = records
    .filter(record => {
      if (!moduleMatches(record, options.modules)) {
        filteredOut++;
        return false;
      }
      if (!speakingPartMatches(record, options.speakingParts)) {
        filteredOut++;
        return false;
      }
      if (!hasUsableFeedback(record)) {
        missingFeedback++;
        return false;
      }
      const packet = buildPacketForRecord(record);
      if (!packet) {
        unsupportedModule++;
        return false;
      }
      return true;
    })
    .sort((a, b) => timestampForRecord(b).localeCompare(timestampForRecord(a)));

  const selected = new Map<string, {
    record: PracticeRecord;
    sampledReason: FeedbackHistoryReplayRecordSummary['sampledReason'];
  }>();
  const seenBuckets = new Set<string>();

  for (const record of candidates) {
    const bucket = recordBucket(record);
    if (seenBuckets.has(bucket)) continue;
    seenBuckets.add(bucket);
    selected.set(record.id, { record, sampledReason: 'bucket_latest' });
    if (selected.size >= options.limit) break;
  }

  if (selected.size < options.limit) {
    for (const record of candidates) {
      if (selected.has(record.id)) continue;
      selected.set(record.id, { record, sampledReason: 'recent_fill' });
      if (selected.size >= options.limit) break;
    }
  }

  const cases = Array.from(selected.values()).map(({ record, sampledReason }) => {
    const packet = buildPacketForRecord(record);
    if (!packet) throw new Error(`Could not build feedback judge packet for selected record ${record.id}.`);
    const hardSafety = runHardSafetyFeedbackJudge(packet);
    return {
      record: summarizeRecord(record, sampledReason),
      hardSafety,
      packet: options.includePackets ? packet : undefined,
      teacherJudgePrompt: options.includeTeacherJudgePrompts ? buildTeacherJudgePrompt(packet) : undefined,
    };
  });

  const findings = cases.flatMap(item => item.hardSafety.findings);

  return {
    generatedAt: new Date().toISOString(),
    options,
    source,
    totals: {
      candidateRecords: candidates.length,
      sampledRecords: cases.length,
      mustFixFindings: findings.filter(finding => finding.severity === 'must_fix').length,
      shouldFixFindings: findings.filter(finding => finding.severity === 'should_fix').length,
      teacherJudgeNeeded: findings.filter(finding => finding.severity === 'needs_teacher_judge').length,
    },
    skipped: {
      missingFeedback,
      unsupportedModule,
      filteredOut,
    },
    cases,
  };
};

const parseJsonArrayFromLocalStorage = (payload: any, key: string): unknown[] => {
  const raw = payload?.localStorage?.[key];
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const extractPracticeRecordsFromBackupPayload = (
  payload: unknown,
): { records: PracticeRecord[]; source: FeedbackHistoryReplaySourceSummary } => {
  const data = payload as any;
  const canonicalRaw = Array.isArray(data?.indexedDb?.practiceRecords)
    ? data.indexedDb.practiceRecords
    : Array.isArray(data)
      ? data
      : [];
  const legacyRaw = parseJsonArrayFromLocalStorage(data, 'ielts_practice_records_v1');
  const legacySessionArchiveFound = Array.isArray(data?.indexedDb?.legacySessionsArchive)
    ? data.indexedDb.legacySessionsArchive.length
    : 0;

  const byKey = new Map<string, PracticeRecord>();
  let unsupportedRecordsSkipped = 0;
  let duplicateRecordsSkipped = 0;

  [...canonicalRaw, ...legacyRaw].forEach(item => {
    const sanitized = sanitizePracticeRecord(item);
    if (!sanitized) {
      unsupportedRecordsSkipped++;
      return;
    }
    const key = `${sanitized.module}:${sanitized.id}`;
    if (byKey.has(key)) {
      duplicateRecordsSkipped++;
      const existing = byKey.get(key);
      if (existing && timestampForRecord(sanitized) > timestampForRecord(existing)) byKey.set(key, sanitized);
      return;
    }
    byKey.set(key, sanitized);
  });

  const records = Array.from(byKey.values());

  return {
    records,
    source: {
      canonicalRecordsFound: canonicalRaw.length,
      legacyRecordsFound: legacyRaw.length,
      sanitizedRecords: records.length,
      duplicateRecordsSkipped,
      unsupportedRecordsSkipped,
      legacySessionArchiveFound,
    },
  };
};
