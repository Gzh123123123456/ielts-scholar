import React, { useState, useEffect, useRef } from 'react';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { SerifButton } from '@/src/components/ui/SerifButton';
import { useApp } from '@/src/context/AppContext';
import { routedAnalyzeWriting, routedCoachWritingFramework, routedExtractWritingFramework } from '@/src/lib/ai';
import { formatBandEstimate } from '@/src/lib/bands';
import { writingTask2, WritingQuestion } from '@/src/data/questions/bank';
import {
  WritingFeedback,
  WritingFrameworkCoachFeedback,
  WritingFrameworkReadiness,
} from '@/src/lib/ai/schemas';
import {
  createRecordId,
  getActiveWritingTask2,
  saveActiveWritingTask2,
  summarizeDiagnostic,
  upsertPracticeRecord,
  WritingTask2PracticeRecord,
} from '@/src/lib/practiceRecords';
import { Send, ArrowRight, FileDown, ShieldCheck, AlertCircle, Sparkles, Trash2 } from 'lucide-react';

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const hasLowSignalText = (text: string) => {
  const normalized = text.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return true;
  const words = normalized.split(' ').filter(Boolean);
  const uniqueWords = new Set(words);
  return normalized.replace(/\s/g, '').length < 20 || (words.length >= 5 && uniqueWords.size <= 2);
};

const isInsufficientTask2Sample = (text: string) => {
  const words = countWords(text);
  return words <= 20 || (words < 60 && hasLowSignalText(text));
};

const isPlaceholderModelAnswer = (text: string) =>
  !text.trim() ||
  text === 'Sample Band 9 essay content...' ||
  /too short for a high training estimate|provider returned incomplete|malformed or incomplete/i.test(text);

const humanizeKey = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/\b\w/g, character => character.toUpperCase());

const dimensionLabels: Record<string, string> = {
  TR: '任务回应 / Task Response',
  CC: '连贯性 / Coherence',
  LR: '词汇准确性 / Lexical Resource',
  GRA: '语法准确性 / Grammar',
};

const categoryLabels: Record<string, string> = {
  lexical_precision: '词汇准确性 / Lexical Precision',
  word_choice: '词汇选择 / Word Choice',
  grammar: '语法准确性 / Grammar',
  grammatical_accuracy: '语法准确性 / Grammar',
  coherence: '连贯性 / Coherence',
  cohesion: '衔接 / Cohesion',
  task_response: '任务回应 / Task Response',
  task_achievement: '任务完成度 / Task Achievement',
  provider_safety: '反馈格式 / Feedback Format',
  insufficient_sample: '样本不足 / Insufficient Sample',
};

const displayDimension = (value: string) => dimensionLabels[value] || humanizeKey(value);

const displayCategory = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return categoryLabels[normalized] || humanizeKey(value);
};

const routeNotice = (
  route: { providerName: string; fallbackReason?: string; learnerReason: string },
  failureKind?: string,
) => {
  if (failureKind === 'provider_unavailable') return 'Provider unavailable. Your text is preserved.';
  if (route.fallbackReason && !/high-value final feedback/i.test(route.fallbackReason)) return route.fallbackReason;
  if (/cooling down|quota|reserve|discount protection|fallback|unavailable/i.test(route.learnerReason)) {
    return route.learnerReason;
  }
  return '';
};

const readinessLabels: Record<WritingFrameworkReadiness, string> = {
  not_ready: 'Not ready',
  almost_ready: 'Almost ready',
  ready_to_write: 'Ready to write',
};

const checklistLabels: Record<keyof WritingFrameworkCoachFeedback['checklist'], string> = {
  taskTypeAnswered: 'Task type answered',
  clearPosition: 'Clear position',
  bothViewsCovered: 'Both required views covered',
  supportExists: 'Usable examples or support',
  paragraphPlanClear: 'Paragraph plan is clear',
};

const formatCoachFeedback = (feedback: WritingFrameworkCoachFeedback, isMock: boolean) => {
  const lines = [
    `${readinessLabels[feedback.readiness]}${isMock ? ' (local mock)' : ''}`,
    feedback.message,
  ].filter(Boolean);

  const checklist = Object.entries(feedback.checklist)
    .map(([key, value]) => `${value ? 'OK' : 'Needs work'} - ${checklistLabels[key as keyof WritingFrameworkCoachFeedback['checklist']]}`)
    .join('\n');

  if (checklist) lines.push(`Checklist:\n${checklist}`);
  if (feedback.mainGaps.length) lines.push(`Main gaps:\n${feedback.mainGaps.map(item => `- ${item}`).join('\n')}`);
  if (feedback.finalFixes.length) lines.push(`Final small fixes:\n${feedback.finalFixes.map(item => `- ${item}`).join('\n')}`);
  if (feedback.nextQuestions.length) lines.push(`Next questions:\n${feedback.nextQuestions.map(item => `- ${item}`).join('\n')}`);
  if (feedback.readiness === 'ready_to_write' && feedback.readySummary) {
    lines.push(`Ready reason:\n${feedback.readySummary}`);
  }

  return lines.join('\n\n');
};

