import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { SerifButton } from '@/src/components/ui/SerifButton';
import {
  getActiveSpeakingSession,
  getPracticeRecords,
  deleteActiveWritingTask1,
  deleteActiveWritingTask2,
  deletePracticeRecord,
  saveActiveSpeakingSession,
  saveActiveWritingTask1,
  saveActiveWritingTask2,
  SpeakingPracticeRecord,
  WritingTask1PracticeRecord,
  WritingTask2PracticeRecord,
} from '@/src/lib/practiceRecords';
import { ArrowRight, History } from 'lucide-react';

const getTimestamp = (record: SpeakingPracticeRecord | WritingTask2PracticeRecord | WritingTask1PracticeRecord) =>
  record.analyzedAt || record.updatedAt || record.createdAt;

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const preview = (value: string | undefined, fallback = 'No preview available.') => {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;
  return normalized.length > 180 ? `${normalized.slice(0, 180)}...` : normalized;
};

const getWritingPreview = (record: WritingTask2PracticeRecord) =>
  preview(record.essay || record.finalFrameworkSummary || record.frameworkInput || record.frameworkChat.find(item => item.role === 'user')?.text);

const getWritingTask1Preview = (record: WritingTask1PracticeRecord) =>
  preview(record.report || record.quickPlan?.overview || record.quickPlan?.keyFeatures);

