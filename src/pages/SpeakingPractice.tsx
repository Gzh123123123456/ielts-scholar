import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { SerifButton } from '@/src/components/ui/SerifButton';
import { QuestionBankItem, QuestionBankModal } from '@/src/components/practice/QuestionBankModal';
import { useApp } from '@/src/context/AppContext';
import { getAIProviderName, routedAnalyzeSpeaking } from '@/src/lib/ai';
import { validateSpeakingTargetLoop } from '@/src/lib/ai/targetValidation';
import { formatBandEstimate, formatConservativeBandEstimate, getTargetLabel, getTargetLabelZh } from '@/src/lib/bands';
import { speakingPart1, speakingPart2, speakingPart3, SpeakingQuestion } from '@/src/data/questions/bank';
import { SpeakingFeedback } from '@/src/lib/ai/schemas';
import {
  buildMarkdownExportFilename,
  buildSpeakingTrainingMarkdown,
} from '@/src/lib/markdownExport';
import {
  HIGH_BAND_BOUNDARY_ZH,
  HIGH_BAND_STABLE_ZH,
  isHighBandBoundaryState,
  isHighBandStableState,
  isRepairState,
  resolveSpeakingTargetState,
} from '@/src/lib/scoreLayer';
import {
  ActiveSpeakingPracticeSession,
  createRecordId,
  getActiveSpeakingSession,
  saveActiveSpeakingSession,
  SpeakingPracticeRecord,
  summarizeDiagnostic,
  upsertPracticeRecord,
} from '@/src/lib/practiceRecords';
import { Mic, Square, RefreshCcw, Send, ArrowRight, FileDown, Edit3, Info, BookOpen } from 'lucide-react';

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const hasLowSignalSpeakingText = (text: string) => {
  const normalized = text.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return true;
  const words = normalized.split(' ').filter(Boolean);
  const uniqueWords = new Set(words);
  return normalized.replace(/\s/g, '').length < 12 || (words.length >= 4 && uniqueWords.size <= 2);
};

const isInsufficientSpeakingSample = (
  text: string,
  speakingPart: 1 | 2 | 3,
  currentFeedback?: SpeakingFeedback | null,
) => {
  const words = countWords(text);
  if (currentFeedback?.fatalErrors.some(error => error.tag === 'insufficient_sample')) return true;
  if (currentFeedback?.upgradedAnswer.toLowerCase().includes('insufficient sample')) return true;
  if (hasLowSignalSpeakingText(text)) return true;
  if (speakingPart === 1) return words <= 8;
  if (speakingPart === 2) return words < 60;
  return words < 35;
};

const isHighBandSpeakingStable = (feedback?: SpeakingFeedback | null) =>
  Boolean(
    feedback &&
    isHighBandStableState(feedback.targetState || resolveSpeakingTargetState(feedback)),
  );

const hasUnstableSpeakingTarget = (feedback?: SpeakingFeedback | null) =>
  Boolean(feedback && isRepairState(feedback.targetState || resolveSpeakingTargetState(feedback)));

const speakingTargetHeading = (feedback: SpeakingFeedback) => {
  const state = feedback.targetState || resolveSpeakingTargetState(feedback);
  if (state === 'high_band_stable') return 'STANDARD ANSWER';
  if (state === 'high_band_boundary') return 'HIGH-BAND BOUNDARY TARGET';
  if (state === 'target_failed_or_borderline') return 'TARGET ANSWER NEEDS REPAIR';
  if (feedback.bandEstimateExcludingPronunciation < 7) return 'BAND 7.0+ TARGET ANSWER';
  if (feedback.bandEstimateExcludingPronunciation < 8) return 'BAND 8+ TARGET ANSWER';
  return feedback.targetLayer || getTargetLabel(feedback.bandEstimateExcludingPronunciation, 'answer');

  if (isHighBandSpeakingStable(feedback)) return '高分稳定检查';
  if (hasUnstableSpeakingTarget(feedback)) return '目标答案仍需加强';
  if (feedback.targetAnswerStatus === 'meets_target' && feedback.targetAnswerLayer === 'band_8_plus') {
    return 'Band 8+ Examiner-Friendly Target';
  }
  if (feedback.targetAnswerStatus !== 'meets_target') return '目标答案尚未完成校验';
  return feedback.targetLayer || getTargetLabel(feedback.bandEstimateExcludingPronunciation, 'answer');
};

const answerDevelopmentPlan = (speakingPart: 1 | 2 | 3, prompt = '') => {
  const questionReference = prompt ? `这道题是：“${prompt}”` : '先围绕当前题目补充内容。';
  const starter = speakingPart === 1
    ? 'Starter: I would say yes, mainly because...'
    : speakingPart === 2
      ? 'Starter: I want to talk about a time when...'
      : 'Starter: In my view, this depends on the situation...';
  const items = speakingPart === 1
    ? [
      '先给一个直接答案，不要只说 yes/no。',
      '补充一个具体个人细节，例如时间、地点、人物或频率。',
      '解释一个简短原因，让回答自然完整。',
    ]
    : speakingPart === 2
      ? [
        '交代背景：人物、地点、时间或事件起点。',
        '展开 2 个具体细节，而不是只给结论。',
        '说明你的感受、变化或为什么这件事重要。',
        '用一个自然结尾收束故事。',
      ]
      : [
        '先提出清楚观点。',
        '比较两种情况或两类人群。',
        '加入一个现实例子支持观点。',
        '解释这个例子背后的更大影响。',
      ];

  return { questionReference, starter, items };
};

