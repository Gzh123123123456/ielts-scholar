import React from 'react';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
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

export default function Progress() {
  const records = getPracticeRecords(80);
  const scoredSpeaking = records.filter(isScoredSpeaking);
  const scoredWriting = records.filter(isScoredWriting);
  const speakingEstimate = average(scoredSpeaking.map(record => getSpeakingScore(record)).filter(isValidBand));
  const writingEstimate = average(scoredWriting.map(record => getWritingScore(record)).filter(isValidBand));
  const latestRecord = records[0];
  const recentRecords = records.slice(0, 6);
  const recentSpeakingScores = scoredSpeaking.slice(0, 6);
  const recentWritingScores = scoredWriting.slice(0, 6);

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

        <section>
          <h3 className="text-xl font-serif mb-4 ml-1">Recent Practice Records</h3>
          {recentRecords.length === 0 ? (
            <PaperCard className="text-center py-12 bg-paper-ink/5 border-dashed">
              <p className="text-paper-ink/40 italic">No records yet.</p>
            </PaperCard>
          ) : (
            <div className="space-y-3">
              {recentRecords.map(record => (
                <PaperCard key={record.id} className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-1">
                        {record.module === 'speaking'
                          ? `Speaking Part ${(record as SpeakingPracticeRecord).part}`
                          : 'Writing Task 2'} / {record.status}
                      </div>
                      <div className="text-sm font-semibold text-paper-ink leading-6">{preview(record.question)}</div>
                    </div>
                    <div className="text-xs text-paper-ink/40 font-sans whitespace-nowrap">
                      {formatDate(getTimestamp(record))}
                    </div>
                  </div>
                </PaperCard>
              ))}
            </div>
          )}
        </section>
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
