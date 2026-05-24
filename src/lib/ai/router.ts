import { MockProvider } from './providers/mockProvider';
import { GeminiProvider } from './providers/geminiProvider';
import { DeepSeekProvider } from './providers/deepseekProvider';
import {
  AIProvider,
  SpeakingAudioTranscriptionRequest,
  SpeakingAnalysisRequest,
  SpeakingScoreOnlyRequest,
  WritingAnalysisRequest,
  WritingFrameworkCoachRequest,
  WritingFrameworkRequest,
  SpeakingTargetValidationRequest,
  WritingTask1AnalysisRequest,
  WritingTargetValidationRequest,
} from './providers/base';
import {
  ProviderDiagnostic,
  ProviderOperation,
  SpeakingAudioTranscriptionResult,
  SpeakingFeedback,
  SpeakingScoreOnlyResult,
  WritingFeedback,
  WritingFrameworkCoachFeedback,
  WritingFrameworkSummary,
  SpeakingTargetValidationResult,
  WritingTargetValidationResult,
  WritingTask1Feedback,
} from './schemas';
import {
  estimateTokensFromText,
  getGeminiLocalUsage,
  getRouterState,
  recordApiCall,
  recordRouterResult,
  setGeminiCooldown,
} from './usage';
import {
  safeAnalyzeSpeaking,
  safeScoreSpeakingOnly,
  safeTranscribeSpeakingAudio,
  safeAnalyzeWriting,
  safeAnalyzeWritingTask1,
  safeCoachWritingFramework,
  safeExtractWritingFramework,
  safeValidateSpeakingTarget,
  safeValidateWritingTarget,
} from './safety';

type ProviderConfig = 'mock' | 'gemini' | 'auto';
type ModelTier = 'mock' | 'gemini' | 'deepseek_flash' | 'deepseek_pro';

interface RouteChoice {
  provider: AIProvider;
  providerName: string;
  model: string;
  tier: ModelTier;
  debugReason: string;
  learnerReason: string;
  fallbackReason?: string;
}

export interface RoutedResult<T> {
  feedback: T;
  diagnostic: ProviderDiagnostic;
  route: {
    providerName: string;
    model: string;
    debugReason: string;
    learnerReason: string;
    fallbackReason?: string;
  };
}

export const readEnv = (key: string): string | undefined => {
  const viteValue = import.meta.env[key];
  if (typeof viteValue === 'string') return viteValue;

  if (typeof process !== 'undefined') {
    const processValue = process.env?.[key];
    if (typeof processValue === 'string') return processValue;
  }

  return undefined;
};

