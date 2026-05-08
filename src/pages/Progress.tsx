import React from 'react';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import {
  speakingPart1,
  speakingPart2,
  speakingPart3,
  speakingTopicCategories,
  writingTask2,
  writingTask2TopicCategories,
  SpeakingTopicCategory,
  WritingTask2TopicCategory,
} from '@/src/data/questions/bank';
import {
  getPracticeRecords,
  PracticeRecord,
  SpeakingPracticeRecord,
  WritingTask2PracticeRecord,
} from '@/src/lib/practiceRecords';

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

const formatBand = (value: number | null) =>
  value === null ? 'Not enough data' : value.toFixed(1);

const normalizeText = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

const getSpeakingScore = (record: SpeakingPracticeRecord) => {
  const score = record.feedback?.bandEstimateExcludingPronunciation;
  return isValidBand(score) ? score : null;
};

const getWritingScore = (record: WritingTask2PracticeRecord) => {
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

const isScoredSpeaking = (record: PracticeRecord): record is SpeakingPracticeRecord =>
  record.module === 'speaking' && record.status === 'analyzed' && getSpeakingScore(record as SpeakingPracticeRecord) !== null;

const isScoredWriting = (record: PracticeRecord): record is WritingTask2PracticeRecord =>
  record.module === 'writing' &&
  (record as WritingTask2PracticeRecord).task === 'task2' &&
  record.status === 'analyzed' &&
  getWritingScore(record as WritingTask2PracticeRecord) !== null;

const speakingBank = [...speakingPart1, ...speakingPart2, ...speakingPart3];

const speakingKeywordFallback: Record<SpeakingTopicCategory, string[]> = {
  'Work & Study': ['work', 'job', 'study', 'school', 'student', 'teacher', 'learn', 'skill', 'project', 'task'],
  'Home & Hometown': ['hometown', 'home', 'where you live'],
  'Family & People': ['family', 'friend', 'person', 'people', 'neighbor', 'children', 'adult'],
  'Daily Life': ['routine', 'evening', 'daily', 'day', 'change', 'decision'],
  'Hobbies & Free Time': ['music', 'sport', 'hobby', 'free time', 'enjoy'],
  'Books & Reading': ['book', 'read', 'e-book'],
  'Technology': ['technology', 'phone', 'app', 'device', 'online'],
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

const fromQuestionText = <T extends string>(
  text: string,
  fallback: Record<T, string[]>,
) => {
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

const getWritingTopic = (record: WritingTask2PracticeRecord): WritingTask2TopicCategory | null => {
  const metadataTopic = fromRecordMetadata(record, writingTask2TopicCategories);
  if (metadataTopic) return metadataTopic;

  const matched = writingTask2.find(question =>
    question.id === record.questionId || normalizeText(question.question) === normalizeText(record.question)
  );
  return matched?.topicCategory || fromQuestionText(record.question, writingKeywordFallback);
};

const countTopics = <T extends string>(
  topics: readonly T[],
  records: PracticeRecord[],
  resolveTopic: (record: PracticeRecord) => T | null,
) => topics.map(topic => ({
  topic,
  count: records.reduce((total, record) => total + (resolveTopic(record) === topic ? 1 : 0), 0),
}));

const pickUnderPracticed = <T extends string>(coverage: { topic: T; count: number }[]) =>
  [...coverage].sort((a, b) => a.count - b.count || a.topic.localeCompare(b.topic))[0];

export default function Progress() {
  const records = getPracticeRecords(80);
  const scoredSpeaking = records.filter(isScoredSpeaking);
  const scoredWriting = records.filter(isScoredWriting);
  const speakingEstimate = average(scoredSpeaking.map(record => getSpeakingScore(record)).filter(isValidBand));
  const writingEstimate = average(scoredWriting.map(record => getWritingScore(record)).filter(isValidBand));
  const latestRecord = records[0];
  const recentSpeakingScores = scoredSpeaking.slice(0, 6);
  const recentWritingScores = scoredWriting.slice(0, 6);
  const speakingRecords = records.filter(record => record.module === 'speaking');
  const writingRecords = records.filter(record =>
    record.module === 'writing' && (record as WritingTask2PracticeRecord).task === 'task2'
  );
  const speakingCoverage = countTopics(
    speakingTopicCategories,
    speakingRecords,
    record => getSpeakingTopic(record as SpeakingPracticeRecord),
  );
  const writingCoverage = countTopics(
    writingTask2TopicCategories,
    writingRecords,
    record => getWritingTopic(record as WritingTask2PracticeRecord),
  );
  const nextSpeaking = pickUnderPracticed(speakingCoverage);
  const nextWriting = pickUnderPracticed(writingCoverage);
  const unfinishedDrafts = records.filter(record => record.status === 'draft').length;

  return (
    <PageShell>
      <TopBar />

      <div className="mb-12 text-center max-w-2xl mx-auto">
        <h2 className="text-3xl mb-2">Your Training Snapshot</h2>
        <p className="text-sm italic text-paper-ink/60">
          Based on local practice records. Not a mock exam score.
        </p>
      </div>

      <div className="space-y-8">
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
          <PaperCard className="text-center py-8">
            <div className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-2">
              Speaking Estimate
            </div>
            <div className={speakingEstimate === null ? 'text-lg font-bold text-paper-ink/45 pt-2' : 'text-4xl font-bold text-accent-terracotta'}>
              {formatBand(speakingEstimate)}
            </div>
          </PaperCard>

          <PaperCard className="text-center py-8">
            <div className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-2">
              Writing Task 2 Estimate
            </div>
            <div className={writingEstimate === null ? 'text-lg font-bold text-paper-ink/45 pt-2' : 'text-4xl font-bold text-accent-terracotta'}>
              {formatBand(writingEstimate)}
            </div>
          </PaperCard>

          <PaperCard className="text-center py-8">
            <div className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-2">
              Analyzed Attempts
            </div>
            <div className="text-sm font-bold uppercase tracking-widest text-paper-ink pt-2 font-sans leading-7">
              Speaking {scoredSpeaking.length}
              <br />
              Writing {scoredWriting.length}
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
            title="Recent Speaking Scores"
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
            title="Recent Writing Task 2 Scores"
            empty="No analyzed Writing Task 2 attempts yet."
            records={recentWritingScores.map(record => ({
              id: record.id,
              date: formatDate(getTimestamp(record)),
              label: 'Writing Task 2',
              question: preview(record.question),
              score: getWritingScore(record),
            }))}
          />
        </div>

        <PaperCard>
          <h3 className="text-sm font-bold uppercase tracking-widest mb-3">Recommended Next Focus</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm leading-7 text-paper-ink/75">
            <p>
              Speaking: try <span className="font-bold text-paper-ink">{nextSpeaking.topic}</span>
              {nextSpeaking.count > 0 ? ' again; it is still one of your lighter areas.' : ' first; no local attempts are recorded yet.'}
            </p>
            <p>
              Writing Task 2: try <span className="font-bold text-paper-ink">{nextWriting.topic}</span>
              {nextWriting.count > 0 ? ' again; it is still one of your lighter areas.' : ' first; no local attempts are recorded yet.'}
            </p>
          </div>
          {unfinishedDrafts > 0 && (
            <p className="mt-4 text-xs italic text-paper-ink/45">
              You also have {unfinishedDrafts} unfinished draft{unfinishedDrafts === 1 ? '' : 's'} saved locally.
            </p>
          )}
        </PaperCard>

        <div className="grid lg:grid-cols-2 gap-8">
          <TopicCoverage title="Speaking Topic Coverage" coverage={speakingCoverage} />
          <TopicCoverage title="Writing Task 2 Topic Coverage" coverage={writingCoverage} />
        </div>

        <p className="text-xs italic text-paper-ink/45 text-center">
          Topic coverage is based on IELTS preparation categories, not an official exam syllabus.
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
      <p className="text-sm italic text-paper-ink/45 py-8 text-center">{empty}</p>
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
              {record.score === null ? '-' : record.score.toFixed(1)}
            </div>
          </div>
        ))}
      </div>
    )}
  </PaperCard>
);

interface TopicCoverageProps {
  title: string;
  coverage: { topic: string; count: number }[];
}

const TopicCoverage: React.FC<TopicCoverageProps> = ({ title, coverage }) => (
  <PaperCard>
    <h3 className="text-sm font-bold uppercase tracking-widest mb-5 border-b border-paper-ink/5 pb-2">
      {title}
    </h3>
    <div className="grid sm:grid-cols-2 gap-2">
      {coverage.map(item => (
        <div key={item.topic} className="flex items-center justify-between gap-3 border border-paper-ink/10 bg-paper-ink/[0.02] px-3 py-2">
          <span className="text-sm text-paper-ink/75">{item.topic}</span>
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
