export type IELTSModule = 'speaking' | 'writing' | 'writing_task1';
export type IELTSMode = 'practice' | 'mock';
export type SpeakingPart = 1 | 2 | 3;
export type WritingTask = 'task1' | 'task2';
export type ProviderOperation =
  | 'speaking_audio_transcription'
  | 'speaking_score_only'
  | 'speaking_analysis'
  | 'part1_clean_retry_certification'
  | 'part1_learning_assets'
  | 'writing_analysis'
  | 'writing_task1_analysis'
  | 'writing_framework_coach'
  | 'writing_framework_extraction'
  | 'speaking_target_validation'
  | 'writing_target_validation';
export type ProviderFailureKind = 'provider_unavailable' | 'parse_or_schema' | 'unsupported';

export interface ProviderDiagnostic {
  module: IELTSModule;
  operation: ProviderOperation;
  providerName: string;
  modelName?: string;
  requestPayload: unknown;
  rawResponse: unknown;
  parsedJson: unknown;
  parseError?: string;
  validationErrors: string[];
  fallbackUsed: boolean;
  failureKind?: ProviderFailureKind;
  normalizedFields?: string[];
  timestamp: string;
}

export interface ScoreSet {
  fluencyCoherence?: number;
  lexicalResource: number;
  grammaticalRangeAccuracy: number;
  pronunciation?: number | null;
  taskResponse?: number;
  coherenceCohesion?: number;
}

export interface FatalError {
  original: string;
  correction: string;
  tag: string;
  explanationZh: string;
}

export interface NaturalnessHint {
  original: string;
  better: string;
  tag: string;
  explanationZh: string;
}

export interface Band9Refinement {
  observation: string;
  refinement: string;
  explanationZh: string;
}

export type TargetAnswerLayer = 'band_7_to_7_5' | 'band_8_plus' | 'high_band_stability';
export type TargetAnswerStatus = 'meets_target' | 'borderline' | 'failed' | 'not_generated' | 'not_applicable';
export type TargetState =
  | 'needs_repair'
  | 'generated_target'
  | 'target_failed_or_borderline'
  | 'high_band_boundary'
  | 'high_band_stable';

export interface SpeakingTargetAnswerSelfScores {
  fluencyCoherence?: number;
  lexicalResource?: number;
  grammaticalRangeAccuracy?: number;
  pronunciation?: null;
}

export interface BandEstimateRange {
  lower: number;
  upper: number;
  rationaleZh?: string;
}

export interface SpeakingScoreOnlyResult {
  module: 'speaking';
  operation: 'speaking_score_only';
  part: SpeakingPart;
  scores: {
    fluencyCoherence: number;
    lexicalResource: number;
    grammaticalRangeAccuracy: number;
    pronunciation: null;
  };
  bandEstimateExcludingPronunciation: number;
  rationaleZh: string;
  boundaryStatus?: 'clear' | 'borderline_7' | 'borderline_8' | 'insufficient_sample';
}

export interface WritingTargetAnswerSelfScores {
  taskResponse?: number;
  coherenceCohesion?: number;
  lexicalResource?: number;
  grammaticalRangeAccuracy?: number;
}

export interface SpeakingTargetValidationResult {
  module: 'speaking';
  operation: 'speaking_target_validation';
  targetFloor: number;
  status: TargetAnswerStatus;
  scores: SpeakingTargetAnswerSelfScores;
  rationaleZh: string;
  repairFocusZh: string;
}

export interface SpeakingAudioTranscriptionResult {
  module: 'speaking';
  operation: 'speaking_audio_transcription';
  transcript: string;
  uncertaintyNotes?: string[];
  providerDiagnostic?: string;
}

export interface WritingTargetValidationResult {
  module: 'writing';
  operation: 'writing_target_validation';
  targetFloor: number;
  status: TargetAnswerStatus;
  scores: WritingTargetAnswerSelfScores;
  rationaleZh: string;
  repairFocusZh: string;
}

