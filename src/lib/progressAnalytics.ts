import {
  speakingTopicCategories,
  writingTask1Academic,
  writingTask2,
  writingTask2TopicCategories,
  type SpeakingTopicCategory,
  type WritingTask1AcademicTaskType,
  type WritingTask2TopicCategory,
} from '@/src/data/questions/bank';
import { speakingPart1, speakingPart2, speakingPart3 } from '@/src/data/speaking/activeSpeakingBank';
import type {
  PracticeRecord,
  SpeakingPracticeRecord,
  WritingTask1PracticeRecord,
  WritingTask2PracticeRecord,
} from '@/src/lib/practiceRecords';

export type PerformanceSeries = 'speaking' | 'writingTask1' | 'writingTask2';
export type CriterionProfileKind = 'speaking' | 'writingTask2';
export type CoverageKind = 'speaking' | 'writingTask1' | 'writingTask2';

export interface PerformancePoint {
  id: string;
  timestamp: number;
  dateIso: string;
  series: PerformanceSeries;
  seriesLabel: string;
  score: number;
  context: string;
}

export interface CriterionDatum {
  key: string;
  label: string;
  shortLabel: string;
  value: number;
}

export interface CriterionProfile {
  kind: CriterionProfileKind;
  label: string;
  sourceRecordId: string;
  dateIso: string;
  context: string;
  criteria: CriterionDatum[];
  note: string;
}

export interface CoverageDatum {
  category: string;
  attempts: number;
}

export interface CoverageGroup {
  kind: CoverageKind;
  label: string;
  provenance: string;
  data: CoverageDatum[];
}

const task1VisualTypes: WritingTask1AcademicTaskType[] = [
  'line graph',
  'bar chart',
  'table',
  'pie chart',
  'mixed chart',
  'process',
  'map',
];

const isValidBand = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 9;

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const recordDateIso = (record: PracticeRecord) =>
  record.analyzedAt || record.updatedAt || record.createdAt;

const recordTimestamp = (record: PracticeRecord) => {
  const value = Date.parse(recordDateIso(record));
  return Number.isFinite(value) ? value : 0;
};

