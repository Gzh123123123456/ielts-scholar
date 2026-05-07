import { SpeakingFeedback, WritingFeedback, WritingFrameworkSummary } from '../schemas';

export interface AIProvider {
  analyzeSpeaking(params: {
    part: number;
    question: string;
    transcript: string;
  }): Promise<SpeakingFeedback>;
  
  analyzeWriting(params: {
    task: string;
    question: string;
    essay: string;
  }): Promise<WritingFeedback>;

  extractWritingFramework?(params: {
    task: 'task2';
    question: string;
    notes: string;
  }): Promise<WritingFrameworkSummary>;
}