export interface SpeakingPreservedStyleItem {
  text: string;
  reasonZh: string;
  expansionZh?: string;
  sampleNextStep?: string;
  transferQuestions?: string[];
  partUseZh?: string;
  riskNoteZh?: string;
}

export type Part2MaterialType =
  | 'person'
  | 'place'
  | 'object'
  | 'experience_event'
  | 'abstract_or_opinion_experience'
  | 'unclear';

export type Part2StoryModuleRole =
  | 'what_who_where'
  | 'background'
  | 'concrete_details'
  | 'what_happened'
  | 'feeling'
  | 'why_it_mattered'
  | 'current_or_future_influence';

export type Part2StoryModuleStatus =
  | 'present'
  | 'thin'
  | 'missing'
  | 'suggested_confirm';

export interface Part2StoryModule {
  role: Part2StoryModuleRole;
  status: Part2StoryModuleStatus;
  sourceWording?: string;
  improvedVersion?: string;
  coachingZh: string;
  confirmationNeeded?: boolean;
}

export type Part2LanguageSignal =
  | 'idiomatic_expression'
  | 'tense'
  | 'connector'
  | 'phrasal_verb'
  | 'collocation'
  | 'clause';

export type Part2LanguageSignalStatus =
  | 'strong'
  | 'usable'
  | 'thin'
  | 'missing'
  | 'not_needed';

export interface Part2LanguageSignalCheck {
  signal: Part2LanguageSignal;
  status: Part2LanguageSignalStatus;
  requirementZh: string;
  foundInTranscript: boolean;
  evidence?: string;
  evidenceQuotes?: string[];
  qualityZh: string;
  nextMoveZh: string;
  bestUpgrade: string;
  alternatives: string[];
  alternativeUpgrades?: {
    kind?: 'replace' | 'add';
    sourceQuote?: string;
    upgrade: string;
    guidanceZh: string;
    insertLocationZh?: string;
    sampleUpgrade?: string;
    sampleUpgradeHighlight?: string;
  }[];
  insertLocationZh: string;
  sampleUpgrade?: string;
  sampleUpgradeHighlight?: string;
  sampleUpgrades?: string[];
  usedInNextVersionQuote?: string;
  profileSignalZh?: string;
}

export interface Part2NextSpeakableVersionHighlight {
  quote: string;
  signal?: Part2LanguageSignal;
  storyRole?: Part2StoryModuleRole;
  labelZh: string;
  whyItWorksZh: string;
}

export interface Part2StoryFeedback {
  materialType: Part2MaterialType;
  materialTypeRationaleZh?: string;
  annotations: Part1AnswerAnnotation[];
  storyModules: Part2StoryModule[];
  languageSignals: Part2LanguageSignalCheck[];
  priorityFocusZh: string;
  nextSpeakableVersion: string;
  nextSpeakableVersionHighlights: Part2NextSpeakableVersionHighlight[];
}

export interface SpeakingThreadAnswer {
  questionId: string;
  question: string;
  answer: string;
}

export type Part1CleanRetryCertificationStatus = 'passed' | 'failed';
export type Part1DisplayedCleanRetryCertificationStatus =
  | 'certified_first_attempt'
  | 'certified_after_rewrite'
  | 'legacy_or_unverified';
export type Part1AnnotationOrigin = 'learner' | 'previous_cleaner_answer_conflict';
export type Part1SessionPriorityState =
  | 'core_repair_needed'
  | 'system_revision_conflict'
  | 'development_needed'
  | 'topic_complete';
export type Part1DevelopmentStatus = 'needed' | 'sufficient';

export interface Part1RetryReferenceCleanAnswer {
  questionRef: string;
  questionId?: string;
  answer: string;
  certificationStatus: Part1DisplayedCleanRetryCertificationStatus;
}

export interface Part1RetryReferenceContext {
  retryChainId: string;
  parentAttemptId?: string;
  cleanRetryAnswers: Part1RetryReferenceCleanAnswer[];
  carriedMyUsableMaterial?: SpeakingMaterialBankItem[];
}

