import type {
  PracticeRecord,
  SpeakingPracticeRecord,
  WritingTask1PracticeRecord,
  WritingTask2PracticeRecord,
} from '@/src/lib/practiceRecords';

export interface PracticeHistoryDedupeRecordSummary {
  id: string;
  module: PracticeRecord['module'];
  part?: 1 | 2 | 3;
  status: PracticeRecord['status'];
  title: string;
  timestamp: string;
}

export interface PracticeHistoryDedupeGroup {
  key: string;
  label: string;
  scope: string;
  keep: PracticeHistoryDedupeRecordSummary;
  remove: PracticeHistoryDedupeRecordSummary[];
}

export interface PracticeHistoryDedupePlan {
  generatedAt: string;
  totalRecords: number;
  eligibleRecords: number;
  skippedRecords: number;
  duplicateGroupCount: number;
  deleteCount: number;
  groups: PracticeHistoryDedupeGroup[];
}

export interface PracticeHistoryDedupeRunReport {
  completedAt: string;
  before: PracticeHistoryDedupePlan;
  after: PracticeHistoryDedupePlan;
  attemptedDeleteCount: number;
  deletedCount: number;
  failedIds: string[];
}

const getTimestamp = (record: PracticeRecord) =>
  record.analyzedAt || record.updatedAt || record.createdAt || '';

const normalizeKeyText = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const shortText = (value: string, fallback: string) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;
  return normalized.length > 96 ? `${normalized.slice(0, 96)}...` : normalized;
};

const firstText = (...values: Array<unknown>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const compareFreshnessDesc = (left: PracticeRecord, right: PracticeRecord) => {
  const leftTimestamp = getTimestamp(left);
  const rightTimestamp = getTimestamp(right);
  const leftMs = Date.parse(leftTimestamp);
  const rightMs = Date.parse(rightTimestamp);
  if (Number.isFinite(leftMs) && Number.isFinite(rightMs) && leftMs !== rightMs) {
    return rightMs - leftMs;
  }
  const lexical = rightTimestamp.localeCompare(leftTimestamp);
  if (lexical !== 0) return lexical;
  return right.id.localeCompare(left.id);
};

const recordSummary = (record: PracticeRecord): PracticeHistoryDedupeRecordSummary => ({
  id: record.id,
  module: record.module,
  part: record.module === 'speaking' ? record.part : undefined,
  status: record.status,
  title: getDisplayTitle(record),
  timestamp: getTimestamp(record),
});

function getDisplayTitle(record: PracticeRecord) {
  if (record.module === 'speaking') {
    const feedback = record.feedback as any;
    return shortText(
      firstText(
        record.topic,
        feedback?.topic,
        record.threadQuestions?.[0]?.topic,
        record.question,
      ),
      `Speaking Part ${record.part}`,
    );
  }
  if (record.module === 'writing_task1') {
    return shortText(firstText(record.instruction, record.prompt, record.topic), 'Writing Task 1 prompt');
  }
  return shortText(firstText(record.question, record.topic), 'Writing Task 2 prompt');
}

function getSpeakingDedupeKey(record: SpeakingPracticeRecord) {
  const questionData = record.questionData as any;
  const feedback = record.feedback as any;
  const sessionKind = record.sessionKind || 'single_question';

  if (record.part === 1) {
    const source = firstText(
      record.topicId,
      record.topic,
      feedback?.topic,
      record.threadQuestions?.[0]?.topic,
      questionData?.topic,
      questionData?.topicCategory,
      record.question,
    );
    return source
      ? {
        key: `speaking:part1:topic:${normalizeKeyText(source)}`,
        label: `Speaking Part 1 · ${shortText(source, 'Topic')}`,
        scope: 'Speaking Part 1 topic',
      }
      : null;
  }

  if (record.part === 3 || sessionKind === 'part3_discussion_thread') {
    const source = firstText(
      record.topicId,
      record.topic,
      feedback?.topic,
      record.threadQuestions?.[0]?.topic,
      questionData?.topic,
      questionData?.topicCategory,
      record.question,
    );
    return source
      ? {
        key: `speaking:part3:topic:${normalizeKeyText(source)}`,
        label: `Speaking Part 3 · ${shortText(source, 'Discussion topic')}`,
        scope: 'Speaking Part 3 discussion topic',
      }
      : null;
  }

  const source = firstText(
    record.questionId,
    questionData?.id,
    record.question,
    questionData?.question,
    record.topic,
  );
  return source
    ? {
      key: `speaking:part2:prompt:${normalizeKeyText(source)}`,
      label: `Speaking Part 2 · ${shortText(firstText(record.question, record.topic, source), 'Prompt')}`,
      scope: 'Speaking Part 2 prompt',
    }
    : null;
}

function getWritingTask2DedupeKey(record: WritingTask2PracticeRecord) {
  const questionData = record.questionData as any;
  const source = firstText(record.questionId, questionData?.id, record.question, questionData?.question, record.topic);
  return source
    ? {
      key: `writing:task2:prompt:${normalizeKeyText(source)}`,
      label: `Writing Task 2 · ${shortText(firstText(record.question, source), 'Prompt')}`,
      scope: 'Writing Task 2 prompt',
    }
    : null;
}

function getWritingTask1DedupeKey(record: WritingTask1PracticeRecord) {
  const questionData = record.questionData as any;
  const source = firstText(
    record.questionId,
    questionData?.id,
    record.instruction,
    record.prompt,
    record.visualBrief,
    record.topic,
  );
  return source
    ? {
      key: `writing:task1:prompt:${normalizeKeyText(source)}`,
      label: `Writing Task 1 · ${shortText(firstText(record.instruction, record.topic, source), 'Prompt')}`,
      scope: 'Writing Task 1 prompt',
    }
    : null;
}

function getDedupeKey(record: PracticeRecord) {
  if (record.module === 'speaking') return getSpeakingDedupeKey(record);
  if (record.module === 'writing_task1') return getWritingTask1DedupeKey(record);
  return getWritingTask2DedupeKey(record);
}

export function buildPracticeHistoryDedupePlan(records: PracticeRecord[]): PracticeHistoryDedupePlan {
  const generatedAt = new Date().toISOString();
  const eligible = records.filter(record => record.status === 'analyzed');
  const buckets = new Map<string, { label: string; scope: string; records: PracticeRecord[] }>();
  let keyedEligibleCount = 0;

  for (const record of eligible) {
    const keyInfo = getDedupeKey(record);
    if (!keyInfo || !keyInfo.key) continue;
    keyedEligibleCount += 1;
    const existing = buckets.get(keyInfo.key);
    if (existing) {
      existing.records.push(record);
    } else {
      buckets.set(keyInfo.key, { label: keyInfo.label, scope: keyInfo.scope, records: [record] });
    }
  }

  const groups: PracticeHistoryDedupeGroup[] = Array.from(buckets.entries())
    .map(([key, value]) => {
      const sorted = [...value.records].sort(compareFreshnessDesc);
      return {
        key,
        label: value.label,
        scope: value.scope,
        keep: recordSummary(sorted[0]),
        remove: sorted.slice(1).map(recordSummary),
      };
    })
    .filter(group => group.remove.length > 0)
    .sort((left, right) => right.remove.length - left.remove.length || left.label.localeCompare(right.label));

  return {
    generatedAt,
    totalRecords: records.length,
    eligibleRecords: keyedEligibleCount,
    skippedRecords: records.length - keyedEligibleCount,
    duplicateGroupCount: groups.length,
    deleteCount: groups.reduce((sum, group) => sum + group.remove.length, 0),
    groups,
  };
}