const envNumber = (key: string, fallback: number) => {
  const value = Number(readEnv(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const envBoolean = (key: string, fallback = false) => {
  const value = readEnv(key)?.trim().toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
};

const configuredProvider = (): ProviderConfig => {
  const normalized = (readEnv('VITE_AI_PROVIDER') || readEnv('AI_PROVIDER') || 'mock').trim().toLowerCase();
  return normalized === 'gemini' || normalized === 'auto' ? normalized : 'mock';
};

export const getProviderRouterMode = () => configuredProvider();
export const getGeminiApiKey = () => readEnv('VITE_GEMINI_API_KEY') || readEnv('GEMINI_API_KEY') || '';
const getDeepSeekApiKey = () => readEnv('VITE_DEEPSEEK_API_KEY') || '';
export const getGeminiModel = () => readEnv('VITE_GEMINI_MODEL') || 'gemini-2.5-flash';
const getDeepSeekBaseUrl = () => readEnv('VITE_DEEPSEEK_BASE_URL') || 'https://api.deepseek.com/v1';
export const getDeepSeekFlashModel = () => readEnv('VITE_DEEPSEEK_FLASH_MODEL') || 'deepseek-v4-flash';
export const getDeepSeekProModel = () => readEnv('VITE_DEEPSEEK_PRO_MODEL') || 'deepseek-v4-pro';

export const getGeminiLimits = () => ({
  rpm: envNumber('VITE_GEMINI_RPM_LIMIT', 5),
  tpm: envNumber('VITE_GEMINI_TPM_LIMIT', 250000),
  rpd: envNumber('VITE_GEMINI_RPD_LIMIT', 20),
  reserve: envNumber('VITE_GEMINI_RPD_RESERVE', 3),
});

export const getDeepSeekStatus = () => ({
  configured: Boolean(getDeepSeekApiKey()),
  balance: 'balance unavailable',
});

const hasDeepSeek = () => Boolean(getDeepSeekApiKey());
const hasGemini = () => Boolean(getGeminiApiKey());

const makeGemini = (): RouteChoice => ({
  provider: new GeminiProvider(getGeminiApiKey(), getGeminiModel()),
  providerName: 'gemini',
  model: getGeminiModel(),
  tier: 'gemini',
  debugReason: 'Gemini selected by provider router.',
  learnerReason: 'Using Gemini for high-value final feedback.',
});

const makeDeepSeekFlash = (reason: string): RouteChoice => ({
  provider: new DeepSeekProvider(getDeepSeekApiKey(), getDeepSeekFlashModel(), getDeepSeekBaseUrl()),
  providerName: 'deepseek',
  model: getDeepSeekFlashModel(),
  tier: 'deepseek_flash',
  debugReason: reason,
  learnerReason: reason,
  fallbackReason: reason,
});

const makeDeepSeekPro = (reason: string): RouteChoice => ({
  provider: new DeepSeekProvider(getDeepSeekApiKey(), getDeepSeekProModel(), getDeepSeekBaseUrl()),
  providerName: 'deepseek',
  model: getDeepSeekProModel(),
  tier: 'deepseek_pro',
  debugReason: reason,
  learnerReason: reason,
  fallbackReason: reason,
});

const makeMock = (reason: string): RouteChoice => ({
  provider: new MockProvider(),
  providerName: 'mock',
  model: 'mock',
  tier: 'mock',
  debugReason: reason,
  learnerReason: reason,
});

const makeUnsupported = (reason: string): RouteChoice => ({
  provider: {} as AIProvider,
  providerName: 'unsupported',
  model: 'none',
  tier: 'mock',
  debugReason: reason,
  learnerReason: reason,
  fallbackReason: reason,
});

const isCooldownActive = () => {
  const until = getRouterState().geminiCooldownUntil;
  return until ? new Date(until).getTime() > Date.now() : false;
};

const usageEstimatePayload = (operation: ProviderOperation, payload: unknown) => {
  if (operation !== 'speaking_audio_transcription') return payload;
  const request = payload as Partial<SpeakingAudioTranscriptionRequest>;
  return {
    part: request.part,
    question: request.question,
    topic: request.topic,
    tags: request.tags,
    cueCard: request.cueCard,
    roughBrowserTranscript: request.roughBrowserTranscript,
    transcriptionHints: request.transcriptionHints,
    mimeType: request.mimeType,
    audioBase64: '[AUDIO_BASE64_REDACTED]',
    audioBase64Length: typeof request.audioBase64 === 'string' ? request.audioBase64.length : undefined,
  };
};

const estimatedText = (operation: ProviderOperation, payload: unknown) =>
  JSON.stringify(usageEstimatePayload(operation, payload));

const canUseGemini = (reserveRequired: boolean) => {
  if (!hasGemini() || isCooldownActive()) return false;
  const usage = getGeminiLocalUsage();
  const limits = getGeminiLimits();
  const remaining = limits.rpd - usage.requestsToday;
  if (usage.requestsLastMinute >= limits.rpm) return false;
  if (usage.estimatedInputTokensLastMinute >= limits.tpm) return false;
  return reserveRequired ? remaining > limits.reserve : remaining > 0;
};

export const canUseRealAudioTranscriptionProvider = () => {
  const mode = configuredProvider();
  return (mode === 'gemini' || mode === 'auto') && hasGemini() && canUseGemini(false);
};

const proAllowedNow = () => {
  const cutoff = new Date(readEnv('VITE_DEEPSEEK_PRO_DISCOUNT_END_UTC') || '2026-05-31T15:59:00Z').getTime();
  return Date.now() <= cutoff || envBoolean('VITE_DEEPSEEK_ALLOW_PRO_AFTER_DISCOUNT', false);
};

const isProviderUnavailable = (diagnostic: ProviderDiagnostic) =>
  diagnostic.failureKind === 'provider_unavailable';

const isGeminiQuotaLike = (diagnostic: ProviderDiagnostic) => {
  const text = `${diagnostic.parseError || ''} ${diagnostic.validationErrors.join(' ')}`.toLowerCase();
  return diagnostic.providerName === 'gemini' && [
    '429',
    'resource_exhausted',
    'quota',
    'rate limit',
    'rate-limited',
    'unavailable',
    '503',
    '500',
  ].some(marker => text.includes(marker));
};

const chooseDeepSeekFallback = (operation: ProviderOperation) => {
  if (!hasDeepSeek()) return makeMock('Real providers unavailable; using Mock Provider.');
  if (operation === 'writing_analysis' && proAllowedNow()) {
    return makeDeepSeekPro('Task 2 high-quality fallback used DeepSeek V4 Pro.');
  }
  if (operation === 'writing_analysis') {
    return makeDeepSeekFlash('DeepSeek V4 Pro discount protection is active; using V4 Flash.');
  }
  return makeDeepSeekFlash('Gemini is unavailable or reserved; using DeepSeek V4 Flash automatically.');
};

const chooseFrameworkRoute = (operation: 'writing_framework_coach' | 'writing_framework_extraction') => {
  if (hasDeepSeek()) {
    return makeDeepSeekFlash(
      operation === 'writing_framework_coach'
        ? 'Framework coach used DeepSeek V4 Flash as a low-cost intermediate step.'
        : 'Framework extraction used DeepSeek V4 Flash to avoid spending Gemini on an intermediate step.',
    );
  }
  return makeMock(
    operation === 'writing_framework_coach'
      ? 'Framework coach used local mock because DeepSeek fallback is unavailable.'
      : 'Framework extraction avoided Gemini; using local mock because DeepSeek fallback is unavailable.',
  );
};

const chooseRoute = (
  operation: ProviderOperation,
  payload: unknown,
  options: { reserveGemini: boolean; insufficientSample?: boolean },
): RouteChoice => {
  const mode = configuredProvider();
  if (mode === 'mock') return makeMock('Mock Provider is the default because no real provider mode is configured.');
  if (mode === 'gemini') {
    return hasGemini()
      ? makeGemini()
      : makeMock('Gemini mode is configured without VITE_GEMINI_API_KEY; using Mock Provider.');
  }

  if (operation === 'writing_framework_coach' || operation === 'writing_framework_extraction') {
    return mode === 'auto'
      ? chooseFrameworkRoute(operation)
      : makeMock(`${operation} uses local mock unless auto routing with DeepSeek is configured.`);
  }

  if (options.insufficientSample) {
    return hasDeepSeek()
      ? makeDeepSeekFlash('Gemini quota looks low, so this lower-priority request used DeepSeek V4 Flash.')
      : makeMock('Short or low-signal sample avoided Gemini; using conservative Mock handling.');
  }

  if (canUseGemini(options.reserveGemini)) {
    return makeGemini();
  }

  return chooseDeepSeekFallback(operation);
};

const chooseAudioTranscriptionRoute = (): RouteChoice => {
  const mode = configuredProvider();
  if (mode === 'mock') return makeMock('Mock audio transcription used for local UI flow.');
  if (mode === 'gemini') {
    if (!hasGemini()) return makeUnsupported('Gemini audio transcription is unavailable because VITE_GEMINI_API_KEY is not configured.');
    return canUseGemini(false)
      ? makeGemini()
      : makeUnsupported('Gemini audio transcription is unavailable because local quota or cooldown limits are active.');
  }
  if (mode === 'auto') {
    if (!hasGemini()) return makeUnsupported('Audio transcription needs Gemini audio input; DeepSeek does not support this operation.');
    return canUseGemini(false)
      ? makeGemini()
      : makeUnsupported('Gemini audio transcription is unavailable because local quota or cooldown limits are active.');
  }
  return makeUnsupported('Audio transcription provider is unavailable.');
};

const chooseAuthoritativeSpeakingScoreRoute = (): RouteChoice => {
  const mode = configuredProvider();
  if (mode === 'mock') return makeMock('Mock Provider is the default score-only judge in mock mode.');
  if (mode === 'gemini') {
    if (!hasGemini()) return makeUnsupported('Gemini authoritative Speaking scorer is unavailable because VITE_GEMINI_API_KEY is not configured.');
    return canUseGemini(false)
      ? makeGemini()
      : makeUnsupported('Gemini authoritative Speaking scorer is unavailable because local quota or cooldown limits are active.');
  }
  if (mode === 'auto') {
    if (!hasGemini()) return makeUnsupported('Authoritative Speaking scoring requires Gemini in auto mode; DeepSeek is not used as an equivalent judge.');
    return canUseGemini(false)
      ? makeGemini()
      : makeUnsupported('Gemini authoritative Speaking scorer is unavailable because local quota or cooldown limits are active; DeepSeek certification is not used.');
  }
  return makeUnsupported('Authoritative Speaking scorer is unavailable.');
};

async function runWithRoute<T>(
  operation: ProviderOperation,
  payload: unknown,
  route: RouteChoice,
  runner: (provider: AIProvider, providerName: string) => Promise<{ feedback: T; diagnostic: ProviderDiagnostic }>,
): Promise<RoutedResult<T>> {
  const result = await runner(route.provider, route.providerName);
  const diagnostic = {
    ...result.diagnostic,
    modelName: route.model,
  };
  const estimatedInputTokens = estimateTokensFromText(estimatedText(operation, payload));
  recordApiCall({
    provider: route.providerName,
    model: route.model,
    operation,
    success: !diagnostic.failureKind,
    status: diagnostic.failureKind || 'ok',
    estimatedInputTokens,
  });
  recordRouterResult({
    lastEffectiveProvider: route.providerName,
    lastEffectiveModel: route.model,
    lastOperation: operation,
    lastFallbackReason: route.fallbackReason,
    lastLearnerReason: route.learnerReason,
    lastDebugReason: route.debugReason,
  });

  return {
    ...result,
    diagnostic,
    route: {
      providerName: route.providerName,
      model: route.model,
      debugReason: route.debugReason,
      learnerReason: route.learnerReason,
      fallbackReason: route.fallbackReason,
    },
  };
}

async function runWithGeminiRetry<T>(
  operation: ProviderOperation,
  payload: unknown,
  route: RouteChoice,
  runner: (provider: AIProvider, providerName: string) => Promise<{ feedback: T; diagnostic: ProviderDiagnostic }>,
) {
  const first = await runWithRoute(operation, payload, route, runner);
  if (route.providerName !== 'gemini' || !isGeminiQuotaLike(first.diagnostic) || !hasDeepSeek()) return first;

  setGeminiCooldown(90, 'Gemini is cooling down after a rate-limit or quota response.');
  const fallback = chooseDeepSeekFallback(operation);
  const retried = await runWithRoute(operation, payload, fallback, runner);
  return {
    ...retried,
    route: {
      ...retried.route,
      fallbackReason: operation === 'writing_analysis' && fallback.tier === 'deepseek_pro'
        ? 'Task 2 high-quality fallback used DeepSeek V4 Pro.'
        : `Gemini is cooling down for about 90s. This attempt used ${fallback.model} automatically.`,
      learnerReason: operation === 'writing_analysis' && fallback.tier === 'deepseek_pro'
        ? 'Task 2 high-quality fallback used DeepSeek V4 Pro.'
        : `Gemini is cooling down for about 90s. This attempt used ${fallback.model} automatically.`,
    },
  };
}

export const routedAnalyzeSpeaking = (
  request: SpeakingAnalysisRequest,
  insufficientSample = false,
): Promise<RoutedResult<SpeakingFeedback>> => {
  const route = chooseRoute('speaking_analysis', request, { reserveGemini: true, insufficientSample });
  return runWithGeminiRetry('speaking_analysis', request, route, (provider, providerName) =>
    safeAnalyzeSpeaking(provider, providerName, request));
};

export const routedTranscribeSpeakingAudio = (
  request: SpeakingAudioTranscriptionRequest,
): Promise<RoutedResult<SpeakingAudioTranscriptionResult>> => {
  const route = chooseAudioTranscriptionRoute();
  return runWithRoute('speaking_audio_transcription', request, route, (provider, providerName) =>
    safeTranscribeSpeakingAudio(provider, providerName, request));
};

export const routedScoreSpeakingOnly = (
  request: SpeakingScoreOnlyRequest,
): Promise<RoutedResult<SpeakingScoreOnlyResult>> => {
  const route = chooseAuthoritativeSpeakingScoreRoute();
  return runWithRoute('speaking_score_only', request, route, (provider, providerName) =>
    safeScoreSpeakingOnly(provider, providerName, request));
};

export const routedValidateSpeakingTarget = (
  request: SpeakingTargetValidationRequest,
): Promise<RoutedResult<SpeakingTargetValidationResult>> => routedScoreSpeakingOnly({
  part: request.part,
  question: request.question,
  transcript: request.transcript,
}).then(result => {
  const floor = request.targetFloor;
  const scores = result.feedback.scores;
  const meets = result.feedback.bandEstimateExcludingPronunciation >= floor &&
    scores.fluencyCoherence >= floor &&
    scores.lexicalResource >= floor &&
    scores.grammaticalRangeAccuracy >= floor;
  const farBelow = [
    result.feedback.bandEstimateExcludingPronunciation,
    scores.fluencyCoherence,
    scores.lexicalResource,
    scores.grammaticalRangeAccuracy,
  ].some(score => score < floor - 0.5);

  return {
    ...result,
    feedback: {
      module: 'speaking',
      operation: 'speaking_target_validation',
      targetFloor: floor,
      status: meets ? 'meets_target' : farBelow ? 'failed' : 'borderline',
      scores: {
        fluencyCoherence: scores.fluencyCoherence,
        lexicalResource: scores.lexicalResource,
        grammaticalRangeAccuracy: scores.grammaticalRangeAccuracy,
        pronunciation: null,
      },
      rationaleZh: `Backward-compatible speaking_target_validation redirected to blind speaking_score_only. ${result.feedback.rationaleZh}`,
      repairFocusZh: meets
        ? ''
        : 'Blind score-only judge did not certify this answer at the requested floor.',
    },
  };
});

export const routedAnalyzeWriting = (
  request: WritingAnalysisRequest,
  insufficientSample = false,
): Promise<RoutedResult<WritingFeedback>> => {
  const route = chooseRoute('writing_analysis', request, { reserveGemini: false, insufficientSample });
  return runWithGeminiRetry('writing_analysis', request, route, (provider, providerName) =>
    safeAnalyzeWriting(provider, providerName, request));
};

export const routedValidateWritingTarget = (
  request: WritingTargetValidationRequest,
): Promise<RoutedResult<WritingTargetValidationResult>> => {
  const route = chooseRoute('writing_target_validation', request, { reserveGemini: false });
  return runWithGeminiRetry('writing_target_validation', request, route, (provider, providerName) =>
    safeValidateWritingTarget(provider, providerName, request));
};

export const routedAnalyzeWritingTask1 = (
  request: WritingTask1AnalysisRequest,
  insufficientSample = false,
): Promise<RoutedResult<WritingTask1Feedback>> => {
  const route = chooseRoute('writing_task1_analysis', request, { reserveGemini: true, insufficientSample });
  return runWithGeminiRetry('writing_task1_analysis', request, route, (provider, providerName) =>
    safeAnalyzeWritingTask1(provider, providerName, request));
};

export const routedCoachWritingFramework = (
  request: WritingFrameworkCoachRequest,
): Promise<RoutedResult<WritingFrameworkCoachFeedback>> => {
  const route = chooseRoute('writing_framework_coach', request, { reserveGemini: true });
  return runWithGeminiRetry('writing_framework_coach', request, route, (provider, providerName) =>
    safeCoachWritingFramework(provider, providerName, request));
};

export const routedExtractWritingFramework = (
  request: WritingFrameworkRequest,
): Promise<RoutedResult<WritingFrameworkSummary>> => {
  const route = chooseRoute('writing_framework_extraction', request, { reserveGemini: true });
  return runWithGeminiRetry('writing_framework_extraction', request, route, (provider, providerName) =>
    safeExtractWritingFramework(provider, providerName, request));
};
