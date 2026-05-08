import { GoogleGenAI } from '@google/genai';
import { AIProvider } from './base';

const MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';

const strictJsonInstruction = `Return one valid JSON object only.
Do not wrap it in Markdown.
Do not use code fences.
Do not include commentary before or after the JSON.
Do not include comments or trailing commas.
Do not include extra keys.
Use arrays for every array field, even when empty.
Use strings for every string field.
Use numbers for every score field.
All user-facing band estimates and criterion scores must use whole or half bands only, such as 5.0, 5.5, 6.0, or 6.5.`;

const speakingSchemaInstruction = `The JSON object must match this exact key structure:
{
  "mode": "practice",
  "module": "speaking",
  "part": 1,
  "question": "string",
  "transcript": "string",
  "bandEstimateExcludingPronunciation": 0,
  "scores": {
    "fluencyCoherence": 0,
    "lexicalResource": 0,
    "grammaticalRangeAccuracy": 0,
    "pronunciation": null,
    "pronunciationNote": "Pronunciation is not formally assessed in V1."
  },
  "fatalErrors": [{ "original": "string", "correction": "string", "tag": "string", "explanationZh": "string" }],
  "naturalnessHints": [{ "original": "string", "better": "string", "tag": "string", "explanationZh": "string" }],
  "band9Refinements": [{ "observation": "string", "refinement": "string", "explanationZh": "string" }],
  "preservedStyle": [{ "text": "string", "reasonZh": "string" }],
  "upgradedAnswer": "string",
  "reusableExample": { "example": "string", "canBeReusedFor": ["string"], "explanationZh": "string" },
  "obsidianMarkdown": "string"
}`;

const writingSchemaInstruction = `The JSON object must match this exact key structure:
{
  "mode": "practice",
  "module": "writing",
  "task": "task2",
  "question": "string",
  "essay": "string",
  "scores": {
    "taskResponse": 0,
    "coherenceCohesion": 0,
    "lexicalResource": 0,
    "grammaticalRangeAccuracy": 0
  },
  "frameworkFeedback": [{ "issue": "string", "suggestionZh": "string", "severity": "fatal" }],
  "sentenceFeedback": [{ "original": "string", "correction": "string", "dimension": "TR", "tag": "string", "explanationZh": "string" }],
  "modelAnswer": "string",
  "reusableArguments": [{ "argument": "string", "canBeReusedFor": ["string"], "explanationZh": "string" }],
  "obsidianMarkdown": "string"
}`;

const writingTask1SchemaInstruction = `The JSON object must match this exact key structure:
{
  "mode": "practice",
  "module": "writing_task1",
  "task": "task1",
  "taskType": "string",
  "instruction": "string",
  "visualBrief": "string",
  "report": "string",
  "estimatedBand": 0,
  "taskAchievement": { "score": 0, "feedback": "string" },
  "overviewFeedback": "string",
  "keyFeaturesFeedback": "string",
  "comparisonFeedback": "string",
  "dataAccuracyFeedback": "string",
  "coherenceFeedback": "string",
  "languageCorrections": [{ "original": "string", "correction": "string", "explanation": "string" }],
  "mustFix": ["string"],
  "rewriteTask": "string",
  "reusableReportPatterns": ["string"],
  "improvedReport": "string",
  "modelExcerpt": "string",
  "obsidianMarkdown": "string"
}`;

const frameworkSchemaInstruction = `The JSON object must match this exact key structure:
{
  "mode": "practice",
  "module": "writing",
  "task": "task2",
  "question": "string",
  "sourceNotes": "string",
  "position": "string",
  "viewA": "string",
  "viewB": "string",
  "myOpinion": "string",
  "paragraphPlan": "string",
  "possibleExample": "string",
  "editableSummary": "string"
}`;

