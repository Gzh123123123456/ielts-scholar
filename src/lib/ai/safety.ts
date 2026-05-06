import { AIProvider } from './providers/base';
import {
  ProviderDiagnostic,
  SpeakingFeedback,
  SpeakingPart,
  WritingFeedback,
  WritingTask,
} from './schemas';

type SpeakingRequest = Parameters<AIProvider['analyzeSpeaking']>[0];
type WritingRequest = Parameters<AIProvider['analyzeWriting']>[0];

interface SafeAnalyzeResult<T> {
  feedback: T;
  diagnostic: ProviderDiagnostic;
}

const FALLBACK_SCORE = 0;
const FALLBACK_TEXT = 'Provider output was malformed or incomplete.';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (
  value: unknown,
  fallback: string,
  path: string,
  errors: string[],
): string => {
  if (typeof value === 'string' && value.trim()) return value;
  errors.push(`${path} missing or invalid string`);
  return fallback;
};

const asNumber = (
  value: unknown,
  path: string,
  errors: string[],
  fallback = FALLBACK_SCORE,
): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  errors.push(`${path} missing or invalid number`);
  return fallback;
};

const asArray = (value: unknown, path: string, errors: string[]): unknown[] => {
  if (Array.isArray(value)) return value;
  errors.push(`${path} missing or invalid array`);
  return [];
};

const asSpeakingPart = (value: unknown, fallback: number, errors: string[]): SpeakingPart => {
  const candidate = typeof value === 'number' ? value : fallback;
  if (candidate === 1 || candidate === 2 || candidate === 3) return candidate;
  errors.push('part missing or invalid SpeakingPart');
  return 1;
};

const asWritingTask = (value: unknown, fallback: string, errors: string[]): WritingTask => {
  const candidate = typeof value === 'string' ? value : fallback;
  if (candidate === 'task1' || candidate === 'task2') return candidate;
  errors.push('task missing or invalid WritingTask');
  return 'task2';
};

const normalizeStringArray = (
  value: unknown,
  path: string,
  errors: string[],
): string[] =>
  asArray(value, path, errors)
    .map((item, index) => asString(item, FALLBACK_TEXT, `${path}[${index}]`, errors));

