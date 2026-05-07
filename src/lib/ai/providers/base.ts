import { SpeakingFeedback, WritingFeedback, WritingFrameworkSummary } from '../schemas';

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

export interface WritingFrameworkRequest {
  task: 'task2';
  question: string;
  notes: string;
}

export interface AIProvider {
  analyzeSpeaking(params: SpeakingAnalysisRequest): Promise<SpeakingFeedback | string>;
  
  analyzeWriting(params: WritingAnalysisRequest): Promise<WritingFeedback | string>;

  extractWritingFramework?(params: WritingFrameworkRequest): Promise<WritingFrameworkSummary | string>;
}
