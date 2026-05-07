import { GoogleGenAI } from '@google/genai';
import { AIProvider } from './base';

const MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';

const strictJsonInstruction = `Return JSON only. Do not wrap it in Markdown. Do not include commentary before or after the JSON.`;

const speakingSchemaInstruction = `The JSON must match this TypeScript shape:
{
  "mode": "practice",
  "module": "speaking",
  "part": 1 | 2 | 3,
  "question": string,
  "transcript": string,
  "bandEstimateExcludingPronunciation": number,
  "scores": {
    "fluencyCoherence": number,
    "lexicalResource": number,
    "grammaticalRangeAccuracy": number,
    "pronunciation": null,
    "pronunciationNote": string
  },
  "fatalErrors": [{ "original": string, "correction": string, "tag": string, "explanationZh": string }],
  "naturalnessHints": [{ "original": string, "better": string, "tag": string, "explanationZh": string }],
  "preservedStyle": [{ "text": string, "reasonZh": string }],
  "upgradedAnswer": string,
  "reusableExample": { "example": string, "canBeReusedFor": string[], "explanationZh": string } | null,
  "obsidianMarkdown": string
}`;

const writingSchemaInstruction = `The JSON must match this TypeScript shape:
{
  "mode": "practice",
  "module": "writing",
  "task": "task1" | "task2",
  "question": string,
  "essay": string,
  "scores": {
    "taskResponse": number,
    "coherenceCohesion": number,
    "lexicalResource": number,
    "grammaticalRangeAccuracy": number
  },
  "frameworkFeedback": [{ "issue": string, "suggestionZh": string, "severity": "fatal" | "naturalness" | "preserved" }],
  "sentenceFeedback": [{ "original": string, "correction": string, "dimension": "TR" | "CC" | "LR" | "GRA", "tag": string, "explanationZh": string }],
  "modelAnswer": string,
  "reusableArguments": [{ "argument": string, "canBeReusedFor": string[], "explanationZh": string }],
  "obsidianMarkdown": string
}`;

const frameworkSchemaInstruction = `The JSON must match this TypeScript shape:
{
  "mode": "practice",
  "module": "writing",
  "task": "task2",
  "question": string,
  "sourceNotes": string,
  "position": string,
  "viewA": string,
  "viewB": string,
  "myOpinion": string,
  "paragraphPlan": string,
  "possibleExample": string,
  "editableSummary": string
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
    });

    return response.text ?? '';
  }

  async analyzeSpeaking(params: {
    part: number;
    question: string;
    transcript: string;
  }): Promise<string> {
    return this.generateJson(`${strictJsonInstruction}

You are an IELTS Speaking feedback engine for a local-first practice app.
Assess transcript-based speaking only. Do not provide a pronunciation score; pronunciation must be null and the note must say pronunciation is not formally assessed in V1.
Keep feedback concise, strict, and useful for a Chinese-speaking IELTS learner.

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

${writingSchemaInstruction}

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
