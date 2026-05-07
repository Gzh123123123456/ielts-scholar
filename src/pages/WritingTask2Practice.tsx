import React, { useState, useEffect, useRef } from 'react';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { SerifButton } from '@/src/components/ui/SerifButton';
import { useApp } from '@/src/context/AppContext';
import { getAIProvider, getAIProviderName, isMockProviderActive, safeAnalyzeWriting, safeExtractWritingFramework } from '@/src/lib/ai';
import { writingTask2, WritingQuestion } from '@/src/data/questions/bank';
import { WritingFeedback } from '@/src/lib/ai/schemas';
import { Send, ArrowRight, FileDown, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';

export default function WritingTask2Practice() {
  const { addDebugLog, saveSession, setProviderDiagnostic } = useApp();
  const [question, setQuestion] = useState<WritingQuestion | null>(null);
  const [phase, setPhase] = useState<'framework' | 'writing' | 'results'>('framework');
  const [frameworkChat, setFrameworkChat] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [frameworkInput, setFrameworkInput] = useState('');
  const [finalFrameworkSummary, setFinalFrameworkSummary] = useState('');
  const [essay, setEssay] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExtractingFramework, setIsExtractingFramework] = useState(false);
  const [frameworkExtractMessage, setFrameworkExtractMessage] = useState('');
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [feedbackFallbackUsed, setFeedbackFallbackUsed] = useState(false);
  const discussionRef = useRef<HTMLDivElement | null>(null);
  const isFrameworkInputComposingRef = useRef(false);

  useEffect(() => {
    loadRandomQuestion();
  }, []);

  const loadRandomQuestion = () => {
    const random = writingTask2[Math.floor(Math.random() * writingTask2.length)];
    setQuestion(random);
    setPhase('framework');
    setEssay('');
    setFeedback(null);
    setFrameworkChat([{ role: 'ai', text: "First, define your position and two main arguments regarding this prompt. You may explain them in Chinese or English." }]);
    setFinalFrameworkSummary('');
    setFrameworkExtractMessage('');
    addDebugLog(`Loaded writing question: ${random.id}`);
  };

  const submitFrameworkNote = async () => {
    if (!frameworkInput.trim()) return;

    const userInput = frameworkInput;
    setFrameworkChat(prev => [...prev, { role: 'user', text: userInput }]);
    setFrameworkInput('');

    await new Promise(r => setTimeout(r, 1000));
    setFrameworkChat(prev => [...prev, { role: 'ai', text: "That sounds like a valid starting point. However, make sure you address 'both views' as requested by the prompt. How do you plan to structure the counter-argument paragraph? (This is a mock response in V1)" }]);

    requestAnimationFrame(() => {
      if (discussionRef.current) {
        discussionRef.current.scrollTop = discussionRef.current.scrollHeight;
      }
    });
  };

  const handleFrameworkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitFrameworkNote();
  };

  const handleFrameworkInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isComposing = isFrameworkInputComposingRef.current || e.nativeEvent.isComposing;
    if (e.key !== 'Enter' || e.shiftKey || isComposing) return;

    e.preventDefault();
    void submitFrameworkNote();
  };

  const buildFrameworkNotes = () => {
    const chatNotes = frameworkChat
      .filter(msg => msg.role === 'user')
      .map(msg => msg.text.trim())
      .filter(Boolean);
    const draftInput = frameworkInput.trim();

    return [...chatNotes, draftInput].filter(Boolean).join('\n\n');
  };

  const extractFinalFramework = async () => {
    const notes = buildFrameworkNotes();
    setFrameworkExtractMessage('');

    if (!notes.trim()) {
      const message = 'Add a few Coach Discussion notes first, then extract a framework summary.';
      setFrameworkExtractMessage(message);
      addDebugLog('Framework extraction skipped: empty notes.');
      return;
    }

    setIsExtractingFramework(true);
    addDebugLog('Extracting Writing Task 2 framework summary...');

    try {
      const provider = getAIProvider();
      const { feedback: result, diagnostic } = await safeExtractWritingFramework(provider, getAIProviderName(), {
        task: 'task2',
        question: question?.question || '',
        notes,
      });

      setProviderDiagnostic(diagnostic);
      setFinalFrameworkSummary(result.editableSummary);
      setFrameworkExtractMessage(
        diagnostic.fallbackUsed
          ? 'A safe fallback framework was generated. Please review and edit it before writing.'
          : 'Framework summary generated. You can edit it before moving to Phase 2.',
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
    addDebugLog("Analyzing essay...");
    try {
      const provider = getAIProvider();
      const { feedback: result, diagnostic } = await safeAnalyzeWriting(provider, getAIProviderName(), {
        task: 'task2',
        question: question?.question || '',
        essay
      });
      setProviderDiagnostic(diagnostic);
      setFeedbackFallbackUsed(diagnostic.fallbackUsed);
      setFeedback(result);
      setPhase('results');

      saveSession({
        id: `wt2_${Date.now()}`,
        date: new Date().toISOString(),
        module: 'writing',
        mode: 'practice',
        question: question?.question,
        essay,
        feedback: result
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
    const blob = new Blob([feedback.obsidianMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ielts-writing-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isMock = isMockProviderActive();
  const writingWorkspaceClass = 'w-[94vw] max-w-[1600px] mx-auto';
  const modelAnswerText = feedback?.modelAnswer?.trim() || '';
  const hasSubstantialModelAnswer = modelAnswerText.length > 24 && modelAnswerText !== 'Sample Band 9 essay content...';

  return (
    <PageShell className="max-w-none px-3 md:px-6 xl:px-8">
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

      <div className={`${writingWorkspaceClass} flex gap-4 p-1 bg-paper-ink/5 rounded-sm self-start mb-8 font-sans uppercase tracking-widest font-bold overflow-x-auto`}>
        <button
          onClick={() => setPhase('framework')}
          className={phase === 'framework' ? 'phase-tab phase-tab-active' : 'phase-tab'}
        >
          Phase 1: Framework
        </button>
        <button
          onClick={() => setPhase('writing')}
          className={phase === 'writing' ? 'phase-tab phase-tab-active' : 'phase-tab'}
        >
          Phase 2: Essay Editor
        </button>
        <button
          onClick={() => setPhase('results')}
          disabled={!feedback}
          className={phase === 'results' ? 'phase-tab phase-tab-active' : 'phase-tab'}
        >
          Phase 3: Final Analysis
        </button>
      </div>

      <div className={writingWorkspaceClass}>
        {phase === 'framework' && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(460px,0.88fr)] xl:items-start">
            <PaperCard className="p-0 overflow-hidden xl:max-h-[calc(100vh-14rem)] xl:flex xl:flex-col">
              <div className="px-6 pt-6 pb-4 border-b border-paper-ink/10 bg-paper-ink/[0.02] shrink-0">
                <h3 className="text-base font-bold uppercase tracking-widest mb-2">Framework Notes</h3>
                <p className="text-sm text-paper-ink/70">
                  Draft in Chinese or English. Focus on Position, View A, View B, and My opinion.
                </p>
              </div>
              <div className="px-6 pt-4 pb-2 shrink-0">
                <p className="text-xs font-sans uppercase tracking-widest text-paper-ink/45 mb-2">Framework headings for your notes</p>
                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                  {['Position', 'View A', 'View B', 'My opinion'].map((label) => (
                    <div key={label} className="border border-paper-ink/10 bg-paper-ink/[0.02] px-3 py-2">
                      <span className="font-semibold">{label}</span>
                    </div>
                  ))}
                </div>
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
                    <p className={`${msg.role === 'user' ? 'text-paper-ink' : 'text-paper-ink-muted italic'} text-[17px] leading-8`}>
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
                <div className="flex justify-end">
                  <SerifButton type="submit" variant="secondary" className="px-4 py-2 text-xs">Send to Coach</SerifButton>
                </div>
              </form>
            </PaperCard>

            <PaperCard className="xl:sticky xl:top-8 xl:max-h-[calc(100vh-4rem)] xl:overflow-hidden xl:flex xl:flex-col">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3 shrink-0">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest mb-3">Final Framework Summary</h3>
                  <p className="text-sm text-paper-ink/70">
                    Consolidate your final writing framework here: Position, View A, View B, My opinion, and optional structure/example.
                  </p>
                </div>
                <SerifButton
                  type="button"
                  variant="outline"
                  onClick={extractFinalFramework}
                  disabled={isExtractingFramework}
                  className="shrink-0 text-xs flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {isExtractingFramework ? 'Extracting...' : 'Generate Framework Summary'}
                </SerifButton>
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
                className="w-full min-h-[360px] xl:min-h-0 xl:flex-1 xl:max-h-[calc(100vh-20rem)] bg-transparent border border-paper-ink/10 rounded-sm p-4 font-serif text-[17px] leading-relaxed resize-y placeholder:opacity-40 focus:border-accent-terracotta focus:shadow-[0_0_0_1px_rgba(166,77,50,0.2)]"
              />
              <div className="flex justify-end border-t border-paper-ink/10 pt-4 mt-4 shrink-0">
                <SerifButton onClick={() => setPhase('writing')} className="flex items-center gap-2">
                  Done with Framework <ArrowRight className="w-4 h-4" />
                </SerifButton>
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
                <span>WORD COUNT: {essay.trim() ? essay.trim().split(/\s+/).length : 0}</span>
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Task Response', score: feedback.scores.taskResponse },
                { label: 'Cohesion', score: feedback.scores.coherenceCohesion },
                { label: 'Lexical', score: feedback.scores.lexicalResource },
                { label: 'Grammar', score: feedback.scores.grammaticalRangeAccuracy },
              ].map((s) => (
                <PaperCard key={s.label} className="text-center p-4">
                  <div className="text-[10px] font-sans font-bold text-paper-ink/40 uppercase mb-1">{s.label}</div>
                  <div className="text-2xl font-bold text-accent-terracotta">{s.score}</div>
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
              <section>
                <h3 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-700" /> Key Corrections
                </h3>
                <div className="space-y-4">
                  {feedback.sentenceFeedback.map((item, i) => (
                    <PaperCard key={i} className="border-l-2 border-l-paper-ink/20">
                      <div className="text-sm text-paper-ink/45 italic line-through mb-2 leading-7">{item.original}</div>
                      <div className="text-[17px] font-bold mb-3 leading-8">{item.correction}</div>
                      <div className="flex items-center gap-2 mb-2 text-[10px] uppercase font-sans font-bold text-accent-terracotta">
                        <span>{item.dimension}</span>
                        <span className="opacity-30">-</span>
                        <span>{item.tag}</span>
                      </div>
                      <p className="text-sm leading-7 text-paper-ink-muted bg-paper-ink/5 p-3 rounded">{item.explanationZh}</p>
                    </PaperCard>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-accent-terracotta" /> Framework Logic Review
                </h3>
                <div className="space-y-3">
                  {feedback.frameworkFeedback.map((f, i) => (
                    <div key={i} className={`p-5 border border-paper-ink/10 rounded flex items-start gap-3 transition-colors ${f.severity === 'fatal' ? 'bg-red-50/50 border-red-100' : 'bg-paper-ink/5'}`}>
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${f.severity === 'fatal' ? 'bg-red-800' : 'bg-accent-terracotta'}`} />
                      <div>
                        <h4 className="text-[17px] font-bold leading-7">{f.issue}</h4>
                        <p className="text-sm italic leading-7 text-paper-ink/60 mt-1">{f.suggestionZh}</p>
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
                  <div className="text-[17px] italic text-paper-ink/60 leading-8 whitespace-pre-wrap max-h-[420px] overflow-auto pr-1">
                    {modelAnswerText}
                  </div>
                ) : (
                  <p className="text-sm leading-7 text-paper-ink/50 italic">
                    Mock provider did not return a substantial model answer excerpt for this attempt. When a real provider supplies a longer excerpt, it will appear here without covering the action buttons below.
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

            <div className="space-y-3">
              {isMock && (
                <div className="flex items-center gap-2 p-3 bg-paper-ink/5 rounded text-[10px] text-paper-ink/40 italic uppercase tracking-wider border border-paper-ink/10 font-sans">
                  <span>Prototype feedback shown using mock AI. Connect Gemini for official evaluation.</span>
                </div>
              )}

              {feedbackFallbackUsed && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded font-sans">
                  Some provider feedback was malformed and has been safely normalized. Check the Debug Panel for details.
                </div>
              )}
            </div>

            <div className="flex justify-between gap-4 border-t border-paper-ink/10 pt-6">
              <SerifButton onClick={exportMarkdown} variant="outline" className="flex-1 text-xs flex items-center justify-center gap-2">
                <FileDown className="w-4 h-4" /> Download Complete Note
              </SerifButton>
              <SerifButton onClick={loadRandomQuestion} className="flex-1 text-xs">New Question</SerifButton>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