const parseRawResponse = (rawResponse: unknown): { parsedJson: unknown; parseError?: string } => {
  if (typeof rawResponse !== 'string') return { parsedJson: rawResponse };

  try {
    return { parsedJson: JSON.parse(rawResponse) };
  } catch (error) {
    return {
      parsedJson: null,
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
};

const normalizeSpeakingFeedback = (
  value: unknown,
  request: SpeakingRequest,
  validationErrors: string[],
): SpeakingFeedback => {
  const source = isRecord(value) ? value : {};
  if (!isRecord(value)) validationErrors.push('response root missing or invalid object');

  const scores = isRecord(source.scores) ? source.scores : {};
  if (!isRecord(source.scores)) validationErrors.push('scores missing or invalid object');

  return {
    mode: source.mode === 'mock' ? 'mock' : 'practice',
    module: 'speaking',
    part: asSpeakingPart(source.part, request.part, validationErrors),
    question: asString(source.question, request.question || FALLBACK_TEXT, 'question', validationErrors),
    transcript: asString(source.transcript, request.transcript || FALLBACK_TEXT, 'transcript', validationErrors),
    bandEstimateExcludingPronunciation: asNumber(
      source.bandEstimateExcludingPronunciation,
      'bandEstimateExcludingPronunciation',
      validationErrors,
    ),
    scores: {
      fluencyCoherence: asNumber(scores.fluencyCoherence, 'scores.fluencyCoherence', validationErrors),
      lexicalResource: asNumber(scores.lexicalResource, 'scores.lexicalResource', validationErrors),
      grammaticalRangeAccuracy: asNumber(
        scores.grammaticalRangeAccuracy,
        'scores.grammaticalRangeAccuracy',
        validationErrors,
      ),
      pronunciation: null,
      pronunciationNote: asString(
        scores.pronunciationNote,
        'Pronunciation is not formally assessed in V1.',
        'scores.pronunciationNote',
        validationErrors,
      ),
    },
    fatalErrors: asArray(source.fatalErrors, 'fatalErrors', validationErrors).map((item, index) => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) validationErrors.push(`fatalErrors[${index}] missing or invalid object`);
      return {
        original: asString(record.original, FALLBACK_TEXT, `fatalErrors[${index}].original`, validationErrors),
        correction: asString(record.correction, FALLBACK_TEXT, `fatalErrors[${index}].correction`, validationErrors),
        tag: asString(record.tag, 'provider_safety', `fatalErrors[${index}].tag`, validationErrors),
        explanationZh: asString(
          record.explanationZh,
          'Provider feedback was incomplete; this item was normalized safely.',
          `fatalErrors[${index}].explanationZh`,
          validationErrors,
        ),
      };
    }),
    naturalnessHints: asArray(source.naturalnessHints, 'naturalnessHints', validationErrors).map((item, index) => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) validationErrors.push(`naturalnessHints[${index}] missing or invalid object`);
      return {
        original: asString(record.original, FALLBACK_TEXT, `naturalnessHints[${index}].original`, validationErrors),
        better: asString(record.better, FALLBACK_TEXT, `naturalnessHints[${index}].better`, validationErrors),
        tag: asString(record.tag, 'provider_safety', `naturalnessHints[${index}].tag`, validationErrors),
        explanationZh: asString(
          record.explanationZh,
          'Provider feedback was incomplete; this item was normalized safely.',
          `naturalnessHints[${index}].explanationZh`,
          validationErrors,
        ),
      };
    }),
    preservedStyle: asArray(source.preservedStyle, 'preservedStyle', validationErrors).map((item, index) => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) validationErrors.push(`preservedStyle[${index}] missing or invalid object`);
      return {
        text: asString(record.text, FALLBACK_TEXT, `preservedStyle[${index}].text`, validationErrors),
        reasonZh: asString(
          record.reasonZh,
          'Provider feedback was incomplete; this item was normalized safely.',
          `preservedStyle[${index}].reasonZh`,
          validationErrors,
        ),
      };
    }),
    upgradedAnswer: asString(
      source.upgradedAnswer,
      'The provider returned incomplete feedback. Please retry analysis after checking the Debug Panel.',
      'upgradedAnswer',
      validationErrors,
    ),
    reusableExample: isRecord(source.reusableExample)
      ? {
          example: asString(source.reusableExample.example, FALLBACK_TEXT, 'reusableExample.example', validationErrors),
          canBeReusedFor: normalizeStringArray(
            source.reusableExample.canBeReusedFor,
            'reusableExample.canBeReusedFor',
            validationErrors,
          ),
          explanationZh: asString(
            source.reusableExample.explanationZh,
            'Provider feedback was incomplete; this item was normalized safely.',
            'reusableExample.explanationZh',
            validationErrors,
          ),
        }
      : null,
    obsidianMarkdown: asString(
      source.obsidianMarkdown,
      '# IELTS Speaking Note\n\nProvider output was malformed or incomplete. Please retry analysis.',
      'obsidianMarkdown',
      validationErrors,
    ),
  };
};

const normalizeSeverity = (value: unknown, path: string, errors: string[]) => {
  if (value === 'fatal' || value === 'naturalness' || value === 'preserved') return value;
  errors.push(`${path} missing or invalid severity`);
  return 'naturalness';
};

const normalizeDimension = (value: unknown, path: string, errors: string[]) => {
  if (value === 'TR' || value === 'CC' || value === 'LR' || value === 'GRA') return value;
  errors.push(`${path} missing or invalid dimension`);
  return 'TR';
};

