import { AIProvider } from './base';
import {
  frameworkCoachSchemaInstruction,
  frameworkSchemaInstruction,
  speakingPromptCalibration,
  speakingSchemaInstruction,
  strictJsonInstruction,
  writingSchemaInstruction,
  writingTask1SchemaInstruction,
} from './geminiProvider';

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

export class DeepSeekProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private model: string,
    private baseUrl = 'https://api.deepseek.com/v1',
  ) {}

  private async generateJson(prompt: string): Promise<string> {
    const response = await fetch(`${normalizeBaseUrl(this.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a strict JSON-only IELTS feedback engine. Return exactly one valid JSON object.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const statusText = response.status === 402
        ? 'insufficient balance'
        : response.status === 429
          ? 'rate limited'
          : response.status === 500 || response.status === 503
            ? 'provider unavailable'
            : response.statusText || 'provider error';
      throw new Error(`DeepSeek ${response.status}: ${statusText}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content ?? '';
  }

  async analyzeSpeaking(params: { part: number; question: string; transcript: string }): Promise<string> {
    const partFocus = params.part === 1
      ? 'Part 1: concise natural spoken answers.'
      : params.part === 2
        ? 'Part 2: long-turn structure, cue coverage, specificity, and story detail.'
        : 'Part 3: abstract reasoning, comparison, examples, and wider consequences.';

    return this.generateJson(`${strictJsonInstruction}

You are an IELTS Speaking feedback engine for a local-first practice app.
Assess transcript-based speaking only. Do not provide a pronunciation score; pronunciation must be null and the note must say pronunciation is not formally assessed in V1.
Keep feedback concise, strict, and useful for a Chinese-speaking IELTS learner.
${partFocus}
${speakingPromptCalibration}
If the transcript is extremely short, nonsensical, or too thin for the part, return conservative insufficient-sample feedback.
Feedback must be target-uplift training feedback. Keep the current estimate defensible, but make upgradedAnswer, naturalnessHints, band9Refinements, and the practice direction aim above the current output level.
If the learner is weak, produce a clean, natural target answer around Band 6.5-7.0 for that part, not merely a minimal correction. If the learner is already strong, provide examiner-friendly Band 8-9 refinements rather than saying there is nothing to improve.
Preserve the learner's personal idea where possible; upgrade execution. Do not fabricate personal details beyond what is needed for a natural answer.
For Part 1, keep upgradedAnswer compact and conversation-oriented. For Part 2, target a spoken story spine with concrete details. For Part 3, target natural spoken discussion logic with reasoning, examples, and consequences.

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
Chinese is for diagnosis, strategy, why-it-matters, and revision tasks. English is for the original essay, corrected sentences, expressions, frames, and the target model answer. Do not fill learner-facing explanations with English.
Set "task" to the exact input task value.
Separate big-picture task response / paragraph logic problems from sentence-level corrections.
Return essayLevelWarnings separately for global reliability/scoring-precondition warnings only: under-length response, very low-signal response, prompt mismatch/off-task answer, not an essay/only notes, unreliable training estimate, copied prompt/no original answer, or too fragmented to score normally. Do not put introduction advice, paragraph development advice, vocabulary advice, or sentence corrections in essayLevelWarnings.
Use sentenceFeedback for direct local sentence corrections only. Give every sentence correction a stable id like C1, C2, C3.
For sentenceFeedback severity, use optional values major, medium, minor, or polish. Omit it when unsure.
For frameworkFeedback severity, use fatal, naturalness, or preserved.
For sentenceFeedback, include primaryIssue, secondaryIssues, microUpgrades, and transferGuidanceZh when they help the learner revise.
Use frameworkFeedback for Logic & Structure Review only: task response, off-topic or irrelevant opening, missing advantage/disadvantage coverage, weak position, missing paragraph development, paragraph order/structure, lack of examples/support.
Do not put pure lexical, grammar, or local wording issues into frameworkFeedback unless they directly affect task response or structure.
Use the supplied frameworkNotes and finalFrameworkSummary when available. Compare the plan with the essay, and point out where the essay failed to deliver the planned position, paragraph role, example, concession, or balance.
For frameworkFeedback, keep three Chinese roles distinct: suggestionZh = why this affects IELTS score; paragraphFixZh = how to revise this essay; transferGuidanceZh = how to avoid the pattern next time.
Include relatedCorrectionIds when a sentence correction supports the same logic issue; otherwise leave it empty and give paragraph-level guidance.
Avoid duplicating full sentence correction text inside frameworkFeedback.
Return vocabularyUpgrade as a two-part Language Bank. Infer the topic domain from the question and essay. topicVocabulary contains 5-8 topic-specific words/collocations/phrases with Chinese meaningZh and usageZh, covering both sides for advantages/disadvantages/outweigh/discuss-both/to-what-extent tasks where relevant. expressionUpgrades contains both category="from_essay" phrase upgrades and category="argument_frame" reusable Task 2 frames. Do not put writing-strategy advice in topicVocabulary.
Choose modelAnswerTargetLevel from the current training estimate: <=5.5 means "Target Band 7.0"; 6.0-6.5 means "Target Band 7.5"; 7.0 means "Target Band 7.5-8.0"; 7.5+ means "Examiner-friendly refinement".
The modelAnswer field must be a complete personalized Task 2 target model answer, normally 280-350 words even when the learner's essay is under 250 words. Prefer concise completeness and avoid 400+ words. It must preserve the learner's original position and main idea, fix the highest-priority Logic & Structure Review issue, and naturally integrate relevant Language Bank and Expression Upgrade items. It must not be a generic Band 9 essay unrelated to the learner's essay.
For advantages/disadvantages or outweigh prompts, if the main issue is missing or weak disadvantage coverage, the modelAnswer must include a clear concession/disadvantage paragraph before defending the final position.
Return modelAnswerAnnotations for meaningful exact spans in modelAnswer: several topic_vocabulary spans, at least two expression_upgrade spans when available, at least one sentence_repair span, and at least one logic_repair span. quote must exactly appear in modelAnswer. Do not over-highlight the whole essay.
Set modelAnswerPersonalized to true only when it uses the user's essay/framework context.

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
Do not invent image details beyond the given brief.
Write diagnosis Chinese-first where useful; keep improvedReport and modelExcerpt in English.

${writingTask1SchemaInstruction}

Input:
${JSON.stringify(params, null, 2)}`);
  }

  async coachWritingFramework(params: { task: 'task2'; question: string; notes: string }): Promise<string> {
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

  async extractWritingFramework(params: { task: 'task2'; question: string; notes: string }): Promise<string> {
    return this.generateJson(`${strictJsonInstruction}

You extract a final IELTS Writing Task 2 framework from the learner's Phase 1 coach discussion notes.
The editableSummary must use clear bullet sections with Position, View A / Concession side, View B / Main argument side, My opinion, Paragraph plan, and Reusable language for this essay. Include 3-5 varied sentence frames such as concession, contrast, not only...but also, not to mention, or this is not to suggest that. Do not write a full essay.
Ground the summary in learner notes, coach discussion, and any unsent draft notes. Use a bilingual editableSummary with Position, View A, View B, My opinion, and Paragraph plan sections. Each major section should include Chinese logic plus useful English thesis/topic sentence drafts where the learner has supplied enough information. Mark missing decisions as Not decided yet / 需要继续补充. Mark AI-suggested examples as Suggested example, please confirm. Do not turn the summary into a full model answer.
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
