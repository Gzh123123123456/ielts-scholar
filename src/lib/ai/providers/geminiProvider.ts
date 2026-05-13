import { GoogleGenAI } from '@google/genai';
import { AIProvider } from './base';

export const strictJsonInstruction = `Return one valid JSON object only.
Do not wrap it in Markdown.
Do not use code fences.
Do not include commentary before or after the JSON.
Do not include comments or trailing commas.
Do not include extra keys.
Use arrays for every array field, even when empty.
Use strings for every string field.
Use numbers for every score field.
All user-facing band estimates and criterion scores must use whole or half bands only, such as 5.0, 5.5, 6.0, or 6.5.`;

export const speakingSchemaInstruction = `The JSON object must match this exact key structure:
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

export const writingSchemaInstruction = `The JSON object must match this exact key structure:
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
  "essayLevelWarnings": [{ "title": "string", "messageZh": "string" }],
  "frameworkFeedback": [{ "issue": "string", "suggestionZh": "string", "severity": "fatal", "location": "Whole Essay", "issueType": "task_response", "relatedCorrectionIds": ["C1"], "paragraphFixZh": "string", "exampleFrame": "string", "transferGuidanceZh": "string" }],
  "sentenceFeedback": [{
    "id": "C1",
    "paragraph": "Introduction",
    "issueType": "off_topic",
    "primaryIssue": "Task response",
    "secondaryIssues": ["Coherence", "Lexical precision"],
    "microUpgrades": [{ "original": "string", "better": "string", "explanationZh": "string" }],
    "transferGuidanceZh": "string",
    "original": "string",
    "correction": "string",
    "dimension": "TR",
    "tag": "string",
    "explanationZh": "string"
  }],
  "vocabularyUpgrade": {
    "topicVocabulary": [{ "expression": "string", "meaningZh": "string", "usageZh": "string", "example": "string" }],
    "expressionUpgrades": [{ "category": "from_essay | argument_frame", "original": "string", "better": "string", "explanationZh": "string", "reuseWhenZh": "string", "example": "string" }]
  },
  "modelAnswer": "string",
  "modelAnswerPersonalized": true,
  "modelAnswerTargetLevel": "string",
  "reusableArguments": [{ "argument": "string", "canBeReusedFor": ["string"], "explanationZh": "string" }],
  "obsidianMarkdown": "string"
}`;

export const writingTask1SchemaInstruction = `The JSON object must match this exact key structure:
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

export const frameworkSchemaInstruction = `The JSON object must match this exact key structure:
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
}

editableSummary must be clear sections, not one dense block:
Position
- 中文逻辑:
- English thesis draft:

View A / Concession side
- 中文逻辑:
- English topic sentence draft:
- Support points:
- Useful sentence frame:

View B / Main argument side
- 中文逻辑:
- English topic sentence draft:
- Support points:
- Useful sentence frame:

My opinion
- 中文逻辑:
- English position sentence:
- Concession pattern:

Paragraph plan
1. Introduction:
2. Body 1:
3. Body 2:
4. Conclusion:

Reusable language for this essay
- Include 3-5 varied sentence frames or transitions.`;

export const frameworkCoachSchemaInstruction = `The JSON object must match this exact key structure:
{
  "mode": "practice",
  "module": "writing",
  "task": "task2",
  "question": "string",
  "sourceNotes": "string",
  "readiness": "not_ready | almost_ready | ready_to_write",
  "checklist": {
    "taskTypeAnswered": true,
    "clearPosition": true,
    "bothViewsCovered": true,
    "supportExists": true,
    "paragraphPlanClear": true
  },
  "mainGaps": ["string"],
  "nextQuestions": ["string"],
  "finalFixes": ["string"],
  "readySummary": "string",
  "message": "string",
  "comments": ["string"]
}`;

export class GeminiProvider implements AIProvider {
  private ai: GoogleGenAI;
  private model: string;

