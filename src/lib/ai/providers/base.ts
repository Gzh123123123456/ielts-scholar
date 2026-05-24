import {
  SpeakingFeedback,
  SpeakingAudioTranscriptionResult,
  SpeakingScoreOnlyResult,
  SpeakingTargetValidationResult,
  WritingFeedback,
  WritingFrameworkCoachFeedback,
  WritingFrameworkSummary,
  WritingTargetValidationResult,
  WritingTask1Feedback,
} from '../schemas';

export interface SpeakingAnalysisRequest {
  part: number;
  question: string;
  transcript: string;
  authoritativeScore?: SpeakingScoreOnlyResult;
  targetRepairFocus?: string;
  targetAttempt?: number;
  priorTargetAnswer?: string;
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
  
  analyzeWriting(params: WritingAnalysisRequest): Promise<WritingFeedback | string>;

  validateWritingTarget?(params: WritingTargetValidationRequest): Promise<WritingTargetValidationResult | string>;

  analyzeWritingTask1?(params: WritingTask1AnalysisRequest): Promise<WritingTask1Feedback | string>;

  coachWritingFramework?(params: WritingFrameworkCoachRequest): Promise<WritingFrameworkCoachFeedback | string>;

  extractWritingFramework?(params: WritingFrameworkRequest): Promise<WritingFrameworkSummary | string>;
}
