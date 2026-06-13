import { SpeakingQuestion, WritingQuestion, WritingTask1AcademicPrompt } from '@/src/data/questions/bank';
import {
  ProviderDiagnostic,
  Part1AnnotationOrigin,
  Part1AnswerAnnotationLayer,
  Part1DisplayedCleanRetryCertificationStatus,
  Part1DevelopmentStatus,
  Part1RetryReferenceCleanAnswer,
  Part1SessionPriorityState,
  SpeakingMaterialBankItem,
  SpeakingFeedback,
  WritingFeedback,
  WritingFrameworkCoachFeedback,
  WritingFrameworkReadiness,
  WritingTask1Feedback,
} from '@/src/lib/ai/schemas';
import { validatePart1ThreadFeedbackIntegrity } from '@/src/lib/ai/part1ThreadIntegrity';

export type PracticeRecordStatus = 'draft' | 'analyzed' | 'provider_failed';

export interface StorageWriteResult {
  ok: boolean;
  reason?: 'quota_exceeded' | 'storage_write_failed';
  key?: string;
  message?: string;
}

export interface ProviderDiagnosticSummary {
  operation: ProviderDiagnostic['operation'];
  providerName: string;
  modelName?: string;
  fallbackUsed: boolean;
  failureKind?: ProviderDiagnostic['failureKind'];
  parseError?: string;
  validationErrors: string[];
  normalizedFields?: string[];
  timestamp: string;
}

interface PracticeRecordBase {
  id: string;
  module: 'speaking' | 'writing' | 'writing_task1';
  mode: 'practice';
  status: PracticeRecordStatus;
  question: string;
  questionId?: string;
  topic?: string;
  tags?: string[];
  taskType?: string;
  createdAt: string;
  updatedAt: string;
  analyzedAt?: string;
  providerDiagnostic?: ProviderDiagnosticSummary;
  obsidianMarkdown?: string;
}

export interface SpeakingPracticeRecord extends PracticeRecordBase {
  module: 'speaking';
  part: 1 | 2 | 3;
  sessionKind?: 'single_question' | 'part1_topic_thread' | 'part3_discussion_thread';
  topicId?: string;
  threadId?: string;
  threadQuestions?: {
    id: string;
    question: string;
    topic: string;
    provenance?: 'active_bank_source' | 'product_supplement' | 'v1_fallback';
    sourceQuestionId?: string;
    supplementId?: string;
    discussionFrame?: string;
    bankGroupId?: string;
  }[];
  threadAnswers?: {
    questionId: string;
    question: string;
    transcript: string;
    rawTranscript?: string;
    audioTranscript?: string;
    transcriptOrigin: 'speech' | 'manual';
    transcriptSource?: 'speech' | 'audio' | 'manual' | 'reviewed';
    lockedAt: string;
  }[];
  activeThreadIndex?: number;
  threadCompleted?: boolean;
  retryChainId?: string;
  parentAttemptId?: string;
  priorCleanRetryAnswers?: Part1RetryReferenceCleanAnswer[];
  carriedMyUsableMaterial?: SpeakingMaterialBankItem[];
  questionData?: SpeakingQuestion;
  transcript: string;
  rawTranscript?: string;
  audioTranscript?: string;
  transcriptOrigin: 'speech' | 'manual';
  transcriptSource?: 'speech' | 'audio' | 'manual' | 'reviewed';
  feedback?: SpeakingFeedback;
}

export interface WritingTask2PracticeRecord extends PracticeRecordBase {
  module: 'writing';
  task: 'task2';
  questionData?: WritingQuestion;
  phase: 'framework' | 'writing' | 'results';
  frameworkChat: { role: 'user' | 'ai'; text: string }[];
  frameworkInput: string;
  finalFrameworkSummary: string;
  frameworkSummaryGenerated?: boolean;
  frameworkReadiness?: WritingFrameworkReadiness;
  latestFrameworkCoach?: WritingFrameworkCoachFeedback;
  essay: string;
  feedback?: WritingFeedback;
  feedbackFallbackUsed?: boolean;
}

export interface WritingTask1QuickPlan {
  overview: string;
  keyFeatures: string;
  comparisons: string;
  paragraphPlan: string;
}

export interface WritingTask1PracticeRecord extends PracticeRecordBase {
  module: 'writing_task1';
  task: 'task1';
  questionData?: WritingTask1AcademicPrompt;
  taskType: string;
  topic: string;
  tags: string[];
  prompt: string;
  instruction: string;
  visualBrief: string;
  dataSummary: string[];
  quickPlan: WritingTask1QuickPlan;
  report: string;
  feedback?: WritingTask1Feedback;
}

export type PracticeRecord = SpeakingPracticeRecord | WritingTask2PracticeRecord | WritingTask1PracticeRecord;

export interface ActiveSpeakingPracticeSession {
  id: string;
  currentPart: 1 | 2 | 3;
  attemptsByPart: Partial<Record<1 | 2 | 3, SpeakingPracticeRecord>>;
  updatedAt: string;
}

const RECORDS_KEY = 'ielts_practice_records_v1';
const ACTIVE_SPEAKING_KEY = 'ielts_active_speaking_practice_v1';
const ACTIVE_WRITING_TASK2_KEY = 'ielts_active_writing_task2_practice_v1';
const ACTIVE_WRITING_TASK1_KEY = 'ielts_active_writing_task1_practice_v1';
export const IELTS_LOCAL_STORAGE_KEYS = [
  RECORDS_KEY,
  ACTIVE_SPEAKING_KEY,
  ACTIVE_WRITING_TASK2_KEY,
  ACTIVE_WRITING_TASK1_KEY,
  'ielts_profile',
  'ielts_sessions',
  'ielts_api_usage_v1',
  'ielts_provider_router_state_v1',
];

const nowIso = () => new Date().toISOString();
const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

const asOptionalString = (value: unknown) =>
  typeof value === 'string' ? value : undefined;

const asOptionalNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const asTargetAnswerLayer = (value: unknown) =>
  value === 'band_7_to_7_5' || value === 'band_8_plus' || value === 'high_band_stability'
    ? value
    : undefined;

const asTargetAnswerStatus = (value: unknown) =>
  value === 'meets_target' ||
  value === 'borderline' ||
  value === 'failed' ||
  value === 'not_generated' ||
  value === 'not_applicable'
    ? value
    : undefined;

const asTargetState = (value: unknown) =>
  value === 'needs_repair' ||
  value === 'generated_target' ||
  value === 'target_failed_or_borderline' ||
  value === 'high_band_boundary' ||
  value === 'high_band_stable'
    ? value
    : undefined;

const asPart1CleanRetryCertificationStatus = (
  value: unknown,
): Part1DisplayedCleanRetryCertificationStatus =>
  value === 'certified_first_attempt' ||
  value === 'certified_after_rewrite' ||
  value === 'legacy_or_unverified'
    ? value
    : 'legacy_or_unverified';

const asPart1AnnotationOrigin = (value: unknown): Part1AnnotationOrigin | undefined =>
  value === 'previous_cleaner_answer_conflict'
    ? 'previous_cleaner_answer_conflict'
    : value === 'learner'
      ? 'learner'
      : undefined;

const asPart1SessionPriorityState = (value: unknown): Part1SessionPriorityState | undefined =>
  value === 'core_repair_needed' ||
  value === 'system_revision_conflict' ||
  value === 'development_needed' ||
  value === 'topic_complete'
    ? value
    : undefined;

const asPart1DevelopmentStatus = (value: unknown): Part1DevelopmentStatus | undefined =>
  value === 'needed' || value === 'sufficient' ? value : undefined;

const asStatus = (value: unknown): PracticeRecordStatus =>
  value === 'analyzed' || value === 'provider_failed' || value === 'draft' ? value : 'draft';

const asTranscriptSource = (value: unknown): SpeakingPracticeRecord['transcriptSource'] =>
  value === 'speech' || value === 'audio' || value === 'manual' || value === 'reviewed'
    ? value
    : undefined;

const asSpeakingSessionKind = (value: unknown): SpeakingPracticeRecord['sessionKind'] =>
  value === 'part1_topic_thread'
    ? 'part1_topic_thread'
    : value === 'part3_discussion_thread'
      ? 'part3_discussion_thread'
      : value === 'single_question'
        ? 'single_question'
        : undefined;

const asSpeakingPart = (value: unknown): 1 | 2 | 3 =>
  value === 2 || value === 3 ? value : 1;

