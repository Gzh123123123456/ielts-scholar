import { SpeakingFeedback, WritingFeedback } from '../schemas';

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
}
