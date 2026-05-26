import { createPartFromBase64, GoogleGenAI } from '@google/genai';
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
  "bandEstimateRange": { "lower": 5.5, "upper": 6.0, "rationaleZh": "string" },
  "estimateRationaleZh": "string",
  "highBandStabilityZh": "string",
  "nextStepZh": "string",
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
  "preservedStyle": [{
    "text": "string",
    "reasonZh": "string",
    "expansionZh": "string",
    "sampleNextStep": "string",
    "transferQuestions": ["string"],
    "partUseZh": "string"
  }],
  "upgradedAnswer": "string",
  "reusableExample": { "example": "string", "canBeReusedFor": ["string"], "explanationZh": "string" }
}`;

export const speakingPart1TopicThreadSchemaInstruction = `The JSON object must match this exact key structure:
{
  "mode": "practice",
  "module": "speaking",
  "part": 1,
  "sessionKind": "part1_topic_thread",
  "topic": "string",
  "threadId": "string",
  "question": "Q1. ...\\nQ2. ...",
  "transcript": "Q1/A1 mapped transcript",
  "bandEstimateExcludingPronunciation": 0,
  "bandEstimateRange": { "lower": 5.5, "upper": 6.0, "rationaleZh": "string" },
  "estimateRationaleZh": "string",
  "scores": {
    "fluencyCoherence": 0,
    "lexicalResource": 0,
    "grammaticalRangeAccuracy": 0,
    "pronunciation": null,
    "pronunciationNote": "Pronunciation is not formally assessed in Part 1 topic-thread transcript practice."
  },
  "threadFeedback": {
    "topic": "string",
    "threadId": "string",
    "questionCount": 4,
    "annotations": [{
      "id": "string",
      "questionRef": "Q1",
      "sourceQuote": "exact learner words copied from that answer transcript",
      "combinedRepair": "complete better spoken version of this source span when local micro-repairs would still sound unnatural",
      "layers": [{
        "severity": "must_fix | better_spoken_choice | optional_polish",
        "issueType": "string",
        "original": "exact learner words",
        "better": "corrected or more natural wording",
        "explanationZh": "string",
        "reuseGuidanceZh": "string"
      }]
    }],
    "cleanRetryAnswers": [{ "questionRef": "Q1", "answer": "short natural retry answer preserving the learner's meaning", "noteZh": "optional short Chinese note only for meaningful compression or reorganisation" }],
    "threadLevelPatterns": [{ "observationZh": "string", "whyItMattersZh": "string", "retryRule": "Direct answer -> one key detail -> stop." }],
    "mustFix": [{ "questionRefs": ["Q1"], "learnerWording": "string", "betterVersion": "string", "explanationZh": "string", "recurring": false }],
    "answerByAnswerCoaching": [],
    "highImpactPhraseFixes": [{ "questionRefs": ["Q3"], "original": "string", "better": "string", "explanationZh": "string" }],
    "materialBank": {
      "myUsableMaterial": [{ "sourceWording": "string", "reusableVersion": "string", "reuseFor": ["string"], "explanationZh": "string" }],
      "reusableSpokenLanguage": [{ "sourceWording": "string", "reusableVersion": "string", "reuseFor": ["string"], "explanationZh": "string" }]
    },
    "optionalPolish": [{ "questionRefs": ["Q1"], "original": "string", "better": "string", "explanationZh": "string" }],
    "nextRetryPlan": { "priorityAccuracyPatternZh": "string", "answerLengthRuleZh": "string", "materialToTry": "string", "actions": ["string"] },
    "nextRetryFocusZh": "string"
  },
  "upgradedAnswer": "",
  "fatalErrors": [],
  "naturalnessHints": [],
  "band9Refinements": [],
  "preservedStyle": [],
  "reusableExample": null
}`;

export const speakingPart1TopicThreadInstruction = `This is Speaking Part 1 topic-thread practice, not a single-question target-answer task.
Analyze the whole ordered topic session and preserve question-to-answer mapping through Q references.
Do not generate a full target answer, target conversation, Band 7 target answer, Band 7+ target answer, Standard Answer, verifier state, certification wording, or target validation language.
Return actionable topic-session feedback only:
- ANNOTATIONS: anchor MUST FIX, BETTER SPOKEN CHOICE, and OPTIONAL POLISH directly to exact sourceQuote text copied from one learner answer. Each sourceQuote must appear verbatim in that answer. Use layers when the same quote has grammar plus spoken-choice issues. Prioritize real learner wording, not invented examples.
- Treat ANNOTATED ANSWERS as the primary workspace. Scan every answer for all meaningful local, anchorable spoken-language issues supported by the transcript: missing articles, singular/plural errors, subject-verb agreement, tense, missing sentence components, wrong word forms, wrong prepositions/collocations, structurally broken phrases, and clearly unnatural spoken wording with a stable natural alternative. Do not impose an arbitrary cap, but do not invent issues for accurate phrases.
- If a local repair is mentioned in coaching, retry advice, or a clean retry answer and can be grounded to exact learner wording, it must also appear as an annotation. Do not create a second duplicate annotation for the same original -> better repair.
- For complex broken stretches where several issues interact, anchor one larger meaningful phrase or sentence instead of several isolated token swaps. Put the detailed local layers inside the same annotation, and use combinedRepair for the complete better spoken version of that span.
- Severity rules: tense, article, determiner/pronoun choice, plurality/countability, preposition, agreement, missing verb/component, wrong word form, fixed-collocation error, or clearly broken structure = must_fix. A natural spoken alternative without an accuracy error = better_spoken_choice. Minor stylistic variation only = optional_polish.
- Do not treat ASR casing, punctuation, spacing, capitalization, transcript spelling, or written-form cleanup as learner language errors. Do not recommend inflated, essay-like, or "more formal" Part 1 wording; prefer short, natural, direct spoken English.
- Do not annotate or discuss transcript-only artifacts as learner errors anywhere in the result: capitalization, punctuation, spacing, ASR casing noise, spelling-only forms that cannot be confirmed in speech, or homophone spelling such as to/too when the spoken form is indistinguishable. If a span has a real structural issue plus casing/spelling cleanup, keep only the real structural issue and anchor only the real spoken-language problem.
- Pronunciation is not assessed in this mode. Do not claim pronunciation problems, correct pronunciation, pronunciation score impact, or delivery issues in estimateRationaleZh, bandEstimateRange.rationaleZh, annotations, thread-level patterns, retry plan, or material bank.
- Before returning every repair and every cleanRetryAnswers item, self-check: grammatical, natural spoken IELTS Part 1 English, intended meaning preserved, concise enough for Part 1, not more formal or inflated. Return one preferred repair, not slash-separated alternatives, in better/combinedRepair.
- CLEAN RETRY ANSWERS: return exactly one cleanRetryAnswers item for every Q in the thread. This is the learner's own answer rebuilt for immediate re-recording, not a Band target answer, model answer, or target conversation. Preserve real personal material, repair important grammar/collocation/structure, compress overlong detail, and never invent personal facts. Use noteZh only when you substantially compress, reorganize the answer, or need to preserve uncertainty because the intended stance cannot be safely recovered.
- Clean retry style: normally direct answer first, then one concise supporting detail or reason. Remove empty delay openers such as "That's an interesting question" or "That's a good question." Do not preserve unnecessary detours just because they appeared in the original. If several real details appear, choose the strongest one instead of copying all of them. If thread-level advice says the learner over-expanded, the clean retry answers must model shorter, more focused answers.
- Clean retry semantic self-check: do not keep a sentence merely because it is grammatical if the idea remains awkward, vague, over-generalized, or unnatural for spoken Part 1. Prefer natural category relationships: a field or subject should not be rewritten as a skill when that sounds awkward; an isolated habit should not become an entire lifestyle unless the learner clearly meant that. Rebuild toward the likely intended habit, routine, preference, object, activity, field, or detail without inventing facts.
- FINAL CLEAN-ANSWER STANCE CHECK: if the learner explicitly begins with a clear stance such as Yes, No, Not really, I would, or I wouldn't, do not silently reverse that stance merely because the supporting explanation is unclear or poorly phrased. Prefer repairing the supporting logic while preserving the stated position. If the answer contains a genuine contradiction and the intended stance cannot be recovered safely, preserve the uncertainty in noteZh or a feedback explanation rather than inventing a new personal preference. Do not use OPTIONAL POLISH to disguise a reversal of the learner's answer stance.
- FINAL CLEAN-ANSWER QUESTION SATISFACTION CHECK: after drafting cleanRetryAnswers, reread each original question. Each clean retry answer must directly answer that exact question and include a complete reason or detail when the question asks for or naturally requires one. If the learner implies a useful reason but states it unclearly, preserve that meaning and make the relationship explicit without inventing facts. Do not output a grammatically improved answer that leaves a "yes/no" stance unsupported, internally contradictory, or unrelated to the question. Do not preserve unrelated background merely because it is true personal material.
- FINAL GRAMMAR-TEACHING CONSISTENCY CHECK: when an annotation teaches a grammar repair also used in a clean retry answer, combinedRepair, explanationZh, and the clean retry answer must reflect the same grammatical meaning. For an experience extending from the past up to now, do not explain the correction as simple past if the clean retry answer uses present-perfect meaning.
- FINAL ANNOTATION COVERAGE CHECK: compare every clean retry answer against the learner's original answer before returning JSON. Every important locally teachable grammar, collocation, pronoun/reference, agreement, tense, missing-component, article/determiner, singular/plural, preposition, or word-form repair used in the clean retry answer must also appear in annotations when it can be grounded to exact learner wording. Do not annotate deletion of filler, broad compression, or a rewritten sentence unless there is a genuine teachable local problem. Do not add duplicate repair cards, and do not create spelling, capitalization, punctuation, or pronunciation annotations during this check.
- Only mark recurring when the same underlying error pattern appears across multiple answers.
- This is transcript-based. Do not assert pause length/frequency, speed, pronunciation, or delivery quality unless the transcript itself shows visible fillers/repetition/broken structure.
- MUST FIX: every important grammar, meaning, repeated low-level, word-form, collocation, or relevance/control issue. Do not cap meaningful items. Use questionRefs such as Q1 or Q1 / Q3.
- THREAD-LEVEL PATTERNS: concise macro behavior only: answer length, buried direct answers, useful material that needs compression, written/lecture-like tone, or accuracy collapse during overextension. Each pattern needs observationZh, whyItMattersZh, and one retryRule. Do not duplicate grammar lists from annotations.
- ANSWER-BY-ANSWER COACHING: return [] for new results. Per-question retry guidance belongs in cleanRetryAnswers.
- HIGH-IMPACT PHRASE FIXES: separate useful spoken-language upgrades with question provenance.
- SPEAKING MATERIAL BANK: be selective; sparse or empty is acceptable. myUsableMaterial must be grounded in learner ideas with real reuse value: concrete hobbies, routines, preferences, experiences, study/work goals, or distinctive personal examples. Do not collect weak generalized claims or awkward pseudo-factual assertions merely because they appear in the answer. Do not save material the clean retry answer should omit as conceptually distracting. Keep short concrete grounded material when useful. Never invent personal facts.
- reusableSpokenLanguage should contain only short, natural, content-bearing expressions genuinely worth imitating or transferring, such as a useful collocation, compact sentence frame, or idiomatic phrase. Exclude generic starters/openers, bare affirmative responses such as "Yes, of course" or "Of course", bare "It depends", "I think", "I would say", "In my opinion", empty templates, unnecessarily formal wording, plain autobiographical facts already better captured in myUsableMaterial, and long model mini-answers. Each reuseFor item should explicitly name transfer use across Part 1 / Part 2 / Part 3 when applicable.
- OPTIONAL POLISH: minor low-priority naturalness only; never put serious issues here.
- NEXT RETRY PLAN: return concise grounded actions: one priority accuracy pattern, one answer-length/focus rule, and one useful expression or personal material item to try naturally next time. Do not advise more complexity when the problem is overexpansion.
- NEXT RETRY FOCUS: keep as a compact legacy summary of nextRetryPlan.
Current estimate is a low-key transcript-based topic-session practice estimate excluding pronunciation. If evidence genuinely straddles two adjacent half-bands, return a bandEstimateRange with exactly one half-band step, for example 4.5-5.0 or 5.0-5.5, never a wider range.`;

export const speakingTargetValidationSchemaInstruction = `The JSON object must match this exact key structure:
{
  "module": "speaking",
  "operation": "speaking_target_validation",
  "targetFloor": 8,
  "status": "meets_target | borderline | failed",
  "scores": {
    "fluencyCoherence": 0,
    "lexicalResource": 0,
    "grammaticalRangeAccuracy": 0,
    "pronunciation": null
  },
  "rationaleZh": "string",
  "repairFocusZh": "string"
}`;

export const speakingScoreOnlySchemaInstruction = `The JSON object must match this exact key structure:
{
  "module": "speaking",
  "operation": "speaking_score_only",
  "part": 1,
  "scores": {
    "fluencyCoherence": 0,
    "lexicalResource": 0,
    "grammaticalRangeAccuracy": 0,
    "pronunciation": null
  },
  "bandEstimateExcludingPronunciation": 0,
  "rationaleZh": "string",
  "boundaryStatus": "clear | borderline_7 | borderline_8 | insufficient_sample"
}`;

export const speakingAudioTranscriptionSchemaInstruction = `The JSON object must match this exact key structure:
{
  "module": "speaking",
  "operation": "speaking_audio_transcription",
  "transcript": "string",
  "uncertaintyNotes": ["string"],
  "providerDiagnostic": "string"
}`;

export const speakingPromptCalibration = `Speaking feedback must be spoken IELTS feedback, not writing-style feedback.
Current estimate: this is a conservative single-question training estimate, excluding pronunciation. IELTS Speaking is scored across a complete test, so do not present one Part 1/2/3 answer as an official complete Speaking band. If the answer clearly fits one half-band, return a single bandEstimateExcludingPronunciation and omit bandEstimateRange or set it to null. If the evidence genuinely straddles two adjacent half-bands, return bandEstimateRange as an object with lower, upper, and rationaleZh, with exactly one half-band step, such as { "lower": 5.5, "upper": 6.0, "rationaleZh": "..." }. Do not return bandEstimateRange as a string. Do not use a range as a generic uncertainty escape hatch. Never return placeholder range objects, identical lower/upper values, lower/upper values outside 1.0-9.0, or ranges wider than one adjacent half-band step.
Global target policy: keep the current estimate honest and conservative. Target answers / improved answers / model answers are pedagogical practice answers, not certified score guarantees. If the learner's current lower bound is below Band 7.0, generate a complete, natural, learnable Band 7 target answer with a clear margin over the original while preserving useful personal material. If the current lower bound is at or above 7.0 but not high-band-stable, generate a more mature Band 7+ target answer that improves precision, naturalness, development, and delivery, but do not label it Band 8+. If the current answer is already high-band-stable, switch to high-band stability. Do not inflate the current estimate to match the target. Do not label any learner-facing output as Band 8+, Advanced, Verified, Not Verified, or Band 9. Do not make stronger target answers more formal, more academic, or more essay-like by default; stronger means clearer logic, more precise language, stronger idea development, better examples, more natural flow, and examiner-friendly execution.
Score consistency: pronunciation is not assessed and must never be treated as a hidden reason for lowering the headline estimate. If bandEstimateExcludingPronunciation is lower than all three visible criteria, either lower the relevant visible criterion or make estimateRationaleZh name a real cap such as insufficient sample, off-task content, overlong Part 1, essay-like Part 3, or malformed answer. If all visible criteria are 7.0 and there is no cap/fatal issue, the headline estimate should not be 6.5.
Target answer process: first score the user's current answer, including bandEstimateRange only when genuinely on an adjacent half-band boundary. Then generate upgradedAnswer in the same response whenever a target answer is appropriate. Do not run or describe target certification, verifier status, repair loops, independent validation, self-scores, or target status. In high-band-stable cases, upgradedAnswer may be an empty string; use highBandStabilityZh and nextStepZh instead. Return concise rationale fields, not hidden reasoning.
Question-answer match: if the transcript clearly answers a different prompt, add a fatalErrors item with tag "prompt_mismatch" and explanationZh "这段回答似乎没有回答当前题目，请确认是否选错题目。". Do not treat a wrong prompt only as weak grammar or vocabulary. Do not over-trigger for partially relevant answers.
Preserve the learner's usable idea where possible, but expand it into exam-ready material instead of only recording it. In preservedStyle, return idea-development material grounded in the reviewed transcript: text = learner material or short summary; reasonZh = why it is useful; expansionZh = how to expand this exact material for the current part; sampleNextStep = one compact English next sentence/frame when safe; transferQuestions = 1-3 IELTS questions where the same material can transfer; partUseZh = how this material should be used in this part. Do not fabricate life events. If the transcript lacks detail, say what kind of real detail the learner should add instead of inventing it.
Part-specific preservedStyle expansion:
- Part 1: Give one concrete personal detail, one short reason/feeling, and avoid turning it into a long story.
- Part 2: Build a story spine: time/place, scene, action, difficulty/change, feeling, why it matters.
- Part 3: Turn personal material into abstract discussion: claim, condition/contrast, example, consequence.
Do not return "nothing to improve" unless the answer is genuinely excellent; even then, provide a concise refinement.
Never put debug, fallback, parser, validation, provider_safety, or retry-panel messages into learning fields.