const compact = (value: string, limit = 88) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}…` : normalized;
};

export const getSpeakingTrainingScore = (record: SpeakingPracticeRecord): number | null => {
  const score = record.feedback?.bandEstimateExcludingPronunciation;
  return isValidBand(score) ? score : null;
};

export const getWritingTask1TrainingScore = (record: WritingTask1PracticeRecord): number | null => {
  const score = record.feedback?.estimatedBand;
  return isValidBand(score) ? score : null;
};

export const getWritingTask2TrainingScore = (record: WritingTask2PracticeRecord): number | null => {
  const scores = record.feedback?.scores;
  if (!scores) return null;
  const values = [
    scores.taskResponse,
    scores.coherenceCohesion,
    scores.lexicalResource,
    scores.grammaticalRangeAccuracy,
  ];
  return values.every(isValidBand) ? average(values) : null;
};

export const buildPerformanceTrajectory = (records: PracticeRecord[]): PerformancePoint[] =>
  records.flatMap((record): PerformancePoint[] => {
    if (record.status !== 'analyzed') return [];

    if (record.module === 'speaking') {
      const score = getSpeakingTrainingScore(record);
      return score === null ? [] : [{
        id: record.id,
        timestamp: recordTimestamp(record),
        dateIso: recordDateIso(record),
        series: 'speaking',
        seriesLabel: 'Speaking',
        score,
        context: compact(record.topic || record.feedback?.topic || record.question),
      }];
    }

    if (record.module === 'writing_task1') {
      const score = getWritingTask1TrainingScore(record);
      return score === null ? [] : [{
        id: record.id,
        timestamp: recordTimestamp(record),
        dateIso: recordDateIso(record),
        series: 'writingTask1',
        seriesLabel: 'Writing Task 1',
        score,
        context: compact(`${record.taskType}: ${record.visualBrief || record.question}`),
      }];
    }

    const score = getWritingTask2TrainingScore(record);
    return score === null ? [] : [{
      id: record.id,
      timestamp: recordTimestamp(record),
      dateIso: recordDateIso(record),
      series: 'writingTask2',
      seriesLabel: 'Writing Task 2',
      score,
      context: compact(record.topic || record.question),
    }];
  }).sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));

const latestEligible = <T extends PracticeRecord>(records: T[], accepts: (record: T) => boolean) =>
  [...records].filter(accepts).sort((a, b) => recordTimestamp(b) - recordTimestamp(a))[0];

export const buildCriterionProfiles = (records: PracticeRecord[]): Partial<Record<CriterionProfileKind, CriterionProfile>> => {
  const speaking = latestEligible(
    records.filter((record): record is SpeakingPracticeRecord => record.module === 'speaking'),
    record => {
      const scores = record.feedback?.scores;
      return record.status === 'analyzed' && Boolean(scores) && [
        scores?.fluencyCoherence,
        scores?.lexicalResource,
        scores?.grammaticalRangeAccuracy,
      ].every(isValidBand);
    },
  );
  const writingTask2 = latestEligible(
    records.filter((record): record is WritingTask2PracticeRecord => record.module === 'writing'),
    record => {
      const scores = record.feedback?.scores;
      return record.status === 'analyzed' && Boolean(scores) && [
        scores?.taskResponse,
        scores?.coherenceCohesion,
        scores?.lexicalResource,
        scores?.grammaticalRangeAccuracy,
      ].every(isValidBand);
    },
  );

  return {
    speaking: speaking?.feedback ? {
      kind: 'speaking',
      label: 'Latest analyzed Speaking attempt',
      sourceRecordId: speaking.id,
      dateIso: recordDateIso(speaking),
      context: compact(speaking.topic || speaking.feedback.topic || speaking.question),
      criteria: [
        { key: 'fluencyCoherence', label: 'Fluency & Coherence', shortLabel: 'Fluency', value: speaking.feedback.scores.fluencyCoherence },
        { key: 'lexicalResource', label: 'Lexical Resource', shortLabel: 'Lexical', value: speaking.feedback.scores.lexicalResource },
        { key: 'grammaticalRangeAccuracy', label: 'Grammatical Range & Accuracy', shortLabel: 'Grammar', value: speaking.feedback.scores.grammaticalRangeAccuracy },
      ],
      note: 'Pronunciation is excluded because this text-based assessment does not score it.',
    } : undefined,
    writingTask2: writingTask2?.feedback ? {
      kind: 'writingTask2',
      label: 'Latest analyzed Writing Task 2 attempt',
      sourceRecordId: writingTask2.id,
      dateIso: recordDateIso(writingTask2),
      context: compact(writingTask2.topic || writingTask2.question),
      criteria: [
        { key: 'taskResponse', label: 'Task Response', shortLabel: 'Task Response', value: writingTask2.feedback.scores.taskResponse },
        { key: 'coherenceCohesion', label: 'Coherence & Cohesion', shortLabel: 'Coherence', value: writingTask2.feedback.scores.coherenceCohesion },
        { key: 'lexicalResource', label: 'Lexical Resource', shortLabel: 'Lexical', value: writingTask2.feedback.scores.lexicalResource },
        { key: 'grammaticalRangeAccuracy', label: 'Grammatical Range & Accuracy', shortLabel: 'Grammar', value: writingTask2.feedback.scores.grammaticalRangeAccuracy },
      ],
      note: 'Criterion values come from the latest complete local Task 2 feedback record.',
    } : undefined,
  };
};

const normalizeText = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

const fromRecordMetadata = <T extends string>(record: PracticeRecord, valid: readonly T[]): T | null => {
  const source = record as PracticeRecord & { topicCategory?: unknown; tags?: unknown[] };
  const questionData = record.questionData as { topicCategory?: unknown; tags?: unknown[] } | undefined;
  const candidates = [source.topicCategory, ...(source.tags || []), questionData?.topicCategory, ...(questionData?.tags || [])];
  return candidates.find((candidate): candidate is T => typeof candidate === 'string' && valid.includes(candidate as T)) || null;
};

const speakingBank = [...speakingPart1, ...speakingPart2, ...speakingPart3];

const speakingKeywords: Record<SpeakingTopicCategory, string[]> = {
  'Work & Study': ['work', 'job', 'study', 'school', 'student', 'teacher', 'learn', 'skill', 'project', 'task'],
  'Home & Hometown': ['hometown', 'home', 'where you live'],
  'Family & People': ['family', 'friend', 'person', 'people', 'neighbor', 'children', 'adult'],
  'Daily Life': ['routine', 'evening', 'daily', 'day', 'change', 'decision'],
  'Hobbies & Free Time': ['music', 'sport', 'hobby', 'free time', 'enjoy'],
  'Books & Reading': ['book', 'read', 'e-book'],
  Technology: ['technology', 'phone', 'app', 'device', 'online'],
  'Travel & Places': ['travel', 'place', 'city', 'public space', 'visit'],
  'Food & Health': ['food', 'cook', 'restaurant', 'health'],
  'Culture & Media': ['media', 'film', 'tv', 'celebration', 'ceremony', 'event'],
  'Nature & Environment': ['weather', 'environment', 'waste', 'nature'],
  'Objects & Memories': ['object', 'thing', 'memory', 'experience', 'buy new things'],
};

const writingKeywords: Record<WritingTask2TopicCategory, string[]> = {
  Education: ['university', 'school', 'students', 'academic', 'teacher', 'language', 'exams'],
  Technology: ['technology', 'artificial intelligence', 'digital', 'devices'],
  'Work & Employment': ['work', 'office', 'jobs', 'careers', 'workers', 'workplaces'],
  'Environment & Resources': ['environment', 'resources', 'waste', 'food waste'],
  Health: ['health', 'stress', 'living longer', 'ageing'],
  'Government & Society': ['government', 'society', 'communities', 'neighbors'],
  'Crime & Law': ['crime', 'law', 'police', 'punishment'],
  'Culture & Media': ['museums', 'art', 'social media', 'news', 'galleries'],
  'Family & Children': ['children', 'parents', 'families', 'outdoors', 'live alone'],
  Globalization: ['international', 'global', 'foreign'],
  'Transport & Cities': ['transport', 'traffic', 'cities', 'city', 'towns'],
  'Economy & Consumerism': ['buy', 'products', 'online', 'salaries', 'paid'],
};

const keywordMatch = <T extends string>(text: string, keywords: Record<T, string[]>): T | null => {
  const normalized = normalizeText(text);
  return (Object.entries(keywords) as [T, string[]][])
    .find(([, values]) => values.some(value => normalized.includes(value)))?.[0] || null;
};

const speakingCategory = (record: SpeakingPracticeRecord): SpeakingTopicCategory | null => {
  const metadata = fromRecordMetadata(record, speakingTopicCategories);
  if (metadata) return metadata;
  const bankMatch = speakingBank.find(item => item.id === record.questionId || normalizeText(item.question) === normalizeText(record.question));
  return bankMatch?.topicCategory || keywordMatch(record.question, speakingKeywords);
};

const task1Category = (record: WritingTask1PracticeRecord): WritingTask1AcademicTaskType | null => {
  if (task1VisualTypes.includes(record.taskType as WritingTask1AcademicTaskType)) return record.taskType as WritingTask1AcademicTaskType;
  return writingTask1Academic.find(item => item.id === record.questionId || normalizeText(item.instruction) === normalizeText(record.instruction))?.taskType || null;
};

const task2Category = (record: WritingTask2PracticeRecord): WritingTask2TopicCategory | null => {
  const metadata = fromRecordMetadata(record, writingTask2TopicCategories);
  if (metadata) return metadata;
  const bankMatch = writingTask2.find(item => item.id === record.questionId || normalizeText(item.question) === normalizeText(record.question));
  return bankMatch?.topicCategory || keywordMatch(record.question, writingKeywords);
};

const coverage = <T extends string>(categories: readonly T[], records: PracticeRecord[], resolve: (record: PracticeRecord) => T | null) =>
  categories.map(category => ({
    category,
    attempts: records.reduce((total, record) => total + (resolve(record) === category ? 1 : 0), 0),
  }));

export const buildCoverageGroups = (records: PracticeRecord[]): Record<CoverageKind, CoverageGroup> => {
  const visibleAttempts = records.filter(record => record.status !== 'draft');
  const speakingRecords = visibleAttempts.filter(record => record.module === 'speaking');
  const task1Records = visibleAttempts.filter(record => record.module === 'writing_task1');
  const task2Records = visibleAttempts.filter(record => record.module === 'writing');
  return {
    speaking: {
      kind: 'speaking',
      label: 'Speaking topics',
      provenance: 'Preparation categories derived from local bank metadata, with text fallback for older records.',
      data: coverage(speakingTopicCategories, speakingRecords, record => speakingCategory(record as SpeakingPracticeRecord)),
    },
    writingTask1: {
      kind: 'writingTask1',
      label: 'Writing Task 1 visual types',
      provenance: 'Academic visual types recorded by the local Task 1 practice bank.',
      data: coverage(task1VisualTypes, task1Records, record => task1Category(record as WritingTask1PracticeRecord)),
    },
    writingTask2: {
      kind: 'writingTask2',
      label: 'Writing Task 2 topics',
      provenance: 'Preparation categories derived from local question metadata, with text fallback for older records.',
      data: coverage(writingTask2TopicCategories, task2Records, record => task2Category(record as WritingTask2PracticeRecord)),
    },
  };
};

export interface ProgressAnalytics {
  trajectory: PerformancePoint[];
  criteria: Partial<Record<CriterionProfileKind, CriterionProfile>>;
  coverage: Record<CoverageKind, CoverageGroup>;
}

export const buildProgressAnalytics = (records: PracticeRecord[]): ProgressAnalytics => ({
  trajectory: buildPerformanceTrajectory(records),
  criteria: buildCriterionProfiles(records),
  coverage: buildCoverageGroups(records),
});