const asPhase = (value: unknown): WritingTask2PracticeRecord['phase'] =>
  value === 'writing' || value === 'results' || value === 'framework' ? value : 'framework';

const asFrameworkReadiness = (value: unknown): WritingFrameworkReadiness | undefined =>
  value === 'almost_ready' || value === 'ready_to_write' || value === 'not_ready' ? value : undefined;

const asFrameworkChat = (value: unknown): WritingTask2PracticeRecord['frameworkChat'] =>
  Array.isArray(value)
    ? value.filter(isObject).map((item): WritingTask2PracticeRecord['frameworkChat'][number] => ({
      role: item.role === 'user' ? 'user' : 'ai',
      text: asString(item.text),
    })).filter(item => item.text.trim())
    : [];

const asStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;

const asRequiredStringArray = (value: unknown) => asStringArray(value) || [];

const sanitizeThreadQuestions = (value: unknown): SpeakingPracticeRecord['threadQuestions'] =>
  Array.isArray(value)
    ? value.filter(isObject).map(item => ({
      id: asString(item.id),
      question: asString(item.question),
      topic: asString(item.topic),
      provenance: (
        item.provenance === 'product_supplement'
          ? 'product_supplement'
          : item.provenance === 'v1_fallback'
            ? 'v1_fallback'
            : 'active_bank_source'
      ) as 'active_bank_source' | 'product_supplement' | 'v1_fallback',
      sourceQuestionId: asOptionalString(item.sourceQuestionId),
      supplementId: asOptionalString(item.supplementId),
      discussionFrame: asOptionalString(item.discussionFrame),
      bankGroupId: asOptionalString(item.bankGroupId),
    })).filter(item => item.id && item.question)
    : undefined;

const sanitizeThreadAnswers = (value: unknown): SpeakingPracticeRecord['threadAnswers'] =>
  Array.isArray(value)
    ? value.filter(isObject).map(item => ({
      questionId: asString(item.questionId),
      question: asString(item.question),
      transcript: asString(item.transcript),
      rawTranscript: asOptionalString(item.rawTranscript),
      audioTranscript: asOptionalString(item.audioTranscript),
      transcriptOrigin: (item.transcriptOrigin === 'speech' ? 'speech' : 'manual') as 'speech' | 'manual',
      transcriptSource: asTranscriptSource(item.transcriptSource),
      lockedAt: asString(item.lockedAt, nowIso()),
    })).filter(item => item.questionId && item.question)
    : undefined;

const sanitizeSpeakingPreservedStyle = (value: unknown): SpeakingFeedback['preservedStyle'] =>
  Array.isArray(value)
    ? value.filter(isObject).map(item => ({
      text: asString(item.text),
      reasonZh: asString(item.reasonZh),
      expansionZh: asOptionalString(item.expansionZh),
      sampleNextStep: asOptionalString(item.sampleNextStep),
      transferQuestions: asStringArray(item.transferQuestions),
      partUseZh: asOptionalString(item.partUseZh),
      riskNoteZh: asOptionalString(item.riskNoteZh),
    })).filter(item => item.text && item.reasonZh)
    : [];

const asModelAnswerAnnotationType = (
  value: unknown,
): NonNullable<WritingFeedback['modelAnswerAnnotations']>[number]['type'] =>
  value === 'expression_upgrade' ||
  value === 'sentence_repair' ||
  value === 'logic_repair' ||
  value === 'topic_vocabulary'
    ? value
    : 'topic_vocabulary';

const phraseLevel = (text: string, maxWords = 14) => {
  const cleaned = text.replace(/[.!?;:]+$/g, '').replace(/\s+/g, ' ').trim();
  const words = cleaned.split(' ').filter(Boolean);
  return words.length <= maxWords ? cleaned : words.slice(0, maxWords).join(' ');
};

const sanitizeTask2TopicVocabulary = (value: unknown): WritingFeedback['vocabularyUpgrade']['topicVocabulary'] =>
  Array.isArray(value)
    ? value.map((item): WritingFeedback['vocabularyUpgrade']['topicVocabulary'][number] | null => {
      if (typeof item === 'string') {
        const expression = phraseLevel(item, 8);
        return expression ? { expression, meaningZh: '', usageZh: '' } : null;
      }
      if (!isObject(item)) return null;
      const expression = phraseLevel(asString(item.expression ?? item.term ?? item.phrase), 8);
      if (!expression) return null;
      return {
        expression,
        meaningZh: asString(item.meaningZh ?? item.meaning),
        usageZh: asString(item.usageZh ?? item.usage ?? item.explanationZh),
        example: asOptionalString(item.example),
      };
    }).filter((item): item is WritingFeedback['vocabularyUpgrade']['topicVocabulary'][number] => Boolean(item))
    : [];

const sanitizeTask2ExpressionUpgrade = (
  item: unknown,
  categoryFallback?: 'from_essay' | 'argument_frame',
): WritingFeedback['vocabularyUpgrade']['expressionUpgrades'][number] | null => {
  if (typeof item === 'string') {
    const better = phraseLevel(item);
    return better ? { category: categoryFallback || 'argument_frame', better, explanationZh: '', reuseWhenZh: '' } : null;
  }
  if (!isObject(item)) return null;
  const original = phraseLevel(asString(item.original), 7);
  const better = phraseLevel(asString(item.better ?? item.frame ?? item.expression));
  if (!better) return null;
  return {
    category: item.category === 'from_essay' || item.type === 'from_essay' || original
      ? 'from_essay'
      : categoryFallback || 'argument_frame',
    original: original || undefined,
    better,
    explanationZh: asString(item.explanationZh),
    reuseWhenZh: asString(item.reuseWhenZh),
    example: asOptionalString(item.example),
  };
};