const starterPracticePlan = (speakingPart: 1 | 2 | 3, prompt = '') => {
  const items = speakingPart === 1
    ? [
      'Direct answer: Yes / No / It depends.',
      'Detail: what kind, when, where, or how often.',
      'Reason: why you like it, dislike it, or do it.',
      'Stop after 2-4 spoken sentences.',
    ]
    : speakingPart === 2
      ? [
        'Introduce the person, place, time, or activity.',
        'Add two concrete details instead of only giving a conclusion.',
        'Explain your feeling, change, or why it mattered.',
        'End the story naturally.',
      ]
      : [
        'State a clear position first.',
        'Compare two situations or two groups of people.',
        'Add one realistic example.',
        'Explain the wider consequence.',
      ];
  const targetAnswer = speakingPart === 1 && /^do you/i.test(prompt.trim())
    ? 'Yes, I do. I usually [specific detail] when I want to relax. It helps me [personal reason].'
    : speakingPart === 1
      ? 'I usually [direct answer]. For example, [specific detail]. I like it because [personal reason].'
      : speakingPart === 2
        ? 'I want to talk about [person/place/activity]. It happened / happens [time or place]. The main reason I remember it is [personal reason].'
        : 'In my view, [direct position]. This is because [reason]. For example, [specific example]. So I think [balanced close].';

  return {
    questionReference: prompt ? `Current question: ${prompt}` : 'Build one complete answer for the current question first.',
    items,
    targetAnswer,
  };
};

const isIncompleteSpeakingFeedback = (
  feedback: SpeakingFeedback,
  failureKind?: string,
) => {
  const placeholderAnswer = /provider returned incomplete feedback|please retry analysis|malformed or incomplete/i.test(feedback.upgradedAnswer);
  const scores = [
    feedback.bandEstimateExcludingPronunciation,
    feedback.scores.fluencyCoherence,
    feedback.scores.lexicalResource,
    feedback.scores.grammaticalRangeAccuracy,
  ];
  const allScoresMissing = scores.every(score => !Number.isFinite(score) || score <= 0);
  const hasIntentionalInsufficientGuidance = feedback.fatalErrors.some(error => error.tag === 'insufficient_sample')
    || /insufficient sample|starter outline/i.test(feedback.upgradedAnswer);
  const hasCoreFeedback = feedback.fatalErrors.length > 0
    || feedback.naturalnessHints.length > 0
    || feedback.band9Refinements.length > 0
    || feedback.preservedStyle.length > 0
    || Boolean(feedback.upgradedAnswer.trim() && !placeholderAnswer);

  if (failureKind === 'parse_or_schema' && allScoresMissing) return true;
  if (hasIntentionalInsufficientGuidance) return false;
  if (placeholderAnswer) return true;
  if (allScoresMissing && !hasCoreFeedback) return true;
  return failureKind === 'parse_or_schema' && (allScoresMissing || !hasCoreFeedback);
};

const materialExpansionFallback = (speakingPart: 1 | 2 | 3) => {
  if (speakingPart === 1) return 'Add one real detail and one short reason; keep it brief.';
  if (speakingPart === 2) return 'Build it into a story spine with scene, action, change, feeling, and meaning.';
  return 'Turn the personal material into a claim, contrast or condition, example, and consequence.';
};

