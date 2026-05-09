import {
  SpeakingFeedback,
  WritingFeedback,
  WritingFrameworkCoachFeedback,
  WritingFrameworkSummary,
  WritingTask1Feedback,
} from '../schemas';

export interface SpeakingAnalysisRequest {
  part: number;
  question: string;
  transcript: string;
}

export interface WritingAnalysisRequest {
  task: string;
  question: string;
  essay: string;
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
  analyzeSpeaking(params: SpeakingAnalysisRequest): Promise<SpeakingFeedback | string>;
  
  analyzeWriting(params: WritingAnalysisRequest): Promise<WritingFeedback | string>;

  analyzeWritingTask1?(params: WritingTask1AnalysisRequest): Promise<WritingTask1Feedback | string>;

  coachWritingFramework?(params: WritingFrameworkCoachRequest): Promise<WritingFrameworkCoachFeedback | string>;

  extractWritingFramework?(params: WritingFrameworkRequest): Promise<WritingFrameworkSummary | string>;
}