const sanitizeWritingTask2Feedback = (value: unknown): WritingFeedback | undefined => {
  if (!isObject(value)) return undefined;
  const scores = isObject(value.scores) ? value.scores : {};
  const vocabularySource = isObject(value.vocabularyUpgrade) ? value.vocabularyUpgrade : {};
  const expressionUpgrades = [
    ...(Array.isArray(vocabularySource.expressionUpgrades) ? vocabularySource.expressionUpgrades : [])
      .map(item => sanitizeTask2ExpressionUpgrade(item)),
    ...(Array.isArray(vocabularySource.userWordingUpgrades) ? vocabularySource.userWordingUpgrades : [])
      .map(item => sanitizeTask2ExpressionUpgrade(item, 'from_essay')),
    ...(Array.isArray(vocabularySource.collocationUpgrades) ? vocabularySource.collocationUpgrades : [])
      .map(item => sanitizeTask2ExpressionUpgrade(item, 'argument_frame')),
    ...(Array.isArray(vocabularySource.reusableSentenceFrames) ? vocabularySource.reusableSentenceFrames : [])
      .map(item => sanitizeTask2ExpressionUpgrade(item, 'argument_frame')),
  ]
    .filter((item): item is WritingFeedback['vocabularyUpgrade']['expressionUpgrades'][number] => Boolean(item))
    .filter((item, index, items) => items.findIndex(candidate => candidate.better.toLowerCase() === item.better.toLowerCase()) === index);

  return {
    ...(value as Partial<WritingFeedback>),
    mode: 'practice',
    module: 'writing',
    task: 'task2',
    question: asString(value.question),
    essay: asString(value.essay),
    scores: {
      taskResponse: typeof scores.taskResponse === 'number' ? scores.taskResponse : 0,
      coherenceCohesion: typeof scores.coherenceCohesion === 'number' ? scores.coherenceCohesion : 0,
      lexicalResource: typeof scores.lexicalResource === 'number' ? scores.lexicalResource : 0,
      grammaticalRangeAccuracy: typeof scores.grammaticalRangeAccuracy === 'number' ? scores.grammaticalRangeAccuracy : 0,
    },
    estimateRationaleZh: asOptionalString(value.estimateRationaleZh),
    targetBandFloor: typeof value.targetBandFloor === 'number' ? value.targetBandFloor : undefined,
    targetLayer: asOptionalString(value.targetLayer),
    targetValidationZh: asOptionalString(value.targetValidationZh),
    targetUpgradeFocusZh: asOptionalString(value.targetUpgradeFocusZh),
    targetAnswerFloor: asOptionalNumber(value.targetAnswerFloor),
    targetAnswerLayer: asTargetAnswerLayer(value.targetAnswerLayer),
    targetAnswerStatus: asTargetAnswerStatus(value.targetAnswerStatus),
    targetAnswerSelfScores: isObject(value.targetAnswerSelfScores)
      ? {
        taskResponse: asOptionalNumber(value.targetAnswerSelfScores.taskResponse),
        coherenceCohesion: asOptionalNumber(value.targetAnswerSelfScores.coherenceCohesion),
        lexicalResource: asOptionalNumber(value.targetAnswerSelfScores.lexicalResource),
        grammaticalRangeAccuracy: asOptionalNumber(value.targetAnswerSelfScores.grammaticalRangeAccuracy),
      }
      : undefined,
    targetAnswerValidationScores: isObject(value.targetAnswerValidationScores)
      ? {
        taskResponse: asOptionalNumber(value.targetAnswerValidationScores.taskResponse),
        coherenceCohesion: asOptionalNumber(value.targetAnswerValidationScores.coherenceCohesion),
        lexicalResource: asOptionalNumber(value.targetAnswerValidationScores.lexicalResource),
        grammaticalRangeAccuracy: asOptionalNumber(value.targetAnswerValidationScores.grammaticalRangeAccuracy),
      }
      : undefined,
    targetAnswerValidationRationaleZh: asOptionalString(value.targetAnswerValidationRationaleZh),
    targetAnswerRationaleZh: asOptionalString(value.targetAnswerRationaleZh),
    targetAnswerRepairFocusZh: asOptionalString(value.targetAnswerRepairFocusZh),
    targetState: asTargetState(value.targetState),
    highBandStabilityZh: asOptionalString(value.highBandStabilityZh),
    nextStepZh: asOptionalString(value.nextStepZh),
    scoreConsistencyNoteZh: asOptionalString(value.scoreConsistencyNoteZh),
    frameworkFeedback: Array.isArray(value.frameworkFeedback) ? value.frameworkFeedback as WritingFeedback['frameworkFeedback'] : [],
    essayLevelWarnings: Array.isArray(value.essayLevelWarnings) ? value.essayLevelWarnings as WritingFeedback['essayLevelWarnings'] : [],
    sentenceFeedback: Array.isArray(value.sentenceFeedback)
      ? value.sentenceFeedback.filter(isObject).map((item, index): WritingFeedback['sentenceFeedback'][number] => ({
        ...(item as Partial<WritingFeedback['sentenceFeedback'][number]>),
        id: asString(item.id, `C${index + 1}`),
        correctionNumber: typeof item.correctionNumber === 'number' ? item.correctionNumber : index + 1,
        paragraph: asOptionalString(item.paragraph),
        sourceQuote: asString(item.sourceQuote, asString(item.original)) || undefined,
        issueType: asOptionalString(item.issueType),
        severity: item.severity === 'major' || item.severity === 'medium' || item.severity === 'minor' || item.severity === 'polish'
          ? item.severity
          : item.severity === 'fatal'
            ? 'major'
            : item.severity === 'naturalness' || item.severity === 'preserved'
              ? 'polish'
              : undefined,
        original: asString(item.original),
        correction: asString(item.correction),
        dimension: item.dimension === 'TR' || item.dimension === 'CC' || item.dimension === 'LR' || item.dimension === 'GRA' ? item.dimension : 'GRA',
        tag: asString(item.tag, 'provider_safety'),
        explanationZh: asString(item.explanationZh),
        microUpgrades: Array.isArray(item.microUpgrades) ? item.microUpgrades as WritingFeedback['sentenceFeedback'][number]['microUpgrades'] : [],
      }))
      : [],
    vocabularyUpgrade: {
      topicVocabulary: sanitizeTask2TopicVocabulary(vocabularySource.topicVocabulary),
      expressionUpgrades,
    },
    modelAnswer: asString(value.modelAnswer),
    modelAnswerAnnotations: Array.isArray(value.modelAnswerAnnotations)
      ? value.modelAnswerAnnotations.filter(isObject).map(item => ({
        quote: asString(item.quote),
        type: asModelAnswerAnnotationType(item.type),
        labelZh: asString(item.labelZh),
      })).filter(item => item.quote)
      : [],
    modelAnswerPersonalized: Boolean(value.modelAnswerPersonalized),
    modelAnswerTargetLevel: asOptionalString(value.modelAnswerTargetLevel),
    reusableArguments: Array.isArray(value.reusableArguments) ? value.reusableArguments as WritingFeedback['reusableArguments'] : [],
    obsidianMarkdown: asString(value.obsidianMarkdown),
  };
};

const asTask1QuickPlan = (value: unknown): WritingTask1QuickPlan => {
  const source = isObject(value) ? value : {};
  return {
    overview: asString(source.overview),
    keyFeatures: asString(source.keyFeatures),
    comparisons: asString(source.comparisons),
    paragraphPlan: asString(source.paragraphPlan),
  };
};

const asPart1AnnotationSeverity = (value: unknown): Part1AnswerAnnotationLayer['severity'] =>
  value === 'must_fix' || value === 'better_spoken_choice' || value === 'optional_polish'
    ? value
    : 'optional_polish';

type StoredPart2Feedback = NonNullable<SpeakingFeedback['part2Feedback']>;

const asPart2MaterialType = (value: unknown): StoredPart2Feedback['materialType'] =>
  value === 'person' ||
  value === 'place' ||
  value === 'object' ||
  value === 'experience_event' ||
  value === 'abstract_or_opinion_experience' ||
  value === 'unclear'
    ? value
    : 'unclear';

const asPart2StoryModuleRole = (value: unknown): StoredPart2Feedback['storyModules'][number]['role'] | null =>
  value === 'what_who_where' ||
  value === 'background' ||
  value === 'concrete_details' ||
  value === 'what_happened' ||
  value === 'feeling' ||
  value === 'why_it_mattered' ||
  value === 'current_or_future_influence'
    ? value
    : null;

const asPart2StoryModuleStatus = (value: unknown): StoredPart2Feedback['storyModules'][number]['status'] =>
  value === 'present' || value === 'thin' || value === 'missing' || value === 'suggested_confirm'
    ? value
    : 'thin';

const asPart2LanguageSignal = (value: unknown): StoredPart2Feedback['languageSignals'][number]['signal'] | null =>
  value === 'idiomatic_expression' ||
  value === 'tense' ||
  value === 'connector' ||
  value === 'phrasal_verb' ||
  value === 'collocation' ||
  value === 'clause'
    ? value
    : null;

const asPart2LanguageSignalStatus = (value: unknown): StoredPart2Feedback['languageSignals'][number]['status'] =>
  value === 'strong' || value === 'usable' || value === 'thin' || value === 'missing' || value === 'not_needed'
    ? value
    : 'thin';

const sanitizeQuestionRefs = (value: unknown, maxCount = 0) => {
  const allowed = new Set(Array.from({ length: maxCount }, (_, index) => `Q${index + 1}`));
  return Array.isArray(value)
    ? value
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim())
      .filter(item => !allowed.size || allowed.has(item))
      .filter((item, index, items) => items.indexOf(item) === index)
    : [];
};

const normalizeStoredPart1Text = (value: string) =>
  value
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const containsStoredPart1UnsupportedBoundaryClaim = (value: string | undefined) => {
  const normalized = normalizeStoredPart1Text(value || '');
  if (!normalized) return false;
  const unsupportedTranscriptArea = /\b(spelling|spell|capitalization|uppercase|lowercase|punctuation|spacing|orthography|transcription|asr|homophone)\b|拼写|大小写|标点|空格|转写|同音/.test(normalized);
  const hasPronunciationMention = /\b(pronunciation|pronounce|pronouncing)\b/.test(normalized);
  const allowedPronunciationNote = /\b(not formally assessed|not assessed|excluding pronunciation)\b/.test(normalized);
  const unsupportedPronunciation = hasPronunciationMention && !allowedPronunciationNote;
  const unsupportedPronunciationZh = /发音/.test(normalized) && !/不正式评估|未评估|不评估/.test(normalized);
  return unsupportedTranscriptArea || unsupportedPronunciation || unsupportedPronunciationZh;
};

const sanitizeStoredPart1FeedbackText = (value: string | undefined) =>
  containsStoredPart1UnsupportedBoundaryClaim(value) ? '' : (value || '');

