import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BookmarkPlus, Check, X } from 'lucide-react';
import { useApp } from '@/src/context/AppContext';
import { canonicalizeSavedExpressionDraft } from '@/src/lib/speakingProfile';

type SelectionSnapshot = {
  text: string;
  x: number;
  y: number;
  module?: string;
  part?: number;
  sourceLabel: string;
};

const selectionLimit = 220;

const cleanSelection = (text: string) =>
  text.replace(/\s+/g, ' ').trim().slice(0, selectionLimit);

const sourceLabelFromPath = (pathname: string) => {
  if (pathname.includes('/speaking')) return 'Speaking';
  if (pathname.includes('/writing/task1')) return 'Writing Task 1';
  if (pathname.includes('/writing')) return 'Writing Task 2';
  if (pathname.includes('/practice-history')) return 'Practice History';
  if (pathname.includes('/progress')) return 'Progress';
  return 'IELTS Scholar';
};

const moduleFromPath = (pathname: string) => {
  if (pathname.includes('/speaking')) return 'speaking';
  if (pathname.includes('/writing')) return 'writing';
  return undefined;
};

export const TextSelectionSaveButton: React.FC = () => {
  const { saveExpression } = useApp();
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [selection, setSelection] = useState<SelectionSnapshot | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const pathMeta = useMemo(() => ({
    module: moduleFromPath(location.pathname),
    sourceLabel: sourceLabelFromPath(location.pathname),
  }), [location.pathname]);

  useEffect(() => {
    setSelection(null);
    setEditing(false);
    setSaved(false);
  }, [location.pathname]);

  useEffect(() => {
    const capture = () => {
      if (rootRef.current?.contains(document.activeElement)) return;
      const active = document.activeElement;
      const isTextInput = active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLInputElement && ['text', 'search', 'email', 'url', 'tel'].includes(active.type));

      if (isTextInput) {
        const start = active.selectionStart ?? 0;
        const end = active.selectionEnd ?? 0;
        const text = cleanSelection(active.value.slice(Math.min(start, end), Math.max(start, end)));
        if (text.length < 2) {
          setSelection(null);
          return;
        }
        const rect = active.getBoundingClientRect();
        setSelection({
          text,
          x: Math.min(window.innerWidth - 180, Math.max(12, rect.right - 168)),
          y: Math.min(window.innerHeight - 80, Math.max(12, rect.top + 12)),
          module: pathMeta.module,
          sourceLabel: pathMeta.sourceLabel,
        });
        setDraft(canonicalizeSavedExpressionDraft(text));
        setEditing(false);
        setSaved(false);
        return;
      }

      const selected = window.getSelection();
      const text = cleanSelection(selected?.toString() || '');
      if (!selected || selected.rangeCount === 0 || text.length < 2) {
        setSelection(null);
        return;
      }
      const range = selected.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) {
        setSelection(null);
        return;
      }
      setSelection({
        text,
        x: Math.min(window.innerWidth - 180, Math.max(12, rect.left + rect.width / 2 - 72)),
        y: Math.min(window.innerHeight - 92, Math.max(12, rect.top - 48)),
        module: pathMeta.module,
        sourceLabel: pathMeta.sourceLabel,
      });
      setDraft(canonicalizeSavedExpressionDraft(text));
      setEditing(false);
      setSaved(false);
    };

    const onSelectionChange = () => window.setTimeout(capture, 0);
    document.addEventListener('mouseup', onSelectionChange);
    document.addEventListener('keyup', onSelectionChange);
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('mouseup', onSelectionChange);
      document.removeEventListener('keyup', onSelectionChange);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [pathMeta.module, pathMeta.sourceLabel]);

  if (!selection) return null;

  const save = () => {
    const expression = draft.replace(/\s+/g, ' ').trim();
    if (!expression) return;
    saveExpression({
      expression,
      originalSnippet: selection.text,
      sourcePath: location.pathname,
      sourceLabel: selection.sourceLabel,
      module: selection.module,
      part: selection.part,
    });
    setSaved(true);
    window.setTimeout(() => {
      setSelection(null);
      setEditing(false);
      setSaved(false);
    }, 850);
  };

  return (
    <div
      ref={rootRef}
      data-selection-save-ui
      className="fixed z-[80] rounded border border-paper-ink/15 bg-paper-100 px-2 py-2 shadow-lg"
      style={{ left: selection.x, top: selection.y }}
    >
      {editing ? (
        <div className="flex w-[260px] items-center gap-2">
          <input
            value={draft}
            onChange={event => setDraft(event.target.value)}
            className="min-w-0 flex-1 border border-paper-ink/15 bg-white px-2 py-1 text-xs font-sans text-paper-ink outline-none focus:border-accent-terracotta"
            autoFocus
          />
          <button
            type="button"
            onClick={save}
            className="grid h-7 w-7 place-items-center border border-accent-terracotta/30 text-accent-terracotta hover:bg-accent-terracotta/10"
            title="Save expression"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setSelection(null)}
            className="grid h-7 w-7 place-items-center border border-paper-ink/10 text-paper-ink/45 hover:text-paper-ink"
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex items-center gap-2 px-2 py-1 text-xs font-sans font-bold uppercase tracking-widest text-paper-ink hover:text-accent-terracotta"
          title="Save selected text"
        >
          {saved ? <Check className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
          {saved ? 'Saved' : 'Save'}
        </button>
      )}
    </div>
  );
};