  constructor(apiKey: string, model = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash') {
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  private async generateJson(prompt: string): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: this.model,
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
    frameworkNotes?: string;
    finalFrameworkSummary?: string;
  }): Promise<string> {
    return this.generateJson(`${strictJsonInstruction}

You are an IELTS Writing Task 2 feedback engine for a local-first practice app.
Return targeted feedback for the user's actual essay. Do not invent a different prompt.
Chinese is for diagnosis, strategy, why-it-matters, and revision tasks. English is for the original essay, corrected sentences, expressions, frames, and the model excerpt. Do not fill learner-facing explanations with English.
Set "task" to the exact input task value. For this V1 flow it is normally "task2".
Separate big-picture task response / paragraph logic problems from sentence-level corrections.
Return essayLevelWarnings separately for global warnings only: under-length response, insufficient sample, unreliable training estimate. Do not put these in frameworkFeedback.
Use sentenceFeedback for direct local sentence corrections only. Give every sentence correction a stable id like C1, C2, C3.
For sentenceFeedback, include primaryIssue, secondaryIssues, microUpgrades, and transferGuidanceZh when they help the learner revise.
Use frameworkFeedback for Logic & Structure Review only: task response, off-topic or irrelevant opening, missing advantage/disadvantage coverage, weak position, missing paragraph development, paragraph order/structure, lack of examples/support.
Do not put pure lexical, grammar, or local wording issues into frameworkFeedback unless they directly affect task response or structure.
Use the supplied frameworkNotes and finalFrameworkSummary when available. Compare the plan with the essay, and point out where the essay failed to deliver the planned position, paragraph role, example, concession, or balance.
For frameworkFeedback, keep three Chinese roles distinct: suggestionZh = why this affects IELTS score; paragraphFixZh = how to revise this essay; transferGuidanceZh = how to avoid the pattern next time.
Include relatedCorrectionIds when a sentence correction supports the same logic issue; otherwise leave it empty and give paragraph-level guidance.
Avoid duplicating full sentence correction text inside frameworkFeedback.
Return vocabularyUpgrade as a two-part Language Bank. topicVocabulary contains 5-8 topic-specific words/collocations/phrases with Chinese meaningZh and usageZh, covering both sides for advantages/disadvantages or outweigh tasks. expressionUpgrades contains both category="from_essay" phrase upgrades and category="argument_frame" reusable Task 2 frames. Do not put writing-strategy advice in topicVocabulary.
Choose modelAnswerTargetLevel from the current training estimate: <=5.5 means "Target Band 7.0 excerpt"; 6.0-6.5 means "Target Band 7.5 excerpt"; 7.0 means "Target Band 7.5-8.0 excerpt"; 7.5+ means "Examiner-friendly refinement".
The modelAnswer field must be a personalized target excerpt that preserves the user's position, fixes the main issues, and reuses several Language Bank expressions verbatim where natural. Set modelAnswerPersonalized to true only when it uses the user's essay/framework context.

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

  async coachWritingFramework(params: {
    task: 'task2';
    question: string;
    notes: string;
  }): Promise<string> {
    return this.generateJson(`${strictJsonInstruction}

You are a concise IELTS Writing Task 2 framework coach.
Judge readiness with this checklist: task type answered, clear position, both required views covered, usable support/examples, and clear paragraph plan.
Chinese-first. Use English only for useful IELTS phrases or topic-sentence drafts.
If not_ready: show main gaps and 2-3 specific next questions.
If almost_ready: show only final small fixes and what to add before generating summary.
If ready_to_write: stop asking questions, summarize why ready, and tell the learner to generate summary or start writing.
No full essay. No complete model framework. No generic template loop.
comments must contain 2-4 short learner-facing lines that match the readiness status.

${frameworkCoachSchemaInstruction}

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
Ground the summary in learner notes, coach discussion, and any unsent draft notes. Use a bilingual editableSummary with Position, View A, View B, My opinion, and Paragraph plan sections. Each major section should include Chinese logic plus useful English thesis/topic sentence drafts where the learner has supplied enough information. Mark missing decisions as Not decided yet / 需要继续补充. Mark AI-suggested examples as Suggested example, please confirm. Do not turn the summary into a full model answer.
Include reusable argument frames such as concession, contrast, not only...but also, not to mention, or this is not to suggest that, but vary them instead of repeating the same frames every time.
Do not write the essay. Consolidate only the learner's notes and coach discussion into the requested fields.
Do not invent a complete high-band essay plan from the prompt alone.
If a decision is missing, write "Not decided yet / 需要继续补充" in that field.
Possible examples must come from the learner notes. If you suggest an example because the notes imply a direction but do not name one, prefix it with "Suggested example, please confirm:".
The editableSummary field must be a readable text block with these labels: Position, View A, View B, My opinion, Paragraph plan, Possible example.

${frameworkSchemaInstruction}

Input:
${JSON.stringify(params, null, 2)}`);
  }
}