const isStoredPart1FormatOnlyRepair = (original: string, better: string, issueType: string, explanationZh: string) => {
  const normalizedOriginal = normalizeStoredPart1Text(original);
  const normalizedBetter = normalizeStoredPart1Text(better);
  if (!normalizedOriginal || !normalizedBetter) return false;
  if (normalizedOriginal === normalizedBetter) return true;
  if (normalizedOriginal.replace(/[^a-z]/g, '') === normalizedBetter.replace(/[^a-z]/g, '')) return true;
  const evidence = normalizeStoredPart1Text(`${issueType} ${explanationZh}`);
  const hasFormatOnlyEvidence = /\b(capitali[sz]ation|uppercase|lowercase|punctuation|spacing|spelling|spell|typo|orthograph|transcription|asr|homophone|pronunciation|pronounce)\b|拼写|大小写|标点|空格|转写|同音|发音/.test(evidence);
  const hasSpokenLanguageEvidence = /\b(article|determiner|pronoun|plural|singular|countability|preposition|collocation|tense|agreement|verb|word form|missing|grammar|accuracy|structure|word choice|natural|phrasing|spoken|reference)\b/.test(evidence);
  const originalWords = normalizedOriginal.split(/\s+/).filter(Boolean);
  const betterWords = normalizedBetter.split(/\s+/).filter(Boolean);
  return hasFormatOnlyEvidence && (!hasSpokenLanguageEvidence || (originalWords.length === 1 && betterWords.length === 1));
};

const sanitizePart1Annotations = (
  value: unknown,
  maxCount: number,
): NonNullable<SpeakingFeedback['threadFeedback']>['annotations'] =>
  Array.isArray(value)
    ? value.filter(isObject).map((item, index) => {
      const questionRef = asString(item.questionRef, `Q${index + 1}`);
      const layers = Array.isArray(item.layers)
        ? item.layers.filter(isObject).map(layer => ({
          severity: asPart1AnnotationSeverity(layer.severity),
          issueType: asString(layer.issueType),
          original: asString(layer.original),
          better: asString(layer.better ?? layer.correction),
          explanationZh: sanitizeStoredPart1FeedbackText(asString(layer.explanationZh)),
          reuseGuidanceZh: asOptionalString(layer.reuseGuidanceZh),
          origin: asPart1AnnotationOrigin(layer.origin),
          priorCertificationStatus: layer.priorCertificationStatus
            ? asPart1CleanRetryCertificationStatus(layer.priorCertificationStatus)
            : undefined,
          systemRevisionNoteZh: sanitizeStoredPart1FeedbackText(asOptionalString(layer.systemRevisionNoteZh)),
        })).filter(layer => (
          layer.original &&
          layer.better &&
          layer.explanationZh &&
          !isStoredPart1FormatOnlyRepair(layer.original, layer.better, layer.issueType, layer.explanationZh)
        ))
        : [];
      return {
        id: asString(item.id, `p1_saved_ann_${index + 1}`),
        questionRef,
        sourceQuote: asString(item.sourceQuote ?? item.original),
        combinedRepair: asOptionalString(item.combinedRepair),
        layers,
      };
    }).filter(item => /^Q\d+$/.test(item.questionRef) && Number(item.questionRef.slice(1)) <= maxCount && item.sourceQuote && item.layers.length)
    : [];

const sanitizePart1PhraseItems = (
  value: unknown,
  maxCount: number,
): NonNullable<SpeakingFeedback['threadFeedback']>['highImpactPhraseFixes'] =>
  Array.isArray(value)
    ? value.filter(isObject).map(item => ({
      questionRefs: sanitizeQuestionRefs(item.questionRefs ?? item.affectedQuestions, maxCount),
      original: asString(item.original ?? item.learnerWording),
      better: asString(item.better ?? item.betterVersion),
      explanationZh: sanitizeStoredPart1FeedbackText(asString(item.explanationZh)),
    })).filter(item => item.questionRefs.length && item.original && item.better && item.explanationZh && !isStoredPart1FormatOnlyRepair(item.original, item.better, '', item.explanationZh))
    : [];

const sanitizePart1CoachingItems = (
  value: unknown,
  maxCount: number,
): NonNullable<SpeakingFeedback['threadFeedback']>['answerByAnswerCoaching'] =>
  Array.isArray(value)
    ? value.filter(isObject).map(item => ({
      questionRefs: sanitizeQuestionRefs(item.questionRefs, maxCount),
      issue: sanitizeStoredPart1FeedbackText(asString(item.issue)),
      coachingZh: sanitizeStoredPart1FeedbackText(asString(item.coachingZh)),
      exampleFrame: asOptionalString(item.exampleFrame),
    })).filter(item => item.questionRefs.length && item.issue && item.coachingZh)
    : [];

const sanitizePart1CleanRetryAnswers = (
  value: unknown,
  maxCount: number,
): NonNullable<SpeakingFeedback['threadFeedback']>['cleanRetryAnswers'] =>
  Array.isArray(value)
    ? value.filter(isObject).map(item => ({
      questionRef: asString(item.questionRef),
      answer: asString(item.answer ?? item.cleanAnswer ?? item.retryAnswer),
      noteZh: asOptionalString(item.noteZh),
    })).filter(item => /^Q\d+$/.test(item.questionRef) && Number(item.questionRef.slice(1)) <= maxCount && item.answer.trim())
      .filter((item, index, items) => items.findIndex(candidate => candidate.questionRef === item.questionRef) === index)
    : [];

const sanitizePart1MaterialItems = (value: unknown): NonNullable<SpeakingFeedback['threadFeedback']>['materialBank']['myUsableMaterial'] =>
  Array.isArray(value)
    ? value.filter(isObject).map(item => ({
      sourceWording: asOptionalString(item.sourceWording ?? item.originalIdea),
      reusableVersion: asString(item.reusableVersion ?? item.naturalReusableVersion),
      reuseFor: asRequiredStringArray(item.reuseFor ?? item.whereItMayBeReused),
      explanationZh: sanitizeStoredPart1FeedbackText(asOptionalString(item.explanationZh)),
      materialCore: asOptionalString(item.materialCore ?? item.personalMaterialCore),
      part1UseCases: asStringArray(item.part1UseCases ?? item.part1UseCase),
      developmentMoveZh: sanitizeStoredPart1FeedbackText(asOptionalString(item.developmentMoveZh ?? item.developmentMove)),
      developedExample: asOptionalString(item.developedExample),
      expressionFrames: asStringArray(item.expressionFrames)?.slice(0, 2),
      materialKey: asOptionalString(item.materialKey ?? item.identityKey),
    })).filter(item => item.reusableVersion && item.reuseFor.length && !containsStoredPart1UnsupportedBoundaryClaim(item.reusableVersion))
    : [];

const sanitizePart1DevelopmentTargets = (
  value: unknown,
  maxCount: number,
): NonNullable<SpeakingFeedback['threadFeedback']>['developmentTargets'] =>
  Array.isArray(value)
    ? value.filter(isObject).map(item => ({
      questionRef: asString(item.questionRef),
      reasonZh: sanitizeStoredPart1FeedbackText(asString(item.reasonZh ?? item.reason)),
      developmentMoveZh: sanitizeStoredPart1FeedbackText(asString(item.developmentMoveZh ?? item.developmentMove)),
      optionalDevelopedAnswer: asOptionalString(item.optionalDevelopedAnswer ?? item.developedAnswer),
    })).filter(item => /^Q\d+$/.test(item.questionRef) && Number(item.questionRef.slice(1)) <= maxCount && item.reasonZh && item.developmentMoveZh)
      .filter((item, index, items) => items.findIndex(candidate => candidate.questionRef === item.questionRef) === index)
    : [];

const sanitizePart1RetryCleanAnswers = (value: unknown): Part1RetryReferenceCleanAnswer[] =>
  Array.isArray(value)
    ? value.filter(isObject).map(item => ({
      questionRef: asString(item.questionRef),
      questionId: asOptionalString(item.questionId),
      answer: asString(item.answer),
      certificationStatus: asPart1CleanRetryCertificationStatus(item.certificationStatus),
    })).filter(item => /^Q\d+$/.test(item.questionRef) && item.answer.trim())
      .filter((item, index, items) => items.findIndex(candidate => candidate.questionRef === item.questionRef) === index)
    : [];