export default function SpeakingPractice() {
  const { addDebugLog, saveSession, capabilities, setProviderDiagnostic } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [part, setPart] = useState<1 | 2 | 3>(1);
  const [question, setQuestion] = useState<SpeakingQuestion | null>(null);
  const [step, setStep] = useState<'idle' | 'recording' | 'editing' | 'analyzing' | 'results'>('idle');
  const [transcript, setTranscript] = useState('');
  const [rawTranscript, setRawTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const [feedback, setFeedback] = useState<SpeakingFeedback | null>(null);
  const [, setFeedbackFallbackUsed] = useState(false);
  const [isBankOpen, setIsBankOpen] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState('');
  const [providerErrorMessage, setProviderErrorMessage] = useState('');
  const [apiStatusMessage, setApiStatusMessage] = useState('');
  const [transcriptCleanupNote, setTranscriptCleanupNote] = useState('');
  const [statusMessage, setStatusMessage] = useState<'Ready' | 'Requesting microphone...' | 'Listening...' | 'No speech detected' | 'Transcription unavailable' | 'Mic denied'>('Ready');

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const transcriptOriginRef = useRef<'speech' | 'manual'>('manual');
  const silenceTimeoutRef = useRef<any>(null);
  const speechRetriesRef = useRef(0);
  const hasSpeechResultRef = useRef(false);
  const fatalSpeechErrorRef = useRef(false);
  const intentionalSpeechStopRef = useRef(false);
  const recognitionRunningRef = useRef(false);
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

  const buildCurrentSpeakingRecord = (
    status: 'draft' | 'analyzed' | 'provider_failed' = feedback ? 'analyzed' : 'draft',
    feedbackOverride: SpeakingFeedback | null = feedback,
    transcriptOverride = transcript,
  ): SpeakingPracticeRecord | null => {
    if (!question) return null;
    const timestamp = new Date().toISOString();
    const existing = activeSessionRef.current?.attemptsByPart[part]?.id === activeAttemptIdRef.current
      ? activeSessionRef.current.attemptsByPart[part]
      : undefined;
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
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
      analyzedAt: status === 'analyzed' ? existing?.analyzedAt || timestamp : existing?.analyzedAt,
      transcript: transcriptOverride,
      rawTranscript: rawTranscript || undefined,
      transcriptOrigin: transcriptOriginRef.current,
      feedback: status === 'provider_failed' ? undefined : feedbackOverride || undefined,
      obsidianMarkdown: status === 'provider_failed' ? undefined : feedbackOverride?.obsidianMarkdown,
    };
  };

  const isUnfinishedSpeakingAttempt = (record?: SpeakingPracticeRecord | null) => {
    if (!record) return false;
    if (record.status === 'analyzed' || record.feedback) return false;
    if (record.status === 'draft' || record.status === 'provider_failed') return true;
    return Boolean(record.transcript.trim() && !record.feedback);
  };

  const pruneCompletedActiveAttempts = (session: ActiveSpeakingPracticeSession) => {
    let pruned = false;
    const attemptsByPart: ActiveSpeakingPracticeSession['attemptsByPart'] = {};
    ([1, 2, 3] as const).forEach(sessionPart => {
      const record = session.attemptsByPart[sessionPart];
      if (!record) return;
      if (isUnfinishedSpeakingAttempt(record)) {
        attemptsByPart[sessionPart] = record;
      } else {
        pruned = true;
      }
    });
    return {
      pruned,
      session: {
        ...session,
        attemptsByPart,
      },
    };
  };

  const logSkippedCompletedAutoRestore = () => {
    console.debug('Skipped auto-restore for completed Speaking attempt; loaded a fresh question instead.');
  };

  const clearActiveSpeakingAttempt = (sessionPart: 1 | 2 | 3) => {
    if (!activeSessionRef.current) return;
    activeSessionRef.current = {
      ...activeSessionRef.current,
      attemptsByPart: {
        ...activeSessionRef.current.attemptsByPart,
        [sessionPart]: undefined,
      },
      updatedAt: new Date().toISOString(),
    };
    saveActiveSpeakingSession(activeSessionRef.current);
  };

  const hasMeaningfulAttemptContent = (status?: 'draft' | 'analyzed' | 'provider_failed') =>
    Boolean(transcript.trim() || feedback || status === 'analyzed' || status === 'provider_failed');

  const persistCurrentSpeakingAttempt = (status?: 'draft' | 'analyzed' | 'provider_failed') => {
    if (feedback || status === 'analyzed') return;
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
    setRawTranscript(record.rawTranscript || '');
    transcriptOriginRef.current = record.transcriptOrigin;
    setFeedback(record.feedback || null);
    setFeedbackFallbackUsed(Boolean(record.providerDiagnostic?.fallbackUsed));
    setStep(record.feedback ? 'results' : record.transcript.trim() ? 'editing' : 'idle');
    setTimer(0);
    setProviderErrorMessage(record.status === 'provider_failed' ? 'AI provider temporarily unavailable. Please retry later.' : '');
    setTranscriptCleanupNote('');
    setRestoreMessage(message);
  };

  useEffect(() => {
    const active = getActiveSpeakingSession();
    if (active) {
      activeSessionRef.current = active;
      const explicitRestoreId = typeof location.state === 'object' && location.state && 'restoreSpeakingRecordId' in location.state
        ? String(location.state.restoreSpeakingRecordId || '')
        : '';
      if (explicitRestoreId) {
        const explicitRecord = Object.values(active.attemptsByPart).find(record => record?.id === explicitRestoreId);
        if (explicitRecord) {
          restoreSpeakingRecord(explicitRecord);
          navigate(location.pathname, { replace: true, state: null });
          return;
        }
      }

      const currentPart = active.currentPart;
      const candidate = active.attemptsByPart[currentPart];
      if (isUnfinishedSpeakingAttempt(candidate)) {
        restoreSpeakingRecord(candidate);
        return;
      }

      const { pruned, session } = pruneCompletedActiveAttempts(active);
      activeSessionRef.current = session;
      if (candidate && !isUnfinishedSpeakingAttempt(candidate)) {
        logSkippedCompletedAutoRestore();
      }
      if (pruned) saveActiveSpeakingSession(session);
      loadRandomQuestion(currentPart);
      return;
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
  }, [part, question, step, transcript, rawTranscript, feedback, providerErrorMessage]);

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
    setRawTranscript('');
    setFeedback(null);
    setFeedbackFallbackUsed(false);
    setTimer(0);
    setStatusMessage('Ready');
    setProviderErrorMessage('');
    setTranscriptCleanupNote('');
    setRestoreMessage('');
    transcriptOriginRef.current = 'manual';
    addDebugLog(`Loaded question: ${random.id}`);
  };

  const switchPart = (p: 1 | 2 | 3) => {
    persistCurrentSpeakingAttempt();
    const existing = activeSessionRef.current?.attemptsByPart[p];
    if (isUnfinishedSpeakingAttempt(existing)) {
      restoreSpeakingRecord(existing);
      activeSessionRef.current = {
        ...activeSessionRef.current,
        currentPart: p,
        updatedAt: new Date().toISOString(),
      };
      saveActiveSpeakingSession(activeSessionRef.current);
      return;
    }
    if (existing) {
      logSkippedCompletedAutoRestore();
      clearActiveSpeakingAttempt(p);
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
    setRawTranscript('');
    setFeedback(null);
    setFeedbackFallbackUsed(false);
    setProviderDiagnostic(null);
    setTimer(0);
    setStep('idle');
    setStatusMessage('Ready');
    setProviderErrorMessage('');
    setTranscriptCleanupNote('');
    setRestoreMessage('');
    transcriptOriginRef.current = 'manual';
    addDebugLog('Started a fresh attempt for the same speaking question.');
  };


  const selectBankQuestion = (selected: SpeakingQuestion) => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      intentionalSpeechStopRef.current = true;
      try { recognitionRef.current.stop(); } catch (e) { /* already stopped */ }
      recognitionRef.current = null;
    }
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    clearActiveSpeakingAttempt(part);
    activeAttemptIdRef.current = createRecordId('sp');
    setQuestion(selected);
    setStep('idle');
    setTranscript('');
    setRawTranscript('');
    setFeedback(null);
    setFeedbackFallbackUsed(false);
    setProviderDiagnostic(null);
    setTimer(0);
    setIsRecording(false);
    setStatusMessage('Ready');
    setProviderErrorMessage('');
    setApiStatusMessage('');
    setTranscriptCleanupNote('');
    setRestoreMessage('');
    transcriptOriginRef.current = 'manual';
    setIsBankOpen(false);
    addDebugLog(`Selected speaking bank question: ${selected.id}`);
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

      const attachRecognitionHandlers = (recognition: any) => {
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 3;

        recognition.onstart = () => {
        recognitionRunningRef.current = true;
        setStatusMessage('Listening...');
        // Set a timeout to warn if no speech is detected after 5 seconds
        silenceTimeoutRef.current = setTimeout(() => {
          if (!transcript) setStatusMessage('No speech detected');
        }, 5000);
      };

        recognition.onresult = (event: any) => {
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
          setRawTranscript(prev => (prev + ' ' + finalTranscript).trim());
        }
      };

        recognition.onerror = (event: any) => {
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

        recognition.onend = () => {
        recognitionRunningRef.current = false;
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

        if (intentionalSpeechStopRef.current || !isRecordingRef.current) {
          addDebugLog('Speech recognition stopped intentionally.');
          return;
        }

        if (fatalSpeechErrorRef.current) {
          addDebugLog('Auto-resume skipped because fatal error occurred.');
          return;
        }

        if (retryTimeoutRef.current) return;

        if (isRecordingRef.current) {
          speechRetriesRef.current += 1;
          addDebugLog('Speech recognition auto-ended during active recording; restarting.');

          retryTimeoutRef.current = setTimeout(() => {
            retryTimeoutRef.current = null;
            if (intentionalSpeechStopRef.current || !isRecordingRef.current) return;
            if (fatalSpeechErrorRef.current) {
              addDebugLog('Auto-resume skipped because fatal error occurred.');
              return;
            }
            if (recognitionRunningRef.current) return;
            const retry = new SpeechRecognition();
            attachRecognitionHandlers(retry);
            recognitionRef.current = retry;
            try {
              retry.start();
            } catch (e: any) {
              if (e?.name === 'InvalidStateError') {
                addDebugLog('Speech recognition restart skipped because it is already running.');
                return;
              }
              addDebugLog(`Retry start error: ${e.message}`);
            }
          }, 500);
        } else {
          addDebugLog(`Speech recognition ended (retries: ${speechRetriesRef.current}, fatal: ${fatalSpeechErrorRef.current})`);
        }
      };
      };

      speechRetriesRef.current = 0;
      hasSpeechResultRef.current = false;
      fatalSpeechErrorRef.current = false;
      intentionalSpeechStopRef.current = false;
      isRecordingRef.current = true;
      recognitionRef.current = new SpeechRecognition();
      attachRecognitionHandlers(recognitionRef.current);
      try {
        recognitionRef.current.start();
      } catch (e: any) {
        if (e?.name === 'InvalidStateError') {
          addDebugLog('Speech recognition start skipped because it is already running.');
        } else {
          throw e;
        }
      }
      setIsRecording(true);
      setStep('recording');
      setTimer(0);
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
      addDebugLog("Recording started");
    } catch (err) {
      addDebugLog(`Mic Access Error: ${err}`);
      fatalSpeechErrorRef.current = true;
      intentionalSpeechStopRef.current = true;
      recognitionRunningRef.current = false;
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
      intentionalSpeechStopRef.current = true;
      try { recognitionRef.current.stop(); } catch (e) { /* may already be stopped */ }
      recognitionRef.current = null;
    }
    // Clear refs
    fatalSpeechErrorRef.current = true;
    intentionalSpeechStopRef.current = true;
    recognitionRunningRef.current = false;
    isRecordingRef.current = false;
    speechRetriesRef.current = 0;
    hasSpeechResultRef.current = false;
    transcriptOriginRef.current = 'manual';
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    // Clear state
    setTranscript('');
    setRawTranscript('');
    setFeedback(null);
    setTimer(0);
    setIsRecording(false);
    setStatusMessage('Ready');
    setStep('idle');
    setTranscriptCleanupNote('');
    addDebugLog('Attempt reset (Retry) — transcript, feedback, timer cleared');
  };

  const stopRecording = () => {
    intentionalSpeechStopRef.current = true;
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
    if (feedback) {
      activeAttemptIdRef.current = createRecordId('sp');
      setFeedback(null);
      setFeedbackFallbackUsed(false);
    }
    const cleanup = { transcript: transcript.trim(), corrections: [] as string[] };
    const cleanedTranscript = cleanup.transcript;
    if (cleanup.corrections.length) {
      setTranscript(cleanedTranscript);
      setTranscriptCleanupNote(`已自动修正可能的转写误差：${cleanup.corrections.join('；')}`);
    } else {
      setTranscriptCleanupNote('');
    }
    setStep('analyzing');
    setProviderErrorMessage('');
    setApiStatusMessage('');
    setProviderDiagnostic(null);
    addDebugLog("Starting AI analysis flow...");
    try {
      const { feedback: result, diagnostic, route } = await routedAnalyzeSpeaking({
        part,
        question: question?.question || '',
        transcript: cleanedTranscript
      }, isInsufficientSpeakingSample(cleanedTranscript, part));
      setProviderDiagnostic(diagnostic);
      setApiStatusMessage(route.fallbackReason || route.learnerReason);

      if (diagnostic.failureKind === 'provider_unavailable') {
        setFeedbackFallbackUsed(false);
        setProviderErrorMessage('AI provider temporarily unavailable. Please retry later. Your transcript is preserved.');
        setStep('editing');
        const failedBase = buildCurrentSpeakingRecord('provider_failed', null, cleanedTranscript);
        if (failedBase) {
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
              [part]: failedBase,
            },
            updatedAt: new Date().toISOString(),
          };
          saveActiveSpeakingSession(activeSessionRef.current);
          upsertPracticeRecord({
            ...failedBase,
            providerDiagnostic: summarizeDiagnostic(diagnostic),
          });
        }
        addDebugLog("Provider unavailable for speaking feedback.");
        return;
      }

      if (isIncompleteSpeakingFeedback(result, diagnostic.failureKind)) {
        setFeedbackFallbackUsed(diagnostic.fallbackUsed);
        setFeedback(null);
        setProviderErrorMessage('AI feedback was incomplete. Your transcript is preserved; please retry analysis.');
        setStep('editing');
        const failedBase = buildCurrentSpeakingRecord('provider_failed', null, cleanedTranscript);
        if (failedBase) {
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
              [part]: failedBase,
            },
            updatedAt: new Date().toISOString(),
          };
          saveActiveSpeakingSession(activeSessionRef.current);
          upsertPracticeRecord({
            ...failedBase,
            providerDiagnostic: summarizeDiagnostic(diagnostic),
          });
        }
        addDebugLog("Incomplete speaking feedback preserved as retryable state.");
        return;
      }

      let resultFeedback = result;
      let finalDiagnostic = diagnostic;
      if (!isInsufficientSpeakingSample(cleanedTranscript, part, result)) {
        const validation = await validateSpeakingTargetLoop(result, false);
        resultFeedback = validation.feedback;
        finalDiagnostic = validation.diagnostic || diagnostic;
        validation.diagnostics.forEach(item => setProviderDiagnostic(item));
        if (!validation.diagnostics.length && finalDiagnostic !== diagnostic) setProviderDiagnostic(finalDiagnostic);
      }

      setFeedbackFallbackUsed(diagnostic.fallbackUsed || finalDiagnostic.fallbackUsed);
      setFeedback(resultFeedback);
      setStep('results');
      const analyzedBase = buildCurrentSpeakingRecord('analyzed', resultFeedback, cleanedTranscript);
      if (analyzedBase) {
        upsertPracticeRecord({
          ...analyzedBase,
          feedback: resultFeedback,
          obsidianMarkdown: resultFeedback.obsidianMarkdown,
          analyzedAt: finalDiagnostic.timestamp,
          providerDiagnostic: summarizeDiagnostic(finalDiagnostic),
        });
      }
      clearActiveSpeakingAttempt(part);
      
      saveSession({
        id: `sp_${Date.now()}`,
        date: new Date().toISOString(),
        module: 'speaking',
        mode: 'practice',
        question: question?.question,
        transcript: cleanedTranscript,
        rawTranscript: rawTranscript || undefined,
        transcriptOrigin: transcriptOriginRef.current,
        feedback: resultFeedback,
        providerDiagnostic: summarizeDiagnostic(finalDiagnostic),
      });
      
      addDebugLog("Analysis complete and results displayed.");
      if (diagnostic.fallbackUsed || finalDiagnostic.fallbackUsed) {
        addDebugLog("Provider fallback used for speaking feedback.");
      }
    } catch (error) {
      addDebugLog(`Analysis Error: ${error}`);
      setFeedbackFallbackUsed(false);
      setStep('editing');
      setApiStatusMessage('');
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const exportMarkdown = () => {
    if (!feedback) return;
    const markdown = buildSpeakingTrainingMarkdown(feedback);
    const blob = new Blob([markdown || feedback.obsidianMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildMarkdownExportFilename({
      module: 'speaking',
      taskOrPart: `p${part}`,
      topic: question?.topicCategory || question?.topic,
      prompt: feedback.question || question?.question,
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  const isMock = getAIProviderName() !== 'gemini';
  const shouldShowDevelopmentPlan = step === 'results' && isInsufficientSpeakingSample(transcript, part, feedback);
  const targetState = feedback ? feedback.targetState || resolveSpeakingTargetState(feedback) : undefined;
  const isHighBandStable = isHighBandSpeakingStable(feedback);
  const isHighBandBoundary = isHighBandBoundaryState(targetState);
  const targetNeedsRepair = hasUnstableSpeakingTarget(feedback);
  const canShowValidatedSpeakingTarget = Boolean(
    feedback &&
    (feedback.targetAnswerStatus === 'meets_target' || isHighBandStable) &&
    !targetNeedsRepair &&
    (feedback.upgradedAnswer.trim() || isHighBandStable),
  );
  const criticalErrors = feedback && isHighBandStable ? [] : feedback?.fatalErrors || [];
  const optionalPolish = feedback && isHighBandStable
    ? feedback.naturalnessHints.slice(0, 2)
    : feedback?.naturalnessHints || [];
  const groundedIdeaUpgrades = feedback?.band9Refinements.filter(item => {
    const transcriptSource = feedback.transcript.toLowerCase();
    const quotedPhrases = Array.from(item.observation.matchAll(/["“](.+?)["”]/g)).map(match => match[1].toLowerCase());
    const citesNaturalnessSource = feedback.naturalnessHints.some(hint =>
      item.observation.includes(hint.original) || item.explanationZh.includes(hint.original),
    );
    return quotedPhrases.some(phrase => transcriptSource.includes(phrase)) || citesNaturalnessSource;
  }) || [];
  const starterPlan = starterPracticePlan(part, question?.question);
  const speakingBankCounts = {
    1: speakingPart1.length,
    2: speakingPart2.length,
    3: speakingPart3.length,
  };
  const currentPartBankCount = speakingBankCounts[part];
  const speakingBankItems: QuestionBankItem[] = getBank(part).map(item => ({
    id: item.id,
    title: item.question,
    metadata: [item.topic, item.topicCategory],
    tags: item.tags || [item.topicCategory, item.topic].filter((value): value is string => Boolean(value)),
    questionText: item.question,
    module: 'speaking',
    part,
  }));

  return (
    <PageShell size="wide">
      <TopBar />
      <QuestionBankModal
        isOpen={isBankOpen}
        title={`Speaking Part ${part} Bank`}
        items={speakingBankItems}
        itemLabel="question"
        onClose={() => setIsBankOpen(false)}
        onSelect={(item) => {
          const selected = getBank(part).find(questionItem => questionItem.id === item.id);
          if (selected) selectBankQuestion(selected);
        }}
      />
      
      <div className="flex flex-col gap-3 mb-8 sm:flex-row sm:items-center sm:justify-center">
        <div className="flex gap-3 p-1.5 bg-paper-ink/5 rounded-sm self-start sm:self-auto font-sans text-sm uppercase tracking-widest font-bold">
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
      </div>

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

      <div className="practice-workspace grid lg:grid-cols-12 gap-8 items-start mb-12">
        <div className={`lg:col-span-12 ${step === 'results' ? 'xl:col-span-12 space-y-6' : 'xl:col-span-12 xl:grid xl:grid-cols-[minmax(360px,0.9fr)_minmax(460px,1.1fr)] xl:gap-6 xl:items-start space-y-6 xl:space-y-0'}`}>
          <PaperCard className="relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/35">
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
              <div className="bg-paper-ink/[0.03] p-5 rounded-sm mb-8 border-l-2 border-accent-terracotta/20 text-base text-paper-ink-muted leading-8">
                {question.cueCard}
              </div>
            )}

            <div className="flex flex-wrap gap-4 pt-4 border-t border-paper-ink/5">
              {step === 'idle' && (
                <>
                  <SerifButton onClick={() => setIsBankOpen(true)} variant="outline" className="flex items-center gap-2 group">
                    <BookOpen className="w-4 h-4" /> Browse Bank
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
            <p className="mt-4 text-sm font-sans text-paper-ink/55">
              Part {part} Bank · {currentPartBankCount} {currentPartBankCount === 1 ? 'question' : 'questions'}
            </p>
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
                    <span className="text-[10px] text-accent-terracotta font-sans flex items-center gap-1">
                      <Info className="w-3 h-3" /> No speech detected. Try speaking clearly.
                    </span>
                  )}
                  {statusMessage === 'Mic denied' && (
                    <span className="text-[10px] text-red-800 flex items-center gap-1 font-sans">
                      <Info className="w-3 h-3" /> Mic denied. Manual typing only.
                    </span>
                  )}
                  {statusMessage === 'Transcription unavailable' && (
                    <span className="text-[10px] text-paper-ink/40 font-sans">Recognition unavailable in this browser.</span>
                  )}
                </div>
              </div>
              <textarea
                value={transcript}
                onChange={(e) => {
                  setTranscript(e.target.value);
                  setTranscriptCleanupNote('');
                  transcriptOriginRef.current = 'manual';
                }}
                disabled={step === 'recording' || step === 'results'}
                placeholder={statusMessage === 'Mic denied' || statusMessage === 'Transcription unavailable' ? "Type your answer manually here..." : "Recognition will appear here..."}
                className="w-full min-h-[300px] xl:min-h-[420px] bg-transparent border border-transparent rounded-sm font-serif text-lg leading-relaxed placeholder:opacity-40 resize-y focus:border-accent-terracotta focus:shadow-[0_0_0_1px_rgba(166,77,50,0.2)]"
              />
              {step === 'editing' && (
                <p className="mt-2 text-[11px] leading-5 text-paper-ink/45 font-sans">
                  Review quick recognition mistakes before analysis. Analyze uses this edited transcript.
                  {rawTranscript && rawTranscript !== transcript ? ' Raw browser text is preserved in the saved record.' : ''}
                </p>
              )}
              {transcriptCleanupNote && (
                <p className="mt-2 text-[11px] leading-5 text-paper-ink/45 font-sans">
                  {transcriptCleanupNote}
                </p>
              )}
            </PaperCard>
          )}

          {step === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <RefreshCcw className="w-6 h-6 animate-spin text-accent-terracotta/40" />
              <p className="font-serif text-paper-ink/45 text-sm">Checking the training estimate and target layer...</p>
            </div>
          )}
        </div>

        {step === 'results' && feedback && (
        <div className="lg:col-span-12">
          
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <PaperCard className="bg-paper-200 border-none relative">
                <h3 className="text-sm font-bold tracking-wide mb-6 text-paper-ink/50 border-b border-paper-ink/10 pb-2">LANGUAGE PERFORMANCE</h3>
                <div className="flex flex-wrap items-end gap-4 mb-8">
                  <span className="text-7xl font-bold text-accent-terracotta leading-none">{formatConservativeBandEstimate(feedback.bandEstimateExcludingPronunciation)}</span>
                  <div className="flex flex-col pb-2">
                    <span className="text-sm text-paper-ink/60 font-bold uppercase tracking-widest">Single-question training estimate</span>
                    <span className="text-xs text-paper-ink/45">约 {formatConservativeBandEstimate(feedback.bandEstimateExcludingPronunciation)}，不含发音；短样本按保守值处理。</span>
                  </div>
                </div>
                
                {(feedback.scoreConsistencyNoteZh || feedback.estimateRationaleZh) && (
                  <p className="mb-5 text-sm leading-7 text-paper-ink/60">
                    {feedback.scoreConsistencyNoteZh || feedback.estimateRationaleZh}
                  </p>
                )}

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

                {false && isMock && (
                  <div className="mt-6 flex items-center gap-2 p-2 bg-paper-ink/5 rounded text-xs text-paper-ink/45">
                    <Info className="w-3 h-3" /> Mock provider active.
                  </div>
                )}
              </PaperCard>

              {isHighBandStable && (
                <PaperCard className="p-5 border-l-2 border-l-green-700/50 bg-green-50/30">
                  <h4 className="text-sm font-bold tracking-wide text-green-800 mb-3 border-b border-paper-ink/10 pb-2">HIGH-BAND STABILITY CHECK</h4>
                  <p className="text-base leading-8 text-paper-ink/75">
                    当前回答已达到目标层级。下一步重点是自然输出、时间控制和迁移练习。
                  </p>
                  <div className="mt-3 grid gap-2 text-sm leading-7 text-paper-ink/60 sm:grid-cols-2">
                    <p>本次没有必须修改的问题。</p>
                    <p>本次没有必要的可选微调。</p>
                  </div>
                </PaperCard>
              )}

              {!isHighBandStable && (criticalErrors.length > 0 || optionalPolish.length > 0 || shouldShowDevelopmentPlan) && (
              <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
                {(criticalErrors.length > 0 || shouldShowDevelopmentPlan) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold tracking-wide text-red-800 ml-1 border-b border-paper-ink/10 pb-2">MUST FIX</h4>
                  {criticalErrors.length === 0 ? (
                    <PaperCard className="p-5 border-l-2 border-l-green-700/50">
                      <p className="text-lg leading-8 text-paper-ink/85 bg-paper-ink/[0.04] border border-paper-ink/10 p-4 rounded-sm">
                        {shouldShowDevelopmentPlan
                          ? 'Starter development needed: give a complete answer first, then review language accuracy.'
                          : isHighBandStable
                            ? '本次没有必须修改的问题。'
                            : '本次没有必须修改的问题。下一步把回答说得更具体、更自然。'}
                      </p>
                    </PaperCard>
                  ) : (
                    <div className="space-y-4">
                      {criticalErrors.map((err, i) => (
                        <PaperCard key={i} className="p-5 border-l-2 border-l-red-800">
                          <div className="text-base line-through text-paper-ink/60 mb-2 leading-7">{err.original}</div>
                          <div className="text-xl font-bold text-red-800 mb-3 leading-8">{err.correction}</div>
                          <p className="text-[17px] leading-8 text-paper-ink/90 bg-paper-ink/[0.05] border border-paper-ink/10 p-4 rounded-sm">{err.explanationZh}</p>
                        </PaperCard>
                      ))}
                    </div>
                  )}
                </div>
                )}

                {optionalPolish.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold tracking-wide text-paper-ink/65 ml-1 border-b border-paper-ink/10 pb-2">OPTIONAL POLISH</h4>
                  {optionalPolish.length === 0 ? (
                    <PaperCard className="p-5 border-l-2 border-l-paper-ink/20">
                      <p className="text-lg leading-8 text-paper-ink/75 bg-paper-ink/[0.04] border border-paper-ink/10 p-4 rounded-sm">
                        {isHighBandStable ? '本次没有必要的可选微调。' : '本次没有返回稳定的可选微调。'}
                      </p>
                    </PaperCard>
                  ) : (
                    <div className="space-y-4">
                      {optionalPolish.map((hint, i) => (
                        <PaperCard key={i} className="p-5 border-l-2 border-l-[#a64d32]/40">
                          <div className="text-base text-paper-ink/65 mb-2 leading-7">"{hint.original}" </div>
                          <div className="text-xl font-bold text-[#a64d32] mb-3 leading-8">Better: {hint.better}</div>
                          <p className="text-[17px] leading-8 text-paper-ink/90 bg-paper-ink/[0.05] border border-paper-ink/10 p-4 rounded-sm">{hint.explanationZh}</p>
                        </PaperCard>
                      ))}
                    </div>
                  )}
                </div>
                )}
              </div>
              )}

              {!shouldShowDevelopmentPlan && groundedIdeaUpgrades.length > 0 && (
                <section className="space-y-3">
                  <h4 className="text-xs font-bold tracking-wide text-paper-ink/55 ml-1">
                    IDEA & EXPRESSION UPGRADE
                  </h4>
                  <PaperCard className="border-l-2 border-l-paper-ink/30 bg-paper-50">
                    <p className="text-sm font-sans uppercase tracking-widest text-paper-ink/35 mb-4">
                      Use only evidence from your answer; skip generic upgrades when there is no source phrase.
                    </p>
                    <div className="grid gap-4 lg:grid-cols-2">
                      {groundedIdeaUpgrades.map((item, index) => (
                        <div key={index} className="border border-paper-ink/10 bg-paper-ink/[0.03] p-4 rounded-sm">
                          <p className="text-xs font-sans font-bold tracking-wide text-paper-ink/40 mb-2">Focus</p>
                          <p className="text-base leading-8 text-paper-ink/85 mb-4">{item.explanationZh || item.observation}</p>
                          <p className="text-xs font-sans font-bold tracking-wide text-paper-ink/40 mb-2">Suggested wording</p>
                          <ul className="space-y-1 mb-4">
                            {[item.refinement, item.observation]
                              .filter(Boolean)
                              .slice(0, 2)
                              .map(expression => (
                                <li key={expression} className="text-base leading-7 text-paper-ink border-l-2 border-l-accent-terracotta/25 pl-3">
                                  {expression}
                                </li>
                              ))}
                          </ul>
                          <p className="text-xs font-sans font-bold tracking-wide text-paper-ink/40 mb-2">Why this works</p>
                          <p className="text-sm leading-7 text-paper-ink/70">
                            {feedback.part === 3
                              ? 'Part 3 需要从观点推进到原因、例子或影响。'
                              : feedback.part === 2
                                ? 'Part 2 需要把素材串成有细节和感受变化的长回答。'
                                : 'Part 1 需要短而自然的个人细节。'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </PaperCard>
                </section>
              )}

              {feedback.preservedStyle.length > 0 && (
                <section className="border border-paper-ink/10 bg-paper-ink/[0.02] p-5">
                  <h4 className="text-sm font-sans font-bold uppercase tracking-widest text-paper-ink/50 mb-4">
                    <span>PERSONAL MATERIAL & IDEA EXPANSION</span>
                  </h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    {feedback.preservedStyle.slice(0, 4).map((style, i) => (
                      <div key={i} className="border-l-2 border-l-accent-terracotta/30 pl-4 py-1">
                        <p className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/40">Your material</p>
                        <p className="text-lg text-paper-ink leading-8">"{style.text}"</p>
                        <p className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/40 mt-3">Why keep it</p>
                        <div className="text-base leading-8 text-paper-ink/75">{style.reasonZh}</div>
                        <p className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/40 mt-3">How to expand</p>
                        <div className="text-base leading-8 text-paper-ink/75">
                          {style.expansionZh || materialExpansionFallback(feedback.part)}
                        </div>
                        {style.sampleNextStep && (
                          <div className="mt-2 text-base leading-7 text-paper-ink border-l-2 border-l-paper-ink/15 pl-3">
                            <span className="block text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-1">Sample sentence</span>
                            {style.sampleNextStep}
                          </div>
                        )}
                        {style.transferQuestions?.length ? (
                          <div className="mt-2">
                            <p className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-2">Transfer to</p>
                            <div className="flex flex-wrap gap-2">
                            {style.transferQuestions.slice(0, 2).map(item => (
                              <span key={item} className="rounded-sm border border-paper-ink/10 bg-paper-50 px-2 py-1 text-[10px] font-sans uppercase tracking-widest text-paper-ink/45">
                                {item}
                              </span>
                            ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <PaperCard className={`bg-paper-50 !p-8 md:!p-10 border-l-2 ${
                feedback.targetAnswerStatus === 'meets_target'
                  ? 'border-l-green-700'
                  : targetNeedsRepair
                    ? 'border-l-red-800'
                    : 'border-l-paper-ink/20'
              }`}>
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-widest text-paper-ink/45 mb-6 border-b border-paper-ink/10 pb-3">
                    {shouldShowDevelopmentPlan
                      ? 'Band 7.0+ Starter Target'
                      : speakingTargetHeading(feedback)}
                    {!shouldShowDevelopmentPlan && (
                      <span className="block mt-2 text-xs normal-case tracking-normal text-paper-ink/45">
                        {isHighBandStable
                          ? '目标层级已达到。下一步重点是自然输出、时间控制和迁移练习。'
                          : isHighBandBoundary
                            ? HIGH_BAND_BOUNDARY_ZH
                          : targetNeedsRepair
                            ? '这版目标答案还没有稳定达到目标层级，需要继续强化。'
                            : getTargetLabelZh(feedback.bandEstimateExcludingPronunciation, 'answer')}
                      </span>
                    )}
                    {!shouldShowDevelopmentPlan && (feedback.targetAnswerRepairFocusZh || feedback.highBandStabilityZh || feedback.targetUpgradeFocusZh || feedback.targetValidationZh) && (
                      <span className="block mt-2 text-sm normal-case tracking-normal leading-7 text-paper-ink/55">
                        {isHighBandBoundary
                          ? HIGH_BAND_BOUNDARY_ZH
                          : feedback.targetAnswerRepairFocusZh || feedback.highBandStabilityZh || feedback.targetUpgradeFocusZh || feedback.targetValidationZh}
                      </span>
                    )}
                  </h4>
                  {shouldShowDevelopmentPlan ? (
                    <div className="max-w-5xl space-y-5 text-paper-ink">
                      <p className="text-lg leading-9">
                        样本太短或信息量不足，不能可靠生成完整高分改写。{starterPlan.questionReference}
                      </p>
                      <ul className="space-y-3">
                        {starterPlan.items.map(item => (
                          <li key={item} className="text-base leading-8 border-l-2 border-l-accent-terracotta/35 pl-4">
                            {item}
                          </li>
                        ))}
                      </ul>
                      <div className="border border-paper-ink/10 bg-paper-ink/[0.03] p-4 rounded-sm">
                        <p className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/45 mb-2">
                          Starter Target Answer
                        </p>
                        <p className="text-lg leading-8 text-paper-ink">{starterPlan.targetAnswer}</p>
                        <p className="text-sm leading-7 text-paper-ink/60 mt-3">
                          This is a starter frame, not a fully personalized upgraded answer. Replace the brackets with your real details.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-5xl space-y-4">
                      {isHighBandStable && (
                        <p className="text-lg leading-8 text-paper-ink/75">
                          {feedback.nextStepZh || '目标层级已达到。下一步重点是自然输出、时间控制和迁移练习。'}
                        </p>
                      )}
                      {canShowValidatedSpeakingTarget ? (
                        <p className="text-xl md:text-2xl leading-10 text-paper-ink font-serif whitespace-pre-wrap">
                          {feedback.upgradedAnswer.trim() || feedback.transcript}
                        </p>
                      ) : (
                        <p className="text-base leading-8 text-paper-ink/65">
                          {isHighBandStable
                            ? '当前回答已达到目标层级。这里不需要生成替换答案。'
                            : targetNeedsRepair
                              ? '这版目标答案还没有稳定达到目标层级，暂不作为成功目标答案展示。'
                              : '目标答案尚未完成独立校验，暂不标记为已达标。'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-8 flex justify-start border-t border-paper-ink/10 pt-6">
                  <SerifButton onClick={exportMarkdown} className="w-full sm:w-auto text-xs flex items-center justify-center gap-2 py-3" variant="outline">
                    <FileDown className="w-4 h-4" /> Export Markdown
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