Part 1 rules:
- Warm-up conversation. Future product direction is topic-thread practice with 3-4 same-topic follow-up questions, so do not treat one Part 1 question as an essay-like final topic response.
- upgradedAnswer should normally be 2-4 natural spoken sentences, about 15-30 seconds.
- Strong Part 1 targets are still short: effortless, specific, natural, and not more academic.
- Structure: direct answer + one specific detail + light reason/feeling.
- A stronger Part 1 target normally stays 2-4 sentences. Do not add academic words, a long explanation, or a mini essay.
- Do not overload advanced vocabulary or write polished paragraphs.
- If the transcript is very short but meaningful, do not invent a full personal answer. Give starter development guidance or a bracketed starter such as: "Yes, I do. I usually read [type of books] when I want to relax. It helps me [personal reason]."
- If you add example details not provided by the user, label them as a starter example or use brackets.
- reusableExample.canBeReusedFor may include 1-3 likely same-topic follow-up IELTS questions.

Part 2 rules:
- Long turn, but still spoken narrative, not literary writing.
- Target time: 1.5-2 minutes.
- upgradedAnswer should follow a story spine: who/what/where -> specific scene -> key details -> feeling change -> why it matters.
- Band 7 Part 2 has a clear story spine, specific details, feeling, and why-it-matters. Band 7+ Part 2 is more vivid but believable, smoother, and more reflective, not literary.
- A stronger Part 2 target should show setting, a specific scene, concrete action, challenge/change, feeling shift, and why it matters. Do not merely add vocabulary.
- Do not treat the cue card as a checklist. Concrete details and personal reflection matter more than fancy vocabulary.