const sanitizePart2Annotations = (value: unknown): StoredPart2Feedback['annotations'] =>
  Array.isArray(value)
    ? value.filter(isObject).map((item, index) => {
      const sourceQuote = asString(item.sourceQuote ?? item.original);
      const rawLayers = Array.isArray(item.layers) ? item.layers : [item];
      const layers = rawLayers.filter(isObject).map(layer => ({
        severity: asPart1AnnotationSeverity(layer.severity),
        issueType: asString(layer.issueType ?? layer.tag),
        original: asString(layer.original ?? sourceQuote),
        better: asString(layer.better ?? layer.correction ?? item.combinedRepair),
        explanationZh: asString(layer.explanationZh),
        reuseGuidanceZh: asOptionalString(layer.reuseGuidanceZh),
        origin: asPart1AnnotationOrigin(layer.origin),
      })).filter(layer => layer.original && layer.better && layer.explanationZh);
      return {
        id: asString(item.id, `p2_saved_ann_${index + 1}`),
        questionRef: asString(item.questionRef, 'PART 2'),
        sourceQuote,
        combinedRepair: asOptionalString(item.combinedRepair),
        layers,
      };
    }).filter(item => item.sourceQuote && item.layers.length).slice(0, 8)
    : [];

const sanitizePart2StoryModules = (value: unknown): StoredPart2Feedback['storyModules'] =>
  Array.isArray(value)
    ? value.filter(isObject).map((item): StoredPart2Feedback['storyModules'][number] | null => {
      const role = asPart2StoryModuleRole(item.role ?? item.module);
      if (!role) return null;
      const sourceWording = asOptionalString(item.sourceWording ?? item.source ?? item.learnerWording);
      const improvedVersion = asOptionalString(item.improvedVersion ?? item.speakableVersion ?? item.nextVersion);
      const coachingZh = asString(item.coachingZh ?? item.coaching ?? item.nextMoveZh);
      if (!sourceWording && !improvedVersion && !coachingZh) return null;
      return {
        role,
        status: asPart2StoryModuleStatus(item.status),
        sourceWording,
        improvedVersion,
        coachingZh,
        confirmationNeeded: Boolean(item.confirmationNeeded),
      };
    }).filter((item): item is StoredPart2Feedback['storyModules'][number] => Boolean(item)).slice(0, 7)
    : [];

const sanitizePart2AlternativeUpgrades = (
  value: unknown,
): NonNullable<StoredPart2Feedback['languageSignals'][number]['alternativeUpgrades']> =>
  Array.isArray(value)
    ? value.filter(isObject).map((item): NonNullable<StoredPart2Feedback['languageSignals'][number]['alternativeUpgrades']>[number] | null => {
      const upgrade = asString(item.upgrade ?? item.bestUpgrade ?? item.better);
      const guidanceZh = asString(item.guidanceZh ?? item.explanationZh ?? item.replaceZh);
      if (!upgrade && !guidanceZh) return null;
      const sourceQuote = asOptionalString(item.sourceQuote ?? item.original ?? item.replace);
      return {
        kind: item.kind === 'replace' || item.kind === 'add'
          ? item.kind
          : sourceQuote ? 'replace' : 'add',
        sourceQuote,
        upgrade,
        guidanceZh,
        insertLocationZh: asOptionalString(item.insertLocationZh ?? item.whereZh ?? item.locationZh),
        sampleUpgrade: asOptionalString(item.sampleUpgrade ?? item.example),
        sampleUpgradeHighlight: asOptionalString(item.sampleUpgradeHighlight ?? item.sampleHighlight ?? item.highlightQuote),
      };
    }).filter((item): item is NonNullable<StoredPart2Feedback['languageSignals'][number]['alternativeUpgrades']>[number] => Boolean(item)).slice(0, 3)
    : [];

const sanitizePart2LanguageSignals = (value: unknown): StoredPart2Feedback['languageSignals'] =>
  Array.isArray(value)
    ? value.filter(isObject).map((item): StoredPart2Feedback['languageSignals'][number] | null => {
      const signal = asPart2LanguageSignal(item.signal ?? item.name);
      if (!signal) return null;
      const result = {
        signal,
        status: asPart2LanguageSignalStatus(item.status),
        requirementZh: asString(item.requirementZh),
        foundInTranscript: Boolean(item.foundInTranscript),
        evidence: asOptionalString(item.evidence),
        evidenceQuotes: asStringArray(item.evidenceQuotes),
        qualityZh: asString(item.qualityZh),
        nextMoveZh: asString(item.nextMoveZh ?? item.coachingZh ?? item.actionZh),
        bestUpgrade: asString(item.bestUpgrade),
        alternatives: asRequiredStringArray(item.alternatives),
        alternativeUpgrades: sanitizePart2AlternativeUpgrades(item.alternativeUpgrades),
        insertLocationZh: asString(item.insertLocationZh),
        sampleUpgrade: asOptionalString(item.sampleUpgrade ?? item.example),
        sampleUpgradeHighlight: asOptionalString(item.sampleUpgradeHighlight ?? item.sampleHighlight ?? item.highlightQuote),
        sampleUpgrades: asStringArray(item.sampleUpgrades),
        usedInNextVersionQuote: asOptionalString(item.usedInNextVersionQuote),
        profileSignalZh: asOptionalString(item.profileSignalZh),
      };
      return result.requirementZh ||
        result.evidence ||
        result.evidenceQuotes?.length ||
        result.qualityZh ||
        result.nextMoveZh ||
        result.bestUpgrade ||
        result.alternatives.length ||
        result.alternativeUpgrades.length ||
        result.insertLocationZh ||
        result.sampleUpgrade ||
        result.sampleUpgrades?.length ||
        result.usedInNextVersionQuote ||
        result.profileSignalZh
        ? result
        : null;
    }).filter((item): item is StoredPart2Feedback['languageSignals'][number] => Boolean(item)).slice(0, 6)
    : [];

const sanitizePart2NextSpeakableHighlights = (
  value: unknown,
  nextSpeakableVersion: string,
): StoredPart2Feedback['nextSpeakableVersionHighlights'] =>
  Array.isArray(value)
    ? value.filter(isObject).map((item): StoredPart2Feedback['nextSpeakableVersionHighlights'][number] | null => {
      const quote = asString(item.quote);
      if (!quote) return null;
      if (nextSpeakableVersion && !nextSpeakableVersion.toLowerCase().includes(quote.toLowerCase())) return null;
      const signal = asPart2LanguageSignal(item.signal);
      const storyRole = asPart2StoryModuleRole(item.storyRole);
      const labelZh = asString(item.labelZh);
      const whyItWorksZh = asString(item.whyItWorksZh);
      if (!labelZh && !whyItWorksZh) return null;
      return {
        quote,
        signal: signal || undefined,
        storyRole: storyRole || undefined,
        labelZh,
        whyItWorksZh,
      };
    }).filter((item): item is StoredPart2Feedback['nextSpeakableVersionHighlights'][number] => Boolean(item)).slice(0, 10)
    : [];

const sanitizePart2Feedback = (
  value: unknown,
  speakingPart: 1 | 2 | 3,
): SpeakingFeedback['part2Feedback'] => {
  if (speakingPart !== 2 || !isObject(value)) return undefined;
  const nextSpeakableVersion = asString(value.nextSpeakableVersion);
  return {
    materialType: asPart2MaterialType(value.materialType),
    materialTypeRationaleZh: asOptionalString(value.materialTypeRationaleZh),
    annotations: sanitizePart2Annotations(value.annotations),
    storyModules: sanitizePart2StoryModules(value.storyModules),
    languageSignals: sanitizePart2LanguageSignals(value.languageSignals),
    priorityFocusZh: asString(value.priorityFocusZh),
    nextSpeakableVersion,
    nextSpeakableVersionHighlights: sanitizePart2NextSpeakableHighlights(
      value.nextSpeakableVersionHighlights,
      nextSpeakableVersion,
    ),
  };
};

const sanitizePart1RetryReference = (value: unknown): SpeakingFeedback['part1RetryReference'] => {
  if (!isObject(value)) return undefined;
  const retryChainId = asString(value.retryChainId);
  const cleanRetryAnswers = sanitizePart1RetryCleanAnswers(value.cleanRetryAnswers);
  if (!retryChainId || !cleanRetryAnswers.length) return undefined;
  return {
    retryChainId,
    parentAttemptId: asOptionalString(value.parentAttemptId),
    cleanRetryAnswers,
    carriedMyUsableMaterial: sanitizePart1MaterialItems(value.carriedMyUsableMaterial),
  };
};

const sanitizePart1ThreadLevelPatterns = (
  value: unknown,
): NonNullable<SpeakingFeedback['threadFeedback']>['threadLevelPatterns'] =>
  Array.isArray(value)
    ? value.filter(isObject).map(item => ({
      observationZh: sanitizeStoredPart1FeedbackText(asString(item.observationZh ?? item.observation)),
      whyItMattersZh: sanitizeStoredPart1FeedbackText(asString(item.whyItMattersZh ?? item.whyItMatters)),
      retryRule: sanitizeStoredPart1FeedbackText(asString(item.retryRule ?? item.rule)),
    })).filter(item => item.observationZh && item.whyItMattersZh && item.retryRule)
    : [];

