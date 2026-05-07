import { AIProvider } from './base';
import { SpeakingFeedback, WritingFeedback, WritingFrameworkSummary } from '../schemas';

const firstNonEmptyLine = (text: string, fallback: string): string => {
  const line = text
    .split(/\r?\n/)
    .map(item => item.trim())
    .find(Boolean);

  return line || fallback;
};

const shorten = (text: string, maxLength = 180): string => {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 3)}...` : cleaned;
};

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

  async extractWritingFramework(params: {
    task: 'task2';
    question: string;
    notes: string;
  }): Promise<WritingFrameworkSummary> {
    await new Promise(r => setTimeout(r, 700));

    const source = params.notes.trim();
    const anchor = firstNonEmptyLine(source, 'Use the strongest idea from the Phase 1 notes.');
    const conciseAnchor = shorten(anchor);

    const summary = {
      mode: 'practice' as const,
      module: 'writing' as const,
      task: params.task,
      question: params.question,
      sourceNotes: params.notes,
      position: `Balanced position based on the notes: ${conciseAnchor}`,
      viewA: 'One side can be acknowledged as reasonable, especially where it protects practical outcomes or short-term social benefits.',
      viewB: 'The opposing side should be developed with a clearer long-term consequence and a stronger link to the question wording.',
      myOpinion: 'My opinion should be explicit: partially agree with both views, but give more weight to the side that is better supported by evidence.',
      paragraphPlan: 'Introduction: paraphrase + balanced thesis.\nBody 1: explain View A with one concrete reason.\nBody 2: explain View B and show why it is stronger.\nConclusion: restate the weighed opinion.',
      possibleExample: 'Use a simple education, work, technology, or public policy example that directly proves the stronger body paragraph.',
    };

    return {
      ...summary,
      editableSummary: `Position:\n${summary.position}\n\nView A:\n${summary.viewA}\n\nView B:\n${summary.viewB}\n\nMy opinion:\n${summary.myOpinion}\n\nParagraph plan:\n${summary.paragraphPlan}\n\nPossible example:\n${summary.possibleExample}`,
    };
  }
}
