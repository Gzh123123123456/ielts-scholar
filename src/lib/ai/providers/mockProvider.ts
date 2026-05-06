import { AIProvider } from './base';
import { SpeakingFeedback, WritingFeedback } from '../schemas';

export class MockProvider implements AIProvider {
  async analyzeSpeaking(params: {
    part: number;
    question: string;
    transcript: string;
  }): Promise<SpeakingFeedback> {
    await new Promise(r => setTimeout(r, 1500));
    return {
      mode: 'practice',
      module: 'speaking',
      part: params.part as any,
      question: params.question,
      transcript: params.transcript,
      bandEstimateExcludingPronunciation: 6.5,
      scores: {
        fluencyCoherence: 6.5,
        lexicalResource: 7.0,
        grammaticalRangeAccuracy: 6.0,
        pronunciation: null,
        pronunciationNote: "Not formally assessed in V1."
      },
      fatalErrors: [
        {
          original: "I likes to play football",
          correction: "I like to play football",
          tag: "grammar",
          explanationZh: "主谓一致错误。'I' 是第一人称，动词不用加 -s。"
        }
      ],
      naturalnessHints: [
        {
          original: "It is very good",
          better: "It's absolutely fantastic",
          tag: "word_choice",
          explanationZh: "使用更地道的副词和形容词搭配来增强口语的自然度。"
        }
      ],
      preservedStyle: [
        {
          text: "I used to be a shy boy",
          reasonZh: "保留了个人的成长故事，这在 Part 1 中很真实。"
        }
      ],
      upgradedAnswer: "Actually, I'm quite fond of my hometown since I've spent my entire childhood there. It's a vibrant city with a rich history, and I've witnessed its rapid transformation over the years.",
      reusableExample: {
        example: "The rapid transformation of my city",
        canBeReusedFor: ["Hometown", "Environment", "Changes"],
        explanationZh: "这个短语可以用来描述任何关于城市变化或发展的场景。"
      },
      obsidianMarkdown: "# IELTS Speaking Note\n..."
    };
  }

  async analyzeWriting(params: {
    task: string;
    question: string;
    essay: string;
  }): Promise<WritingFeedback> {
    await new Promise(r => setTimeout(r, 2000));
    return {
      mode: 'practice',
      module: 'writing',
      task: params.task as any,
      question: params.question,
      essay: params.essay,
      scores: {
        taskResponse: 7.5,
        coherenceCohesion: 7.0,
        lexicalResource: 6.5,
        grammaticalRangeAccuracy: 6.5
      },
      frameworkFeedback: [
        {
          issue: "Conclusion is a bit brief",
          suggestionZh: "可以再总结一下两个观点的平衡点。",
          severity: "naturalness"
        }
      ],
      sentenceFeedback: [
        {
          original: "People should study what they want.",
          correction: "Individuals should be encouraged to pursue subjects they are passionate about.",
          dimension: "LR",
          tag: "lexical_precision",
          explanationZh: "使用更正式、更多样化的词汇来提升学术写作的质量。"
        }
      ],
      modelAnswer: "Sample Band 9 essay content...",
      reusableArguments: [
        {
          argument: "Personal interest leads to better academic performance",
          canBeReusedFor: ["Education", "Work satisfaction"],
          explanationZh: "这是一个通用的教育类观点。"
        }
      ],
      obsidianMarkdown: "# IELTS Writing Note\n..."
    };
  }
}