const sanitizePart1NextRetryPlan = (value: unknown): NonNullable<SpeakingFeedback['threadFeedback']>['nextRetryPlan'] => {
  if (!isObject(value)) return undefined;
  const actions = asStringArray(value.actions)?.map(sanitizeStoredPart1FeedbackText).filter(item => item.trim()).slice(0, 4);
  const plan = {
    priorityAccuracyPatternZh: sanitizeStoredPart1FeedbackText(asOptionalString(value.priorityAccuracyPatternZh)),
    answerLengthRuleZh: sanitizeStoredPart1FeedbackText(asOptionalString(value.answerLengthRuleZh)),
    materialToTry: sanitizeStoredPart1FeedbackText(asOptionalString(value.materialToTry)),
    actions,
  };
  return plan.priorityAccuracyPatternZh || plan.answerLengthRuleZh || plan.materialToTry || plan.actions?.length
    ? plan
    : undefined;
};

const sanitizePart1ThreadFeedback = (
  value: unknown,
  maxCount: number,
): SpeakingFeedback['threadFeedback'] | undefined => {
  if (!isObject(value)) return undefined;
  const materialBank = isObject(value.materialBank) ? value.materialBank : {};
  return {
    topic: asString(value.topic, 'Part 1 Topic'),
    threadId: asString(value.threadId, 'part1_thread'),
    questionCount: typeof value.questionCount === 'number' ? value.questionCount : maxCount,
    mustFix: Array.isArray(value.mustFix)
      ? value.mustFix.filter(isObject).map(item => ({
        questionRefs: sanitizeQuestionRefs(item.questionRefs ?? item.affectedQuestions, maxCount),
        learnerWording: asString(item.learnerWording ?? item.original),
        betterVersion: asString(item.betterVersion ?? item.correction),
        explanationZh: sanitizeStoredPart1FeedbackText(asString(item.explanationZh)),
        recurring: Boolean(item.recurring),
      })).filter(item => item.questionRefs.length && item.learnerWording && item.betterVersion && item.explanationZh && !isStoredPart1FormatOnlyRepair(item.learnerWording, item.betterVersion, 'must_fix', item.explanationZh))
      : [],
    annotations: sanitizePart1Annotations(value.annotations, maxCount),
    cleanRetryAnswers: sanitizePart1CleanRetryAnswers(value.cleanRetryAnswers, maxCount),
    cleanRetryCertificationStatus: value.cleanRetryCertificationStatus
      ? asPart1CleanRetryCertificationStatus(value.cleanRetryCertificationStatus)
      : undefined,
    part1SessionPriorityState: asPart1SessionPriorityState(value.part1SessionPriorityState),
    developmentStatus: asPart1DevelopmentStatus(value.developmentStatus),
    developmentTargets: sanitizePart1DevelopmentTargets(value.developmentTargets, maxCount),
    threadLevelPatterns: sanitizePart1ThreadLevelPatterns(value.threadLevelPatterns),
    answerByAnswerCoaching: sanitizePart1CoachingItems(value.answerByAnswerCoaching, maxCount),
    highImpactPhraseFixes: sanitizePart1PhraseItems(value.highImpactPhraseFixes, maxCount),
    materialBank: {
      myUsableMaterial: sanitizePart1MaterialItems(materialBank.myUsableMaterial),
      reusableSpokenLanguage: sanitizePart1MaterialItems(materialBank.reusableSpokenLanguage),
    },
    optionalPolish: sanitizePart1PhraseItems(value.optionalPolish, maxCount),
    nextRetryPlan: sanitizePart1NextRetryPlan(value.nextRetryPlan),
    nextRetryFocusZh: asString(value.nextRetryFocusZh),
    previousCleanerConflictCount: typeof value.previousCleanerConflictCount === 'number'
      ? Math.max(0, Math.floor(value.previousCleanerConflictCount))
      : undefined,
  };
};

const sanitizeSpeakingFeedback = (value: unknown): SpeakingFeedback | undefined => {
  if (!isObject(value)) return undefined;
  const scores = isObject(value.scores) ? value.scores : {};
  const part = asSpeakingPart(value.part);
  const sessionKind = asSpeakingSessionKind(value.sessionKind);
  const hasThreadAnswers = sessionKind === 'part1_topic_thread' || sessionKind === 'part3_discussion_thread';
  const threadAnswers = hasThreadAnswers
    ? Array.isArray(value.threadAnswers)
      ? value.threadAnswers.filter(isObject).map(item => ({
        questionId: asString(item.questionId),
        question: asString(item.question),
        answer: asString(item.answer ?? item.transcript),
      })).filter(item => item.questionId && item.question)
      : []
    : undefined;
  const reusableExample = isObject(value.reusableExample)
    ? {
      example: asString(value.reusableExample.example),
      canBeReusedFor: Array.isArray(value.reusableExample.canBeReusedFor)
        ? value.reusableExample.canBeReusedFor.filter((item): item is string => typeof item === 'string')
        : [],
      explanationZh: asString(value.reusableExample.explanationZh),
    }
    : null;

  return {
    ...(value as Partial<SpeakingFeedback>),
    mode: 'practice',
    module: 'speaking',
    part,
    sessionKind,
    topic: asOptionalString(value.topic),
    threadId: asOptionalString(value.threadId),
    threadAnswers,
    part1RetryReference: sanitizePart1RetryReference(value.part1RetryReference),
    threadFeedback: sessionKind === 'part1_topic_thread'
      ? sanitizePart1ThreadFeedback(value.threadFeedback, threadAnswers?.length || 0)
      : undefined,
    question: asString(value.question),
    transcript: asString(value.transcript),
    bandEstimateExcludingPronunciation: typeof value.bandEstimateExcludingPronunciation === 'number'
      ? value.bandEstimateExcludingPronunciation
      : 0,
    bandEstimateRange: isObject(value.bandEstimateRange) &&
      typeof value.bandEstimateRange.lower === 'number' &&
      typeof value.bandEstimateRange.upper === 'number'
      ? {
          lower: value.bandEstimateRange.lower,
          upper: value.bandEstimateRange.upper,
          rationaleZh: asOptionalString(value.bandEstimateRange.rationaleZh),
        }
      : undefined,
    estimateRationaleZh: asOptionalString(value.estimateRationaleZh),
    targetBandFloor: typeof value.targetBandFloor === 'number' ? value.targetBandFloor : undefined,
    targetLayer: asOptionalString(value.targetLayer),
    targetValidationZh: asOptionalString(value.targetValidationZh),
    targetUpgradeFocusZh: asOptionalString(value.targetUpgradeFocusZh),
    targetAnswerFloor: asOptionalNumber(value.targetAnswerFloor),
    targetAnswerLayer: asTargetAnswerLayer(value.targetAnswerLayer),
    targetAnswerStatus: asTargetAnswerStatus(value.targetAnswerStatus),
    targetAnswerSelfScores: isObject(value.targetAnswerSelfScores)
      ? {
        fluencyCoherence: asOptionalNumber(value.targetAnswerSelfScores.fluencyCoherence),
        lexicalResource: asOptionalNumber(value.targetAnswerSelfScores.lexicalResource),
        grammaticalRangeAccuracy: asOptionalNumber(value.targetAnswerSelfScores.grammaticalRangeAccuracy),
        pronunciation: null,
      }
      : undefined,
    targetAnswerValidationScores: isObject(value.targetAnswerValidationScores)
      ? {
        fluencyCoherence: asOptionalNumber(value.targetAnswerValidationScores.fluencyCoherence),
        lexicalResource: asOptionalNumber(value.targetAnswerValidationScores.lexicalResource),
        grammaticalRangeAccuracy: asOptionalNumber(value.targetAnswerValidationScores.grammaticalRangeAccuracy),
        pronunciation: null,
      }
      : undefined,
    targetAnswerValidationRationaleZh: asOptionalString(value.targetAnswerValidationRationaleZh),
    targetAnswerRationaleZh: asOptionalString(value.targetAnswerRationaleZh),
    targetAnswerRepairFocusZh: asOptionalString(value.targetAnswerRepairFocusZh),
    targetState: asTargetState(value.targetState),
    highBandStabilityZh: asOptionalString(value.highBandStabilityZh),
    nextStepZh: asOptionalString(value.nextStepZh),
    scoreConsistencyNoteZh: asOptionalString(value.scoreConsistencyNoteZh),
    scores: {
      fluencyCoherence: typeof scores.fluencyCoherence === 'number' ? scores.fluencyCoherence : 0,
      lexicalResource: typeof scores.lexicalResource === 'number' ? scores.lexicalResource : 0,
      grammaticalRangeAccuracy: typeof scores.grammaticalRangeAccuracy === 'number' ? scores.grammaticalRangeAccuracy : 0,
      pronunciation: null,
      pronunciationNote: asString(scores.pronunciationNote, 'Pronunciation is not formally assessed in V1.'),
    },
    fatalErrors: Array.isArray(value.fatalErrors) ? value.fatalErrors as SpeakingFeedback['fatalErrors'] : [],
    naturalnessHints: Array.isArray(value.naturalnessHints) ? value.naturalnessHints as SpeakingFeedback['naturalnessHints'] : [],
    band9Refinements: Array.isArray(value.band9Refinements) ? value.band9Refinements as SpeakingFeedback['band9Refinements'] : [],
    preservedStyle: sanitizeSpeakingPreservedStyle(value.preservedStyle),
    upgradedAnswer: asString(value.upgradedAnswer),
    part2Feedback: sanitizePart2Feedback(value.part2Feedback, part),
    reusableExample,
    obsidianMarkdown: asString(value.obsidianMarkdown),
  };
};

