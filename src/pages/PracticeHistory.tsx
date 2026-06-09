import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { SerifButton } from '@/src/components/ui/SerifButton';
import {
  SpeakingPracticeRecord,
  WritingTask1PracticeRecord,
  WritingTask2PracticeRecord,
  PracticeRecord,
} from '@/src/lib/practiceRecords';
import {
  initializePracticeRepository,
  listPracticeRecords,
  deletePracticeRecord,
  saveActiveSpeakingSession,
  saveActiveWritingTask1,
  saveActiveWritingTask2,
  deleteActiveWritingTask1,
  deleteActiveWritingTask2,
  getActiveSpeakingSession,
  exportCompleteLocalBackup,
  downloadBackupFile,
  isRepositoryReady,
} from '@/src/lib/practiceRepository';
import { ArrowRight, History, AlertTriangle, Download } from 'lucide-react';

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

const speakingHistoryTitle = (record: SpeakingPracticeRecord) =>
  record.sessionKind === 'part1_topic_thread'
    ? record.topic || record.feedback?.topic || 'Part 1 Topic Thread'
    : preview(record.question, 'Saved Speaking question');

const speakingHistoryMeta = (record: SpeakingPracticeRecord) =>
  record.sessionKind === 'part1_topic_thread'
    ? `PART 1 · TOPIC THREAD · ${record.status}${record.threadAnswers?.length ? ` · ${record.threadAnswers.length} questions completed` : ''}`
    : `Part ${record.part} / ${record.status}`;

const speakingHistoryPreview = (record: SpeakingPracticeRecord) =>
  record.sessionKind === 'part1_topic_thread'
    ? preview(record.threadAnswers?.map((answer, index) => `Q${index + 1}: ${answer.transcript}`).join(' ') || record.transcript, 'No transcript saved yet.')
    : preview(record.transcript, 'No transcript saved yet.');

const STORAGE_FULL_MESSAGE = '本地存储空间已满，暂时无法打开这条历史记录。你的历史记录仍保留在本机，请先导出备份并清理存储空间后再试。';

type HistoryModuleFilter = 'all' | 'speaking' | 'writing_task1' | 'writing';
type SpeakingPartFilter = 'all' | 1 | 2 | 3;

const RECORDS_PER_PAGE = 10;

const getRecordModuleFilter = (record: PracticeRecord): HistoryModuleFilter =>
  record.module === 'writing' ? 'writing' : record.module;

const getRecordTitle = (record: PracticeRecord) => {
  if (record.module === 'speaking') return speakingHistoryTitle(record);
  if (record.module === 'writing_task1') return preview(record.instruction, 'Saved Writing Task 1 prompt');
  return preview(record.question, 'Saved Writing Task 2 prompt');
};

const getRecordMeta = (record: PracticeRecord) => {
  if (record.module === 'speaking') return speakingHistoryMeta(record);
  if (record.module === 'writing_task1') return `${record.taskType} / ${record.status}`;
  return `Task 2 / ${record.status}`;
};

const getRecordPreview = (record: PracticeRecord) => {
  if (record.module === 'speaking') return speakingHistoryPreview(record);
  if (record.module === 'writing_task1') return getWritingTask1Preview(record);
  return getWritingPreview(record);
};