Part 3 rules:
- Abstract discussion, but face-to-face spoken answer, not Writing Task 2 spoken aloud.
- upgradedAnswer should normally be 4-6 spoken sentences, about 35-60 seconds.
- Use natural spoken discussion logic: direct position -> reason/contrast/condition -> example -> consequence/wider meaning.
- Band 7 Part 3 has a clear position, reason/contrast, example, and consequence. Band 7+ Part 3 has stronger cause/effect, more nuanced contrast, better examples, and more natural spoken transitions.
- A stronger Part 3 target should have spoken reasoning depth: claim, condition or contrast, example or observation, consequence, and natural discussion rhythm. Do not make it sound like Writing Task 2.
- Prefer spoken bridges such as "I'd say...", "I think...", "It really depends...", "One major change is...", and "A good example would be..."
- Avoid writing-style connectors and essay phrases such as "Furthermore", "Moreover", "Consequently", "It is universally acknowledged that", and "In contemporary society".
- If the original answer already has a position and example, do not give generic advice like "add an example"; identify the real issue, such as grammar, word form, pronunciation-transcript error, weak cause/effect, weak consequence, unclear comparison, or spoken clarity.
- Before finalizing any Band 7+ upgradedAnswer for an already-7.0 learner, self-check whether it clearly improves idea development, precision, organization, and naturalness without making it essay-like.`;

export const speakingFeedbackDepthInstruction = `Avoid endless sentence-level nitpicking, but do not make low/mid-band feedback sparse.
Low-noise feedback means layered, high-impact, and readable feedback, not little feedback.
Silent coverage pass before selecting displayed feedback: for any substantial low/mid-band answer, first scan the transcript clause by clause for clear high-impact problems. Check especially narrative tense consistency, subject-verb or clause-form errors, articles/determiners, malformed noun phrases or word order, high-impact awkward phrasing/collocation, and important task/cue-card coverage gaps for the relevant Part when they materially weaken the response. Then output the meaningful fixes without nitpicking trivial slips or likely ASR noise.
Classification rule: clear grammar errors must go in fatalErrors / MUST FIX, not only in naturalnessHints. This includes present tense inside an explicitly past narrative, missing articles in specific noun phrases, malformed non-finite clauses where a finite verb is needed, tense mismatch in a past narrative, subject-verb errors, article/determiner errors, clause-form errors, and malformed noun phrases. naturalnessHints are for understandable but non-fatal wording improvements, collocation upgrades, or smoother spoken phrasing.
Coverage rule: do not omit a separate unrelated clear grammar error merely to keep the page short. If one longer correction clearly covers two linked errors, return one card explaining both; otherwise keep separate unrelated high-impact issues separate. Do not duplicate cards for the same underlying phrase.
Correction depth by current estimate:
- Below 6.5: return about 5-8 high-impact correction items across fatalErrors and naturalnessHints when the transcript has enough material. Include at least 3-5 original phrase fixes if the answer contains enough stable wording. Use fatalErrors for clear grammar, collocation, word-choice, tense, or meaning problems that can affect IELTS score. Use naturalnessHints for important spoken phrase upgrades that are not fatal but would noticeably improve LR/GRA/FC. Do not list trivial slips.
- 6.5-7.5: return fewer but still meaningful targeted fixes, focused on precision, coherence, spoken naturalness, and idea development.
- 8.0+ or high-band stable: keep feedback concise and do not force many corrections.
Do not invent errors. Do not correct every tiny spoken imperfection. Do not mark isolated likely ASR artifacts as definite grammar errors. If a phrase could be ASR, either avoid making it a Must Fix or phrase the explanation as "check this phrase". Functional-word homophones such as will/well, went/but, and of/off should not be heavily penalized unless repeated or meaning-breaking.
Do not skip original sentence or phrase problems just because the target answer rewrites or omits them. For each major fatalError or naturalnessHint, make explanationZh include a short target-link when useful, for example "Target answer uses this as: ..." or "Target answer rebuilds this idea as: ..." or "This phrase was omitted because ...".
Target answer linkage: upgradedAnswer must visibly apply the most important fixes from fatalErrors and naturalnessHints while preserving useful personal material. For a power-cut story, for example, use natural spoken repairs such as "the power went out", "everything went pitch black", "find a lighter and light some candles", and "the electricity company" where those ideas come from the learner.
band9Refinements must quote or reference exact learner wording in observation or explanationZh, otherwise the UI grounding filter may remove the item. Use this field for grounded idea/expression upgrades, not generic advice.
preservedStyle must explain what material is worth keeping and how it was rebuilt. For Part 2, keep concrete personal material such as childhood power cut, home alone, fear, TV/Ultraman, monsters/darkness, and calling parents when present, then explain how to rebuild scattered details into a story spine. Do not make upgradedAnswer a totally unrelated model answer.`;

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
  "frameworkFeedback": [{ "issue": "string", "suggestionZh": "string", "severity": "fatal | naturalness | preserved", "location": "Whole Essay", "issueType": "task_response", "relatedCorrectionIds": ["C1"], "paragraphFixZh": "string", "exampleFrame": "string", "transferGuidanceZh": "string" }],
  "sentenceFeedback": [{
    "id": "C1",
    "paragraph": "Introduction",
    "sourceQuote": "string",
    "issueType": "off_topic",
    "severity": "major | medium | minor | polish",
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
  "modelAnswerAnnotations": [{ "quote": "exact span from modelAnswer", "type": "topic_vocabulary | expression_upgrade | sentence_repair | logic_repair", "labelZh": "string" }],
  "modelAnswerPersonalized": true,
  "modelAnswerTargetLevel": "string",
  "estimateRationaleZh": "string",
  "targetBandFloor": 7,
  "targetLayer": "Band 7.0+ Target Model Answer | Band 8+ Examiner-Friendly Model Answer",
  "targetValidationZh": "string",
  "targetUpgradeFocusZh": "string",
  "targetAnswerFloor": 7,
  "targetAnswerLayer": "band_7_to_7_5 | band_8_plus | high_band_stability",
  "targetAnswerStatus": "meets_target | borderline | failed | not_generated | not_applicable",
  "targetAnswerSelfScores": {
    "taskResponse": 0,
    "coherenceCohesion": 0,
    "lexicalResource": 0,
    "grammaticalRangeAccuracy": 0
  },
  "targetAnswerRationaleZh": "string",
  "targetAnswerRepairFocusZh": "string",
  "highBandStabilityZh": "string",
  "nextStepZh": "string",
  "scoreConsistencyNoteZh": "string",
  "reusableArguments": [{ "argument": "string", "canBeReusedFor": ["string"], "explanationZh": "string" }],
  "obsidianMarkdown": "string"
}`;