const normalizeWritingFeedback = (
  value: unknown,
  request: WritingRequest,
  validationErrors: string[],
): WritingFeedback => {
  const source = isRecord(value) ? value : {};
  if (!isRecord(value)) validationErrors.push('response root missing or invalid object');

  const scores = isRecord(source.scores) ? source.scores : {};
  if (!isRecord(source.scores)) validationErrors.push('scores missing or invalid object');

  return {
    mode: source.mode === 'mock' ? 'mock' : 'practice',
    module: 'writing',
    task: asWritingTask(source.task, request.task, validationErrors),
    question: asString(source.question, request.question || FALLBACK_TEXT, 'question', validationErrors),
    essay: asString(source.essay, request.essay || FALLBACK_TEXT, 'essay', validationErrors),
    scores: {
      taskResponse: asNumber(scores.taskResponse, 'scores.taskResponse', validationErrors),
      coherenceCohesion: asNumber(scores.coherenceCohesion, 'scores.coherenceCohesion', validationErrors),
      lexicalResource: asNumber(scores.lexicalResource, 'scores.lexicalResource', validationErrors),
      grammaticalRangeAccuracy: asNumber(
        scores.grammaticalRangeAccuracy,
        'scores.grammaticalRangeAccuracy',
        validationErrors,
      ),
    },
    frameworkFeedback: asArray(source.frameworkFeedback, 'frameworkFeedback', validationErrors).map((item, index) => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) validationErrors.push(`frameworkFeedback[${index}] missing or invalid object`);
      return {
        issue: asString(record.issue, FALLBACK_TEXT, `frameworkFeedback[${index}].issue`, validationErrors),
        suggestionZh: asString(
          record.suggestionZh,
          'Provider feedback was incomplete; this item was normalized safely.',
          `frameworkFeedback[${index}].suggestionZh`,
          validationErrors,
        ),
        severity: normalizeSeverity(record.severity, `frameworkFeedback[${index}].severity`, validationErrors),
      };
    }),
    sentenceFeedback: asArray(source.sentenceFeedback, 'sentenceFeedback', validationErrors).map((item, index) => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) validationErrors.push(`sentenceFeedback[${index}] missing or invalid object`);
      return {
        original: asString(record.original, FALLBACK_TEXT, `sentenceFeedback[${index}].original`, validationErrors),
        correction: asString(record.correction, FALLBACK_TEXT, `sentenceFeedback[${index}].correction`, validationErrors),
        dimension: normalizeDimension(record.dimension, `sentenceFeedback[${index}].dimension`, validationErrors),
        tag: asString(record.tag, 'provider_safety', `sentenceFeedback[${index}].tag`, validationErrors),
        explanationZh: asString(
          record.explanationZh,
          'Provider feedback was incomplete; this item was normalized safely.',
          `sentenceFeedback[${index}].explanationZh`,
          validationErrors,
        ),
      };
    }),
    modelAnswer: asString(
      source.modelAnswer,
      'The provider returned incomplete feedback. Please retry analysis after checking the Debug Panel.',
      'modelAnswer',
      validationErrors,
    ),
    reusableArguments: asArray(source.reusableArguments, 'reusableArguments', validationErrors).map((item, index) => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) validationErrors.push(`reusableArguments[${index}] missing or invalid object`);
      return {
        argument: asString(record.argument, FALLBACK_TEXT, `reusableArguments[${index}].argument`, validationErrors),
        canBeReusedFor: normalizeStringArray(
          record.canBeReusedFor,
          `reusableArguments[${index}].canBeReusedFor`,
          validationErrors,
        ),
        explanationZh: asString(
          record.explanationZh,
          'Provider feedback was incomplete; this item was normalized safely.',
          `reusableArguments[${index}].explanationZh`,
          validationErrors,
        ),
      };
    }),
    obsidianMarkdown: asString(
      source.obsidianMarkdown,
      '# IELTS Writing Note\n\nProvider output was malformed or incomplete. Please retry analysis.',
      'obsidianMarkdown',
      validationErrors,
    ),
  };
};

export const safeAnalyzeSpeaking = async (
  provider: AIProvider,
  providerName: string,
  requestPayload: SpeakingRequest,
): Promise<SafeAnalyzeResult<SpeakingFeedback>> => {
  let rawResponse: unknown = null;
  let parsedJson: unknown = null;
  let parseError: string | undefined;
  const validationErrors: string[] = [];

  try {
    rawResponse = await provider.analyzeSpeaking(requestPayload);
    const parsed = parseRawResponse(rawResponse);
    parsedJson = parsed.parsedJson;
    parseError = parsed.parseError;
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  const feedback = normalizeSpeakingFeedback(parsedJson, requestPayload, validationErrors);
  const fallbackUsed = Boolean(parseError) || validationErrors.length > 0;

  return {
    feedback,
    diagnostic: {
      module: 'speaking',
      providerName,
      requestPayload,
      rawResponse,
      parsedJson,
      parseError,
      validationErrors,
      fallbackUsed,
      timestamp: new Date().toISOString(),
    },
  };
};

export const safeAnalyzeWriting = async (
  provider: AIProvider,
  providerName: string,
  requestPayload: WritingRequest,
): Promise<SafeAnalyzeResult<WritingFeedback>> => {
  let rawResponse: unknown = null;
  let parsedJson: unknown = null;
  let parseError: string | undefined;
  const validationErrors: string[] = [];

  try {
    rawResponse = await provider.analyzeWriting(requestPayload);
    const parsed = parseRawResponse(rawResponse);
    parsedJson = parsed.parsedJson;
    parseError = parsed.parseError;
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  const feedback = normalizeWritingFeedback(parsedJson, requestPayload, validationErrors);
  const fallbackUsed = Boolean(parseError) || validationErrors.length > 0;

  return {
    feedback,
    diagnostic: {
      module: 'writing',
      providerName,
      requestPayload,
      rawResponse,
      parsedJson,
      parseError,
      validationErrors,
      fallbackUsed,
      timestamp: new Date().toISOString(),
    },
  };
};