const sanitizeSpeakingRecord = (value: unknown): SpeakingPracticeRecord | null => {
  if (!isObject(value) || value.module !== 'speaking') return null;
  const id = asString(value.id);
  const question = asString(value.question);
  if (!id || !question) return null;
  const timestamp = asString(value.updatedAt, asString(value.createdAt, nowIso()));
  const sanitizedThreadAnswers = sanitizeThreadAnswers(value.threadAnswers);
  const sanitizedFeedback = sanitizeSpeakingFeedback(value.feedback);
  const restoredThreadIntegrity = value.sessionKind === 'part1_topic_thread' && sanitizedFeedback
    ? validatePart1ThreadFeedbackIntegrity(sanitizedFeedback, (sanitizedThreadAnswers || []).map(answer => ({
      questionId: answer.questionId,
      question: answer.question,
      transcript: answer.transcript,
    })))
    : null;
  const restoredFeedback = restoredThreadIntegrity && !restoredThreadIntegrity.ok ? undefined : sanitizedFeedback;
  const restoredStatus = restoredThreadIntegrity && !restoredThreadIntegrity.ok && asStatus(value.status) === 'analyzed'
    ? 'provider_failed'
    : asStatus(value.status);

  return {
    ...(value as Partial<SpeakingPracticeRecord>),
    id,
    module: 'speaking',
    mode: 'practice',
    status: restoredStatus,
    part: asSpeakingPart(value.part),
    sessionKind: asSpeakingSessionKind(value.sessionKind),
    topicId: asOptionalString(value.topicId),
    threadId: asOptionalString(value.threadId),
    threadQuestions: sanitizeThreadQuestions(value.threadQuestions),
    threadAnswers: sanitizedThreadAnswers,
    activeThreadIndex: typeof value.activeThreadIndex === 'number' ? Math.max(0, Math.floor(value.activeThreadIndex)) : undefined,
    threadCompleted: typeof value.threadCompleted === 'boolean' ? value.threadCompleted : undefined,
    retryChainId: asOptionalString(value.retryChainId),
    parentAttemptId: asOptionalString(value.parentAttemptId),
    priorCleanRetryAnswers: sanitizePart1RetryCleanAnswers(value.priorCleanRetryAnswers),
    carriedMyUsableMaterial: sanitizePart1MaterialItems(value.carriedMyUsableMaterial),
    question,
    questionId: asOptionalString(value.questionId),
    topic: asOptionalString(value.topic),
    tags: asStringArray(value.tags),
    createdAt: asString(value.createdAt, timestamp),
    updatedAt: timestamp,
    analyzedAt: asOptionalString(value.analyzedAt),
    transcript: asString(value.transcript),
    rawTranscript: asOptionalString(value.rawTranscript),
    audioTranscript: asOptionalString(value.audioTranscript),
    transcriptOrigin: value.transcriptOrigin === 'speech' ? 'speech' : 'manual',
    transcriptSource: asTranscriptSource(value.transcriptSource),
    feedback: restoredFeedback,
    obsidianMarkdown: restoredFeedback ? asOptionalString(value.obsidianMarkdown) : undefined,
  };
};

const sanitizeWritingTask2Record = (value: unknown): WritingTask2PracticeRecord | null => {
  if (!isObject(value) || value.module !== 'writing') return null;
  const id = asString(value.id);
  const question = asString(value.question);
  if (!id || !question) return null;
  const timestamp = asString(value.updatedAt, asString(value.createdAt, nowIso()));

  return {
    ...(value as Partial<WritingTask2PracticeRecord>),
    id,
    module: 'writing',
    mode: 'practice',
    status: asStatus(value.status),
    task: 'task2',
    question,
    questionId: asOptionalString(value.questionId),
    topic: asOptionalString(value.topic),
    tags: asStringArray(value.tags),
    taskType: asOptionalString(value.taskType),
    createdAt: asString(value.createdAt, timestamp),
    updatedAt: timestamp,
    analyzedAt: asOptionalString(value.analyzedAt),
    phase: asPhase(value.phase),
    frameworkChat: asFrameworkChat(value.frameworkChat),
    frameworkInput: asString(value.frameworkInput),
    finalFrameworkSummary: asString(value.finalFrameworkSummary),
    frameworkSummaryGenerated: Boolean(value.frameworkSummaryGenerated),
    frameworkReadiness: asFrameworkReadiness(value.frameworkReadiness),
    latestFrameworkCoach: isObject(value.latestFrameworkCoach)
      ? value.latestFrameworkCoach as unknown as WritingFrameworkCoachFeedback
      : undefined,
    essay: asString(value.essay),
    feedback: sanitizeWritingTask2Feedback(value.feedback),
    feedbackFallbackUsed: Boolean(value.feedbackFallbackUsed),
  };
};

const sanitizeWritingTask1Feedback = (value: unknown): WritingTask1Feedback | undefined => {
  if (!isObject(value)) return undefined;
  const taskAchievement = isObject(value.taskAchievement) ? value.taskAchievement : {};
  return {
    ...(value as Partial<WritingTask1Feedback>),
    mode: 'practice',
    module: 'writing_task1',
    task: 'task1',
    taskType: asString(value.taskType),
    instruction: asString(value.instruction),
    visualBrief: asString(value.visualBrief),
    report: asString(value.report),
    estimatedBand: typeof value.estimatedBand === 'number' ? value.estimatedBand : 0,
    taskAchievement: {
      score: typeof taskAchievement.score === 'number' ? taskAchievement.score : 0,
      feedback: asString(taskAchievement.feedback),
    },
    overviewFeedback: asString(value.overviewFeedback),
    keyFeaturesFeedback: asString(value.keyFeaturesFeedback),
    comparisonFeedback: asString(value.comparisonFeedback),
    dataAccuracyFeedback: asString(value.dataAccuracyFeedback),
    coherenceFeedback: asString(value.coherenceFeedback),
    languageCorrections: Array.isArray(value.languageCorrections)
      ? value.languageCorrections as WritingTask1Feedback['languageCorrections']
      : [],
    mustFix: asRequiredStringArray(value.mustFix),
    rewriteTask: asString(value.rewriteTask),
    reusableReportPatterns: asRequiredStringArray(value.reusableReportPatterns),
    improvedReport: asString(value.improvedReport),
    modelExcerpt: asOptionalString(value.modelExcerpt),
    targetState: asTargetState(value.targetState),
    obsidianMarkdown: asString(value.obsidianMarkdown),
  };
};