const Task2PhaseTabs = ({
  phase,
  hasFeedback,
  onChange,
}: {
  phase: 'framework' | 'writing' | 'results';
  hasFeedback: boolean;
  onChange: (phase: 'framework' | 'writing' | 'results') => void;
}) => {
  const tabs: { id: 'framework' | 'writing' | 'results'; label: string; disabled?: boolean }[] = [
    { id: 'framework', label: 'Phase 1: Framework' },
    { id: 'writing', label: 'Phase 2: Essay Editor' },
    { id: 'results', label: 'Phase 3: Final Analysis', disabled: !hasFeedback },
  ];

  return (
    <div className="practice-workspace phase-tabs gap-2 p-1 bg-paper-ink/5 rounded-sm mb-8 font-sans uppercase tracking-widest font-bold">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          disabled={tab.disabled}
          className={phase === tab.id ? 'phase-tab phase-tab-active' : 'phase-tab'}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default function WritingTask2Practice() {
  const { addDebugLog, saveSession, setProviderDiagnostic } = useApp();
  const [question, setQuestion] = useState<WritingQuestion | null>(null);
  const [phase, setPhase] = useState<'framework' | 'writing' | 'results'>('framework');
  const [frameworkChat, setFrameworkChat] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [frameworkInput, setFrameworkInput] = useState('');
  const [frameworkReadiness, setFrameworkReadiness] = useState<WritingFrameworkReadiness>('not_ready');
  const [latestFrameworkCoach, setLatestFrameworkCoach] = useState<WritingFrameworkCoachFeedback | null>(null);
  const [finalFrameworkSummary, setFinalFrameworkSummary] = useState('');
  const [frameworkSummaryGenerated, setFrameworkSummaryGenerated] = useState(false);
  const [essay, setEssay] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCoachingFramework, setIsCoachingFramework] = useState(false);
  const [isExtractingFramework, setIsExtractingFramework] = useState(false);
  const [frameworkExtractMessage, setFrameworkExtractMessage] = useState('');
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [feedbackFallbackUsed, setFeedbackFallbackUsed] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState('');
  const [providerErrorMessage, setProviderErrorMessage] = useState('');
  const [apiStatusMessage, setApiStatusMessage] = useState('');
  const discussionRef = useRef<HTMLDivElement | null>(null);
  const isFrameworkInputComposingRef = useRef(false);
  const coachRunIdRef = useRef(0);
  const cancelledCoachRunRef = useRef<number | null>(null);
  const activeAttemptIdRef = useRef(createRecordId('wt2'));
  const restoredRecordRef = useRef<WritingTask2PracticeRecord | null>(null);
  const isRestoringRecordRef = useRef(false);

  useEffect(() => {
    const active = getActiveWritingTask2();
    if (active) {
      restoreWritingAttempt(active);
      return;
    }
    loadRandomQuestion();
  }, []);

  useEffect(() => {
    if (isRestoringRecordRef.current) {
      isRestoringRecordRef.current = false;
      return;
    }
    if (!question || isAnalyzing || isCoachingFramework || isExtractingFramework) return;
    persistWritingAttempt(providerErrorMessage ? 'provider_failed' : undefined);
  }, [
    question,
    phase,
    frameworkChat,
    frameworkInput,
    frameworkReadiness,
    latestFrameworkCoach,
    finalFrameworkSummary,
    frameworkSummaryGenerated,
    essay,
    feedback,
    feedbackFallbackUsed,
    providerErrorMessage,
  ]);

  const buildWritingRecord = (status: 'draft' | 'analyzed' | 'provider_failed' = feedback ? 'analyzed' : 'draft'): WritingTask2PracticeRecord | null => {
    if (!question) return null;
    const timestamp = new Date().toISOString();
    const existing = restoredRecordRef.current?.id === activeAttemptIdRef.current ? restoredRecordRef.current : null;
    return {
      id: activeAttemptIdRef.current,
      module: 'writing',
      mode: 'practice',
      status,
      task: 'task2',
      question: question.question,
      questionId: question.id,
      topic: question.topicCategory,
      tags: question.tags,
      taskType: question.type,
      questionData: question,
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
      analyzedAt: status === 'analyzed' ? existing?.analyzedAt || timestamp : existing?.analyzedAt,
      phase,
      frameworkChat,
      frameworkInput,
      frameworkReadiness,
      latestFrameworkCoach: latestFrameworkCoach || undefined,
      finalFrameworkSummary,
      frameworkSummaryGenerated,
      essay,
      feedback: status === 'provider_failed' ? undefined : feedback || undefined,
      feedbackFallbackUsed,
      obsidianMarkdown: status === 'provider_failed' ? undefined : feedback?.obsidianMarkdown,
    };
  };

  const persistWritingAttempt = (status?: 'draft' | 'analyzed' | 'provider_failed') => {
    const record = buildWritingRecord(status);
    if (!record) return;
    saveActiveWritingTask2(record);
    upsertPracticeRecord(record);
  };

  const restoreWritingAttempt = (record: WritingTask2PracticeRecord, message = '') => {
    isRestoringRecordRef.current = true;
    restoredRecordRef.current = record;
    activeAttemptIdRef.current = record.id;
    setQuestion(record.questionData || writingTask2.find(item => item.id === record.questionId) || {
      id: record.questionId || record.id,
      type: 'saved',
      question: record.question,
    });
    setPhase(record.feedback ? 'results' : record.phase);
    setFrameworkChat(record.frameworkChat.length ? record.frameworkChat : [{ role: 'ai', text: "First, define your position and two main arguments regarding this prompt. You may explain them in Chinese or English." }]);
    setFrameworkInput(record.frameworkInput);
    setFrameworkReadiness(record.frameworkReadiness || record.latestFrameworkCoach?.readiness || 'not_ready');
    setLatestFrameworkCoach(record.latestFrameworkCoach || null);
    setFinalFrameworkSummary(record.finalFrameworkSummary);
    setFrameworkSummaryGenerated(Boolean(record.frameworkSummaryGenerated));
    setEssay(record.essay);
    setFeedback(record.feedback || null);
    setFeedbackFallbackUsed(Boolean(record.feedbackFallbackUsed || record.providerDiagnostic?.fallbackUsed));
    setProviderErrorMessage(record.status === 'provider_failed' ? 'AI provider temporarily unavailable. Please retry later. Your draft is preserved.' : '');
    setApiStatusMessage('');
    setFrameworkExtractMessage('');
    setRestoreMessage(message);
  };

  const loadRandomQuestion = () => {
    const random = writingTask2[Math.floor(Math.random() * writingTask2.length)];
    activeAttemptIdRef.current = createRecordId('wt2');
    restoredRecordRef.current = null;
    setQuestion(random);
    setPhase('framework');
    setEssay('');
    setFeedback(null);
    setFeedbackFallbackUsed(false);
    setFrameworkChat([{ role: 'ai', text: "First, define your position and two main arguments regarding this prompt. You may explain them in Chinese or English." }]);
    setFrameworkReadiness('not_ready');
    setLatestFrameworkCoach(null);
    setFinalFrameworkSummary('');
    setFrameworkSummaryGenerated(false);
    setFrameworkExtractMessage('');
    setProviderErrorMessage('');
    setApiStatusMessage('');
    setRestoreMessage('');
    addDebugLog(`Loaded writing question: ${random.id}`);
  };

  const submitFrameworkNote = async () => {
    if (!frameworkInput.trim() || isCoachingFramework) return;

    const userInput = frameworkInput;
    const runId = coachRunIdRef.current + 1;
    coachRunIdRef.current = runId;
    cancelledCoachRunRef.current = null;
    setFrameworkChat(prev => [...prev, { role: 'user', text: userInput }]);
    setFrameworkInput('');
    setApiStatusMessage('');
    setIsCoachingFramework(true);

    const notes = [
      ...frameworkChat
        .filter(msg => msg.role === 'user' || msg.role === 'ai')
        .map(msg => `${msg.role === 'user' ? 'User note' : 'Coach feedback'}: ${msg.text.trim()}`)
        .filter(Boolean),
      `User note: ${userInput}`,
    ].join('\n\n');

    try {
      const { feedback: coachFeedback, diagnostic, route } = await routedCoachWritingFramework({
        task: 'task2',
        question: question?.question || '',
        notes,
      });
      if (cancelledCoachRunRef.current === runId || coachRunIdRef.current !== runId) {
        addDebugLog('Framework coach response ignored after cancellation.');
        return;
      }
      setProviderDiagnostic(diagnostic);
      const notice = routeNotice(route, diagnostic.failureKind);
      if (notice && (diagnostic.failureKind === 'provider_unavailable' || route.providerName === 'mock')) {
        setApiStatusMessage(notice);
      }
      if (diagnostic.failureKind === 'provider_unavailable') {
        setFrameworkChat(prev => [...prev, { role: 'ai', text: 'AI coach is temporarily unavailable. Your note is saved; continue planning manually and retry later.' }]);
        addDebugLog('Provider unavailable for framework coach.');
        return;
      }
      setLatestFrameworkCoach(coachFeedback);
      setFrameworkReadiness(coachFeedback.readiness);
      setFrameworkChat(prev => [...prev, {
        role: 'ai',
        text: formatCoachFeedback(coachFeedback, route.providerName === 'mock'),
      }]);
      addDebugLog(diagnostic.fallbackUsed ? 'Provider fallback used for framework coach.' : 'Framework coach feedback complete.');
    } catch (error) {
      if (cancelledCoachRunRef.current === runId || coachRunIdRef.current !== runId) {
        addDebugLog('Framework coach error ignored after cancellation.');
        return;
      }
      setFrameworkChat(prev => [...prev, { role: 'ai', text: 'Local mock coach: clarify your final position, one main reason, and one example from your own notes.' }]);
      addDebugLog(`Framework coach failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (coachRunIdRef.current === runId) {
        setIsCoachingFramework(false);
      }
    }

    requestAnimationFrame(() => {
      if (discussionRef.current) {
        discussionRef.current.scrollTop = discussionRef.current.scrollHeight;
      }
    });
  };

  const stopFrameworkCoach = () => {
    const runId = coachRunIdRef.current;
    cancelledCoachRunRef.current = runId;
    coachRunIdRef.current = runId + 1;
    setIsCoachingFramework(false);
    setApiStatusMessage('Coach generation stopped. Your notes are preserved.');
    addDebugLog('Framework coach generation cancelled by user.');
  };

  const deleteLastCoachFeedback = () => {
    setFrameworkChat(prev => {
      const lastCoachIndex = [...prev].map((msg, index) => ({ msg, index }))
        .reverse()
        .find(item => item.msg.role === 'ai' && item.index > 0)?.index;
      if (lastCoachIndex === undefined) return prev;
      return prev.filter((_, index) => index !== lastCoachIndex);
    });
    setLatestFrameworkCoach(null);
    setFrameworkReadiness('not_ready');
    setFrameworkExtractMessage('Latest coach feedback deleted. Your notes are unchanged.');
  };

  const handleFrameworkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitFrameworkNote();
  };

  const handleFrameworkInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isComposing = isFrameworkInputComposingRef.current || e.nativeEvent.isComposing;
    if (e.key !== 'Enter' || isComposing || (!e.ctrlKey && !e.metaKey)) return;

    e.preventDefault();
    void submitFrameworkNote();
  };

  const buildFrameworkNotes = () => {
    const chatNotes = frameworkChat
      .filter((msg, index) => msg.role === 'user' || index > 0)
      .map(msg => `${msg.role === 'user' ? 'User note' : 'Coach feedback'}: ${msg.text.trim()}`)
      .filter(Boolean);
    const draftInput = frameworkInput.trim();

    return [...chatNotes, draftInput].filter(Boolean).join('\n\n');
  };

  const extractFinalFramework = async () => {
    const notes = buildFrameworkNotes();
    setFrameworkExtractMessage('');
    setApiStatusMessage('');

    if (!notes.trim()) {
      const message = 'Add a few Coach Discussion notes first, then extract a framework summary.';
      setFrameworkExtractMessage(message);
      addDebugLog('Framework extraction skipped: empty notes.');
      return;
    }

    setIsExtractingFramework(true);
    addDebugLog('Extracting Writing Task 2 framework summary...');

    try {
      const { feedback: result, diagnostic, route } = await routedExtractWritingFramework({
        task: 'task2',
        question: question?.question || '',
        notes,
      });

      setProviderDiagnostic(diagnostic);
      const notice = routeNotice(route, diagnostic.failureKind);
      setApiStatusMessage(diagnostic.failureKind === 'provider_unavailable' ? notice : '');
      if (diagnostic.failureKind === 'provider_unavailable') {
        setFrameworkExtractMessage('AI provider temporarily unavailable. Please retry later. You can keep editing the framework manually.');
        addDebugLog('Provider unavailable for framework extraction.');
        persistWritingAttempt('provider_failed');
        return;
      }

      setFinalFrameworkSummary(result.editableSummary);
      setFrameworkSummaryGenerated(true);
      setFrameworkExtractMessage(
        diagnostic.fallbackUsed
          ? 'A safe fallback framework was generated. Please review and edit it before writing.'
          : route.providerName === 'mock'
            ? 'Local mock framework summary generated from your notes. You can edit it before moving to Phase 2.'
            : 'Framework summary generated from your notes. You can edit it before moving to Phase 2.',
      );
      addDebugLog(
        diagnostic.fallbackUsed
          ? 'Provider fallback used for framework extraction.'
          : 'Framework extraction complete.',
      );
    } catch (error) {
      console.error(error);
      const message = 'Framework extraction failed. You can keep editing the summary manually.';
      setFrameworkExtractMessage(message);
      addDebugLog(`Framework extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsExtractingFramework(false);
    }
  };

  const analyzeEssay = async () => {
    setIsAnalyzing(true);
    setProviderErrorMessage('');
    setApiStatusMessage('');
    addDebugLog("Analyzing essay...");
    try {
      const { feedback: result, diagnostic, route } = await routedAnalyzeWriting({
        task: 'task2',
        question: question?.question || '',
        essay
      }, isInsufficientTask2Sample(essay));
      setProviderDiagnostic(diagnostic);
      setApiStatusMessage(routeNotice(route, diagnostic.failureKind));

      if (diagnostic.failureKind === 'provider_unavailable') {
        setFeedbackFallbackUsed(false);
        setProviderErrorMessage('AI provider temporarily unavailable. Please retry later. Your essay draft is preserved.');
        persistWritingAttempt('provider_failed');
        const failedBase = buildWritingRecord('provider_failed');
        if (failedBase) {
          upsertPracticeRecord({
            ...failedBase,
            providerDiagnostic: summarizeDiagnostic(diagnostic),
          });
        }
        addDebugLog('Provider unavailable for writing feedback.');
        return;
      }

      setFeedbackFallbackUsed(diagnostic.fallbackUsed);
      setFeedback(result);
      setPhase('results');
      persistWritingAttempt('analyzed');
      const analyzedBase = buildWritingRecord('analyzed');
      if (analyzedBase) {
        upsertPracticeRecord({
          ...analyzedBase,
          feedback: result,
          feedbackFallbackUsed: diagnostic.fallbackUsed,
          obsidianMarkdown: result.obsidianMarkdown,
          providerDiagnostic: summarizeDiagnostic(diagnostic),
        });
      }

      saveSession({
        id: `wt2_${Date.now()}`,
        date: new Date().toISOString(),
        module: 'writing',
        mode: 'practice',
        question: question?.question,
        essay,
        framework: finalFrameworkSummary,
        feedback: result,
        providerDiagnostic: summarizeDiagnostic(diagnostic),
      });
      addDebugLog("Writing analysis complete");
      if (diagnostic.fallbackUsed) {
        addDebugLog("Provider fallback used for writing feedback.");
      }
    } catch (error) {
      console.error(error);
      setFeedbackFallbackUsed(false);
      alert("Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const exportMarkdown = () => {
    if (!feedback) return;
    const logicItems = feedback.frameworkFeedback.length
      ? feedback.frameworkFeedback.map((item, index) => {
          const related = item.relatedCorrectionIds?.length
            ? item.relatedCorrectionIds.map(id => `Correction #${id.replace(/^C/i, '')}`).join(', ')
            : 'No sentence-level correction covers this issue. This needs paragraph-level revision.';
          return `### Logic Issue ${index + 1}: ${item.issue}
- Why it matters: ${item.suggestionZh}
- Big-picture fix: ${item.paragraphFixZh || item.suggestionZh}
- Related: ${related}${item.exampleFrame ? `\n- Example frame: ${item.exampleFrame}` : ''}`;
        }).join('\n\n')
      : '- No logic-level issue returned.';
    const sentenceItems = feedback.sentenceFeedback.length
      ? feedback.sentenceFeedback.map((item, index) => `### Correction #${item.correctionNumber || index + 1}
- Original: ${item.original}
- Correction: ${item.correction}
- Dimension: ${item.dimension}
- Focus: ${item.tag}
- Explanation: ${item.explanationZh}`).join('\n\n')
      : '- No sentence-level correction returned.';
    const markdown = `# IELTS Writing Task 2 Note

## Prompt
${feedback.question}

## Logic & Structure Review
${logicItems}

## Sentence-level Corrections
${sentenceItems}

## Model Answer Excerpt
${feedback.modelAnswer}

## Essay
${feedback.essay}`;
    const blob = new Blob([markdown || feedback.obsidianMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ielts-writing-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const writingWorkspaceClass = 'practice-workspace';
  const modelAnswerText = feedback?.modelAnswer?.trim() || '';
  const isInsufficientSample = isInsufficientTask2Sample(essay);
  const hasSubstantialModelAnswer = modelAnswerText.length > 24 && !isPlaceholderModelAnswer(modelAnswerText) && !isInsufficientSample;
  const hasCoachFeedback = frameworkChat.some((msg, index) => msg.role === 'ai' && index > 0);

  return (
    <PageShell size="wide">
      <TopBar />

      <div className={`${writingWorkspaceClass} mb-8`}>
        <PaperCard className="bg-paper-200 border-none">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40">Task 2 Question</span>
            <span className="question-type-badge">({question?.type})</span>
          </div>
          <h2 className="text-xl leading-relaxed">{question?.question}</h2>
        </PaperCard>
      </div>

      <Task2PhaseTabs phase={phase} hasFeedback={Boolean(feedback)} onChange={setPhase} />

      <div className={writingWorkspaceClass}>
        {providerErrorMessage && (
          <div className="mb-6 space-y-2">
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-sm font-sans">
              {providerErrorMessage}
            </div>
          </div>
        )}
        {apiStatusMessage && (
          <div className="mb-6 p-3 bg-paper-ink/5 border border-paper-ink/10 text-paper-ink/65 text-sm rounded-sm font-sans">
            {apiStatusMessage}
          </div>
        )}
      </div>

      <div className={writingWorkspaceClass}>
        {phase === 'framework' && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(460px,0.88fr)] xl:items-start">
            <PaperCard className="p-0 overflow-hidden xl:max-h-[calc(100vh-14rem)] xl:flex xl:flex-col">
              <div className="px-6 pt-6 pb-4 border-b border-paper-ink/10 bg-paper-ink/[0.02] shrink-0">
                <h3 className="text-base font-bold uppercase tracking-widest">Framework Notes</h3>
              </div>
              <div ref={discussionRef} className="px-6 py-5 space-y-3 max-h-[360px] xl:max-h-none xl:flex-1 overflow-auto">
                {frameworkChat.map((msg, i) => (
                  <div key={i} className="border-l-2 border-paper-ink/10 pl-3 py-1.5">
                    <p className="text-xs font-sans uppercase tracking-widest text-paper-ink/50 mb-1">
                      {msg.role === 'user'
                        ? 'Your Note'
                        : i === 0
                          ? 'Prompt Guidance'
                          : 'Coach Feedback'}
                    </p>
                    <p className={`${msg.role === 'user' ? 'text-paper-ink' : 'text-paper-ink-muted'} text-[17px] leading-8 whitespace-pre-wrap`}>
                      {msg.text}
                    </p>
                  </div>
                ))}
              </div>
              <form onSubmit={handleFrameworkSubmit} className="p-6 border-t border-paper-ink/10 space-y-3 shrink-0">
                <textarea
                  value={frameworkInput}
                  onChange={(e) => setFrameworkInput(e.target.value)}
                  onKeyDown={handleFrameworkInputKeyDown}
                  onCompositionStart={() => {
                    isFrameworkInputComposingRef.current = true;
                  }}
                  onCompositionEnd={() => {
                    isFrameworkInputComposingRef.current = false;
                  }}
                  placeholder="Planning notes (Chinese or English): thesis, two main arguments, and counter-view structure..."
                  rows={6}
                  autoFocus
                  className="w-full min-h-[180px] xl:min-h-[160px] bg-transparent border border-paper-ink/10 rounded-sm p-4 font-serif text-[17px] leading-relaxed resize-y placeholder:opacity-40 focus:border-accent-terracotta focus:shadow-[0_0_0_1px_rgba(166,77,50,0.2)]"
                />
                <p className="text-xs font-sans text-paper-ink/45">
                  Enter = newline. Ctrl+Enter / Cmd+Enter = Send to Coach.
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  {hasCoachFeedback && (
                    <SerifButton
                      type="button"
                      variant="outline"
                      onClick={deleteLastCoachFeedback}
                      className="px-4 py-2 text-xs flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete last coach feedback
                    </SerifButton>
                  )}
                  <SerifButton
                    type={isCoachingFramework ? 'button' : 'submit'}
                    variant="secondary"
                    onClick={isCoachingFramework ? stopFrameworkCoach : undefined}
                    disabled={!isCoachingFramework && !frameworkInput.trim()}
                    className="px-4 py-2 text-xs"
                  >
                    {isCoachingFramework ? 'Stop generating' : 'Send to Coach'}
                  </SerifButton>
                </div>
              </form>
            </PaperCard>

            <PaperCard className="xl:sticky xl:top-8 xl:max-h-[calc(100vh-4rem)] xl:overflow-hidden xl:flex xl:flex-col">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3 shrink-0">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest mb-3">Final Framework Summary</h3>
                  <p className="text-xs font-sans text-paper-ink/45">
                    Coach readiness: {readinessLabels[frameworkReadiness]}
                  </p>
                </div>
              </div>
              {frameworkExtractMessage && (
                <p className="text-xs font-sans text-paper-ink/55 bg-paper-ink/5 border border-paper-ink/10 rounded-sm px-3 py-2 mb-3 shrink-0">
                  {frameworkExtractMessage}
                </p>
              )}
              <textarea
                value={finalFrameworkSummary}
                onChange={(e) => setFinalFrameworkSummary(e.target.value)}
                placeholder="Final Framework Summary (Chinese or English)..."
                rows={12}
                className="w-full min-h-[420px] md:min-h-[520px] xl:min-h-[640px] xl:h-[68vh] xl:max-h-[calc(100vh-10rem)] xl:flex-1 bg-transparent border border-paper-ink/10 rounded-sm p-4 font-serif text-[17px] leading-relaxed resize-y overflow-auto placeholder:opacity-40 focus:border-accent-terracotta focus:shadow-[0_0_0_1px_rgba(166,77,50,0.2)]"
              />
              <div className="flex flex-col gap-3 border-t border-paper-ink/10 pt-4 mt-4 shrink-0">
                {frameworkSummaryGenerated ? (
                  <SerifButton
                    type="button"
                    onClick={() => setPhase('writing')}
                    className="w-full justify-center flex items-center gap-2"
                  >
                    Use This Framework &mdash; Start Writing <ArrowRight className="w-4 h-4" />
                  </SerifButton>
                ) : frameworkReadiness === 'ready_to_write' ? (
                  <SerifButton
                    type="button"
                    variant="outline"
                    onClick={extractFinalFramework}
                    disabled={isExtractingFramework}
                    className="w-full justify-center text-xs flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    {isExtractingFramework ? 'Extracting...' : <>Framework Ready &mdash; Generate Summary</>}
                  </SerifButton>
                ) : (
                  <p className="text-xs font-sans text-paper-ink/55 bg-paper-ink/5 border border-paper-ink/10 rounded-sm px-3 py-2">
                    Keep discussing with Coach before generating summary.
                  </p>
                )}
                {!frameworkSummaryGenerated && frameworkReadiness === 'ready_to_write' && (
                  <SerifButton
                    type="button"
                    variant="secondary"
                    onClick={() => setPhase('writing')}
                    className="w-full justify-center flex items-center gap-2"
                  >
                    Skip Framework Discussion &mdash; Start Writing <ArrowRight className="w-4 h-4" />
                  </SerifButton>
                )}
              </div>
            </PaperCard>
          </div>
        )}

        {phase === 'writing' && (
          <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.34fr)_minmax(0,0.66fr)] xl:items-start">
            <PaperCard className="xl:sticky xl:top-8 xl:max-h-[calc(100vh-4rem)] xl:overflow-hidden">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-3">Framework Summary</h3>
              <div className="xl:max-h-[calc(100vh-10rem)] xl:overflow-auto xl:pr-1">
                {finalFrameworkSummary.trim() ? (
                  <p className="text-[17px] leading-8 whitespace-pre-wrap">{finalFrameworkSummary}</p>
                ) : (
                  <p className="text-sm text-paper-ink/60">No final framework summary yet. You can go back to Phase 1 to refine it.</p>
                )}
              </div>
            </PaperCard>
            <div className="space-y-6">
              <PaperCard className="p-0">
                <textarea
                  value={essay}
                  onChange={(e) => setEssay(e.target.value)}
                  placeholder="Start writing your 250+ word essay here..."
                  autoFocus
                  className="w-full min-h-[720px] p-8 bg-transparent border border-transparent rounded-sm font-serif text-xl leading-relaxed placeholder:opacity-40 resize-y focus:border-accent-terracotta focus:shadow-[0_0_0_1px_rgba(166,77,50,0.2)]"
                />
              </PaperCard>
              <div className="flex justify-between items-center bg-paper-ink/5 p-4 rounded text-xs font-sans text-paper-ink/40 uppercase tracking-widest">
                <span>WORD COUNT: {countWords(essay)}</span>
                <div className="flex items-center gap-4">
                  <SerifButton onClick={analyzeEssay} disabled={isAnalyzing || !essay.trim()} className="flex items-center gap-2">
                    {isAnalyzing ? "Analyzing..." : "Submit for Analysis"} <Send className="w-4 h-4" />
                  </SerifButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === 'results' && feedback && (
          <div className="space-y-8">
            {isInsufficientSample && (
              <PaperCard className="border-l-2 border-l-red-800 bg-red-50/40">
                <h3 className="text-sm font-bold uppercase tracking-widest text-red-800 mb-3">Insufficient Sample</h3>
                <p className="text-base leading-8 text-paper-ink/85">
                  This essay is too short or too low-signal for reliable Task 2 feedback. Treat any old saved scores or model-answer text as non-diagnostic; first expand the response into a clear position, two developed body paragraphs, and a short conclusion.
                </p>
              </PaperCard>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Task Response', score: feedback.scores.taskResponse },
                { label: 'Cohesion', score: feedback.scores.coherenceCohesion },
                { label: 'Lexical', score: feedback.scores.lexicalResource },
                { label: 'Grammar', score: feedback.scores.grammaticalRangeAccuracy },
              ].map((s) => (
                <PaperCard key={s.label} className="text-center p-4">
                  <div className="text-[10px] font-sans font-bold text-paper-ink/40 uppercase mb-1">{s.label}</div>
                  <div className={isInsufficientSample ? 'text-sm font-bold text-paper-ink/50 uppercase tracking-widest font-sans pt-2' : 'text-2xl font-bold text-accent-terracotta'}>
                    {isInsufficientSample ? 'Insufficient' : formatBandEstimate(s.score)}
                  </div>
                </PaperCard>
              ))}
            </div>

            <section>
              <h3 className="text-sm font-bold uppercase tracking-widest mb-4">My Essay</h3>
              <PaperCard>
                <div className="text-[17px] leading-8 whitespace-pre-wrap text-paper-ink max-h-[420px] overflow-auto pr-1">
                  {essay}
                </div>
              </PaperCard>
            </section>

            <div className="grid gap-8 xl:grid-cols-[minmax(0,1.12fr)_minmax(420px,0.88fr)] xl:items-start">
              <section className="order-2">
                <h3 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-700" /> Sentence-level Corrections
                </h3>
                <div className="space-y-4">
                  {feedback.sentenceFeedback.map((item, i) => (
                    <PaperCard key={i} className="border-l-2 border-l-paper-ink/20">
                      <div className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/45 mb-3">
                        Correction #{item.correctionNumber || i + 1}
                      </div>
                      <div className="text-base text-paper-ink/60 line-through mb-2 leading-7">{item.original}</div>
                      <div className="text-[17px] font-bold mb-3 leading-8">{item.correction}</div>
                      <div className="flex flex-wrap items-center gap-2 mb-2 text-[10px] uppercase font-sans font-bold text-accent-terracotta">
                        <span>{displayDimension(item.dimension)}</span>
                        <span className="opacity-30">-</span>
                        <span>{displayCategory(item.tag)}</span>
                      </div>
                      <p className="text-sm leading-7 text-paper-ink-muted bg-paper-ink/5 p-3 rounded">{item.explanationZh}</p>
                    </PaperCard>
                  ))}
                </div>
              </section>

              <section className="order-1">
                <h3 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-accent-terracotta" /> Logic & Structure Review
                </h3>
                <div className="space-y-3">
                  {feedback.frameworkFeedback.map((f, i) => (
                    <div key={i} className={`p-5 border border-paper-ink/10 rounded flex items-start gap-3 transition-colors ${f.severity === 'fatal' ? 'bg-red-50/50 border-red-100' : 'bg-paper-ink/5'}`}>
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${f.severity === 'fatal' ? 'bg-red-800' : 'bg-accent-terracotta'}`} />
                      <div className="min-w-0 space-y-3">
                        <h4 className="text-[17px] font-bold leading-7">{f.issue}</h4>
                        <div>
                          <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-1">Why it matters</p>
                          <p className="text-base leading-8 text-paper-ink/70">{f.suggestionZh}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-1">Big-picture fix</p>
                          <p className="text-base leading-8 text-paper-ink/70">
                            {f.paragraphFixZh || 'No sentence-level correction covers this issue. This needs paragraph-level revision.'}
                          </p>
                        </div>
                        {f.relatedCorrectionIds?.length ? (
                          <div className="flex flex-wrap gap-2">
                            <span className="text-xs font-sans text-paper-ink/45 self-center">Related:</span>
                            {f.relatedCorrectionIds.map(id => (
                              <span key={id} className="text-[10px] font-sans font-bold uppercase tracking-widest border border-paper-ink/10 bg-paper-50 px-2 py-1 rounded-sm">
                                Correction #{id.replace(/^C/i, '')}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm leading-7 text-paper-ink/60 bg-paper-50/70 border border-paper-ink/10 rounded-sm p-3">
                            No sentence-level correction covers this issue. This needs paragraph-level revision.
                          </p>
                        )}
                        {f.exampleFrame && (
                          <p className="text-sm leading-7 text-paper-ink/70 bg-paper-50/70 border border-paper-ink/10 rounded-sm p-3">
                            Example frame: {f.exampleFrame}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <PaperCard className="min-h-[220px]">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Model Answer Excerpt</h3>
              <div className="min-h-[132px] rounded-sm border border-paper-ink/10 bg-paper-ink/[0.02] p-4">
                {hasSubstantialModelAnswer ? (
                  <div className="text-[17px] text-paper-ink/75 leading-8 whitespace-pre-wrap max-h-[420px] overflow-auto pr-1">
                    {modelAnswerText}
                  </div>
                ) : (
                  <p className="text-base leading-8 text-paper-ink/65">
                    {isInsufficientSample
                      ? 'Model-answer text is hidden for this insufficient sample so the saved record does not look more reliable than it is.'
                      : 'No substantial model answer excerpt was returned for this attempt.'}
                  </p>
                )}
              </div>
            </PaperCard>

            <details className="group border border-paper-ink/10 bg-paper-ink/[0.02] p-4">
              <summary className="cursor-pointer list-none text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/50 flex items-center justify-between">
                <span>Planning Reference / My Framework</span>
                <span className="text-paper-ink/35 group-open:hidden">Open</span>
                <span className="hidden text-paper-ink/35 group-open:inline">Close</span>
              </summary>
              <div className="mt-4 border-t border-paper-ink/10 pt-4">
                <div className="max-h-[220px] overflow-auto pr-1">
                  {finalFrameworkSummary.trim() ? (
                    <p className="text-base leading-8 whitespace-pre-wrap">{finalFrameworkSummary}</p>
                  ) : (
                    <p className="text-sm text-paper-ink/60">No final framework summary yet. You can go back to Phase 1 to refine it.</p>
                  )}
                </div>
              </div>
            </details>

            <div className="flex justify-between gap-4 border-t border-paper-ink/10 pt-6">
              <SerifButton onClick={exportMarkdown} variant="outline" className="flex-1 text-xs flex items-center justify-center gap-2">
                <FileDown className="w-4 h-4" /> Export Markdown
              </SerifButton>
              <SerifButton onClick={loadRandomQuestion} className="flex-1 text-xs">New Question</SerifButton>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
