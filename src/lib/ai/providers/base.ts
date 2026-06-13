import {
  SpeakingFeedback,
  SpeakingAudioTranscriptionResult,
  Part1AnswerAnnotation,
  Part1CleanRetryAnswer,
  Part1CleanRetryCertificationResult,
  Part1LearningAssetsResult,
  Part1RetryReferenceContext,
  SpeakingScoreOnlyResult,
  SpeakingTargetValidationResult,
  SpeakingThreadAnswer,
  WritingFeedback,
  WritingFrameworkCoachFeedback,
  WritingFrameworkSummary,
  WritingTargetValidationResult,
  WritingTask1Feedback,
} from '../schemas';

export interface MasteredSpeakingExpressionHint {
  expression: string;
  signal?: string;
  count?: number;
}

export interface SpeakingAnalysisRequest {
  part: number;
  question: string;
  transcript: string;
  sessionKind?: 'single_question' | 'part1_topic_thread' | 'part3_discussion_thread';
  topic?: string;
  threadId?: string;
  threadAnswers?: SpeakingThreadAnswer[];
  retryReference?: Part1RetryReferenceContext;
  authoritativeScore?: SpeakingScoreOnlyResult;
  targetRepairFocus?: string;
  targetAttempt?: number;
  priorTargetAnswer?: string;
  masteredExpressions?: MasteredSpeakingExpressionHint[];
}

export interface SpeakingScoreOnlyRequest {
  part: number;
  question: string;
  transcript: string;
}

export interface SpeakingAudioTranscriptionRequest {
  part: number;
  question: string;
  audioBase64: string;
  mimeType: string;
  topic?: string;
  tags?: string[];
  cueCard?: string;
  roughBrowserTranscript?: string;
  transcriptionHints?: string[];
}

export interface Part1CleanRetryCertificationRequest {
  topic: string;
  threadId: string;
  threadAnswers: SpeakingThreadAnswer[];
  cleanRetryAnswers: Part1CleanRetryAnswer[];
  attempt: 1 | 2;
}

export interface Part1LearningAssetsRequest {
  topic: string;
  threadId: string;
  threadAnswers: SpeakingThreadAnswer[];
  cleanRetryAnswers: Part1CleanRetryAnswer[];
  annotations?: Part1AnswerAnnotation[];
  retryReference?: Part1RetryReferenceContext;
  carriedMyUsableMaterial?: Part1RetryReferenceContext['carriedMyUsableMaterial'];
  attempt?: 1 | 2;
  repairFocus?: string;
}

export interface WritingAnalysisRequest {
  task: string;
  question: string;
  essay: string;
  frameworkNotes?: string;
  finalFrameworkSummary?: string;
  targetRepairFocus?: string;
  targetAttempt?: number;
  priorTargetAnswer?: string;
}

export interface SpeakingTargetValidationRequest {
  part: number;
  question: string;
  transcript: string;
  targetFloor: number;
}

export interface WritingTargetValidationRequest {
  task: string;
  question: string;
  candidateTargetAnswer: string;
  targetFloor: number;
  originalCurrentScore?: number;
  targetLayer?: string;
}

export interface WritingTask1AnalysisRequest {
  task: 'task1';
  taskType: string;
  instruction: string;
  visualBrief: string;
  dataSummary: string;
  report: string;
  expectedOverview?: string;
  expectedKeyFeatures?: string[];
  expectedComparisons?: string[];
  commonTraps?: string[];
  reusablePatterns?: string[];
}

export interface WritingFrameworkRequest {
  task: 'task2';
  question: string;
  notes: string;
}

export interface WritingFrameworkCoachRequest {
  task: 'task2';
  question: string;
  notes: string;
}

export interface AIProvider {
  transcribeSpeakingAudio?(params: SpeakingAudioTranscriptionRequest): Promise<SpeakingAudioTranscriptionResult | string>;

  scoreSpeakingOnly?(params: SpeakingScoreOnlyRequest): Promise<SpeakingScoreOnlyResult | string>;

  analyzeSpeaking(params: SpeakingAnalysisRequest): Promise<SpeakingFeedback | string>;

  validateSpeakingTarget?(params: SpeakingTargetValidationRequest): Promise<SpeakingTargetValidationResult | string>;

  certifyPart1CleanRetry?(params: Part1CleanRetryCertificationRequest): Promise<Part1CleanRetryCertificationResult | string>;

  generatePart1LearningAssets?(params: Part1LearningAssetsRequest): Promise<Part1LearningAssetsResult | string>;
  
  analyzeWriting(params: WritingAnalysisRequest): Promise<WritingFeedback | string>;

  validateWritingTarget?(params: WritingTargetValidationRequest): Promise<WritingTargetValidationResult | string>;

  analyzeWritingTask1?(params: WritingTask1AnalysisRequest): Promise<WritingTask1Feedback | string>;

  coachWritingFramework?(params: WritingFrameworkCoachRequest): Promise<WritingFrameworkCoachFeedback | string>;

  extractWritingFramework?(params: WritingFrameworkRequest): Promise<WritingFrameworkSummary | string>;
}