export class GeminiProvider implements AIProvider {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  private async generateJson(prompt: string): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    return response.text ?? '';
  }

  async analyzeSpeaking(params: {
    part: number;
    question: string;
    transcript: string;
  }): Promise<string> {
    const partFocus = params.part === 1
      ? 'Part 1 focus: direct answer quality, naturalness, concise development, and whether the answer sounds spontaneous.'
      : params.part === 2
        ? 'Part 2 focus: cue card coverage, answer architecture/story structure, specificity/detail, and reusable story material / 万金油素材.'
        : 'Part 3 focus: abstract reasoning, comparison/generalization, example quality, and argument depth.';

    return this.generateJson(`${strictJsonInstruction}

You are an IELTS Speaking feedback engine for a local-first practice app.
Assess transcript-based speaking only. Do not provide a pronunciation score; pronunciation must be null and the note must say pronunciation is not formally assessed in V1.
Keep feedback concise, strict, and useful for a Chinese-speaking IELTS learner.
${partFocus}
Avoid endless sentence-level nitpicking. If the answer is already strong, return an empty fatalErrors array and say no critical correction is needed through naturalnessHints or upgradedAnswer.
Do not cap upgraded answers at Band 7; make the upgradedAnswer genuinely high-band while preserving the learner's core idea.
If the transcript is extremely short, nonsensical, or too thin for the part, do not write a long upgradedAnswer. Return an insufficient-sample message with a short starter outline instead. Be stricter for Part 2 and Part 3 than Part 1.
Use fatalErrors only for true mistakes. Use band9Refinements for high-level examiner-friendly refinements, especially when fatalErrors is empty or short.
Band 9 refinements should cover over-formal or AI-like phrasing, unnatural spoken rhythm, overlong Part 1 answers, missed chances for concise natural development, and ways to sound more spontaneous.
For Part 1, prefer concise natural spoken answers over long academic answers. For Part 2 and Part 3, allow more development but still check spoken delivery.

${speakingSchemaInstruction}

Input:
${JSON.stringify(params, null, 2)}`);
  }

  async analyzeWriting(params: {
    task: string;
    question: string;
    essay: string;
  }): Promise<string> {
    return this.generateJson(`${strictJsonInstruction}

You are an IELTS Writing Task 2 feedback engine for a local-first practice app.
Return targeted feedback for the user's actual essay. Do not invent a different prompt.
Keep Chinese explanations concise and practical.
Set "task" to the exact input task value. For this V1 flow it is normally "task2".

${writingSchemaInstruction}

Input:
${JSON.stringify(params, null, 2)}`);
  }

  async analyzeWritingTask1(params: {
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
  }): Promise<string> {
    return this.generateJson(`${strictJsonInstruction}

You are an IELTS Academic Writing Task 1 feedback engine for a local-first practice app.
Assess only the user's report against the supplied text visual brief and data.
Do not implement General Training letters.
Do not invent image details beyond the given brief.
Do not explain causes unless the visual brief explicitly gives causes.
Focus on overview quality, key feature selection, useful comparison, data accuracy, coherence, and concise academic reporting.
Keep feedback concise and Task 1-specific.
Write overviewFeedback, keyFeaturesFeedback, comparisonFeedback, dataAccuracyFeedback, coherenceFeedback, mustFix, rewriteTask, and language correction explanations Chinese-first. Start each explanation in Chinese, diagnose the learner's English problem in Chinese, and include short English corrections or example phrases only where useful.
Keep improvedReport and modelExcerpt in English.
Make rewriteTask a newline-separated Chinese-first bullet list of concrete actions, including overview rewriting, comparisons, data accuracy, and grouping when relevant.

${writingTask1SchemaInstruction}

Input:
${JSON.stringify(params, null, 2)}`);
  }

  async extractWritingFramework(params: {
    task: 'task2';
    question: string;
    notes: string;
  }): Promise<string> {
    return this.generateJson(`${strictJsonInstruction}

You extract a final IELTS Writing Task 2 framework from the learner's Phase 1 coach discussion notes.
Do not write the essay. Consolidate the plan into the requested fields.
The editableSummary field must be a readable text block with these labels: Position, View A, View B, My opinion, Paragraph plan, Possible example.

${frameworkSchemaInstruction}

Input:
${JSON.stringify(params, null, 2)}`);
  }
}