export interface Part1CleanRetryCertificationViolation {
  questionRef: string;
  issueType: string;
  severity: 'must_fix';
  candidateWording: string;
  saferVersion?: string;
  reasonZh: string;
}

export interface SpeakingThreadMustFixItem {
  questionRefs: string[];
  learnerWording: string;
  betterVersion: string;
  explanationZh: string;
  recurring?: boolean;
  origin?: Part1AnnotationOrigin;
  priorCertificationStatus?: Part1DisplayedCleanRetryCertificationStatus;
}

export interface SpeakingThreadCoachingItem {
  questionRefs: string[];
  issue: string;
  coachingZh: string;
  exampleFrame?: string;
}

export interface SpeakingThreadPhraseFixItem {
  questionRefs: string[];
  original: string;
  better: string;
  explanationZh: string;
}

export type Part1AnnotationSeverity =
  | 'must_fix'
  | 'better_spoken_choice'
  | 'optional_polish';

export interface Part1AnswerAnnotationLayer {
  severity: Part1AnnotationSeverity;
  issueType: string;
  original: string;
  better: string;
  explanationZh: string;
  reuseGuidanceZh?: string;
  origin?: Part1AnnotationOrigin;
  priorCertificationStatus?: Part1DisplayedCleanRetryCertificationStatus;
  systemRevisionNoteZh?: string;
}

export interface Part1AnswerAnnotation {
  id: string;
  questionRef: string;
  sourceQuote: string;
  layers: Part1AnswerAnnotationLayer[];
  combinedRepair?: string;
}

export interface Part1CleanRetryAnswer {
  questionRef: string;
  answer: string;
  noteZh?: string;
}

export interface Part1CleanRetryCertificationResult {
  module: 'speaking';
  operation: 'part1_clean_retry_certification';
  topic: string;
  threadId: string;
  attempt: 1 | 2;
  status: Part1CleanRetryCertificationStatus;
  violations: Part1CleanRetryCertificationViolation[];
  revisedCleanRetryAnswers?: Part1CleanRetryAnswer[];
  rationaleZh?: string;
}

export interface Part1LearningAssetsResult {
  module: 'speaking';
  operation: 'part1_learning_assets';
  topic: string;
  threadId: string;
  questionCount: number;
  developmentTargets: Part1DevelopmentTarget[];
  materialBank: {
    myUsableMaterial: SpeakingMaterialBankItem[];
    reusableSpokenLanguage: SpeakingMaterialBankItem[];
  };
  rationaleZh?: string;
}

export type Part1DevelopmentMode =
  | 'needs_content'
  | 'expression_upgrade'
  | 'no_extra_content';

export interface Part1DevelopmentPhraseChunk {
  text: string;
  purposeZh?: string;
}

export interface Part1DevelopmentTarget {
  questionRef: string;
  developmentMode?: Part1DevelopmentMode;
  topicFrameZh?: string;
  reasonZh: string;
  developmentMoveZh: string;
  phraseScaffolds?: string[];
  phraseChunks?: Part1DevelopmentPhraseChunk[];
  optionalDevelopedAnswer?: string;
}

export interface SpeakingMaterialBankItem {
  sourceWording?: string;
  reusableVersion: string;
  reuseFor: string[];
  explanationZh?: string;
  translationZh?: string;
  materialCore?: string;
  materialKind?: 'development_seed' | 'reusable_personal_material';
  part1UseCases?: string[];
  developmentMoveZh?: string;
  developedExample?: string;
  expressionFrames?: string[];
  materialKey?: string;
}

export interface SpeakingThreadLevelPattern {
  observationZh: string;
  whyItMattersZh: string;
  retryRule: string;
}

export interface SpeakingNextRetryPlan {
  priorityAccuracyPatternZh?: string;
  answerLengthRuleZh?: string;
  materialToTry?: string;
  actions?: string[];
}

