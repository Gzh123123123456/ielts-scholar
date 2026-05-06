import React, { useState, useEffect, useRef } from 'react';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { SerifButton } from '@/src/components/ui/SerifButton';
import { useApp } from '@/src/context/AppContext';
import { getAIProvider } from '@/src/lib/ai';
import { speakingPart1, speakingPart2, speakingPart3, SpeakingQuestion } from '@/src/data/questions/bank';
import { SpeakingFeedback } from '@/src/lib/ai/schemas';
import { Mic, Square, Play, RefreshCcw, Send, ArrowRight, FileDown, Edit3, Volume2, Info } from 'lucide-react';

export default function SpeakingPractice() {
  const { addDebugLog, saveSession, capabilities } = useApp();
  const [part, setPart] = useState<1 | 2 | 3>(1);
  const [question, setQuestion] = useState<SpeakingQuestion | null>(null);
  const [step, setStep] = useState<'idle' | 'recording' | 'editing' | 'analyzing' | 'results'>('idle');
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const [feedback, setFeedback] = useState<SpeakingFeedback | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<'Ready' | 'Requesting microphone...' | 'Listening...' | 'No speech detected' | 'Transcription unavailable' | 'Mic denied'>('Ready');

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const transcriptOriginRef = useRef<'speech' | 'manual'>('manual');
  const silenceTimeoutRef = useRef<any>(null);
  const speechRetriesRef = useRef(0);
  const hasSpeechResultRef = useRef(false);
  const fatalSpeechErrorRef = useRef(false);
  const isRecordingRef = useRef(false);
  const retryTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (!capabilities.speechRecognition && !capabilities.webkitSpeechRecognition) {
      setStatusMessage('Transcription unavailable');
    }
  }, [capabilities]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const loadRandomQuestion = (p: 1 | 2 | 3) => {
    const bank = p === 1 ? speakingPart1 : p === 2 ? speakingPart2 : speakingPart3;
    const random = bank[Math.floor(Math.random() * bank.length)];
    setQuestion(random);
    setPart(p);
    setStep('idle');
    setTranscript('');
    setFeedback(null);
    setTimer(0);
    setStatusMessage('Ready');
    transcriptOriginRef.current = 'manual';
    addDebugLog(`Loaded question: ${random.id}`);
  };

  const readQuestion = () => {
    if (!question) return;
    if (!window.speechSynthesis) {
      addDebugLog('SpeechSynthesis not available');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(
      question.cueCard ? question.question + '. ' + question.cueCard : question.question
    );
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    setIsSynthesizing(true);
    utterance.onend = () => setIsSynthesizing(false);
    utterance.onerror = () => {
      setIsSynthesizing(false);
      addDebugLog('SpeechSynthesis error');
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const startRecording = async () => {
    setStatusMessage('Requesting microphone...');
    try {
      // Explicitly request mic access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // We check permission but don't hold the stream if we're not saving audio in V1
      stream.getTracks().forEach(track => track.stop());
      
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setStatusMessage('Transcription unavailable');
        setStep('editing');
        return;
      }

      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setStatusMessage('Listening...');
        // Set a timeout to warn if no speech is detected after 5 seconds
        silenceTimeoutRef.current = setTimeout(() => {
          if (!transcript) setStatusMessage('No speech detected');
        }, 5000);
      };

      recognitionRef.current.onresult = (event: any) => {
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        setStatusMessage('Listening...');
        
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          hasSpeechResultRef.current = true;
          transcriptOriginRef.current = 'speech';
          setTranscript(prev => (prev + ' ' + finalTranscript).trim());
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        addDebugLog(`Speech error: ${event.error}`);
        addDebugLog(`lastSpeechError = "${event.error}"`);

        if (event.error === 'not-allowed') {
          fatalSpeechErrorRef.current = true;
          setStatusMessage('Mic denied');
        } else if (event.error === 'no-speech') {
          // Not fatal — will retry in onend
        } else {
          // service-not-allowed, audio-capture, network, aborted, etc. — fatal, stop retrying
          fatalSpeechErrorRef.current = true;
          setStatusMessage('Transcription unavailable');
        }
      };

      recognitionRef.current.onend = () => {
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

        const shouldRetry = !hasSpeechResultRef.current
          && !fatalSpeechErrorRef.current
          && speechRetriesRef.current < 2
          && isRecordingRef.current;

        if (shouldRetry) {
          speechRetriesRef.current += 1;
          addDebugLog(`Auto-retry speech recognition (${speechRetriesRef.current}/2)`);

          retryTimeoutRef.current = setTimeout(() => {
            retryTimeoutRef.current = null;
            if (fatalSpeechErrorRef.current) return; // User clicked Done during delay
            const SpeechRecognitionRetry = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            const retry = new SpeechRecognitionRetry();
            retry.continuous = true;
            retry.interimResults = true;
            retry.lang = 'en-US';
            retry.onstart = recognitionRef.current.onstart;
            retry.onresult = recognitionRef.current.onresult;
            retry.onerror = recognitionRef.current.onerror;
            retry.onend = recognitionRef.current.onend;
            recognitionRef.current = retry;
            try {
              retry.start();
            } catch (e: any) {
              addDebugLog(`Retry start error: ${e.message}`);
            }
          }, 500);
        } else {
          addDebugLog(`Speech recognition ended (retries: ${speechRetriesRef.current}, fatal: ${fatalSpeechErrorRef.current})`);
        }
      };

      speechRetriesRef.current = 0;
      hasSpeechResultRef.current = false;
      fatalSpeechErrorRef.current = false;
      recognitionRef.current.start();
      setIsRecording(true);
      setStep('recording');
      setTimer(0);
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
      addDebugLog("Recording started");
    } catch (err) {
      addDebugLog(`Mic Access Error: ${err}`);
      setStatusMessage('Mic denied');
      setStep('editing');
    }
  };

  const resetCurrentAttempt = () => {
    // Stop any pending retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    // Stop any running recognition
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { /* may already be stopped */ }
      recognitionRef.current = null;
    }
    // Clear refs
    fatalSpeechErrorRef.current = true;
    isRecordingRef.current = false;
    speechRetriesRef.current = 0;
    hasSpeechResultRef.current = false;
    transcriptOriginRef.current = 'manual';
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    // Clear state
    setTranscript('');
    setFeedback(null);
    setTimer(0);
    setIsRecording(false);
    setStatusMessage('Ready');
    setStep('idle');
    addDebugLog('Attempt reset (Retry) — transcript, feedback, timer cleared');
  };

  const stopRecording = () => {
    fatalSpeechErrorRef.current = true; // Prevent any pending retry from restarting
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { /* may already be stopped */ }
    }
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    clearInterval(timerRef.current);
    setIsRecording(false);
    setStep('editing');
    setStatusMessage('Ready');
    addDebugLog("Recording stopped");
  };

  const analyze = async () => {
    if (!transcript.trim()) return;
    setStep('analyzing');
    addDebugLog("Starting AI analysis flow...");
    try {
      const provider = getAIProvider();
      const result = await provider.analyzeSpeaking({
        part,
        question: question?.question || '',
        transcript
      });
      setFeedback(result);
      setStep('results');
      
      saveSession({
        id: `sp_${Date.now()}`,
        date: new Date().toISOString(),
        module: 'speaking',
        mode: 'practice',
        question: question?.question,
        transcript,
        transcriptOrigin: transcriptOriginRef.current,
        feedback: result
      });
      
      addDebugLog("Analysis complete and results displayed.");
    } catch (error) {
      addDebugLog(`Analysis Error: ${error}`);
      setStep('editing');
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const exportMarkdown = () => {
    if (!feedback) return;
    const blob = new Blob([feedback.obsidianMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ielts-speaking-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isMock = !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY';

  return (
    <PageShell>
      <TopBar />
      
      <div className="flex gap-4 p-1 bg-paper-ink/5 rounded-sm self-start mb-8 font-sans text-[10px] uppercase tracking-widest font-bold">
        {[1, 2, 3].map((p) => (
          <button
            key={p}
            onClick={() => loadRandomQuestion(p as any)}
            className={`px-3 py-1 rounded-sm transition-all duration-200 ${
              part === p
                ? 'bg-accent-terracotta text-paper-50'
                : 'text-paper-ink/40 hover:text-paper-ink hover:bg-paper-ink/5 cursor-pointer'
            } disabled:opacity-30 disabled:cursor-not-allowed`}
            disabled={step === 'recording' || step === 'analyzing'}
          >
            Part {p}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start mb-12">
        <div className="lg:col-span-12 xl:col-span-7 space-y-6">
          <PaperCard className="relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/30 italic">
                {question?.topic} • Part {part}
              </span>
              <div className="flex items-center gap-3">
                {isRecording && (
                   <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-accent-terracotta font-bold animate-pulse">
                     <span className="w-1.5 h-1.5 rounded-full bg-accent-terracotta" /> Listening...
                   </span>
                )}
                <span className="font-mono text-sm text-paper-ink/40">{formatTime(timer)}</span>
              </div>
            </div>

            <h2 className="text-2xl mb-8 leading-tight text-paper-ink">{question?.question}</h2>
            
            {question?.cueCard && (
              <div className="bg-paper-ink/[0.03] p-5 rounded-sm mb-8 border-l-2 border-accent-terracotta/20 italic text-sm text-paper-ink-muted leading-relaxed">
                {question.cueCard}
              </div>
            )}

            <div className="flex flex-wrap gap-4 pt-4 border-t border-paper-ink/5">
              {step === 'idle' && (
                <>
                  <SerifButton onClick={readQuestion} variant="outline" disabled={isSynthesizing} className="flex items-center gap-2 group">
                    <Volume2 className={`w-4 h-4 ${isSynthesizing ? 'animate-pulse' : ''}`} /> Read Prompt
                  </SerifButton>
                  <SerifButton onClick={startRecording} className="flex items-center gap-2">
                    <Mic className="w-4 h-4" /> Start Recording
                  </SerifButton>
                </>
              )}
              {step === 'recording' && (
                <SerifButton onClick={stopRecording} variant="secondary" className="flex items-center gap-2 bg-red-800 text-white hover:bg-red-900">
                  <Square className="w-4 h-4" /> Stop & Review
                </SerifButton>
              )}
              {step === 'editing' && (
                <>
                  <SerifButton onClick={analyze} disabled={!transcript.trim()} className="flex items-center gap-2 px-8">
                    <Send className="w-4 h-4" /> Analyze
                  </SerifButton>
                  <SerifButton onClick={resetCurrentAttempt} variant="outline" className="flex items-center gap-2">
                    <RefreshCcw className="w-4 h-4" /> Retry
                  </SerifButton>
                </>
              )}
              {step === 'results' && (
                <SerifButton onClick={() => loadRandomQuestion(part)} variant="outline" className="flex items-center gap-2">
                  Continue Training <ArrowRight className="w-4 h-4" />
                </SerifButton>
              )}
            </div>
          </PaperCard>

          {(step !== 'idle' && step !== 'analyzing') && (
            <PaperCard className={step === 'results' ? 'opacity-60 grayscale-[0.5]' : ''}>
              <div className="flex items-center justify-between mb-4 border-b border-paper-ink/5 pb-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 flex items-center gap-2">
                    <Edit3 className="w-3 h-3" /> {step === 'editing' ? 'Edit Your Transcript' : 'Spoken Content'}
                  </h3>
                  <span className="text-[8px] uppercase px-1.5 py-0.5 rounded-sm bg-paper-ink/5 text-paper-ink/40 font-bold border border-paper-ink/10">
                    Source: {transcriptOriginRef.current}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {statusMessage === 'No speech detected' && (
                    <span className="text-[10px] text-accent-terracotta italic font-sans flex items-center gap-1">
                      <Info className="w-3 h-3" /> No speech detected. Try speaking clearly.
                    </span>
                  )}
                  {statusMessage === 'Mic denied' && (
                    <span className="text-[10px] text-red-800 italic flex items-center gap-1 font-sans">
                      <Info className="w-3 h-3" /> Mic denied. Manual typing only.
                    </span>
                  )}
                  {statusMessage === 'Transcription unavailable' && (
                    <span className="text-[10px] text-paper-ink/30 italic font-sans">Recognition unavailable in this browser.</span>
                  )}
                </div>
              </div>
              <textarea
                value={transcript}
                onChange={(e) => {
                  setTranscript(e.target.value);
                  transcriptOriginRef.current = 'manual';
                }}
                disabled={step === 'recording' || step === 'results'}
                placeholder={statusMessage === 'Mic denied' || statusMessage === 'Transcription unavailable' ? "Type your answer manually here..." : "Recognition will appear here..."}
                className="w-full h-48 bg-transparent border border-transparent rounded-sm font-serif text-lg leading-relaxed placeholder:opacity-40 resize-none focus:border-accent-terracotta focus:shadow-[0_0_0_1px_rgba(166,77,50,0.2)]"
              />
            </PaperCard>
          )}

          {step === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <RefreshCcw className="w-6 h-6 animate-spin text-accent-terracotta/40" />
              <p className="font-serif italic text-paper-ink/40 text-sm">Cross-referencing output with Band 9 descriptors...</p>
            </div>
          )}
        </div>

        {step === 'results' && feedback && (
        <div className="lg:col-span-12 xl:col-span-5">
          
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <PaperCard className="bg-paper-200 border-none relative">
                <h3 className="text-[10px] font-bold uppercase tracking-widest mb-6 text-paper-ink/40 border-b border-paper-ink/10 pb-2">Language Performance</h3>
                <div className="flex items-baseline gap-2 mb-8">
                  <span className="text-6xl font-bold text-accent-terracotta leading-none">{feedback.bandEstimateExcludingPronunciation}</span>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-paper-ink/40 font-bold uppercase tracking-tight">Est. Band</span>
                    <span className="text-[8px] text-paper-ink/30 italic uppercase">(Excl. Pronunciation)</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-2 mb-4">
                  {[
                    { label: 'Fluency & Coherence', score: feedback.scores.fluencyCoherence },
                    { label: 'Lexical Resource', score: feedback.scores.lexicalResource },
                    { label: 'Grammatical Range', score: feedback.scores.grammaticalRangeAccuracy },
                  ].map((s) => (
                    <div key={s.label} className="flex justify-between items-center text-xs py-1 border-b border-paper-ink/5 last:border-0">
                      <span className="text-paper-ink/60">{s.label}</span>
                      <span className="font-bold">{s.score}</span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-paper-ink/30 italic flex items-center justify-between pt-2">
                  <span>Pronunciation</span>
                  <span>Not assessed in V1</span>
                </div>

                {isMock && (
                  <div className="mt-6 flex items-center gap-2 p-2 bg-paper-ink/5 rounded text-[9px] text-paper-ink/40 italic uppercase tracking-wider">
                    <Info className="w-3 h-3" /> Prototype feedback using mock AI.
                  </div>
                )}
              </PaperCard>

              {feedback.fatalErrors.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-red-800 ml-1">Critical Corrections</h4>
                  {feedback.fatalErrors.map((err, i) => (
                    <PaperCard key={i} className="p-4 border-l-2 border-l-red-800">
                      <div className="text-xs line-through text-paper-ink/40 mb-1">{err.original}</div>
                      <div className="text-sm font-bold text-red-800 mb-2">{err.correction}</div>
                      <p className="text-[11px] text-paper-ink/60 bg-paper-ink/[0.03] p-3 rounded italic">— {err.explanationZh}</p>
                    </PaperCard>
                  ))}
                </div>
              )}

              {feedback.naturalnessHints.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#a64d32] ml-1">Naturalness Upgrades</h4>
                  {feedback.naturalnessHints.map((hint, i) => (
                    <PaperCard key={i} className="p-4 border-l-2 border-l-[#a64d32]/40">
                      <div className="text-xs text-paper-ink/40 mb-1 italic">"{hint.original}" </div>
                      <div className="text-sm font-bold text-[#a64d32] mb-2">Better: {hint.better}</div>
                      <p className="text-[11px] text-paper-ink/60 bg-paper-ink/[0.03] p-3 rounded italic">— {hint.explanationZh}</p>
                    </PaperCard>
                  ))}
                </div>
              )}

              {feedback.preservedStyle.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-paper-ink/40 ml-1">Preserved Personal Style</h4>
                  <PaperCard className="space-y-3">
                    {feedback.preservedStyle.map((style, i) => (
                      <div key={i} className="text-xs italic text-paper-ink-muted">
                        <span className="font-bold">"{style.text}"</span>
                        <div className="text-[10px] mt-1 opacity-60">— {style.reasonZh}</div>
                      </div>
                    ))}
                  </PaperCard>
                </div>
              )}

              <PaperCard className="bg-paper-50 !p-8">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-paper-ink/40 mb-6 border-b border-paper-ink/10 pb-2">High-Band Transformation</h4>
                <p className="text-base italic leading-relaxed text-paper-ink-muted font-serif">
                  "{feedback.upgradedAnswer}"
                </p>
                <div className="mt-10">
                  <SerifButton onClick={exportMarkdown} className="w-full text-xs flex items-center justify-center gap-2 py-3" variant="outline">
                    <FileDown className="w-4 h-4" /> Export to Obsidian (.md)
                  </SerifButton>
                </div>
              </PaperCard>
            </div>
        </div>
        )}
      </div>
    </PageShell>
  );
}
