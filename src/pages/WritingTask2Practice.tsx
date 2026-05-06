import React, { useState, useEffect } from 'react';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { SerifButton } from '@/src/components/ui/SerifButton';
import { useApp } from '@/src/context/AppContext';
import { getAIProvider } from '@/src/lib/ai';
import { writingTask2, WritingQuestion } from '@/src/data/questions/bank';
import { WritingFeedback } from '@/src/lib/ai/schemas';
import { FileText, Send, ArrowRight, FileDown, ShieldCheck, AlertCircle } from 'lucide-react';


export default function WritingTask2Practice() {
  const { addDebugLog, saveSession } = useApp();
  const [question, setQuestion] = useState<WritingQuestion | null>(null);
  const [phase, setPhase] = useState<'framework' | 'writing' | 'results'>('framework');
  const [frameworkChat, setFrameworkChat] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [frameworkInput, setFrameworkInput] = useState('');
  const [essay, setEssay] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);

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
    addDebugLog(`Loaded writing question: ${random.id}`);
  };

  const handleFrameworkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!frameworkInput.trim()) return;

    const userInput = frameworkInput;
    setFrameworkChat(prev => [...prev, { role: 'user', text: userInput }]);
    setFrameworkInput('');
    
    // Mocking AI framework response
    await new Promise(r => setTimeout(r, 1000));
    setFrameworkChat(prev => [...prev, { role: 'ai', text: "That sounds like a valid starting point. However, make sure you address 'both views' as requested by the prompt. How do you plan to structure the counter-argument paragraph? (This is a mock response in V1)" }]);
  };

  const analyzeEssay = async () => {
    setIsAnalyzing(true);
    addDebugLog("Analyzing essay...");
    try {
      const provider = getAIProvider();
      const result = await provider.analyzeWriting({
        task: 'task2',
        question: question?.question || '',
        essay
      });
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
    } catch (error) {
      console.error(error);
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

  const isMock = !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY';

  return (
    <PageShell>
      <TopBar />

      <div className="mb-8">
        <PaperCard className="bg-paper-200 border-none">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40">Task 2 Question</span>
            <span className="question-type-badge">({question?.type})</span>
          </div>
          <h2 className="text-xl leading-relaxed">{question?.question}</h2>
        </PaperCard>
      </div>

      <div className="flex gap-4 p-1 bg-paper-ink/5 rounded-sm self-start mb-8 font-sans text-[10px] uppercase tracking-widest font-bold">
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

      <div className="max-w-3xl">
          {phase === 'framework' && (
            <div className="space-y-6">
              <PaperCard className="h-[500px] flex flex-col p-0 overflow-hidden">
                <div className="flex-1 overflow-auto p-6 space-y-4 font-serif text-sm">
                  {frameworkChat.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded p-4 ${msg.role === 'user' ? 'bg-accent-terracotta text-paper-50' : 'bg-paper-ink/5 text-paper-ink-muted italic'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleFrameworkSubmit} className="p-4 border-t border-paper-ink/10 flex gap-2 items-end">
                  <textarea
                    value={frameworkInput}
                    onChange={(e) => setFrameworkInput(e.target.value)}
                    placeholder="Type your logic or points here — Chinese or English..."
                    rows={3}
                    autoFocus
                    className="flex-1 bg-transparent border border-paper-ink/10 rounded-sm p-2 font-serif text-sm leading-relaxed resize-none placeholder:opacity-40 focus:border-accent-terracotta focus:shadow-[0_0_0_1px_rgba(166,77,50,0.2)]"
                  />
                  <SerifButton type="submit" variant="secondary" className="px-4 py-1 text-xs">Send</SerifButton>
                </form>
              </PaperCard>
              <div className="flex items-center gap-2 text-xs text-paper-ink/40 font-sans border border-paper-ink/10 rounded-sm p-3 bg-paper-ink/[0.02]">
                <span className="font-bold uppercase tracking-wider text-paper-ink/50 shrink-0">Check:</span>
                <span>Clear position?</span><span className="text-paper-ink/20">|</span>
                <span>Both views addressed?</span><span className="text-paper-ink/20">|</span>
                <span>Logical flow?</span>
              </div>
              <div className="flex justify-end">
                <SerifButton onClick={() => setPhase('writing')} className="flex items-center gap-2">
                  Done with Framework <ArrowRight className="w-4 h-4" />
                </SerifButton>
              </div>
            </div>
          )}

          {phase === 'writing' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-xs text-paper-ink/40 font-sans border border-paper-ink/10 rounded-sm p-3 bg-paper-ink/[0.02]">
                <span className="font-bold uppercase tracking-wider text-paper-ink/50 shrink-0">Per paragraph:</span>
                <span>Topic sentence?</span><span className="text-paper-ink/20">|</span>
                <span>Specific example?</span><span className="text-paper-ink/20">|</span>
                <span>Link to thesis?</span><span className="text-paper-ink/20">|</span>
                <span>Natural phrasing?</span>
              </div>
              <PaperCard className="p-0">
                <textarea
                  value={essay}
                  onChange={(e) => setEssay(e.target.value)}
                  placeholder="Start writing your 250+ word essay here..."
                  autoFocus
                  className="w-full h-[600px] p-8 bg-transparent border border-transparent rounded-sm font-serif text-lg leading-relaxed placeholder:opacity-40 resize-none focus:border-accent-terracotta focus:shadow-[0_0_0_1px_rgba(166,77,50,0.2)]"
                />
              </PaperCard>
              <div className="flex justify-between items-center bg-paper-ink/5 p-4 rounded text-xs font-sans text-paper-ink/40 uppercase tracking-widest">
                <span>WORD COUNT: {essay.trim() ? essay.trim().split(/\s+/).length : 0}</span>
                <div className="flex items-center gap-4">
                  {(() => {
                    const wc = essay.trim() ? essay.trim().split(/\s+/).length : 0;
                    if (wc > 0 && wc < 20) {
                      return (
                        <span className="text-[10px] normal-case tracking-normal text-paper-ink/30 italic max-w-[200px] text-right leading-tight">
                          Short for a full Task 2 essay. Feedback is best treated as paragraph-level practice.
                        </span>
                      );
                    }
                    return null;
                  })()}
                  <SerifButton onClick={analyzeEssay} disabled={isAnalyzing || !essay.trim()} className="flex items-center gap-2">
                    {isAnalyzing ? "Analyzing..." : "Submit for Analysis"} <Send className="w-4 h-4" />
                  </SerifButton>
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

              {isMock && (
                <div className="flex items-center gap-2 p-3 bg-paper-ink/5 rounded text-[10px] text-paper-ink/40 italic uppercase tracking-wider border border-paper-ink/10 font-sans">
                  <span>Prototype feedback shown using mock AI. Connect Gemini for official evaluation.</span>
                </div>
              )}

              <section>
                <h3 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-700" /> Key Corrections
                </h3>
                <div className="space-y-4">
                  {feedback.sentenceFeedback.map((item, i) => (
                    <PaperCard key={i} className="border-l-2 border-l-paper-ink/20">
                      <div className="text-xs text-paper-ink/40 italic line-through mb-1">{item.original}</div>
                      <div className="text-sm font-bold mb-2">{item.correction}</div>
                      <div className="flex items-center gap-2 mb-2 text-[10px] uppercase font-sans font-bold text-accent-terracotta">
                        <span>{item.dimension}</span>
                        <span className="opacity-30">•</span>
                        <span>{item.tag}</span>
                      </div>
                      <p className="text-[11px] text-paper-ink-muted bg-paper-ink/5 p-2 rounded">{item.explanationZh}</p>
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
                    <div key={i} className={`p-4 border border-paper-ink/10 rounded flex items-start gap-3 transition-colors ${f.severity === 'fatal' ? 'bg-red-50/50 border-red-100' : 'bg-paper-ink/5'}`}>
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${f.severity === 'fatal' ? 'bg-red-800' : 'bg-accent-terracotta'}`} />
                      <div>
                        <h4 className="text-sm font-bold">{f.issue}</h4>
                        <p className="text-xs italic text-paper-ink/60">{f.suggestionZh}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <PaperCard>
                <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Model Answer Excerpt</h3>
                <div className="text-sm italic text-paper-ink/60 leading-relaxed max-h-40 overflow-hidden relative">
                  {feedback.modelAnswer}
                  <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-paper-50 to-transparent" />
                </div>
                <div className="mt-6 flex justify-between gap-4">
                  <SerifButton onClick={exportMarkdown} variant="outline" className="flex-1 text-xs flex items-center justify-center gap-2">
                    <FileDown className="w-4 h-4" /> Download Complete Note
                  </SerifButton>
                  <SerifButton onClick={loadRandomQuestion} className="flex-1 text-xs">New Question</SerifButton>
                </div>
              </PaperCard>
            </div>
          )}
      </div>
    </PageShell>
  );
}
