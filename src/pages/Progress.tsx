import React from 'react';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import {
  speakingPart1,
  speakingPart2,
  speakingPart3,
  speakingTopicCategories,
  writingTask1Academic,
  WritingTask1AcademicTaskType,
  writingTask2,
  writingTask2TopicCategories,
  SpeakingTopicCategory,
  WritingTask2TopicCategory,
} from '@/src/data/questions/bank';
import {
  getPracticeRecords,
  PracticeRecord,
  SpeakingPracticeRecord,
  WritingTask1PracticeRecord,
  WritingTask2PracticeRecord,
} from '@/src/lib/practiceRecords';
import {
  combineWritingEstimates,
  conservativeRecentEstimate,
  formatApproxBandEstimate,
  formatBandEstimate,
} from '@/src/lib/bands';

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

const getTimestamp = (record: PracticeRecord) =>
  record.analyzedAt || record.updatedAt || record.createdAt;

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const preview = (value: string) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 96 ? `${normalized.slice(0, 96)}...` : normalized;
};

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

const normalizeText = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

const getSpeakingScore = (record: SpeakingPracticeRecord) => {
  const score = record.feedback?.bandEstimateExcludingPronunciation;
  return isValidBand(score) ? score : null;
};

const getWritingTask2Score = (record: WritingTask2PracticeRecord) => {
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

const getWritingTask1Score = (record: WritingTask1PracticeRecord) => {
  const score = record.feedback?.estimatedBand;
  return isValidBand(score) ? score : null;
};

const isScoredSpeaking = (record: PracticeRecord): record is SpeakingPracticeRecord =>
  record.module === 'speaking' && record.status === 'analyzed' && getSpeakingScore(record as SpeakingPracticeRecord) !== null;

const isScoredWritingTask2 = (record: PracticeRecord): record is WritingTask2PracticeRecord =>
  record.module === 'writing' &&
  (record as WritingTask2PracticeRecord).task === 'task2' &&
  record.status === 'analyzed' &&
  getWritingTask2Score(record as WritingTask2PracticeRecord) !== null;

const isScoredWritingTask1 = (record: PracticeRecord): record is WritingTask1PracticeRecord =>
  record.module === 'writing_task1' &&
  record.status === 'analyzed' &&
  getWritingTask1Score(record as WritingTask1PracticeRecord) !== null;

const speakingBank = [...speakingPart1, ...speakingPart2, ...speakingPart3];

const speakingKeywordFallback: Record<SpeakingTopicCategory, string[]> = {
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

const writingKeywordFallback: Record<WritingTask2TopicCategory, string[]> = {
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

const fromRecordMetadata = <T extends string>(record: PracticeRecord, validTopics: readonly T[]): T | null => {
  const source = record as PracticeRecord & { topicCategory?: unknown; tags?: unknown[] };
  const questionData = record.questionData as { topicCategory?: unknown; tags?: unknown[] } | undefined;
  const candidates = [
    source.topicCategory,
    ...(Array.isArray(source.tags) ? source.tags : []),
    questionData?.topicCategory,
    ...(Array.isArray(questionData?.tags) ? questionData.tags : []),
  ];
  return candidates.find((candidate): candidate is T =>
    typeof candidate === 'string' && validTopics.includes(candidate as T)
  ) || null;
};

const fromQuestionText = <T extends string>(text: string, fallback: Record<T, string[]>) => {
  const normalized = normalizeText(text);
  return (Object.entries(fallback) as [T, string[]][])
    .find(([, keywords]) => keywords.some(keyword => normalized.includes(keyword)))?.[0] || null;
};

const getSpeakingTopic = (record: SpeakingPracticeRecord): SpeakingTopicCategory | null => {
  const metadataTopic = fromRecordMetadata(record, speakingTopicCategories);
  if (metadataTopic) return metadataTopic;

  const matched = speakingBank.find(question =>
    question.id === record.questionId || normalizeText(question.question) === normalizeText(record.question)
  );
  return matched?.topicCategory || fromQuestionText(record.question, speakingKeywordFallback);
};

const getWritingTask2Topic = (record: WritingTask2PracticeRecord): WritingTask2TopicCategory | null => {
  const metadataTopic = fromRecordMetadata(record, writingTask2TopicCategories);
  if (metadataTopic) return metadataTopic;

  const matched = writingTask2.find(question =>
    question.id === record.questionId || normalizeText(question.question) === normalizeText(record.question)
  );
  return matched?.topicCategory || fromQuestionText(record.question, writingKeywordFallback);
};

const getTask1VisualType = (record: WritingTask1PracticeRecord): WritingTask1AcademicTaskType | null => {
  const direct = record.taskType as WritingTask1AcademicTaskType;
  if (task1VisualTypes.includes(direct)) return direct;

  const matched = writingTask1Academic.find(prompt =>
    prompt.id === record.questionId || normalizeText(prompt.instruction) === normalizeText(record.instruction)
  );
  return matched?.taskType || null;
};

const countCoverage = <T extends string>(
  items: readonly T[],
  records: PracticeRecord[],
  resolveItem: (record: PracticeRecord) => T | null,
) => items.map(item => ({
  item,
  count: records.reduce((total, record) => total + (resolveItem(record) === item ? 1 : 0), 0),
}));

const pickUnderPracticed = <T extends string>(coverage: { item: T; count: number }[]) =>
  [...coverage].sort((a, b) => a.count - b.count || a.item.localeCompare(b.item))[0];

interface TrainingSuggestion {
  title: string;
  reason: string;
}

const buildTrainingSuggestions = (
  scoredSpeaking: SpeakingPracticeRecord[],
  scoredWritingTask1: WritingTask1PracticeRecord[],
  scoredWritingTask2: WritingTask2PracticeRecord[],
  speakingCoverage: { item: SpeakingTopicCategory; count: number }[],
  task1Coverage: { item: WritingTask1AcademicTaskType; count: number }[],
  task2Coverage: { item: WritingTask2TopicCategory; count: number }[],
  unfinishedDrafts: number,
): TrainingSuggestion[] => {
  const suggestions: TrainingSuggestion[] = [];
  const addSuggestion = (suggestion: TrainingSuggestion) => {
    if (suggestions.length < 4) suggestions.push(suggestion);
  };

  if (scoredSpeaking.length < 3) {
    addSuggestion({
      title: `Add more analyzed Speaking attempts (${scoredSpeaking.length}/3)`,
      reason: 'Training estimates are steadier after several local attempts.',
    });
  }

  if (scoredWritingTask2.length < 3) {
    addSuggestion({
      title: `Add more analyzed Writing Task 2 attempts (${scoredWritingTask2.length}/3)`,
      reason: 'Task 2 carries more weight in the combined Writing training estimate.',
    });
  }

  const thinTask1 = pickUnderPracticed(task1Coverage);
  if (thinTask1 && (thinTask1.count === 0 || scoredWritingTask1.length < 3)) {
    addSuggestion({
      title: `Practice Task 1 visual type: ${thinTask1.item}`,
      reason: thinTask1.count === 0
        ? 'No local analyzed attempt is recorded for this visual type yet.'
        : `Only ${thinTask1.count} local attempt${thinTask1.count === 1 ? '' : 's'} are recorded for this visual type.`,
    });
  }

  const thinTask2 = pickUnderPracticed(task2Coverage);
  if (thinTask2) {
    addSuggestion({
      title: `Cover Writing Task 2 topic: ${thinTask2.item}`,
      reason: thinTask2.count === 0
        ? 'No local Task 2 attempt is recorded for this preparation category yet.'
        : `This category has ${thinTask2.count} local Task 2 attempt${thinTask2.count === 1 ? '' : 's'}.`,
    });
  }

  const nextSpeaking = pickUnderPracticed(speakingCoverage);
  if (nextSpeaking) {
    addSuggestion({
      title: `Cover Speaking: ${nextSpeaking.item}`,
      reason: nextSpeaking.count === 0
        ? 'No local attempts are recorded for this preparation category yet.'
        : `This category has ${nextSpeaking.count} local attempt${nextSpeaking.count === 1 ? '' : 's'}.`,
    });
  }

  if (unfinishedDrafts > 0) {
    addSuggestion({
      title: 'Finish saved drafts',
      reason: `${unfinishedDrafts} draft${unfinishedDrafts === 1 ? ' is' : 's are'} saved locally and not analyzed yet.`,
    });
  }

  return suggestions.slice(0, 3);
};

export default function Progress() {
  const records = getPracticeRecords(80);
  const scoredSpeaking = records.filter(isScoredSpeaking);
  const scoredWritingTask2 = records.filter(isScoredWritingTask2);
  const scoredWritingTask1 = records.filter(isScoredWritingTask1);
  const speakingEstimate = conservativeRecentEstimate(scoredSpeaking.map(record => getSpeakingScore(record)).filter(isValidBand));
  const task1Estimate = conservativeRecentEstimate(scoredWritingTask1.map(record => getWritingTask1Score(record)).filter(isValidBand));
  const task2Estimate = conservativeRecentEstimate(scoredWritingTask2.map(record => getWritingTask2Score(record)).filter(isValidBand));
  const writingEstimate = combineWritingEstimates(task1Estimate, scoredWritingTask1.length, task2Estimate, scoredWritingTask2.length);
  const latestRecord = records[0];
  const recentSpeakingScores = scoredSpeaking.slice(0, 6);
  const speakingRecords = records.filter(record => record.module === 'speaking');
  const writingTask2Records = records.filter((record): record is WritingTask2PracticeRecord =>
    record.module === 'writing' && (record as WritingTask2PracticeRecord).task === 'task2'
  );
  const writingTask1Records = records.filter((record): record is WritingTask1PracticeRecord =>
    record.module === 'writing_task1' && record.task === 'task1'
  );
  const writingTask2Drafts = writingTask2Records.filter(record => record.status === 'draft').length;
  const writingTask1Drafts = writingTask1Records.filter(record => record.status === 'draft').length;
  const recentWritingScores = [...scoredWritingTask2, ...scoredWritingTask1]
    .sort((a, b) => getTimestamp(b).localeCompare(getTimestamp(a)))
    .slice(0, 6);
  const speakingCoverage = countCoverage(
    speakingTopicCategories,
    speakingRecords,
    record => getSpeakingTopic(record as SpeakingPracticeRecord),
  );
  const task1Coverage = countCoverage(
    task1VisualTypes,
    writingTask1Records,
    record => getTask1VisualType(record as WritingTask1PracticeRecord),
  );
  const task2Coverage = countCoverage(
    writingTask2TopicCategories,
    writingTask2Records,
    record => getWritingTask2Topic(record as WritingTask2PracticeRecord),
  );
  const unfinishedDrafts = records.filter(record => record.status === 'draft').length;
  const trainingSuggestions = buildTrainingSuggestions(
    scoredSpeaking,
    scoredWritingTask1,
    scoredWritingTask2,
    speakingCoverage,
    task1Coverage,
    task2Coverage,
    unfinishedDrafts,
  );

  return (
    <PageShell size="wide">
      <TopBar />

      <div className="mb-10 text-center max-w-2xl mx-auto">
        <h2 className="text-3xl">Your Training Snapshot</h2>
      </div>

      <div className="space-y-8">
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
          <PaperCard className="text-center py-8">
            <div className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-2">
              Speaking Training Estimate
            </div>
            <div className={speakingEstimate === null ? 'text-lg font-bold text-paper-ink/45 pt-2' : 'text-4xl font-bold text-accent-terracotta'}>
              {formatApproxBandEstimate(speakingEstimate)}
            </div>
          </PaperCard>

          <PaperCard className="text-center py-8">
            <div className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-2">
              Writing Training Estimate
            </div>
            <div className={writingEstimate === null ? 'text-lg font-bold text-paper-ink/45 pt-2' : 'text-4xl font-bold text-accent-terracotta'}>
              {formatApproxBandEstimate(writingEstimate)}
            </div>
          </PaperCard>

          <PaperCard className="text-center py-8">
            <div className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-2">
              Analyzed Attempts
            </div>
            <div className="text-sm font-bold uppercase tracking-widest text-paper-ink pt-2 font-sans leading-7">
              Speaking {scoredSpeaking.length}
              <br />
              Writing T2 {scoredWritingTask2.length}
              <br />
              Writing T1 {scoredWritingTask1.length}
              <br />
              <span className="text-paper-ink/45">
                Drafts T2 {writingTask2Drafts} / T1 {writingTask1Drafts}
              </span>
            </div>
          </PaperCard>

          <PaperCard className="text-center py-8">
            <div className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-2">
              Last Practice
            </div>
            <div className="text-sm font-bold text-paper-ink pt-2 font-sans leading-6">
              {latestRecord ? formatDate(getTimestamp(latestRecord)) : 'No records yet'}
            </div>
          </PaperCard>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <ScoreList
            title="Recent Speaking Training Estimates"
            empty="No analyzed Speaking attempts yet."
            records={recentSpeakingScores.map(record => ({
              id: record.id,
              date: formatDate(getTimestamp(record)),
              label: `Speaking Part ${record.part}`,
              question: preview(record.question),
              score: getSpeakingScore(record),
            }))}
          />

          <ScoreList
            title="Recent Writing Training Estimates"
            empty="No analyzed Writing attempts yet."
            records={recentWritingScores.map(record => ({
              id: record.id,
              date: formatDate(getTimestamp(record)),
              label: record.module === 'writing_task1'
                ? `Writing Task 1 / ${getTask1VisualType(record) || record.taskType}`
                : `Writing Task 2 / ${getWritingTask2Topic(record as WritingTask2PracticeRecord) || (record as WritingTask2PracticeRecord).questionData?.type || 'practice'}`,
              question: preview(record.question),
              score: record.module === 'writing_task1'
                ? getWritingTask1Score(record)
                : getWritingTask2Score(record as WritingTask2PracticeRecord),
            }))}
          />
        </div>

        <PaperCard>
          <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Suggested Training Plan</h3>
          {trainingSuggestions.length === 0 ? (
            <p className="text-sm text-paper-ink/55">No local practice records yet. Start with one Speaking attempt and one Writing Task 2 attempt.</p>
          ) : (
            <div className="space-y-3">
              {trainingSuggestions.map((suggestion, index) => (
                <div key={`${suggestion.title}-${index}`} className="border-l-2 border-l-accent-terracotta/40 pl-4 py-1">
                  <p className="text-base font-bold text-paper-ink leading-7">{suggestion.title}</p>
                  <p className="text-sm leading-7 text-paper-ink/65">{suggestion.reason}</p>
                </div>
              ))}
            </div>
          )}
        </PaperCard>

        <div className="grid xl:grid-cols-3 gap-8">
          <CoverageList title="Speaking Topic Coverage" coverage={speakingCoverage} />
          <CoverageList title="Writing Task 1 Visual Type Coverage" coverage={task1Coverage} />
          <CoverageList title="Writing Task 2 Topic Coverage" coverage={task2Coverage} />
        </div>

        <p className="text-xs text-paper-ink/50 text-center">
          Coverage is based on local preparation records and prompt metadata, not an official IELTS syllabus.
        </p>
      </div>
    </PageShell>
  );
}

interface ScoreListProps {
  title: string;
  empty: string;
  records: {
    id: string;
    date: string;
    label: string;
    question: string;
    score: number | null;
  }[];
}

const ScoreList: React.FC<ScoreListProps> = ({ title, empty, records }) => (
  <PaperCard>
    <h3 className="text-sm font-bold uppercase tracking-widest mb-5 border-b border-paper-ink/5 pb-2">
      {title}
    </h3>
    {records.length === 0 ? (
      <p className="text-sm text-paper-ink/55 py-8 text-center">{empty}</p>
    ) : (
      <div className="space-y-3">
        {records.map(record => (
          <div key={record.id} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center border-b border-paper-ink/5 pb-3 last:border-b-0 last:pb-0">
            <div>
              <p className="text-[10px] font-sans uppercase tracking-widest text-paper-ink/40 mb-1">
                {record.label} / {record.date}
              </p>
              <p className="text-sm leading-6 text-paper-ink/75">{record.question}</p>
            </div>
            <div className="text-2xl font-bold text-accent-terracotta">
              {formatBandEstimate(record.score)}
            </div>
          </div>
        ))}
      </div>
    )}
  </PaperCard>
);

interface CoverageListProps {
  title: string;
  coverage: { item: string; count: number }[];
}

const CoverageList: React.FC<CoverageListProps> = ({ title, coverage }) => (
  <PaperCard>
    <h3 className="text-sm font-bold uppercase tracking-widest mb-5 border-b border-paper-ink/5 pb-2">
      {title}
    </h3>
    <div className="grid sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2 gap-2">
      {coverage.map(item => (
        <div key={item.item} className="flex items-center justify-between gap-3 border border-paper-ink/10 bg-paper-ink/[0.02] px-3 py-2">
          <span className="text-sm text-paper-ink/75">{item.item}</span>
          <span className={item.count === 0
            ? 'text-[10px] font-sans uppercase tracking-widest text-paper-ink/35'
            : 'text-sm font-bold text-accent-terracotta'}
          >
            {item.count === 0 ? 'Not yet' : item.count}
          </span>
        </div>
      ))}
    </div>
  </PaperCard>
);
