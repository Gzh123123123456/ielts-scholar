import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Download,
  ExternalLink,
  History,
  RefreshCw,
  X,
} from 'lucide-react';
import type {
  PracticeRecord,
  SpeakingPracticeRecord,
  WritingTask1PracticeRecord,
  WritingTask2PracticeRecord,
} from '@/src/lib/practiceRecords';
import {
  downloadBackupFile,
  exportCompleteLocalBackup,
  getActiveSpeakingSession,
  getStorageHealth,
  initializePracticeRepository,
  isRepositoryReady,
  listPracticeRecords,
  saveActiveSpeakingSession,
  saveActiveWritingTask1,
  saveActiveWritingTask2,
} from '@/src/lib/practiceRepository';

type HistoryFilter = 'all' | 'speaking' | 'task1' | 'task2';

const getTimestamp = (record: PracticeRecord) =>
  record.analyzedAt || record.updatedAt || record.createdAt;

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const preview = (value: string | undefined, fallback = 'No preview available.') => {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;
  return normalized.length > 120 ? `${normalized.slice(0, 120)}...` : normalized;
};

const recordTitle = (record: PracticeRecord) => {
  if (record.module === 'speaking') {
    return record.sessionKind === 'part1_topic_thread'
      ? record.topic || record.feedback?.topic || 'Part 1 Topic Thread'
      : preview(record.question, 'Saved Speaking question');
  }
  if (record.module === 'writing_task1') {
    return preview(record.instruction, 'Saved Writing Task 1 prompt');
  }
  return preview(record.question, 'Saved Writing Task 2 prompt');
};

const recordMeta = (record: PracticeRecord) => {
  if (record.module === 'speaking') {
    return record.sessionKind === 'part1_topic_thread'
      ? `Part 1 topic thread / ${record.status}`
      : `Speaking Part ${record.part} / ${record.status}`;
  }
  if (record.module === 'writing_task1') {
    return `Writing Task 1 / ${record.status}`;
  }
  return `Writing Task 2 / ${record.status}`;
};

const recordBodyPreview = (record: PracticeRecord) => {
  if (record.module === 'speaking') {
    return record.sessionKind === 'part1_topic_thread'
      ? preview(record.threadAnswers?.map((answer, index) => `Q${index + 1}: ${answer.transcript}`).join(' ') || record.transcript)
      : preview(record.transcript, 'No transcript saved yet.');
  }
  if (record.module === 'writing_task1') {
    return preview(record.report || record.quickPlan?.overview || record.quickPlan?.keyFeatures);
  }
  return preview(
    record.essay ||
      record.finalFrameworkSummary ||
      record.frameworkInput ||
      record.frameworkChat.find(item => item.role === 'user')?.text,
  );
};

const matchesFilter = (record: PracticeRecord, filter: HistoryFilter) => {
  if (filter === 'all') return true;
  if (filter === 'speaking') return record.module === 'speaking';
  if (filter === 'task1') return record.module === 'writing_task1';
  return record.module === 'writing' && record.task === 'task2';
};

const sortByRecent = (records: PracticeRecord[]) =>
  [...records].sort((a, b) => getTimestamp(b).localeCompare(getTimestamp(a)));