export interface SpeakingThreadFeedback {
  topic: string;
  threadId: string;
  questionCount: number;
  mustFix: SpeakingThreadMustFixItem[];
  annotations?: Part1AnswerAnnotation[];
  cleanRetryAnswers: Part1CleanRetryAnswer[];
  cleanRetryCertificationStatus?: Part1DisplayedCleanRetryCertificationStatus;
  part1SessionPriorityState?: Part1SessionPriorityState;
  developmentStatus?: Part1DevelopmentStatus;
  developmentTargets?: Part1DevelopmentTarget[];
  threadLevelPatterns?: SpeakingThreadLevelPattern[];
  answerByAnswerCoaching: SpeakingThreadCoachingItem[];
  highImpactPhraseFixes: SpeakingThreadPhraseFixItem[];
  materialBank: {
    myUsableMaterial: SpeakingMaterialBankItem[];
    reusableSpokenLanguage: SpeakingMaterialBankItem[];
  };
  optionalPolish: SpeakingThreadPhraseFixItem[];
  nextRetryPlan?: SpeakingNextRetryPlan;
  nextRetryFocusZh: string;
  previousCleanerConflictCount?: number;
}

export interface SpeakingFeedback {
  mode: IELTSMode;
  module: 'speaking';
  part: SpeakingPart;
  sessionKind?: 'single_question' | 'part1_topic_thread';
  topic?: string;
  threadId?: string;
  threadAnswers?: SpeakingThreadAnswer[];
  part1RetryReference?: Part1RetryReferenceContext;
  threadFeedback?: SpeakingThreadFeedback;
  part2Feedback?: Part2StoryFeedback;
  question: string;
  transcript: string;
  bandEstimateExcludingPronunciation: number;
  bandEstimateRange?: BandEstimateRange;
  estimateRationaleZh?: string;
  targetBandFloor?: number;
  targetLayer?: string;
  targetValidationZh?: string;
  targetUpgradeFocusZh?: string;
  targetAnswerFloor?: number;
  targetAnswerLayer?: TargetAnswerLayer;
  targetAnswerStatus?: TargetAnswerStatus;
  targetAnswerSelfScores?: SpeakingTargetAnswerSelfScores;
  targetAnswerValidationScores?: SpeakingTargetAnswerSelfScores;
  targetAnswerValidationRationaleZh?: string;
  targetAnswerRationaleZh?: string;
  targetAnswerRepairFocusZh?: string;
  targetState?: TargetState;
  highBandStabilityZh?: string;
  nextStepZh?: string;
  scoreConsistencyNoteZh?: string;
  scores: {
    fluencyCoherence: number;
    lexicalResource: number;
    grammaticalRangeAccuracy: number;
    pronunciation: null;
    pronunciationNote: string;
  };
  fatalErrors: FatalError[];
  naturalnessHints: NaturalnessHint[];
  band9Refinements: Band9Refinement[];
  preservedStyle: SpeakingPreservedStyleItem[];
  upgradedAnswer: string;
  reusableExample: {
    example: string;
    canBeReusedFor: string[];
    explanationZh: string;
  } | null;
  obsidianMarkdown: string;
}