export const writingTargetValidationSchemaInstruction = `The JSON object must match this exact key structure:
{
  "module": "writing",
  "operation": "writing_target_validation",
  "targetFloor": 8,
  "status": "meets_target | borderline | failed",
  "scores": {
    "taskResponse": 0,
    "coherenceCohesion": 0,
    "lexicalResource": 0,
    "grammaticalRangeAccuracy": 0
  },
  "rationaleZh": "string",
  "repairFocusZh": "string"
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

editableSummary must be clear sections, not one dense block. Adapt labels to task type:
- Discuss both views: Position, View A, View B, My opinion, Paragraph plan, Possible example.
- Causes / problem-solution / "Why does this happen, and what can be done?": Position, Cause Analysis, Solution Plan, My Position, Paragraph Plan, Topic-specific argument frames. Do not use View A / View B.
- Agree/disagree: Core Position, Supporting Reason 1, Supporting Reason 2, Counterpoint / Limit if useful, Paragraph Plan.
- Advantages/disadvantages/outweigh: Advantage Analysis, Disadvantage Analysis, My Judgement if required, Paragraph Plan.
- Do not use "overview" as a Task 2 paragraph instruction; use thesis, position, or introduction.
Each major section should include Chinese logic plus useful English thesis/topic sentence drafts when the learner supplied enough information.
Reusable language for this essay should include 3-5 varied sentence frames or transitions.`;

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

  private async generateJson(prompt: string, temperature?: number): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        ...(typeof temperature === 'number' ? { temperature } : {}),
      },
    });

    return response.text ?? '';
  }

  private async generateJsonWithAudio(prompt: string, audioBase64: string, mimeType: string): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          createPartFromBase64(audioBase64, mimeType),
        ],
      }],
      config: {
        responseMimeType: 'application/json',
      },
    });

    return response.text ?? '';
  }

  async transcribeSpeakingAudio(params: {
    part: number;
    question: string;
    audioBase64: string;
    mimeType: string;
    topic?: string;
    tags?: string[];
    cueCard?: string;
    roughBrowserTranscript?: string;
    transcriptionHints?: string[];
  }): Promise<string> {
    const partContext = params.part === 1
      ? 'IELTS Speaking Part 1 short-answer practice.'
      : params.part === 2
        ? 'IELTS Speaking Part 2 long-turn cue-card practice.'
        : 'IELTS Speaking Part 3 discussion practice.';
    const hints = params.transcriptionHints?.length
      ? params.transcriptionHints.join(', ')
      : 'No extra hints supplied.';
    const roughBrowserTranscript = params.roughBrowserTranscript?.trim()
      || 'No browser transcript was captured.';

    return this.generateJsonWithAudio(`${strictJsonInstruction}

You are a verbatim transcription engine for an IELTS Speaking practice app.
This is an IELTS Speaking practice answer.
This operation is transcription only. Do not create IELTS feedback. Do not score pronunciation. Do not correct speech in real time.

Transcribe the learner's English speech as accurately as possible.
Preserve grammar mistakes, false starts, repeated words, filler words, incomplete phrases, unnatural wording, tense errors, article errors, preposition errors, contraction choices, and word-form mistakes.
Do not rewrite, polish, normalize, or correct grammar.
Do not infer a better sentence from the IELTS question or the hint list.
If a word is unclear, write [unclear] in the transcript or add an uncertainty note.
Proper nouns and place names should be transcribed as heard; note uncertainty instead of silently changing them.
Use context hints only to resolve likely ASR ambiguity, especially proper nouns, places, and IELTS topic vocabulary.
Hints can help distinguish words like go jogging vs go joking/shopping, energetic vs nonsense, workplace vs what place, electricity went off vs electricity but off, will vs well, to some extent vs to such extent, and raining vs rainy.
Hints must not convert a learner's actual grammar mistake into corrected English. If the learner says "I always energetic", do not rewrite it as "I am always energetic."
The browser transcript below may contain recognition errors. Use it only as a weak timing/word hint. Do not copy it blindly.

Context for disambiguation only:
- ${partContext}
- Question: ${params.question}
- Cue card / bullet points: ${params.cueCard || 'not specified'}
- Topic: ${params.topic || 'not specified'}
- Tags: ${(params.tags || []).join(', ') || 'none'}
- Possible words/phrases: ${hints}
- Rough browser transcript: ${roughBrowserTranscript}

Return only structured JSON matching the expected schema.
${speakingAudioTranscriptionSchemaInstruction}`, params.audioBase64, params.mimeType);
  }

  async analyzeSpeaking(params: {
    part: number;
    question: string;
    transcript: string;
    sessionKind?: 'single_question' | 'part1_topic_thread';
    topic?: string;
    threadId?: string;
    threadAnswers?: { questionId: string; question: string; answer: string }[];
    authoritativeScore?: {
      bandEstimateExcludingPronunciation: number;
      scores: {
        fluencyCoherence: number;
        lexicalResource: number;
        grammaticalRangeAccuracy: number;
        pronunciation: null;
      };
      rationaleZh: string;
    };
    targetRepairFocus?: string;
    targetAttempt?: number;
    priorTargetAnswer?: string;
  }): Promise<string> {
    if (params.sessionKind === 'part1_topic_thread') {
      return this.generateJson(`${strictJsonInstruction}

You are an IELTS Speaking Part 1 topic-session feedback engine for a local-first practice app.
Chinese is for diagnosis and explanations. English is for learner wording, corrections, phrase fixes, reusable versions, and short frames.
${speakingPart1TopicThreadInstruction}

${speakingPart1TopicThreadSchemaInstruction}

Input:
${JSON.stringify(params, null, 2)}`);
    }

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
${speakingPromptCalibration}
${speakingFeedbackDepthInstruction}
If the answer is already strong, return an empty fatalErrors array and use naturalnessHints or band9Refinements for concise grounded idea and expression upgrades.
Feedback must be target-uplift training feedback. Keep the current estimate defensible and conservative, but make upgradedAnswer, naturalnessHints, band9Refinements, and the practice direction aim at least Band 7.0+.
If the learner is weak or medium, produce a clean, natural Band 7 target answer for that part with enough improvement margin, not merely a minimal correction. If the learner is already around Band 7.0 or above but not high-band-stable, upgradedAnswer must become a meaningfully stronger Band 7+ training answer rather than another ordinary Band 7 answer. Do not call it Band 8+, Advanced, Verified, Not Verified, or certified.
Preserve the learner's personal idea where possible; upgrade execution. Do not fabricate personal details beyond what is needed for a natural answer.
If the transcript is extremely short, nonsensical, or too thin for the part, do not write a long upgradedAnswer. Return an insufficient-sample message with a short starter outline instead. Be stricter for Part 2 and Part 3 than Part 1.
Use fatalErrors only for true mistakes. Use band9Refinements as an internal compatibility field for Idea & Expression Upgrade items, especially when fatalErrors is empty or short. In each band9Refinements item, observation should be a concise issue/upgrade point, refinement should contain 1-3 usable English phrases or sentence frames only, and explanationZh should be short Chinese guidance. Do not write "Band 9" in the content.
Idea & Expression Upgrade items should cover over-formal or AI-like phrasing, unnatural spoken rhythm, overlong Part 1 answers, missed chances for concise natural development, reasoning depth, and ways to sound more spontaneous.
For Part 1, keep upgradedAnswer compact and conversation-oriented. For Part 2, target a spoken story spine with concrete details. For Part 3, target natural spoken discussion logic with reasoning, examples, and consequences.
Do not use targetRepairFocus, priorTargetAnswer, or authoritativeScore to describe target certification. Normal Speaking analysis is one structured feedback pass: score the learner answer, give feedback, and generate upgradedAnswer when appropriate.

${speakingSchemaInstruction}

Input:
${JSON.stringify(params, null, 2)}`, 0.1);
  }

  async scoreSpeakingOnly(params: {
    part: number;
    question: string;
    transcript: string;
  }): Promise<string> {
    const partRules = params.part === 1
      ? 'Part 1: short, natural, direct, personal detail, conversation-ready. Do not penalize appropriate brevity.'
      : params.part === 2
        ? 'Part 2: sustained long-turn answer with scene, detail, development, feeling, and meaning where relevant.'
        : 'Part 3: spoken discussion with position, reasoning, example/contrast/consequence. Do not expect essay-style discourse.';

    return this.generateJson(`${strictJsonInstruction}

You are the authoritative blind IELTS Speaking text scorer for a local-first training app.
Score only the submitted transcript against the question. The transcript may be any answer text; do not infer whether it is a learner original, a generated target, or a retest.
Inputs allowed for judging: Speaking part, question, transcript, and part-specific requirements. Do not use or ask for target floors, target labels, original scores, candidate status, or target certification wording.
This is a text-based single-question training estimate excluding pronunciation. Pronunciation must be null.
Use the same rubric and strictness for every submitted text:
- fluency/coherence: answer fit, progression, part-appropriate development, spoken organization
- lexical resource: natural precision, collocation, topic vocabulary, spoken idiom without fake formality
- grammatical range/accuracy: control, sentence variety, error density, clarity
If evidence sits on a boundary, prefer the lower visible estimate. Do not relax the score because the answer is polished or generated. Do not apply an extra penalty just because it is one question.
${partRules}
Return whole or half bands only. The headline estimate should be the conservative visible text-based estimate from FC/LR/GRA, not pronunciation.

${speakingScoreOnlySchemaInstruction}

Input:
${JSON.stringify(params, null, 2)}`);
  }

  async validateSpeakingTarget(params: {
    part: number;
    question: string;
    transcript: string;
    targetFloor: number;
  }): Promise<string> {
    const partRules = params.part === 1
      ? 'Part 1: short, direct, natural, one concrete personal detail, not academic or overlong.'
      : params.part === 2
        ? 'Part 2: sustained long-turn story spine with setting, scene, concrete action, challenge/change, feeling shift, and why it matters. Preserve distinctive useful material.'
        : 'Part 3: spoken reasoning with position, nuance or contrast, example/observation, consequence, and natural speech rhythm; not essay prose.';

    return this.generateJson(`${strictJsonInstruction}

You are an independent IELTS Speaking target-answer validator. This is a scoring-only pass.
Do not generate feedback for the learner's original answer. Do not generate a new target answer. Do not rewrite the candidate.
Score only the transcript against the question and the same strict transcript-based Speaking criteria used by the app: fluency/coherence, lexical resource, and grammatical range/accuracy. Pronunciation must be null.
Mirror the normal speaking_analysis rubric; validation may be slightly stricter than generation, but it must never be looser than normal analysis. Do not pass a target that normal speaking_analysis would clearly treat as 7.0 or 7.5.
Do not apply a blanket single-question penalty to a complete target answer. Do not inflate scores. Do not relabel 7.5 as 8.0.
For Part 2, Band 8+ requires a true long-turn story spine: setting/time/place, specific scene, concrete action, challenge/change, feeling shift, why it matters, and natural spoken sequencing. Do not pass a target as 8+ just because it is longer, more formal, or more vocabulary-heavy. Preserve distinctive useful material such as "vibe coding" and explain it instead of replacing it with generic wording.
For Part 3, Band 8+ requires spoken reasoning depth: direct position, nuance/condition/contrast, concrete example or observation, and cause/effect or consequence. It must not sound like Writing Task 2 read aloud.
If the candidate is borderline or uncertain, return borderline or failed, not meets_target.
Target floor is ${params.targetFloor}. status may be meets_target only if every required score is >= targetFloor. If any score is below targetFloor, return borderline or failed and give a compact Chinese repairFocusZh.
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
Set "task" to the exact input task value. For this V1 flow it is normally "task2".
Separate big-picture task response / paragraph logic problems from sentence-level corrections.
Return essayLevelWarnings separately for global reliability/scoring-precondition warnings only: under-length response, very low-signal response, prompt mismatch/off-task answer, not an essay/only notes, unreliable training estimate, copied prompt/no original answer, or too fragmented to score normally. Do not put introduction advice, paragraph development advice, vocabulary advice, or sentence corrections in essayLevelWarnings.
If the essay clearly answers a different prompt, add an essayLevelWarnings item with title "Prompt mismatch warning" and messageZh "这段回答似乎没有回答当前题目，请确认是否选错题目。". Also make the Task Response score reflect the mismatch. Do not only treat mismatch as language weakness, and do not over-trigger for partially relevant essays.
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
Current estimate must remain honest and conservative. Choose the target with the global policy only: if the current essay is below Band 7.0, use a stable Band 7.0-7.5 target model; if the current essay is 7.0-7.5, use a genuinely Band 8+ examiner-friendly model with a safety margin above 7.5; if the current essay is already 8.0+, switch to high-band stability rather than generating a fake higher replacement essay. In high_band_stability, modelAnswer may be an empty string; use highBandStabilityZh and nextStepZh instead. Do not use Target Band 7.5, Target Band 7.5-8.0, or Band 9.
Score-feedback consistency is mandatory. If any score dimension is below 7.0, the feedback must name the real blocker for that dimension. Task Response blockers include missing task parts, weak position, shallow development, unsupported solution, or wrong focus. Coherence blockers include unclear paragraph role, weak progression, or over-stacked ideas. Lexical blockers include unnatural collocation, over-formality, repetition, or imprecise topic vocabulary. Grammar blockers include sentence control, punctuation, clause logic, accuracy, or range. Never call a dimension excellent while assigning 6.5 unless you clearly explain why it is close but not yet Band 7.0.
Logic & Structure Review must be a revision roadmap: what the issue is, why it affects IELTS performance, and what to add, remove, or rewrite. If the learner's original argument direction would cap the band, say it is not recommended, explain why it limits Task Response or Coherence, and make the modelAnswer use a stronger direction.
The modelAnswer field must be a complete personalized Task 2 target model answer, normally 280-350 words even when the learner's essay is under 250 words. Prefer concise completeness and avoid 400+ words. It must apply Task Response/task command fixes, concession or balance if relevant, paragraph-level logic advice, sentence correction lessons, Language Bank items, and the user's usable ideas where appropriate. It must not merely polish the original essay; if an original idea is weak or off-task, replace it with a more appropriate task-relevant idea and explain that in feedback.
For Band 7.0+ modelAnswer, the answer must be clear, relevant, supported, and controlled. For Band 8+ modelAnswer, the answer must show direct task response, a clear sustained position, well-developed paragraphs, precise topic vocabulary, flexible sentence structures, strong cohesion without mechanical linking, and no generic template padding. Two-pass target integrity is mandatory: after generating modelAnswer, self-score it using the same Task Response, Coherence & Cohesion, Lexical Resource, and Grammar criteria. If any self-score is below targetAnswerFloor, revise the modelAnswer before returning. If it still cannot meet the floor, set targetAnswerStatus to borderline or failed, do not label it Band 8+, and explain targetAnswerRepairFocusZh. Do not fake an upgrade by making it more formal, longer, or template-like. Avoid relying on "pervasive issue", "delve into", "multifaceted approach", or "it is imperative that" as the upgrade.
For advantages/disadvantages or outweigh prompts, if the main issue is missing or weak disadvantage coverage, the modelAnswer must include a clear concession/disadvantage paragraph before defending the final position.
Return modelAnswerAnnotations for meaningful exact spans in modelAnswer: several topic_vocabulary spans, at least two expression_upgrade spans when available, at least one sentence_repair span, and at least one logic_repair span. quote must exactly appear in modelAnswer. Do not over-highlight the whole essay.
Set modelAnswerPersonalized to true only when it uses the user's essay/framework context.
If targetRepairFocus and priorTargetAnswer are provided, this is a retry because an independent scoring-only validator rejected the previous model answer. Do not repeat the prior model. Repair the specific weakness through stronger task response, paragraph function, example specificity, reasoning mechanism, cohesion, and controlled language. Do not inflate the current essay scores or lower the Band 8+ meaning.

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

You are an independent IELTS Writing Task 2 target-answer validator. This is a scoring-only pass.
Do not generate a teaching report. Do not generate a new model answer. Do not rewrite the candidate.
Score only candidateTargetAnswer against the exact question using the same strict IELTS Task 2 criteria: Task Response, Coherence & Cohesion, Lexical Resource, and Grammatical Range & Accuracy.
Mirror the normal writing_analysis criteria; validation may be slightly stricter than generation, but it must never be looser than normal analysis. Do not pass a target that normal writing_analysis would clearly score as 7.0 or 7.5.
Do not inflate scores, do not lower the meaning of Band 8+, and do not count generic formal phrasing as a real upgrade. A Band 8+ answer needs exact task response, clear sustained position, developed paragraph functions, concrete examples, natural precise vocabulary, and controlled grammar range.
Band 8+ model answers must improve task response, reasoning mechanism, paragraph function, example specificity, progression, and natural precision. Do not reward phrases like "pervasive issue," "delve into," "multifaceted approach," or "it is imperative that" as fake upgrades.
If the candidate is borderline or uncertain, return borderline or failed, not meets_target.
Target floor is ${params.targetFloor}. status may be meets_target only if every required score is >= targetFloor. If any score is below targetFloor, return borderline or failed and give a compact Chinese repairFocusZh.

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
Do not implement General Training letters.
Do not invent image details beyond the given brief.
Do not explain causes unless the visual brief explicitly gives causes.
Focus on overview quality, key feature selection, useful comparison, data accuracy, coherence, and concise academic reporting.
Current estimate must remain honest and conservative. Target reports must follow the global uplift policy: if the current report is below Band 7.0, improvedReport/modelExcerpt must be a Band 7.0+ Target Report; if the current report is around Band 7.0 or above, improvedReport/modelExcerpt must be a Band 8+ Examiner-Friendly Report. Do not inflate the current estimate to match the target. Do not label output as Band 9 or Target Band 7.5.
The target report must improve overview quality, key feature selection, comparison logic, data accuracy, and concise academic reporting style. Do not just correct grammar. For Band 8+ reports, self-check that the report has a clear overview, accurate key features, strong comparisons, precise data description, and no irrelevant detail dump.
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

  async extractWritingFramework(params: {
    task: 'task2';
    question: string;
    notes: string;
  }): Promise<string> {
    return this.generateJson(`${strictJsonInstruction}

You extract a final IELTS Writing Task 2 framework from the learner's Phase 1 coach discussion notes.
Ground the summary in learner notes, coach discussion, and any unsent draft notes. Use task-appropriate bilingual editableSummary labels. Use View A / View B only for discuss-both-views prompts. For causes-solutions prompts, use Cause Analysis and Solution Plan. Each major section should include Chinese logic plus useful English thesis/topic sentence drafts where the learner has supplied enough information. Mark missing decisions as Not decided yet / 需要继续补充. Mark AI-suggested examples as Suggested example, please confirm. Do not turn the summary into a full model answer.
Include reusable argument frames such as concession, contrast, not only...but also, not to mention, or this is not to suggest that, but vary them instead of repeating the same frames every time.
Do not write the essay. Consolidate only the learner's notes and coach discussion into the requested fields.
Do not invent a complete high-band essay plan from the prompt alone.
If a decision is missing, write "Not decided yet / 需要继续补充" in that field.
Possible examples must come from the learner notes. If you suggest an example because the notes imply a direction but do not name one, prefix it with "Suggested example, please confirm:".
The editableSummary field must be a readable text block with task-appropriate labels. Do not use "overview" for Task 2 introduction planning.

${frameworkSchemaInstruction}

Input:
${JSON.stringify(params, null, 2)}`);
  }
}