export default function PracticeHistory() {
  const navigate = useNavigate();
  const [records, setRecords] = useState(() => getPracticeRecords(80));
  const speakingAttempts = records.filter((record): record is SpeakingPracticeRecord => record.module === 'speaking');
  const writingAttempts = records.filter((record): record is WritingTask2PracticeRecord =>
    record.module === 'writing' && record.task === 'task2'
  );
  const writingTask1Attempts = records.filter((record): record is WritingTask1PracticeRecord =>
    record.module === 'writing_task1' && record.task === 'task1'
  );

  const refreshRecords = () => {
    setRecords(getPracticeRecords(80));
  };

  const openSpeakingAttempt = (record: SpeakingPracticeRecord) => {
    const active = getActiveSpeakingSession();
    saveActiveSpeakingSession({
      id: active?.id || `history_speaking_${Date.now()}`,
      currentPart: record.part,
      attemptsByPart: {
        ...(active?.attemptsByPart || {}),
        [record.part]: record,
      },
      updatedAt: new Date().toISOString(),
    });
    navigate('/speaking/practice');
  };

  const openWritingAttempt = (record: WritingTask2PracticeRecord) => {
    saveActiveWritingTask2(record);
    navigate('/writing/task2/practice');
  };

  const openWritingTask1Attempt = (record: WritingTask1PracticeRecord) => {
    saveActiveWritingTask1(record);
    navigate('/writing/task1');
  };

  const deleteSpeakingAttempt = (record: SpeakingPracticeRecord) => {
    const confirmed = window.confirm('Delete this attempt? This cannot be undone.');
    if (!confirmed) return;

    deletePracticeRecord(record.id, 'speaking');
    const active = getActiveSpeakingSession();
    if (active?.attemptsByPart[record.part]?.id === record.id) {
      saveActiveSpeakingSession({
        ...active,
        attemptsByPart: {
          ...active.attemptsByPart,
          [record.part]: undefined,
        },
        updatedAt: new Date().toISOString(),
      });
    }
    refreshRecords();
  };

  const deleteWritingAttempt = (record: WritingTask2PracticeRecord) => {
    const confirmed = window.confirm('Delete this attempt? This cannot be undone.');
    if (!confirmed) return;

    deletePracticeRecord(record.id, 'writing');
    deleteActiveWritingTask2(record.id);
    refreshRecords();
  };

  const deleteWritingTask1Attempt = (record: WritingTask1PracticeRecord) => {
    const confirmed = window.confirm('Delete this attempt? This cannot be undone.');
    if (!confirmed) return;

    deletePracticeRecord(record.id, 'writing_task1');
    deleteActiveWritingTask1(record.id);
    refreshRecords();
  };

  return (
    <PageShell size="wide">
      <TopBar />

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-accent-terracotta/10 text-accent-terracotta rounded">
            <History className="w-5 h-5" />
          </div>
          <h1 className="text-3xl text-paper-ink">Practice History</h1>
        </div>
      </div>

      <div className="grid xl:grid-cols-3 gap-8">
        <section>
          <h2 className="text-xl font-serif mb-4">Speaking Attempts</h2>
          <div className="space-y-4">
            {speakingAttempts.length === 0 ? (
              <PaperCard className="text-sm italic text-paper-ink/50">No saved attempts yet.</PaperCard>
            ) : speakingAttempts.map(record => (
              <PaperCard key={record.id} className="hover:border-accent-terracotta/25 transition-colors">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-1">
                      Part {record.part} / {record.status}
                    </div>
                    <h3 className="text-lg leading-snug">{preview(record.question, 'Saved Speaking question')}</h3>
                  </div>
                  <div className="text-xs text-paper-ink/40 font-sans whitespace-nowrap">
                    {formatTimestamp(getTimestamp(record))}
                  </div>
                </div>
                <p className="text-sm text-paper-ink/60 italic mb-4">
                  {preview(record.transcript, 'No transcript saved yet.')}
                </p>
                <div className="flex flex-wrap gap-2">
                  <SerifButton
                    type="button"
                    variant="outline"
                    className="text-xs flex items-center gap-2"
                    onClick={() => openSpeakingAttempt(record)}
                  >
                    Open / Restore <ArrowRight className="w-3 h-3" />
                  </SerifButton>
                  <SerifButton
                    type="button"
                    variant="outline"
                    className="text-xs border-red-800/30 text-red-800 hover:bg-red-50"
                    onClick={() => deleteSpeakingAttempt(record)}
                  >
                    Delete
                  </SerifButton>
                </div>
              </PaperCard>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-serif mb-4">Writing Task 1 Attempts</h2>
          <div className="space-y-4">
            {writingTask1Attempts.length === 0 ? (
              <PaperCard className="text-sm italic text-paper-ink/50">No saved attempts yet.</PaperCard>
            ) : writingTask1Attempts.map(record => (
              <PaperCard key={record.id} className="hover:border-accent-terracotta/25 transition-colors">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-1">
                      {record.taskType} / {record.status}
                    </div>
                    <h3 className="text-lg leading-snug">{preview(record.instruction, 'Saved Writing Task 1 prompt')}</h3>
                  </div>
                  <div className="text-xs text-paper-ink/40 font-sans whitespace-nowrap">
                    {formatTimestamp(getTimestamp(record))}
                  </div>
                </div>
                <p className="text-sm text-paper-ink/60 italic mb-4">
                  {getWritingTask1Preview(record)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <SerifButton
                    type="button"
                    variant="outline"
                    className="text-xs flex items-center gap-2"
                    onClick={() => openWritingTask1Attempt(record)}
                  >
                    Open / Restore <ArrowRight className="w-3 h-3" />
                  </SerifButton>
                  <SerifButton
                    type="button"
                    variant="outline"
                    className="text-xs border-red-800/30 text-red-800 hover:bg-red-50"
                    onClick={() => deleteWritingTask1Attempt(record)}
                  >
                    Delete
                  </SerifButton>
                </div>
              </PaperCard>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-serif mb-4">Writing Task 2 Attempts</h2>
          <div className="space-y-4">
            {writingAttempts.length === 0 ? (
              <PaperCard className="text-sm italic text-paper-ink/50">No saved attempts yet.</PaperCard>
            ) : writingAttempts.map(record => (
              <PaperCard key={record.id} className="hover:border-accent-terracotta/25 transition-colors">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-1">
                      Task 2 / {record.status}
                    </div>
                    <h3 className="text-lg leading-snug">{preview(record.question, 'Saved Writing Task 2 prompt')}</h3>
                  </div>
                  <div className="text-xs text-paper-ink/40 font-sans whitespace-nowrap">
                    {formatTimestamp(getTimestamp(record))}
                  </div>
                </div>
                <p className="text-sm text-paper-ink/60 italic mb-4">
                  {getWritingPreview(record)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <SerifButton
                    type="button"
                    variant="outline"
                    className="text-xs flex items-center gap-2"
                    onClick={() => openWritingAttempt(record)}
                  >
                    Open / Restore <ArrowRight className="w-3 h-3" />
                  </SerifButton>
                  <SerifButton
                    type="button"
                    variant="outline"
                    className="text-xs border-red-800/30 text-red-800 hover:bg-red-50"
                    onClick={() => deleteWritingAttempt(record)}
                  >
                    Delete
                  </SerifButton>
                </div>
              </PaperCard>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
