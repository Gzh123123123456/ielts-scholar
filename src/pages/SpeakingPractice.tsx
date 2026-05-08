import React, { useState, useEffect, useRef } from 'react';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { SerifButton } from '@/src/components/ui/SerifButton';
import { useApp } from '@/src/context/AppContext';
import { getAIProvider, getAIProviderName, safeAnalyzeSpeaking } from '@/src/lib/ai';
import { formatBandEstimate } from '@/src/lib/bands';
import { speakingPart1, speakingPart2, speakingPart3, SpeakingQuestion } from '@/src/data/questions/bank';
import { SpeakingFeedback } from '@/src/lib/ai/schemas';
import {
  ActiveSpeakingPracticeSession,
  createRecordId,
  getActiveSpeakingSession,
  saveActiveSpeakingSession,
  SpeakingPracticeRecord,
  summarizeDiagnostic,
  upsertPracticeRecord,
} from '@/src/lib/practiceRecords';
import { Link } from 'react-router-dom';
import { Mic, Square, RefreshCcw, Send, ArrowRight, FileDown, Edit3, Volume2, Info, History } from 'lucide-react';

export default function SpeakingPractice() {
  const { addDebugLog, saveSession, capabilities, setProviderDiagnostic } = useApp();
  const [part, setPart] = useState<1 | 2 | 3>(1);
  const [question, setQuestion] = useState<SpeakingQuestion | null>(null);
  const [step, setStep] = useState<'idle' | 'recording' | 'editing' | 'analyzing' | 'results'>('idle');
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const [feedback, setFeedback] = useState<SpeakingFeedback | null>(null);
  const [, setFeedbackFallbackUsed] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState('');
  const [providerErrorMessage, setProviderErrorMessage] = useState('');
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
  const activeSessionRef = useRef<ActiveSpeakingPracticeSession | null>(null);
  const activeAttemptIdRef = useRef(createRecordId('sp'));
  const isRestoringRecordRef = useRef(false);

  useEffect(() => {
    if (!capabilities.speechRecognition && !capabilities.webkitSpeechRecognition) {
      setStatusMessage('Transcription unavailable');
    }
  }, [capabilities]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const getBank = (p: 1 | 2 | 3) => p === 1 ? speakingPart1 : p === 2 ? speakingPart2 : speakingPart3;

  const buildCurrentSpeakingRecord = (status: 'draft' | 'analyzed' | 'provider_failed' = feedback ? 'analyzed' : 'draft'): SpeakingPracticeRecord | null => {
    if (!question) return null;
    const timestamp = new Date().toISOString();
    return {
      id: activeAttemptIdRef.current,
      module: 'speaking',
      mode: 'practice',
      status,
      part,
      question: question.question,
      questionId: question.id,
      topic: question.topicCategory || question.topic,
      tags: question.tags || (question.topicCategory ? [question.topicCategory] : undefined),
      questionData: question,
      createdAt: timestamp,
      updatedAt: timestamp,
      analyzedAt: status === 'analyzed' ? timestamp : undefined,
      transcript,
      transcriptOrigin: transcriptOriginRef.current,
      feedback: status === 'provider_failed' ? undefined : feedback || undefined,
      obsidianMarkdown: status === 'provider_failed' ? undefined : feedback?.obsidianMarkdown,
    };
  };

  const hasMeaningfulAttemptContent = (status?: 'draft' | 'analyzed' | 'provider_failed') =>
    Boolean(transcript.trim() || feedback || status === 'analyzed' || status === 'provider_failed');

  const persistCurrentSpeakingAttempt = (status?: 'draft' | 'analyzed' | 'provider_failed') => {
    if (!hasMeaningfulAttemptContent(status)) return;
    const record = buildCurrentSpeakingRecord(status);
    if (!record) return;

    const session = activeSessionRef.current || {
      id: createRecordId('speaking_session'),
      currentPart: part,
      attemptsByPart: {},
      updatedAt: new Date().toISOString(),
    };
    activeSessionRef.current = {
      ...session,
      currentPart: part,
      attemptsByPart: {
        ...session.attemptsByPart,
        [part]: record,
      },
      updatedAt: new Date().toISOString(),
    };
    saveActiveSpeakingSession(activeSessionRef.current);
    upsertPracticeRecord(record);
  };

  const restoreSpeakingRecord = (record: SpeakingPracticeRecord, message = '') => {
    isRestoringRecordRef.current = true;
    activeAttemptIdRef.current = record.id;
    setPart(record.part);
    setQuestion(record.questionData || getBank(record.part).find(item => item.id === record.questionId) || {
      id: record.questionId || record.id,
      topic: 'Saved Attempt',
      part: record.part,
      question: record.question,
    });
    setTranscript(record.transcript);
    transcriptOriginRef.current = record.transcriptOrigin;
    setFeedback(record.feedback || null);
    setFeedbackFallbackUsed(Boolean(record.providerDiagnostic?.fallbackUsed));
    setStep(record.feedback ? 'results' : record.transcript.trim() ? 'editing' : 'idle');
    setTimer(0);
    setProviderErrorMessage(record.status === 'provider_failed' ? 'AI provider temporarily unavailable. Please retry later.' : '');
    setRestoreMessage(message);
  };

  useEffect(() => {
    const active = getActiveSpeakingSession();
    if (active) {
      activeSessionRef.current = active;
      const restored = active.attemptsByPart[active.currentPart] || active.attemptsByPart[1];
      if (restored) {
        restoreSpeakingRecord(restored);
        return;
      }
    }
    loadRandomQuestion(1);
  }, []);

  useEffect(() => {
    if (isRestoringRecordRef.current) {
      isRestoringRecordRef.current = false;
      return;
    }
    if (!question || step === 'recording' || step === 'analyzing') return;
    persistCurrentSpeakingAttempt(providerErrorMessage ? 'provider_failed' : undefined);
  }, [part, question, step, transcript, feedback, providerErrorMessage]);

  const getQuestionTopicKey = (item: SpeakingQuestion) => item.topicCategory || item.topic;

  const loadRandomQuestion = (p: 1 | 2 | 3, excludeQuestionId?: string, avoidTopicKey?: string) => {
    const bank = p === 1 ? speakingPart1 : p === 2 ? speakingPart2 : speakingPart3;
    const available = excludeQuestionId
      ? bank.filter(item => item.id !== excludeQuestionId)
      : bank;
    const differentTopicAvailable = avoidTopicKey
      ? available.filter(item => getQuestionTopicKey(item) !== avoidTopicKey)
      : [];
    const candidates = differentTopicAvailable.length ? differentTopicAvailable : available.length ? available : bank;
    const random = candidates[Math.floor(Math.random() * candidates.length)];
    activeAttemptIdRef.current = createRecordId('sp');
    setQuestion(random);
    setPart(p);
    setStep('idle');
    setTranscript('');
    setFeedback(null);
    setFeedbackFallbackUsed(false);
    setTimer(0);
    setStatusMessage('Ready');
    setProviderErrorMessage('');
    setRestoreMessage('');
    transcriptOriginRef.current = 'manual';
    addDebugLog(`Loaded question: ${random.id}`);
  };

  const switchPart = (p: 1 | 2 | 3) => {
    persistCurrentSpeakingAttempt();
    const existing = activeSessionRef.current?.attemptsByPart[p];
    if (existing) {
      restoreSpeakingRecord(existing, `Restored saved Part ${p} attempt.`);
      activeSessionRef.current = {
        ...activeSessionRef.current,
        currentPart: p,
        updatedAt: new Date().toISOString(),
      };
      saveActiveSpeakingSession(activeSessionRef.current);
      return;
    }
    loadRandomQuestion(p);
  };

  const changeQuestion = () => {
    const bank = getBank(part);
    const alternatives = question ? bank.filter(item => item.id !== question.id) : bank;
    if (alternatives.length === 0) {
      setRestoreMessage('No other questions available yet.');
      return;
    }

    const hasCurrentWork = Boolean(transcript.trim() || feedback);
    if (hasCurrentWork) {
      const confirmed = window.confirm('Change question? Your current unsaved transcript or feedback will be cleared.');
      if (!confirmed) return;
    }

    if (activeSessionRef.current) {
      activeSessionRef.current = {
        ...activeSessionRef.current,
        attemptsByPart: {
          ...activeSessionRef.current.attemptsByPart,
          [part]: undefined,
        },
        updatedAt: new Date().toISOString(),
      };
      saveActiveSpeakingSession(activeSessionRef.current);
    }

    loadRandomQuestion(part, question?.id, question ? getQuestionTopicKey(question) : undefined);
  };

  const practiceThisQuestionAgain = () => {
    if (!question) return;
    activeAttemptIdRef.current = createRecordId('sp');
    setTranscript('');
    setFeedback(null);
    setFeedbackFallbackUsed(false);
    setProviderDiagnostic(null);
    setTimer(0);
    setStep('idle');
    setStatusMessage('Ready');
    setProviderErrorMessage('');
    setRestoreMessage('');
    transcriptOriginRef.current = 'manual';
    addDebugLog('Started a fresh attempt for the same speaking question.');
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
    setProviderErrorMessage('');
    addDebugLog("Starting AI analysis flow...");
    try {
      const provider = getAIProvider();
      const { feedback: result, diagnostic } = await safeAnalyzeSpeaking(provider, getAIProviderName(), {
        part,
        question: question?.question || '',
        transcript
      });
      setProviderDiagnostic(diagnostic);

      if (diagnostic.failureKind === 'provider_unavailable') {
        setFeedbackFallbackUsed(false);
        setProviderErrorMessage('AI provider temporarily unavailable. Please retry later. Your transcript is preserved.');
        setStep('editing');
        persistCurrentSpeakingAttempt('provider_failed');
        const failedBase = buildCurrentSpeakingRecord('provider_failed');
        if (failedBase) {
          upsertPracticeRecord({
            ...failedBase,
            providerDiagnostic: summarizeDiagnostic(diagnostic),
          });
        }
        addDebugLog("Provider unavailable for speaking feedback.");
        return;
      }

      setFeedbackFallbackUsed(diagnostic.fallbackUsed);
      setFeedback(result);
      setStep('results');
      persistCurrentSpeakingAttempt('analyzed');
      const analyzedBase = buildCurrentSpeakingRecord('analyzed');
      if (analyzedBase) {
        upsertPracticeRecord({
          ...analyzedBase,
          feedback: result,
          obsidianMarkdown: result.obsidianMarkdown,
          analyzedAt: diagnostic.timestamp,
          providerDiagnostic: summarizeDiagnostic(diagnostic),
        });
      }
      
      saveSession({
        id: `sp_${Date.now()}`,
        date: new Date().toISOString(),
        module: 'speaking',
        mode: 'practice',
        question: question?.question,
        transcript,
        transcriptOrigin: transcriptOriginRef.current,
        feedback: result,
        providerDiagnostic: summarizeDiagnostic(diagnostic),
      });
      
      addDebugLog("Analysis complete and results displayed.");
      if (diagnostic.fallbackUsed) {
        addDebugLog("Provider fallback used for speaking feedback.");
      }
    } catch (error) {
      addDebugLog(`Analysis Error: ${error}`);
      setFeedbackFallbackUsed(false);
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

  const isMock = getAIProviderName() !== 'gemini';

  return (
    <PageShell size={step === 'results' ? 'wide' : 'medium'}>
      <TopBar />
      
      <div className="flex flex-col gap-3 mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3 p-1.5 bg-paper-ink/5 rounded-sm self-start font-sans text-sm uppercase tracking-widest font-bold">
          {[1, 2, 3].map((p) => (
            <button
              key={p}
              onClick={() => switchPart(p as 1 | 2 | 3)}
              className={`min-w-28 px-5 py-3 rounded-sm transition-all duration-200 ${
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
        <Link to="/practice-history" className="inline-flex items-center gap-2 text-sm italic text-paper-ink/45 hover:text-accent-terracotta">
          View history <History className="w-4 h-4" />
        </Link>
      </div>

      {(restoreMessage || providerErrorMessage) && (
        <div className="mb-6 space-y-2">
          {restoreMessage && (
            <div className="inline-flex p-2 bg-paper-ink/5 border border-paper-ink/10 rounded-sm text-[10px] font-sans uppercase tracking-widest text-paper-ink/35">
              {restoreMessage}
            </div>
          )}
          {providerErrorMessage && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-sm font-sans">
              {providerErrorMessage}
            </div>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-8 items-start mb-12">
        <div className={`lg:col-span-12 ${step === 'results' ? 'xl:col-span-12 space-y-6' : 'xl:col-span-12 xl:grid xl:grid-cols-[minmax(360px,0.9fr)_minmax(460px,1.1fr)] xl:gap-6 xl:items-start space-y-6 xl:space-y-0'}`}>
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
                  <SerifButton onClick={changeQuestion} variant="outline" className="flex items-center gap-2">
                    <RefreshCcw className="w-4 h-4" /> Change Question
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
                  <SerifButton onClick={changeQuestion} variant="outline" className="flex items-center gap-2">
                    Change Question
                  </SerifButton>
                </>
              )}
              {step === 'results' && (
                <>
                  <SerifButton onClick={practiceThisQuestionAgain} className="flex items-center gap-2">
                    Practice This Question Again
                  </SerifButton>
                  <SerifButton onClick={() => loadRandomQuestion(part)} variant="outline" className="flex items-center gap-2">
                    Continue Training <ArrowRight className="w-4 h-4" />
                  </SerifButton>
                </>
              )}
            </div>
          </PaperCard>

          {(step !== 'idle' && step !== 'analyzing') && (
            <PaperCard className={step === 'results' ? 'opacity-60 grayscale-[0.5]' : ''}>
              <div className="flex items-center justify-between mb-4 border-b border-paper-ink/5 pb-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/50 flex items-center gap-2">
                    <Edit3 className="w-3 h-3" /> {step === 'editing' ? 'Edit Your Transcript' : 'My Transcript'}
                  </h3>
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
                className="w-full min-h-[300px] xl:min-h-[420px] bg-transparent border border-transparent rounded-sm font-serif text-lg leading-relaxed placeholder:opacity-40 resize-y focus:border-accent-terracotta focus:shadow-[0_0_0_1px_rgba(166,77,50,0.2)]"
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
        <div className="lg:col-span-12">
          
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <PaperCard className="bg-paper-200 border-none relative">
                <h3 className="text-sm font-bold uppercase tracking-widest mb-6 text-paper-ink/50 border-b border-paper-ink/10 pb-2">Language Performance</h3>
                <div className="flex flex-wrap items-end gap-4 mb-8">
                  <span className="text-7xl font-bold text-accent-terracotta leading-none">{formatBandEstimate(feedback.bandEstimateExcludingPronunciation)}</span>
                  <div className="flex flex-col pb-2">
                    <span className="text-sm text-paper-ink/60 font-bold uppercase tracking-widest">Training Estimate</span>
                    <span className="text-xs text-paper-ink/40 italic">Pronunciation is not assessed in V1.</span>
                  </div>
                </div>
                
                <div className="grid gap-3 md:grid-cols-3 mb-4">
                  {[
                    { label: 'Fluency & Coherence', score: feedback.scores.fluencyCoherence },
                    { label: 'Lexical Resource', score: feedback.scores.lexicalResource },
                    { label: 'Grammatical Range', score: feedback.scores.grammaticalRangeAccuracy },
                  ].map((s) => (
                    <div key={s.label} className="border border-paper-ink/10 bg-paper-50/50 p-4">
                      <span className="block text-xs font-sans uppercase tracking-widest text-paper-ink/50 mb-2">{s.label}</span>
                      <span className="text-2xl font-bold text-paper-ink">{formatBandEstimate(s.score)}</span>
                    </div>
                  ))}
                </div>

                {isMock && (
                  <div className="mt-6 flex items-center gap-2 p-2 bg-paper-ink/5 rounded text-xs text-paper-ink/40 italic">
                    <Info className="w-3 h-3" /> Prototype feedback using mock AI.
                  </div>
                )}
              </PaperCard>

              <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
                <div className="space-y-3">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-red-800 ml-1">Must Fix</h4>
                  {feedback.fatalErrors.length === 0 ? (
                    <PaperCard className="p-5 border-l-2 border-l-green-700/50">
                      <p className="text-lg leading-8 text-paper-ink/85 bg-paper-ink/[0.04] border border-paper-ink/10 p-4 rounded-sm">No critical correction needed for this attempt. Focus on making the answer more fluent and specific.</p>
                    </PaperCard>
                  ) : (
                    <div className="space-y-4">
                      {feedback.fatalErrors.map((err, i) => (
                        <PaperCard key={i} className="p-5 border-l-2 border-l-red-800">
                          <div className="text-sm line-through text-paper-ink/45 mb-2 leading-6">{err.original}</div>
                          <div className="text-xl font-bold text-red-800 mb-3 leading-8">{err.correction}</div>
                          <p className="text-[17px] leading-8 text-paper-ink/90 bg-paper-ink/[0.05] border border-paper-ink/10 p-4 rounded-sm">{err.explanationZh}</p>
                        </PaperCard>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-[#a64d32] ml-1">Optional Polish</h4>
                  {feedback.naturalnessHints.length === 0 ? (
                    <PaperCard className="p-5 border-l-2 border-l-paper-ink/20">
                      <p className="text-lg leading-8 text-paper-ink/75 bg-paper-ink/[0.04] border border-paper-ink/10 p-4 rounded-sm">No optional polish item was returned for this attempt.</p>
                    </PaperCard>
                  ) : (
                    <div className="space-y-4">
                      {feedback.naturalnessHints.map((hint, i) => (
                        <PaperCard key={i} className="p-5 border-l-2 border-l-[#a64d32]/40">
                          <div className="text-sm text-paper-ink/45 mb-2 italic leading-6">"{hint.original}" </div>
                          <div className="text-xl font-bold text-[#a64d32] mb-3 leading-8">Better: {hint.better}</div>
                          <p className="text-[17px] leading-8 text-paper-ink/90 bg-paper-ink/[0.05] border border-paper-ink/10 p-4 rounded-sm">{hint.explanationZh}</p>
                        </PaperCard>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {feedback.band9Refinements.length > 0 && (
                <section className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-paper-ink/55 ml-1">
                    Band 9 Refinement / Examiner-Friendly Refinement
                  </h4>
                  <PaperCard className="border-l-2 border-l-paper-ink/30 bg-paper-50">
                    <p className="text-sm font-sans uppercase tracking-widest text-paper-ink/35 mb-4">
                      Not mistakes. These are high-level refinements for stronger spoken delivery.
                    </p>
                    <div className="grid gap-4 lg:grid-cols-2">
                      {feedback.band9Refinements.map((item, index) => (
                        <div key={index} className="border border-paper-ink/10 bg-paper-ink/[0.03] p-4 rounded-sm">
                          <p className="text-base leading-7 text-paper-ink/75 mb-3">{item.observation}</p>
                          <p className="text-lg leading-8 font-bold text-paper-ink mb-3">{item.refinement}</p>
                          <p className="text-base leading-8 text-paper-ink/85">{item.explanationZh}</p>
                        </div>
                      ))}
                    </div>
                  </PaperCard>
                </section>
              )}

              {feedback.preservedStyle.length > 0 && (
                <section className="border border-paper-ink/10 bg-paper-ink/[0.02] p-5">
                  <h4 className="text-sm font-sans font-bold uppercase tracking-widest text-paper-ink/50 mb-4">
                    <span>Preserved Personal Style</span>
                  </h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    {feedback.preservedStyle.slice(0, 4).map((style, i) => (
                      <div key={i} className="border-l-2 border-l-accent-terracotta/30 pl-4 py-1">
                        <p className="text-lg italic text-paper-ink leading-8">"{style.text}"</p>
                        <div className="text-[10px] mt-1 opacity-60">— {style.reasonZh}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <PaperCard className="bg-paper-50 !p-8 md:!p-10 border-l-2 border-l-accent-terracotta">
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-widest text-paper-ink/45 mb-6 border-b border-paper-ink/10 pb-3">High-Band Transformation</h4>
                    <p className="text-2xl italic leading-10 text-paper-ink font-serif max-w-4xl">
                      "{feedback.upgradedAnswer}"
                    </p>
                  </div>
                  <div className="lg:pt-12">
                    <SerifButton onClick={exportMarkdown} className="w-full lg:w-auto text-xs flex items-center justify-center gap-2 py-3 whitespace-nowrap" variant="outline">
                      <FileDown className="w-4 h-4" /> Export to Obsidian (.md)
                    </SerifButton>
                  </div>
                </div>
              </PaperCard>
            </div>
        </div>
        )}
      </div>
    </PageShell>
  );
}