export default function PracticeHistory() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState<HistoryModuleFilter>('all');
  const [speakingPartFilter, setSpeakingPartFilter] = useState<SpeakingPartFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const report = await initializePracticeRepository();
        const completed = report.status === 'completed' && isRepositoryReady();
        if (completed) {
          const allRecords = await listPracticeRecords();
          setRecords(allRecords);
        } else {
          const { getAllPracticeRecords } = await import('@/src/lib/practiceRecords');
          const fallbackRecords = getAllPracticeRecords();
          setRecords(fallbackRecords);
        }
      } catch (err) {
        console.error('[ielts] History init failed:', err);
        try {
          const { getAllPracticeRecords } = await import('@/src/lib/practiceRecords');
          setRecords(getAllPracticeRecords());
        } catch {}
      } finally {
        setRecordsLoaded(true);
      }
    })();
  }, []);
  const speakingAttempts = records.filter((record): record is SpeakingPracticeRecord => record.module === 'speaking');
  const writingAttempts = records.filter((record): record is WritingTask2PracticeRecord =>
    record.module === 'writing' && record.task === 'task2'
  );
  const writingTask1Attempts = records.filter((record): record is WritingTask1PracticeRecord =>
    record.module === 'writing_task1' && record.task === 'task1'
  );
  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => getTimestamp(b).localeCompare(getTimestamp(a))),
    [records],
  );
  const filteredRecords = useMemo(
    () => sortedRecords.filter(record => {
      if (moduleFilter !== 'all' && getRecordModuleFilter(record) !== moduleFilter) return false;
      if (
        moduleFilter === 'speaking' &&
        speakingPartFilter !== 'all' &&
        record.module === 'speaking' &&
        record.part !== speakingPartFilter
      ) {
        return false;
      }
      return true;
    }),
    [moduleFilter, sortedRecords, speakingPartFilter],
  );
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / RECORDS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * RECORDS_PER_PAGE;
  const pageEndIndex = Math.min(pageStartIndex + RECORDS_PER_PAGE, filteredRecords.length);
  const visibleRecords = filteredRecords.slice(pageStartIndex, pageEndIndex);
  const moduleFilters: { value: HistoryModuleFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: records.length },
    { value: 'speaking', label: 'Speaking', count: speakingAttempts.length },
    { value: 'writing_task1', label: 'Task 1', count: writingTask1Attempts.length },
    { value: 'writing', label: 'Task 2', count: writingAttempts.length },
  ];
  const speakingPartFilters: { value: SpeakingPartFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All Parts', count: speakingAttempts.length },
    { value: 1, label: 'Part 1', count: speakingAttempts.filter(record => record.part === 1).length },
    { value: 2, label: 'Part 2', count: speakingAttempts.filter(record => record.part === 2).length },
    { value: 3, label: 'Part 3', count: speakingAttempts.filter(record => record.part === 3).length },
  ];
  const paginationPages = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, safeCurrentPage - 2);
    const end = Math.min(totalPages, safeCurrentPage + 2);
    if (start > 1) pages.push(1);
    if (start > 2) pages.push(-1);
    for (let page = start; page <= end; page += 1) pages.push(page);
    if (end < totalPages - 1) pages.push(-2);
    if (end < totalPages) pages.push(totalPages);
    return pages;
  }, [safeCurrentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [moduleFilter, speakingPartFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const refreshRecords = async () => {
    const allRecords = await listPracticeRecords();
    setRecords(allRecords);
  };

  const openSpeakingAttempt = async (record: SpeakingPracticeRecord) => {
    setStorageError(null);
    const active = await getActiveSpeakingSession();
    const result = await saveActiveSpeakingSession({
      id: active?.id || `history_speaking_${Date.now()}`,
      currentPart: record.part,
      attemptsByPart: {
        ...(active?.attemptsByPart || {}),
        [record.part]: record,
      },
      updatedAt: new Date().toISOString(),
    });
    if (!result.ok) {
      setStorageError(STORAGE_FULL_MESSAGE);
      return;
    }
    navigate('/speaking/practice', { state: { restoreSpeakingRecordId: record.id } });
  };

  const openWritingAttempt = async (record: WritingTask2PracticeRecord) => {
    setStorageError(null);
    const result = await saveActiveWritingTask2(record);
    if (!result.ok) {
      setStorageError(STORAGE_FULL_MESSAGE);
      return;
    }
    navigate('/writing/task2/practice');
  };

  const openWritingTask1Attempt = async (record: WritingTask1PracticeRecord) => {
    setStorageError(null);
    const result = await saveActiveWritingTask1(record);
    if (!result.ok) {
      setStorageError(STORAGE_FULL_MESSAGE);
      return;
    }
    navigate('/writing/task1');
  };

  const deleteSpeakingAttempt = async (record: SpeakingPracticeRecord) => {
    const confirmed = window.confirm('Delete this attempt? This cannot be undone.');
    if (!confirmed) return;

    await deletePracticeRecord(record.id, 'speaking');
    const active = await getActiveSpeakingSession();
    if (active?.attemptsByPart[record.part]?.id === record.id) {
      await saveActiveSpeakingSession({
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

  const deleteWritingAttempt = async (record: WritingTask2PracticeRecord) => {
    const confirmed = window.confirm('Delete this attempt? This cannot be undone.');
    if (!confirmed) return;

    await deletePracticeRecord(record.id, 'writing');
    await deleteActiveWritingTask2(record.id);
    refreshRecords();
  };

  const deleteWritingTask1Attempt = async (record: WritingTask1PracticeRecord) => {
    const confirmed = window.confirm('Delete this attempt? This cannot be undone.');
    if (!confirmed) return;

    await deletePracticeRecord(record.id, 'writing_task1');
    await deleteActiveWritingTask1(record.id);
    refreshRecords();
  };

  const openRecord = (record: PracticeRecord) => {
    if (record.module === 'speaking') {
      openSpeakingAttempt(record);
    } else if (record.module === 'writing_task1') {
      openWritingTask1Attempt(record);
    } else {
      openWritingAttempt(record);
    }
  };

  const deleteRecord = (record: PracticeRecord) => {
    if (record.module === 'speaking') {
      deleteSpeakingAttempt(record);
    } else if (record.module === 'writing_task1') {
      deleteWritingTask1Attempt(record);
    } else {
      deleteWritingAttempt(record);
    }
  };

  const handleExport = async () => {
    try {
      const payload = await exportCompleteLocalBackup();
      downloadBackupFile(payload);
    } catch (err) {
      setStorageError('导出备份失败，请重试。');
    }
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

      {storageError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-700 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-red-800 mb-1">存储空间不足</div>
            <div className="text-sm text-red-700 leading-6">{storageError}</div>
            <div className="flex flex-wrap gap-2 mt-2">
              <SerifButton
                type="button"
                variant="outline"
                className="text-xs border-red-300 text-red-700 hover:bg-red-100"
                onClick={() => { handleExport(); setStorageError(null); }}
              >
                <Download className="w-3 h-3 mr-1" /> 导出本地数据备份
              </SerifButton>
              <SerifButton
                type="button"
                variant="outline"
                className="text-xs"
                onClick={() => setStorageError(null)}
              >
                Dismiss
              </SerifButton>
            </div>
          </div>
        </div>
      )}

      {!recordsLoaded && (
        <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-paper-ink/55">
          正在加载练习记录...
        </div>
      )}

      <section className="max-w-6xl mx-auto">
        <div className="mb-5 border-y border-paper-ink/10 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-serif text-xl text-paper-ink">Attempts</h2>
              <p className="mt-1 text-sm text-paper-ink/50">
                {filteredRecords.length === 0
                  ? 'No matching records'
                  : `Showing ${pageStartIndex + 1}-${pageEndIndex} of ${filteredRecords.length} records`}
                {filteredRecords.length > 0 && ` | Page ${safeCurrentPage} of ${totalPages}`}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
              {moduleFilters.map(item => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setModuleFilter(item.value);
                    if (item.value !== 'speaking') setSpeakingPartFilter('all');
                  }}
                  className={`rounded border px-3 py-2 text-left transition-colors ${
                    moduleFilter === item.value
                      ? 'border-accent-terracotta bg-accent-terracotta/10 text-accent-terracotta'
                      : 'border-paper-ink/10 bg-paper-50 text-paper-ink/60 hover:border-paper-ink/25 hover:text-paper-ink'
                  }`}
                >
                  <span className="block text-[10px] font-sans font-bold uppercase tracking-widest">{item.label}</span>
                  <span className="font-mono text-xs">{item.count}</span>
                </button>
              ))}
            </div>
          </div>

          {moduleFilter === 'speaking' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {speakingPartFilters.map(item => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setSpeakingPartFilter(item.value)}
                  className={`rounded border px-3 py-1.5 text-xs transition-colors ${
                    speakingPartFilter === item.value
                      ? 'border-paper-ink/60 bg-paper-ink/5 text-paper-ink'
                      : 'border-paper-ink/10 text-paper-ink/50 hover:text-paper-ink'
                  }`}
                >
                  {item.label} <span className="font-mono text-paper-ink/40">{item.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {visibleRecords.length === 0 ? (
            <PaperCard className="text-sm text-paper-ink/55 md:col-span-2">
              No saved attempts match this filter.
            </PaperCard>
          ) : visibleRecords.map(record => (
            <PaperCard key={record.id} className="p-5 h-full flex flex-col hover:border-accent-terracotta/25 transition-colors">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-1">
                    {getRecordMeta(record)}
                  </div>
                  <h3 className="text-lg leading-snug">{getRecordTitle(record)}</h3>
                </div>
                <div className="text-xs text-paper-ink/40 font-sans whitespace-nowrap">
                  {formatTimestamp(getTimestamp(record))}
                </div>
              </div>
              <p className="mt-3 flex-1 text-sm text-paper-ink/65 leading-7">
                {getRecordPreview(record)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <SerifButton
                  type="button"
                  variant="outline"
                  className="text-xs flex items-center gap-2"
                  onClick={() => openRecord(record)}
                  title="打开这条历史记录对应的练习页面"
                >
                  查看 <ArrowRight className="w-3 h-3" />
                </SerifButton>
                <SerifButton
                  type="button"
                  variant="outline"
                  className="text-xs"
                  onClick={() => deleteRecord(record)}
                >
                  删除
                </SerifButton>
              </div>
            </PaperCard>
          ))}
        </div>

        {filteredRecords.length > RECORDS_PER_PAGE && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <SerifButton
              type="button"
              variant="outline"
              className="text-xs"
              onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
              disabled={safeCurrentPage === 1}
            >
              Previous
            </SerifButton>
            {paginationPages.map((page, index) => (
              page < 0 ? (
                <span key={`ellipsis-${index}`} className="px-2 text-xs text-paper-ink/35">...</span>
              ) : (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`h-8 min-w-8 rounded border px-2 text-xs transition-colors ${
                    page === safeCurrentPage
                      ? 'border-accent-terracotta bg-accent-terracotta/10 text-accent-terracotta'
                      : 'border-paper-ink/10 bg-paper-50 text-paper-ink/55 hover:border-paper-ink/25 hover:text-paper-ink'
                  }`}
                >
                  {page}
                </button>
              )
            ))}
            <SerifButton
              type="button"
              variant="outline"
              className="text-xs"
              onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
              disabled={safeCurrentPage === totalPages}
            >
              Next
            </SerifButton>
          </div>
        )}
      </section>
    </PageShell>
  );
}