export const HistoryPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [storageSummary, setStorageSummary] = useState<{ records: number; legacy: number; mb: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const loadHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const report = await initializePracticeRepository();
      let nextRecords: PracticeRecord[] = [];
      if (report.status === 'completed' && isRepositoryReady()) {
        nextRecords = await listPracticeRecords();
        try {
          const health = await getStorageHealth();
          setStorageSummary({
            records: health.indexedDb.practiceRecords,
            legacy: health.indexedDb.legacySessionsArchive,
            mb: health.localStorage.totalMB,
          });
        } catch {
          setStorageSummary(null);
        }
      } else {
        const { getAllPracticeRecords } = await import('@/src/lib/practiceRecords');
        nextRecords = getAllPracticeRecords();
        setStorageSummary(null);
      }
      setRecords(sortByRecent(nextRecords));
    } catch (loadError) {
      try {
        const { getAllPracticeRecords } = await import('@/src/lib/practiceRecords');
        setRecords(sortByRecent(getAllPracticeRecords()));
      } catch {
        setError(loadError instanceof Error ? loadError.message : 'History failed to load.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadHistory();
  }, [isOpen]);

  const counts = useMemo(() => ({
    all: records.length,
    speaking: records.filter(record => record.module === 'speaking').length,
    task1: records.filter(record => record.module === 'writing_task1').length,
    task2: records.filter(record => record.module === 'writing' && record.task === 'task2').length,
  }), [records]);

  const filteredRecords = useMemo(
    () => records.filter(record => matchesFilter(record, filter)),
    [records, filter],
  );
  const visibleRecords = useMemo(
    () => filteredRecords.slice(0, 24),
    [filteredRecords],
  );

  const restoreRecord = async (record: PracticeRecord) => {
    setError(null);
    if (record.module === 'speaking') {
      const speakingRecord = record as SpeakingPracticeRecord;
      const active = await getActiveSpeakingSession();
      const result = await saveActiveSpeakingSession({
        id: active?.id || `history_speaking_${Date.now()}`,
        currentPart: speakingRecord.part,
        attemptsByPart: {
          ...(active?.attemptsByPart || {}),
          [speakingRecord.part]: speakingRecord,
        },
        updatedAt: new Date().toISOString(),
      });
      if (!result.ok) {
        setError(result.message || 'Unable to restore this Speaking attempt.');
        return;
      }
      setIsOpen(false);
      navigate('/speaking/practice', { state: { restoreSpeakingRecordId: speakingRecord.id } });
      return;
    }

    if (record.module === 'writing_task1') {
      const result = await saveActiveWritingTask1(record as WritingTask1PracticeRecord);
      if (!result.ok) {
        setError(result.message || 'Unable to restore this Task 1 attempt.');
        return;
      }
      setIsOpen(false);
      navigate('/writing/task1');
      return;
    }

    const result = await saveActiveWritingTask2(record as WritingTask2PracticeRecord);
    if (!result.ok) {
      setError(result.message || 'Unable to restore this Task 2 attempt.');
      return;
    }
    setIsOpen(false);
    navigate('/writing/task2/practice');
  };

  const exportBackup = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const payload = await exportCompleteLocalBackup();
      downloadBackupFile(payload);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Backup export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-20 p-2 bg-paper-ink/5 hover:bg-paper-ink/10 rounded-full transition-colors z-50 text-paper-ink/30 notranslate"
        translate="no"
        title="Open Practice History"
      >
        <History className="w-3 h-3" />
      </button>
    );
  }

  return (
    <div className="fixed inset-y-0 left-0 w-[22rem] max-w-[calc(100vw-1rem)] bg-paper-50 border-r border-paper-ink/20 shadow-2xl z-50 flex flex-col font-sans text-xs notranslate" translate="no">
      <div className="p-3 border-b border-paper-ink/10 flex justify-between items-center bg-paper-200">
        <div>
          <h3 className="font-bold uppercase tracking-widest text-accent-terracotta">Practice History</h3>
          <p className="mt-1 text-[10px] text-paper-ink/45">
            {isLoading ? 'Loading...' : `${counts.all} records`}
            {storageSummary && ` / ${storageSummary.legacy} legacy / ${storageSummary.mb} MB`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadHistory}
            className="p-1 text-paper-ink/45 hover:text-accent-terracotta"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1 hover:text-accent-terracotta"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="border-b border-paper-ink/10 p-3 space-y-3">
        <div className="grid grid-cols-4 gap-1">
          {[
            ['all', 'All', counts.all],
            ['speaking', 'S', counts.speaking],
            ['task1', 'T1', counts.task1],
            ['task2', 'T2', counts.task2],
          ].map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value as HistoryFilter)}
              className={`rounded border px-2 py-1 text-[11px] transition-colors ${
                filter === value
                  ? 'border-accent-terracotta bg-accent-terracotta/10 text-accent-terracotta'
                  : 'border-paper-ink/10 bg-paper-100 text-paper-ink/55 hover:text-paper-ink'
              }`}
            >
              <span className="font-bold">{label}</span>
              <span className="ml-1 font-mono">{count}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={exportBackup}
            disabled={isExporting}
            className="flex items-center justify-center gap-1 rounded border border-paper-ink/15 bg-paper-50 px-2 py-1.5 text-[11px] text-paper-ink/65 hover:border-accent-terracotta/40 hover:text-accent-terracotta disabled:opacity-50"
          >
            <Download className="w-3 h-3" />
            {isExporting ? 'Exporting' : 'Backup'}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              if (location.pathname !== '/practice-history') navigate('/practice-history');
            }}
            className="flex items-center justify-center gap-1 rounded border border-paper-ink/15 bg-paper-50 px-2 py-1.5 text-[11px] text-paper-ink/65 hover:border-accent-terracotta/40 hover:text-accent-terracotta"
          >
            <ExternalLink className="w-3 h-3" />
            Advanced
          </button>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-[11px] leading-5 text-red-800 flex gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto divide-y divide-paper-ink/10">
        {isLoading && records.length === 0 ? (
          <div className="p-4 space-y-3">
            {[0, 1, 2].map(item => (
              <div key={item} className="h-20 rounded border border-paper-ink/10 bg-paper-100 animate-pulse" />
            ))}
          </div>
        ) : visibleRecords.length === 0 ? (
          <div className="p-5 text-center text-paper-ink/45">
            No saved attempts here yet.
          </div>
        ) : (
          visibleRecords.map(record => (
            <article key={record.id} className="p-3 hover:bg-paper-100/70 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-paper-ink/35">
                    {recordMeta(record)}
                  </div>
                  <h4 className="mt-1 font-serif text-sm leading-snug text-paper-ink line-clamp-2">
                    {recordTitle(record)}
                  </h4>
                </div>
                <time className="flex-shrink-0 whitespace-nowrap font-mono text-[10px] text-paper-ink/35">
                  {formatTimestamp(getTimestamp(record))}
                </time>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-paper-ink/55 line-clamp-2">
                {recordBodyPreview(record)}
              </p>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => restoreRecord(record)}
                  className="inline-flex items-center gap-1 rounded border border-accent-terracotta/35 px-2 py-1 text-[11px] text-accent-terracotta hover:bg-accent-terracotta/10"
                >
                  Restore <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {filteredRecords.length > visibleRecords.length && (
        <div className="border-t border-paper-ink/10 px-3 py-2 text-[10px] text-paper-ink/40">
          Showing {visibleRecords.length} of {filteredRecords.length}. Use Advanced for the full archive.
        </div>
      )}
    </div>
  );
};