const sanitizeWritingTask1Record = (value: unknown): WritingTask1PracticeRecord | null => {
  if (!isObject(value) || value.module !== 'writing_task1') return null;
  const id = asString(value.id);
  const instruction = asString(value.instruction, asString(value.question));
  if (!id || !instruction) return null;
  const timestamp = asString(value.updatedAt, asString(value.createdAt, nowIso()));

  return {
    ...(value as Partial<WritingTask1PracticeRecord>),
    id,
    module: 'writing_task1',
    mode: 'practice',
    status: asStatus(value.status),
    task: 'task1',
    question: asString(value.question, instruction),
    questionId: asOptionalString(value.questionId),
    topic: asString(value.topic, 'Academic Task 1'),
    tags: asRequiredStringArray(value.tags),
    taskType: asString(value.taskType, 'Academic Task 1'),
    createdAt: asString(value.createdAt, timestamp),
    updatedAt: timestamp,
    analyzedAt: asOptionalString(value.analyzedAt),
    instruction,
    prompt: asString(value.prompt, instruction),
    visualBrief: asString(value.visualBrief),
    dataSummary: asRequiredStringArray(value.dataSummary),
    quickPlan: asTask1QuickPlan(value.quickPlan),
    report: asString(value.report),
    feedback: sanitizeWritingTask1Feedback(value.feedback),
    obsidianMarkdown: asOptionalString(value.obsidianMarkdown),
  };
};

export const sanitizePracticeRecord = (value: unknown): PracticeRecord | null =>
  isObject(value) && value.module === 'speaking'
    ? sanitizeSpeakingRecord(value)
    : isObject(value) && value.module === 'writing_task1'
      ? sanitizeWritingTask1Record(value)
      : sanitizeWritingTask2Record(value);

export const sanitizeActiveSpeakingSession = (value: unknown): ActiveSpeakingPracticeSession | null => {
  if (!isObject(value) || !isObject(value.attemptsByPart)) return null;

  const attemptsByPart: ActiveSpeakingPracticeSession['attemptsByPart'] = {};
  ([1, 2, 3] as const).forEach(part => {
    const record = sanitizeSpeakingRecord(value.attemptsByPart?.[part]);
    if (record) attemptsByPart[part] = record;
  });

  return {
    id: asString(value.id, createRecordId('speaking_session')),
    currentPart: asSpeakingPart(value.currentPart),
    attemptsByPart,
    updatedAt: asString(value.updatedAt, nowIso()),
  };
};

const sortTimestamp = (record: PracticeRecord) =>
  record.analyzedAt || record.createdAt || record.updatedAt || '';

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};

const readJsonArray = (key: string): unknown[] => {
  const value = readJson<unknown>(key, []);
  return Array.isArray(value) ? value : [];
};

const writeJson = (key: string, value: unknown): StorageWriteResult => {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return { ok: true };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      return {
        ok: false,
        reason: 'quota_exceeded',
        key,
        message: `localStorage quota exceeded writing "${key}".`,
      };
    }
    console.error(`[ielts] Unexpected storage write error for "${key}":`, error);
    return {
      ok: false,
      reason: 'storage_write_failed',
      key,
      message: `Failed to write to localStorage key "${key}".`,
    };
  }
};

const removeJson = (key: string) => {
  localStorage.removeItem(key);
};

export const createRecordId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const summarizeDiagnostic = (diagnostic: ProviderDiagnostic): ProviderDiagnosticSummary => ({
  operation: diagnostic.operation,
  providerName: diagnostic.providerName,
  modelName: diagnostic.modelName,
  fallbackUsed: diagnostic.fallbackUsed,
  failureKind: diagnostic.failureKind,
  parseError: diagnostic.parseError,
  validationErrors: diagnostic.validationErrors,
  normalizedFields: diagnostic.normalizedFields,
  timestamp: diagnostic.timestamp,
});

export const getPracticeRecords = (limit = 12): PracticeRecord[] =>
  readJsonArray(RECORDS_KEY)
    .map(sanitizePracticeRecord)
    .filter((record): record is PracticeRecord => Boolean(record))
    .filter(record => record.status !== 'draft')
    .sort((a, b) => sortTimestamp(b).localeCompare(sortTimestamp(a)))
    .slice(0, limit);

export const getAllPracticeRecords = (): PracticeRecord[] =>
  readJsonArray(RECORDS_KEY)
    .map(sanitizePracticeRecord)
    .filter((record): record is PracticeRecord => Boolean(record))
    .filter(record => record.status !== 'draft')
    .sort((a, b) => sortTimestamp(b).localeCompare(sortTimestamp(a)));

export const upsertPracticeRecord = (record: PracticeRecord): StorageWriteResult => {
  if (record.status === 'draft') return { ok: true };
  const rawRecords = readJsonArray(RECORDS_KEY);
  const validRecords = rawRecords
    .map(sanitizePracticeRecord)
    .filter((item): item is PracticeRecord => Boolean(item));
  const preservedUnknownRecords = rawRecords.filter(item => !sanitizePracticeRecord(item));
  const existing = validRecords.find(item => item.id === record.id);
  const nextRecord = {
    ...existing,
    ...record,
    createdAt: record.createdAt || existing?.createdAt || nowIso(),
    updatedAt: record.updatedAt || existing?.updatedAt || nowIso(),
    analyzedAt: record.analyzedAt || existing?.analyzedAt,
    providerDiagnostic: record.providerDiagnostic || existing?.providerDiagnostic,
    obsidianMarkdown: record.obsidianMarkdown || existing?.obsidianMarkdown,
  } as PracticeRecord;
  const next = [
    ...[nextRecord, ...validRecords.filter(item => item.id !== record.id)]
      .sort((a, b) => sortTimestamp(b).localeCompare(sortTimestamp(a))),
    ...preservedUnknownRecords,
  ];
  return writeJson(RECORDS_KEY, next);
};

export const deletePracticeRecord = (
  recordId: string,
  module?: PracticeRecord['module'],
) => {
  const records = readJsonArray(RECORDS_KEY);
  const next = records.filter(record => (
    !isObject(record) || record.id !== recordId || (module ? record.module !== module : false)
  ));
  return writeJson(RECORDS_KEY, next);
};

export const getActiveSpeakingSession = (): ActiveSpeakingPracticeSession | null =>
  sanitizeActiveSpeakingSession(readJson<unknown>(ACTIVE_SPEAKING_KEY, null));

export const saveActiveSpeakingSession = (session: ActiveSpeakingPracticeSession): StorageWriteResult => {
  return writeJson(ACTIVE_SPEAKING_KEY, { ...session, updatedAt: nowIso() });
};

export const getActiveWritingTask2 = (): WritingTask2PracticeRecord | null =>
  sanitizeWritingTask2Record(readJson<unknown>(ACTIVE_WRITING_TASK2_KEY, null));

export const saveActiveWritingTask2 = (attempt: WritingTask2PracticeRecord): StorageWriteResult => {
  return writeJson(ACTIVE_WRITING_TASK2_KEY, attempt);
};

export const deleteActiveWritingTask2 = (recordId: string) => {
  const active = getActiveWritingTask2();
  if (active?.id === recordId) {
    removeJson(ACTIVE_WRITING_TASK2_KEY);
  }
};

export const getActiveWritingTask1 = (): WritingTask1PracticeRecord | null =>
  sanitizeWritingTask1Record(readJson<unknown>(ACTIVE_WRITING_TASK1_KEY, null));

export const saveActiveWritingTask1 = (attempt: WritingTask1PracticeRecord): StorageWriteResult => {
  return writeJson(ACTIVE_WRITING_TASK1_KEY, attempt);
};

export const deleteActiveWritingTask1 = (recordId: string) => {
  const active = getActiveWritingTask1();
  if (active?.id === recordId) {
    removeJson(ACTIVE_WRITING_TASK1_KEY);
  }
};

export interface StorageUsageInfo {
  key: string;
  sizeBytes: number;
  sizeMB: string;
}

export const getStorageUsage = () => {
  const entries: StorageUsageInfo[] = [];
  let totalBytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const value = localStorage.getItem(key) || '';
    const sizeBytes = new Blob([value]).size;
    totalBytes += sizeBytes;
    entries.push({ key, sizeBytes, sizeMB: (sizeBytes / 1024 / 1024).toFixed(3) });
  }
  entries.sort((a, b) => b.sizeBytes - a.sizeBytes);
  const totalMB = (totalBytes / 1024 / 1024).toFixed(3);
  const isNearQuota = totalBytes > 4.5 * 1024 * 1024;
  return { entries, totalBytes, totalMB, isNearQuota };
};

export const exportBrowserStorageBackup = () => {
  const localData: Record<string, string | null> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) localData[key] = localStorage.getItem(key);
  }
  const sessionData: Record<string, string | null> = {};
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key) sessionData[key] = sessionStorage.getItem(key);
  }
  const backupPayload = {
    origin: window.location.origin,
    capturedAt: new Date().toISOString(),
    localStorage: localData,
    sessionStorage: sessionData,
  };
  const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ielts-scholar-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const clearAllIeltsLocalData = () => {
  IELTS_LOCAL_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
};