export interface WritingFeedback {
  mode: IELTSMode;
  module: 'writing';
  task: WritingTask;
  question: string;
  essay: string;
  scores: {
    taskResponse: number;
    coherenceCohesion: number;
    lexicalResource: number;
    grammaticalRangeAccuracy: number;
  };
  frameworkFeedback: {
    issue: string;
    suggestionZh: string;
    severity: 'fatal' | 'naturalness' | 'preserved' | 'major' | 'medium' | 'minor' | 'polish';
    location?: 'Whole Essay' | 'Introduction' | 'Body Paragraph 1' | 'Body Paragraph 2' | 'Conclusion' | 'Unknown / General';
    issueType?: string;
    relatedCorrectionIds?: string[];
    paragraphFixZh?: string;
    exampleFrame?: string;
    transferGuidanceZh?: string;
  }[];
  essayLevelWarnings: {
    title: string;
    messageZh: string;
  }[];
  sentenceFeedback: {
    id?: string;
    correctionNumber?: number;
    paragraph?: string;
    sourceQuote?: string;
    issueType?: string;
    severity?: 'major' | 'medium' | 'minor' | 'polish';
    primaryIssue?: string;
    secondaryIssues?: string[];
    microUpgrades?: {
      original: string;
      better: string;
      explanationZh: string;
    }[];
    transferGuidanceZh?: string;
    original: string;
    correction: string;
    dimension: 'TR' | 'CC' | 'LR' | 'GRA';
    tag: string;
    explanationZh: string;
  }[];
  vocabularyUpgrade: {
    topicVocabulary: {
      expression: string;
      meaningZh: string;
      usageZh: string;
      example?: string;
    }[];
    expressionUpgrades: {
      category?: 'from_essay' | 'argument_frame';
      original?: string;
      better: string;
      explanationZh: string;
      reuseWhenZh: string;
      example?: string;
    }[];
    userWordingUpgrades?: {
      original: string;
      better: string;
      explanationZh: string;
    }[];
    collocationUpgrades?: string[];
    reusableSentenceFrames?: string[];
  };
  modelAnswer: string;
  modelAnswerAnnotations?: {
    quote: string;
    type: 'topic_vocabulary' | 'expression_upgrade' | 'sentence_repair' | 'logic_repair';
    labelZh: string;
  }[];
  modelAnswerPersonalized?: boolean;
  modelAnswerTargetLevel?: string;
  estimateRationaleZh?: string;
  targetBandFloor?: number;
  targetLayer?: string;
  targetValidationZh?: string;
  targetUpgradeFocusZh?: string;
  targetAnswerFloor?: number;
  targetAnswerLayer?: TargetAnswerLayer;
  targetAnswerStatus?: TargetAnswerStatus;
  targetAnswerSelfScores?: WritingTargetAnswerSelfScores;
  targetAnswerValidationScores?: WritingTargetAnswerSelfScores;
  targetAnswerValidationRationaleZh?: string;
  targetAnswerRationaleZh?: string;
  targetAnswerRepairFocusZh?: string;
  targetState?: TargetState;
  highBandStabilityZh?: string;
  nextStepZh?: string;
  scoreConsistencyNoteZh?: string;
  reusableArguments: {
    argument: string;
    canBeReusedFor: string[];
    explanationZh: string;
  }[];
  obsidianMarkdown: string;
}

export interface WritingTask1Feedback {
  mode: IELTSMode;
  module: 'writing_task1';
  task: 'task1';
  taskType: string;
  instruction: string;
  visualBrief: string;
  report: string;
  estimatedBand: number;
  taskAchievement: {
    score: number;
    feedback: string;
  };
  overviewFeedback: string;
  keyFeaturesFeedback: string;
  comparisonFeedback: string;
  dataAccuracyFeedback: string;
  coherenceFeedback: string;
  languageCorrections: {
    original: string;
    correction: string;
    explanation: string;
  }[];
  mustFix: string[];
  rewriteTask: string;
  reusableReportPatterns: string[];
  improvedReport: string;
  modelExcerpt?: string;
  targetState?: TargetState;
  obsidianMarkdown: string;
}

export interface WritingFrameworkSummary {
  mode: IELTSMode;
  module: 'writing';
  task: 'task2';
  question: string;
  sourceNotes: string;
  position: string;
  viewA: string;
  viewB: string;
  myOpinion: string;
  paragraphPlan: string;
  possibleExample: string;
  editableSummary: string;
}

export type WritingFrameworkReadiness = 'not_ready' | 'almost_ready' | 'ready_to_write';

export interface WritingFrameworkCoachFeedback {
  mode: IELTSMode;
  module: 'writing';
  task: 'task2';
  question: string;
  sourceNotes: string;
  readiness: WritingFrameworkReadiness;
  checklist: {
    taskTypeAnswered: boolean;
    clearPosition: boolean;
    bothViewsCovered: boolean;
    supportExists: boolean;
    paragraphPlanClear: boolean;
  };
  mainGaps: string[];
  nextQuestions: string[];
  finalFixes: string[];
  readySummary: string;
  message: string;
  comments?: string[];
}
