import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { getPracticeRecords, PracticeRecord } from '@/src/lib/practiceRecords';

export interface QuestionBankItem {
  id?: string;
  title: string;
  metadata?: string | string[];
  tags?: string[];
  questionText?: string;
  module: PracticeRecord['module'];
  part?: 1 | 2 | 3;
  task?: 'task1' | 'task2';
}

interface QuestionBankModalProps<T extends QuestionBankItem> {
  isOpen: boolean;
  title: string;
  items: T[];
  onClose: () => void;
  onSelect: (item: T) => void;
}

const normalizeLabelKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const uniqueLabels = (values: (string | undefined)[]) => {
  const seen = new Set<string>();
  return values
    .map(value => value?.trim())
    .filter((value): value is string => Boolean(value))
    .filter(value => {
      const key = normalizeLabelKey(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const metadataLabels = (metadata?: string | string[]) =>
  uniqueLabels(Array.isArray(metadata) ? metadata : metadata ? metadata.split(/\s*[|/]\s*/) : []);

const hasAnalyzedFeedback = (record: PracticeRecord) =>
  record.status === 'analyzed' && Boolean(record.feedback);

const matchesBankItem = (record: PracticeRecord, item: QuestionBankItem) => {
  if (record.module !== item.module) return false;
  if (item.part && record.module === 'speaking' && record.part !== item.part) return false;
  if (item.task && 'task' in record && record.task !== item.task) return false;

  if (item.id) return record.questionId === item.id;
  const text = item.questionText || item.title;
  return Boolean(text && record.question === text);
};

const practiceStatus = (count: number) => {
  if (count === 0) return 'Not practiced';
  if (count === 1) return 'Practiced 1 time';
  return `Practiced ${count} times`;
};

export function QuestionBankModal<T extends QuestionBankItem>({
  isOpen,
  title,
  items,
  onClose,
  onSelect,
}: QuestionBankModalProps<T>) {
  const [activeTag, setActiveTag] = useState('All');
  const records = useMemo(() => (isOpen ? getPracticeRecords(1000) : []), [isOpen]);

  const tags = useMemo(() => {
    const derived = uniqueLabels(items.flatMap(item => item.tags || []));
    return derived.length ? ['All', ...derived] : ['All'];
  }, [items]);

  const visibleItems = activeTag === 'All'
    ? items
    : items.filter(item => (item.tags || []).includes(activeTag));

  useEffect(() => {
    if (!isOpen) return;
    setActiveTag('All');
  }, [isOpen, title]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex h-dvh w-screen items-center justify-center bg-paper-ink/25 px-4 py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="question-bank-title"
        className="w-full max-w-4xl max-h-[86vh] overflow-hidden rounded-sm border border-paper-ink/15 bg-paper-50 shadow-2xl shadow-paper-ink/15"
      >
        <div className="flex items-start justify-between gap-4 border-b border-paper-ink/10 bg-paper-ink/[0.025] px-5 py-4">
          <div>
            <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-accent-terracotta mb-1">
              {items.length} {items.length === 1 ? 'question' : 'questions'}
            </p>
            <h2 id="question-bank-title" className="text-2xl leading-tight text-paper-ink">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-paper-ink/10 text-paper-ink/55 hover:bg-paper-ink/5 hover:text-paper-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-paper-ink/10 px-5 py-3">
          <div className="flex flex-wrap gap-2.5">
            {tags.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(tag)}
                className={`rounded-sm border px-3 py-1.5 text-[10px] font-sans font-bold uppercase tracking-widest transition-colors ${
                  activeTag === tag
                    ? 'border-accent-terracotta bg-accent-terracotta text-paper-50'
                    : 'border-paper-ink/10 text-paper-ink/45 hover:border-accent-terracotta/30 hover:text-paper-ink'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[58vh] overflow-y-auto px-5 py-4">
          <div className="space-y-2">
            {visibleItems.map(item => {
              const practicedCount = records.filter(record => (
                hasAnalyzedFeedback(record) && matchesBankItem(record, item)
              )).length;
              const metadata = metadataLabels(item.metadata).join(' / ');
              return (
                <button
                  key={item.id || item.title}
                  type="button"
                  onClick={() => onSelect(item)}
                  className="w-full rounded-sm border border-paper-ink/10 bg-paper-100/45 px-4 py-3 text-left transition-colors hover:border-accent-terracotta/35 hover:bg-paper-200/60"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-base leading-7 text-paper-ink">{item.title}</p>
                      {metadata && (
                        <p className="mt-1 text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40">
                          {metadata}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-sm border border-paper-ink/10 bg-paper-50 px-2.5 py-1 text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/45">
                      {practiceStatus(practicedCount)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </section>
    </div>,
    document.body,
  );
}
