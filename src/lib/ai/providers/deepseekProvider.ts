import { AIProvider } from './base';
import {
  frameworkCoachSchemaInstruction,
  frameworkSchemaInstruction,
  speakingPromptCalibration,
  speakingSchemaInstruction,
  speakingTargetValidationSchemaInstruction,
  strictJsonInstruction,
  writingSchemaInstruction,
  writingTargetValidationSchemaInstruction,
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

  async analyzeSpeaking(params: {
    part: number;
    question: string;
    transcript: string;
    targetRepairFocus?: string;
    targetAttempt?: number;
    priorTargetAnswer?: string;
  }): Promise<string> {
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
Feedback must be target-uplift training feedback. The current score is a conservative single-question training estimate, excluding pronunciation, not an official complete IELTS Speaking band. If evidence sits between two bands, prefer the lower visible estimate.
For weak or medium answers, make upgradedAnswer, naturalnessHints, and practice direction aim at a natural Band 7.0+ training target, not merely a minimal correction. If the learner is 7.0-7.5, upgradedAnswer must become a meaningfully stronger Band 8+ examiner-friendly answer rather than another ordinary Band 7 answer, and targetAnswerSelfScores must show at least 8.0 in FC, LR, and GRA. If the learner is already 8.0+, switch to high-band stability instead of generating a fake higher answer; upgradedAnswer may be an empty string in that state, and highBandStabilityZh/nextStepZh should carry the guidance. Do not label output as Band 9.
If the transcript clearly answers a different prompt, add fatalErrors tag "prompt_mismatch" with explanationZh "这段回答似乎没有回答当前题目，请确认是否选错题目。", and do not treat the problem only as grammar or vocabulary.
Preserve the learner's personal idea where possible; upgrade execution. Do not fabricate personal details beyond what is needed for a natural answer.
In preservedStyle, include concrete expansionZh, sampleNextStep, transferQuestions, partUseZh, and riskNoteZh grounded in the learner transcript. If detail is missing, ask for the kind of real detail to add instead of inventing one.
For Part 1, keep upgradedAnswer compact and conversation-oriented. For Part 2, target a spoken story spine with concrete details. For Part 3, target natural spoken discussion logic with reasoning, examples, and consequences.
If targetRepairFocus and priorTargetAnswer are provided, this is a retry after independent validation failed. Do not repeat the prior answer; repair the specific weakness while keeping the current score honest.

${speakingSchemaInstruction}

Input:
${JSON.stringify(params, null, 2)}`);
  }

  async validateSpeakingTarget(params: {
    part: number;
    question: string;
    candidateTargetAnswer: string;
    targetFloor: number;
    originalCurrentScore?: number;
    targetLayer?: string;
  }): Promise<string> {
    const partRules = params.part === 1
      ? 'Part 1: short, direct, natural, one concrete personal detail; no fake academic vocabulary.'
      : params.part === 2
        ? 'Part 2: sustained story spine with setting, scene, action, change/challenge, feeling shift, and meaning.'
        : 'Part 3: spoken reasoning with position, nuance/contrast, example, consequence; not essay prose.';

    return this.generateJson(`${strictJsonInstruction}

You are an independent IELTS Speaking target-answer validator. Scoring-only operation.
Do not generate a new target answer or teaching report. Score candidateTargetAnswer only.
Use strict IELTS Speaking visible criteria: fluency/coherence, lexical resource, grammar range/accuracy. Pronunciation is null.
Mirror normal speaking_analysis criteria; validation may be slightly stricter than generation, but it must never be looser. Do not pass a target that normal analysis would clearly score as 7.0 or 7.5.
Do not apply a blanket single-question penalty to a complete target answer. Do not inflate scores or treat 7.5 as 8.0.
For Part 2, Band 8+ requires setting/time/place, specific scene, concrete action, challenge/change, feeling shift, why it matters, and natural spoken sequencing. Do not pass a target as 8+ merely for length, formality, or vocabulary.
For Part 3, Band 8+ requires direct position, nuance/condition/contrast, concrete example or observation, and cause/effect or consequence. It must not sound like Writing Task 2 read aloud.
If uncertain, return borderline or failed.
Target floor is ${params.targetFloor}; status is meets_target only if all required scores are >= targetFloor.
${partRules}

${speakingTargetValidationSchemaInstruction}

Input:
${JSON.stringify(params, null, 2)}`);
  }

  async analyzeWriting(params: {
    task: string;
    question: string;
    essay: string;
    frameworkNotes?: string;
    finalFrameworkSummary?: string;
    targetRepairFocus?: string;
    targetAttempt?: number;
    priorTargetAnswer?: string;
  }): Promise<string> {
    return this.generateJson(`${strictJsonInstruction}

You are an IELTS Writing Task 2 feedback engine for a local-first practice app.
Return targeted feedback for the user's actual essay. Do not invent a different prompt.
Chinese is for diagnosis, strategy, why-it-matters, and revision tasks. English is for the original essay, corrected sentences, expressions, frames, and the target model answer. Do not fill learner-facing explanations with English.
Set "task" to the exact input task value.
Separate big-picture task response / paragraph logic problems from sentence-level corrections.
Return essayLevelWarnings separately for global reliability/scoring-precondition warnings only: under-length response, very low-signal response, prompt mismatch/off-task answer, not an essay/only notes, unreliable training estimate, copied prompt/no original answer, or too fragmented to score normally. Do not put introduction advice, paragraph development advice, vocabulary advice, or sentence corrections in essayLevelWarnings.
If the essay clearly answers a different prompt, add essayLevelWarnings title "Prompt mismatch warning" and messageZh "这段回答似乎没有回答当前题目，请确认是否选错题目。". Make Task Response reflect the mismatch; do not only treat it as language weakness.
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
Current estimate must remain honest and conservative. If the current essay is below Band 7.0, use a stable Band 7.0-7.5 target model. If it is 7.0-7.5, modelAnswer must become a genuinely Band 8+ answer, and targetAnswerSelfScores must show at least 8.0 across TR, CC, LR, and GRA. If it is already 8.0+, switch to high-band stability instead of generating a fake higher replacement essay; modelAnswer may be an empty string in that state, and highBandStabilityZh/nextStepZh should carry the guidance. Do not use Target Band 7.5, Target Band 7.5-8.0, or Band 9.
Score-feedback consistency is mandatory. If any score dimension is below 7.0, the feedback must name the real blocker for that dimension. Task Response blockers include missing task parts, weak position, shallow development, unsupported solution, or wrong focus. Coherence blockers include unclear paragraph role, weak progression, or over-stacked ideas. Lexical blockers include unnatural collocation, over-formality, repetition, or imprecise topic vocabulary. Grammar blockers include sentence control, punctuation, clause logic, accuracy, or range. Never call a dimension excellent while assigning 6.5 unless you clearly explain why it is close but not yet Band 7.0.
Logic & Structure Review must be a revision roadmap: what the issue is, why it affects IELTS performance, and what to add, remove, or rewrite. If the learner's original argument direction would cap the band, say it is not recommended, explain why it limits Task Response or Coherence, and make the modelAnswer use a stronger direction.
The modelAnswer field must be a complete personalized Task 2 target model answer, normally 280-350 words even when the learner's essay is under 250 words. Prefer concise completeness and avoid 400+ words. It must apply Task Response/task command fixes, concession or balance if relevant, paragraph-level logic advice, sentence correction lessons, Language Bank items, and the user's usable ideas where appropriate. It must not merely polish the original essay; if an original idea is weak or off-task, replace it with a more appropriate task-relevant idea and explain that in feedback.
For Band 7.0+ modelAnswer, the answer must be clear, relevant, supported, and controlled. For Band 8+ modelAnswer, the answer must show direct task response, a clear sustained position, well-developed paragraphs, precise topic vocabulary, flexible sentence structures, strong cohesion without mechanical linking, and no generic template padding. Before finalizing modelAnswer, self-check whether it would still likely be judged below targetBandFloor; if yes, strengthen idea development, precision, organization, and naturalness. Do not fake an upgrade by making it more formal or template-like.
For advantages/disadvantages or outweigh prompts, if the main issue is missing or weak disadvantage coverage, the modelAnswer must include a clear concession/disadvantage paragraph before defending the final position.
Return modelAnswerAnnotations for meaningful exact spans in modelAnswer: several topic_vocabulary spans, at least two expression_upgrade spans when available, at least one sentence_repair span, and at least one logic_repair span. quote must exactly appear in modelAnswer. Do not over-highlight the whole essay.
Set modelAnswerPersonalized to true only when it uses the user's essay/framework context.
If targetRepairFocus and priorTargetAnswer are provided, this is a retry after independent validation failed. Do not repeat the prior model; repair the exact weakness through stronger task response, paragraph function, examples, reasoning, cohesion, and controlled language.

${writingSchemaInstruction}

Input:
${JSON.stringify(params, null, 2)}`);
  }

  async validateWritingTarget(params: {
    task: string;
    question: string;
    candidateTargetAnswer: string;
    targetFloor: number;
    originalCurrentScore?: number;
    targetLayer?: string;
  }): Promise<string> {
    return this.generateJson(`${strictJsonInstruction}

You are an independent IELTS Writing Task 2 target-answer validator. Scoring-only operation.
Do not generate a teaching report, new model answer, or rewrite. Score candidateTargetAnswer only.
Use strict Task Response, Coherence & Cohesion, Lexical Resource, and Grammatical Range & Accuracy criteria.
Mirror normal writing_analysis criteria; validation may be slightly stricter than generation, but it must never be looser. Do not pass a target that normal analysis would clearly score as 7.0 or 7.5.
Do not inflate scores, do not lower Band 8+, and do not reward generic formal phrases as a real upgrade.
Band 8+ model answers must improve task response, reasoning mechanism, paragraph function, example specificity, progression, and natural precision. Do not reward phrases like "pervasive issue," "delve into," "multifaceted approach," or "it is imperative that" as fake upgrades.
If uncertain, return borderline or failed.
Target floor is ${params.targetFloor}; status is meets_target only if all four scores are >= targetFloor.

${writingTargetValidationSchemaInstruction}

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
Current estimate must remain honest and conservative. Target reports must follow the global uplift policy: if the current report is below Band 7.0, improvedReport/modelExcerpt must be a Band 7.0+ Target Report; if the current report is around Band 7.0 or above, improvedReport/modelExcerpt must be a Band 8+ Examiner-Friendly Report. Do not inflate the current estimate to match the target. Do not label output as Band 9 or Target Band 7.5.
The target report must improve overview quality, key feature selection, comparison logic, data accuracy, and concise academic reporting style. Do not just correct grammar. For Band 8+ reports, self-check that the report has a clear overview, accurate key features, strong comparisons, precise data description, and no irrelevant detail dump.
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
Respond directly to the learner's latest note or follow-up question. If they ask "我指出来了吗？", answer in Chinese first: "你指出了原因的一部分，但还没有完成这道题要求。" Then explain what they already provided, what is still missing, why the prompt requires it, and what to add next.
For two-part questions, explicitly identify both required task parts, for example "Why is this happening?" and "What can be done?" Do not answer with a generic checklist when the learner asks a direct follow-up.
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
The editableSummary must use task-appropriate clear bullet sections. For causes-solutions questions, use Position, Cause Analysis, Solution Plan, My Position, Paragraph Plan, and Topic-specific argument frames. Do not use View A / View B unless the prompt is a discuss-both-views task. Include 3-5 varied sentence frames such as concession, contrast, not only...but also, not to mention, or this is not to suggest that. Do not write a full essay.
Ground the summary in learner notes, coach discussion, and any unsent draft notes. Each major section should include Chinese logic plus useful English thesis/topic sentence drafts where the learner has supplied enough information. Mark missing decisions as Not decided yet / 需要继续补充. Mark AI-suggested examples as Suggested example, please confirm. Do not turn the summary into a full model answer.
Do not write the essay. Consolidate only the learner's notes and coach discussion into the requested fields.
Do not invent a complete high-band essay plan from the prompt alone.
If a decision is missing, write "Not decided yet / 需要继续补充" in that field.
Possible examples must come from the learner notes. If you suggest an example because the notes imply a direction but do not name one, prefix it with "Suggested example, please confirm:".
The editableSummary field must be a readable text block with task-appropriate labels. Do not use "overview" as a Task 2 paragraph instruction.

${frameworkSchemaInstruction}

Input:
${JSON.stringify(params, null, 2)}`);
  }
}
