import { createPartFromBase64, GoogleGenAI } from '@google/genai';
import { AIProvider, SpeakingAnalysisRequest } from './base';

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
  "speakingCeilingDiagnosis": {
    "whyNotLowerZh": "concise Chinese evidence for why the answer deserves at least the current level",
    "whyNotHigherZh": "concise Chinese ceiling for why it is not yet the next stable level",
    "nextBandTriggerZh": "one minimal Chinese action that would move the answer toward the next half/whole band",
    "textOnlyNoteZh": "concise Chinese product premise: estimate assumes the current answer can be spoken naturally and clearly",
    "partSpecificCeilingZh": "concise Chinese Part 1/2/3-specific ceiling, not an official separate part band",
    "ceilingTags": ["too_written | not_precise_enough | limited_paraphrase_flexibility | over_explained | not_spontaneous_enough | weak_nuance | generic_reasoning | insufficient_part3_abstraction | minor_collocation_inaccuracy | grammar_errors_still_persistent | under_developed | part_inappropriate_development | delivery_unknown"]
  },
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
  "part2Feedback": {
    "materialType": "person | place | object | experience_event | abstract_or_opinion_experience | unclear",
    "materialTypeRationaleZh": "string",
    "annotations": [{
      "id": "string",
      "questionRef": "PART 2",
      "sourceQuote": "exact learner words copied from the transcript",
      "combinedRepair": "complete better spoken version of this source span when useful",
      "layers": [{
        "severity": "must_fix | better_spoken_choice | optional_polish",
        "issueType": "grammar | tense | collocation | story clarity | lexical precision | connector | clause | task development",
        "original": "exact learner words",
        "better": "corrected or more natural wording",
        "explanationZh": "string",
        "reuseGuidanceZh": "string"
      }]
    }],
    "storyModules": [{
      "role": "what_who_where | background | concrete_details | what_happened | feeling | why_it_mattered | current_or_future_influence",
      "status": "present | thin | missing | suggested_confirm",
      "sourceWording": "exact or summarized learner material",
      "improvedVersion": "short speakable module, not a full answer",
      "coachingZh": "string",
      "confirmationNeeded": false
    }],
    "languageSignals": [{
      "signal": "idiomatic_expression | tense | connector | phrasal_verb | collocation | clause",
      "status": "strong | usable | thin | missing | not_needed",
      "requirementZh": "fixed Part 2 requirement for this signal",
      "foundInTranscript": false,
      "evidence": "exact learner wording or empty string",
      "evidenceQuotes": ["exact learner wording already using or attempting this signal"],
      "qualityZh": "Chinese diagnosis only: what the learner used, whether it is correct, repetitive, narrow, confusing, or missing; do not include concrete English upgrade suggestions here",
      "nextMoveZh": "Chinese diagnosis of the next learning focus only; do not name concrete English expressions, connectors, clause frames, or alternatives here",
      "bestUpgrade": "single compact English upgrade expression/frame for this answer, not Chinese coaching and not a full example sentence unless the signal itself is clause; for phrasal_verb, return only the core verb + particle/preposition phrase, not leading adverbs or wider modifiers; for clause, return a high-quality clause frame or sentence-level structure, not a bare subordinator or low-value because/when/although sentence",
      "alternatives": ["2-3 topic-specific alternatives"],
      "alternativeUpgrades": [{
        "kind": "replace | add",
        "sourceQuote": "exact learner wording only when kind is replace",
        "upgrade": "specific high-value expression/frame for this signal",
        "guidanceZh": "Chinese note explaining why this exact upgrade is worth learning; do not introduce extra English alternatives beyond this upgrade",
        "insertLocationZh": "where to add this exact upgrade or what original slot it replaces; do not introduce extra English alternatives here",
        "sampleUpgrade": "optional complete English sentence for this signal asset",
        "sampleUpgradeHighlight": "exact substring inside sampleUpgrade to highlight"
      }],
      "insertLocationZh": "where/how to add it in this answer",
      "sampleUpgrade": "one complete English sentence that integrates bestUpgrade into this learner's current story",
      "sampleUpgradeHighlight": "exact substring inside sampleUpgrade that should be highlighted as the new expression",
      "sampleUpgrades": ["2-4 complete or near-complete English sentences/frames for this exact story"],
      "usedInNextVersionQuote": "exact phrase copied from nextSpeakableVersion showing the same upgrade chosen for this signal",
      "profileSignalZh": "what this attempt suggests for future learner habit/profile tracking"
    }],
    "priorityFocusZh": "string",
    "nextSpeakableVersion": "string",
    "nextSpeakableVersionHighlights": [{
      "quote": "exact phrase copied from nextSpeakableVersion; for language highlights, this must match the integrated signal upgrade",
      "signal": "idiomatic_expression | tense | connector | phrasal_verb | collocation | clause",
      "storyRole": "what_who_where | background | concrete_details | what_happened | feeling | why_it_mattered | current_or_future_influence",
      "labelZh": "short Chinese label",
      "whyItWorksZh": "string"
    }]
  },
  "part3Feedback": {
    "topic": "string",
    "threadId": "string",
    "sessionPriorityZh": "string",
    "answers": [{
      "questionRef": "Q1",
      "question": "exact Part 3 question",
      "answer": "exact learner answer for this question",
      "questionFrame": "cause_reason | change_trend | evaluation_stance | comparison_contrast | advantages_disadvantages | solution_suggestion | category_criteria | consequence_impact",
      "questionFrameLabelZh": "short Chinese label for the question type",
      "questionFrameGuidanceZh": "one concise Chinese instruction for how to answer this question type",
      "feedbackMode": "language_repair | reasoning_upgrade | part3_generalisation | answer_scope | precision_upgrade | compression_upgrade | nuance_upgrade | micro_upgrade",
      "thinkingDiagnosis": {
        "questionThinkingZh": "这题怎么想：what this Part 3 question is really asking the learner to do",
        "retainedIdeaZh": "保留你的思路：one useful learner idea/material worth keeping",
        "upgradeRuleZh": "升级规则：what is missing, why it matters, and how to add it",
        "reusableFrameZh": "可迁移句型：short Chinese note explaining how to reuse the frame",
        "reusableFrame": "Natural English sentence frame with A/B/C or X placeholders; no square-bracket prompt syntax",
        "whatWorksZh": "legacy fallback: what the current answer already does well",
        "mainCeilingZh": "legacy fallback: the current growth edge that most limits the answer",
        "bestNextMoveZh": "legacy fallback: the one next training move",
        "answerControlZh": "whether it answers directly or wanders",
        "generalisationZh": "whether it moves from personal example to broader people/society/topic level",
        "nuanceZh": "whether it avoids absolute claims and uses condition/contrast where needed",
        "supportZh": "whether reason + example/contrast/consequence are enough",
        "speakabilityZh": "whether it sounds naturally spoken instead of written",
        "examinerReadinessZh": "whether the learner could handle a likely why/how/change follow-up"
      },
      "ctChain": {
        "claim": "the learner's current or improved core claim",
        "reason": "main reason",
        "exampleOrEvidence": "example, evidence, or concrete scenario",
        "contrastOrCondition": "contrast, limitation, or condition",
        "consequence": "result, impact, or wider implication",
        "missingLinkZh": "Chinese diagnosis of the weakest logic link",
        "nextMoveZh": "Chinese instruction for the next thinking move"
      },
      "microUpgrade": {
        "focusZh": "one concise upgrade focus when a full rewrite is not needed",
        "upgradedLine": "one spoken sentence or compact move the learner can reuse",
        "whyItHelpsZh": "why this improves the answer"
      },
      "targetAnswer": "one natural spoken Part 3 next speakable answer for this exact question; may be a compact micro-version for strong answers",
      "targetAnswerHighlights": [{
        "quote": "exact substring copied from targetAnswer",
        "role": "claim | reason | example | contrast | consequence | language",
        "labelZh": "short Chinese label",
        "whyItWorksZh": "string"
      }]
    }],
    "topicLanguage": [{
      "title": "short Chinese topic label, e.g. 书籍类型",
      "noteZh": "optional very short Chinese note; omit if not needed",
      "items": [{
        "expression": "directly relevant spoken Part 3 expression",
        "meaningZh": "very short Chinese meaning",
        "role": "category | reason | contrast | solution | example | result | language",
        "sourceQuestionRef": "Q1"
      }]
    }]
  },
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
  "speakingCeilingDiagnosis": {
    "whyNotLowerZh": "concise Chinese evidence for why the answer deserves at least the current level",
    "whyNotHigherZh": "concise Chinese ceiling for why it is not yet the next stable level",
    "nextBandTriggerZh": "one minimal Chinese action that would move the answer toward the next half/whole band",
    "textOnlyNoteZh": "concise Chinese product premise: estimate assumes the current answer can be spoken naturally and clearly",
    "partSpecificCeilingZh": "concise Chinese Part 1-specific ceiling, not an official separate part band",
    "ceilingTags": ["too_written | not_precise_enough | limited_paraphrase_flexibility | over_explained | not_spontaneous_enough | weak_nuance | generic_reasoning | insufficient_part3_abstraction | minor_collocation_inaccuracy | grammar_errors_still_persistent | under_developed | part_inappropriate_development | delivery_unknown"]
  },
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
        "reuseGuidanceZh": "string",
        "origin": "learner | previous_cleaner_answer_conflict",
        "priorCertificationStatus": "certified_first_attempt | certified_after_rewrite | legacy_or_unverified",
        "systemRevisionNoteZh": "string"
      }]
    }],
    "cleanRetryAnswers": [{ "questionRef": "Q1", "answer": "short natural retry answer preserving the learner's meaning", "noteZh": "optional short Chinese note only for meaningful compression or reorganisation" }],
    "developmentStatus": "needed | sufficient",
    "developmentTargets": [{ "questionRef": "Q1", "developmentMode": "needs_content | expression_upgrade | no_extra_content", "topicFrameZh": "short Chinese boundary for this exact question", "reasonZh": "optional concise Chinese; empty when it would repeat the obvious", "developmentMoveZh": "concise Chinese task, not a model answer", "phraseScaffolds": ["legacy short English phrase only when phraseChunks cannot be filled"], "phraseChunks": [{ "text": "English chunk, not a full answer", "purposeZh": "brief Chinese purpose tied to the question" }], "optionalDevelopedAnswer": "" }],
    "threadLevelPatterns": [],
    "mustFix": [{ "questionRefs": ["Q1"], "learnerWording": "string", "betterVersion": "string", "explanationZh": "string", "recurring": false }],
    "answerByAnswerCoaching": [],
    "highImpactPhraseFixes": [{ "questionRefs": ["Q3"], "original": "string", "better": "string", "explanationZh": "string" }],
    "materialBank": {
      "myUsableMaterial": [{ "sourceWording": "exact learner wording or shortest grounded source phrase", "reusableVersion": "polished English sentence or short paragraph preserving the learner's stance/idea", "reuseFor": ["Part 1 use case"], "explanationZh": "one concise Chinese translation or meaning paraphrase of the English material", "translationZh": "Chinese translation of developedExample/reusableVersion only", "materialCore": "distinct personal stance, idea, reason, preference, habit, fact, or answer angle", "materialKind": "development_seed | reusable_personal_material", "part1UseCases": ["current Part 1 question/use case"], "developmentMoveZh": "one-step development move", "developedExample": "paraphrased or lightly expanded English sentence/short paragraph for reusable_personal_material", "expressionFrames": ["short reusable frame"], "materialKey": "stable semantic identity" }],
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

export const speakingPart1LearningAssetsSchemaInstruction = `The JSON object must match this exact key structure:
{
  "module": "speaking",
  "operation": "part1_learning_assets",
  "topic": "string",
  "threadId": "string",
  "questionCount": 4,
  "developmentTargets": [{
    "questionRef": "Q1",
    "developmentMode": "needs_content | expression_upgrade | no_extra_content",
    "topicFrameZh": "short Chinese boundary for this exact question",
    "reasonZh": "optional concise Chinese; empty when it would repeat the obvious",
    "developmentMoveZh": "concise Chinese task, not a model answer",
    "phraseChunks": [{ "text": "English chunk, not a full answer", "purposeZh": "brief Chinese purpose tied to the question" }],
    "phraseScaffolds": [],
    "optionalDevelopedAnswer": ""
  }],
  "materialBank": {
    "myUsableMaterial": [{
      "sourceWording": "exact learner wording or shortest grounded source phrase",
      "reusableVersion": "polished English sentence or short paragraph preserving the learner's stance/idea",
      "reuseFor": ["current Part 1 use case"],
      "explanationZh": "one concise Chinese translation or meaning paraphrase of reusableVersion/developedExample",
      "translationZh": "Chinese translation of developedExample/reusableVersion only",
      "materialCore": "distinct personal stance, idea, reason, preference, habit, fact, or answer angle",
      "materialKind": "reusable_personal_material",
      "part1UseCases": ["current Part 1 question/use case"],
      "developmentMoveZh": "",
      "developedExample": "paraphrased or lightly expanded English sentence/short paragraph",
      "expressionFrames": [],
      "materialKey": "stable semantic identity"
    }],
    "reusableSpokenLanguage": [{
      "sourceWording": "",
      "reusableVersion": "current-topic spoken phrase/chunk/frame",
      "reuseFor": ["current Part 1 topic use"],
      "explanationZh": ""
    }]
  },
  "rationaleZh": "brief internal Chinese summary of coverage"
}`;

export const part1CleanRetryCertificationSchemaInstruction = `The JSON object must match this exact key structure:
{
  "module": "speaking",
  "operation": "part1_clean_retry_certification",
  "topic": "string",
  "threadId": "string",
  "attempt": 1,
  "status": "passed | failed",
  "violations": [{
    "questionRef": "Q1",
    "issueType": "grammar_error | broken_structure | wrong_meaning | direct_answer_failure | stance_reversal | invented_personal_fact | internal_factual_temporal_inconsistency | fact_relation_changed | seriously_unnatural_word_choice | underresponsive_or_missing_key_detail | overlong_or_off_task",
    "severity": "must_fix",
    "candidateWording": "exact candidate wording that creates the hard problem",
    "saferVersion": "corrected or safer version when available",
    "reasonZh": "concise Chinese reason"
  }],
  "revisedCleanRetryAnswers": [{ "questionRef": "Q1", "answer": "one revised clean retry answer", "noteZh": "optional Chinese note" }],
  "rationaleZh": "string"
}`;

export const part1CleanRetryCertificationInstruction = `This is an internal certification gate for displayed IELTS Speaking Part 1 topic-thread cleaner answers.
Evaluate the candidate cleanRetryAnswers, not the learner's original answers.
Do not return a band score, target floor, target status, ordinary learner feedback, material bank, annotations, or analysis of the learner's original answer.
Return operation exactly "part1_clean_retry_certification".

Certification passes when every candidate is meaning-preserving, natural, concise, directly answers its exact question, avoids invented personal facts, and contains no genuine MUST FIX under the Part 1 cleaner-answer standard.

Certification must fail only for hard problems:
- grammar error;
- broken structure;
- wrong meaning or direct-answer failure;
- explicit stance reversal compared with the learner's clear Yes / No / Not really / I would / I would not stance;
- invented personal fact;
- internal factual or temporal inconsistency, including a continuous-duration claim that conflicts with another period-away or exception stated in the same candidate;
- changed factual relation, location type, administrative/spatial relation, personal history, stated preference, or stance compared with the learner's source answer;
- unnatural collocation or word choice that is genuinely incorrect or seriously misleading in ordinary spoken English;
- answer so under-responsive that it does not answer the exact question or drops the learner's most useful relevant personal content;
- answer so overlong, rehearsed, or off-task that it is not an immediate Part 1 retry answer.

Meaning-preservation check: compare each candidate against the learner's original answer for that same question. Clarify grammar and naturalness, but do not solve awkward English by changing real-world facts, geography, administrative/spatial relations, timelines, personal history, preferences, or stance. If the learner's intended factual relation is ambiguous, use a semantically conservative formulation rather than inventing a more specific fact.

Internal-consistency check: reread each candidate by itself. If two statements cannot both be true in ordinary spoken English, status must be failed and the revised answer must repair only the inconsistency while preserving the learner's meaning.

Certification must not fail for optional specificity improvements, acceptable synonyms, one natural variant versus another, regional spoken-English variation that remains acceptable, merely more precise wording, formal-versus-casual variation that remains understandable and appropriate, transcript spelling, capitalization, punctuation, spacing, ASR formatting, homophone spelling, pronunciation, or a contextual preference where a more specific object/material term might be nicer but the candidate is already understandable and not wrong.

Certification must fail and rewrite if a candidate remains genuinely under-responsive to the question after repair, especially when it drops the learner's strongest relevant personal detail. Certification must also fail and rewrite if a candidate sounds like a prepared mini Part 2 response instead of an immediately re-recordable Part 1 answer. A good cleaner answer answers directly, preserves the learner's real meaning and strongest personal content, and normally includes one relevant reason, example, contrast, or concrete personal detail when the question invites it. One sentence is acceptable when it already answers adequately; two natural sentences are often strongest for hometown, preferences, routines, experiences, or opinions; three may fit a short contrast or important personal fact. Do not impose a brittle word-count cutoff. If the learner's submitted retry answer is already stable but could be richer, keep it valid and put the richer path in optional guidance rather than pretending it is a correction.

Certification must fail if a cleaner answer or its note would teach a hard spoken-feedback problem: treating acceptable regional/style variants as MUST FIX, teaching transcript-only spelling/capitalization/punctuation/ASR artifacts as spoken errors, or using an over-absolute rule for context-dependent grammar or collocation. Do not fail merely for optional regional or stylistic preferences.

If attempt is 1 and status is failed, return exactly one revisedCleanRetryAnswers item for every expected Q. The revised answers must preserve the learner's meaning, repair the hard problem, remain concise, and not invent personal facts.
If attempt is 2, do not return another rewrite loop; omit revisedCleanRetryAnswers or return an empty array.
Do not be stylistically more aggressive than the normal Part 1 feedback engine. Optional polish is not certification failure.`;

export const speakingPart1TopicThreadInstruction = `This is Speaking Part 1 topic-thread practice, not a single-question target-answer task.
Analyze the whole ordered topic session and preserve question-to-answer mapping through Q references.
Do not generate a full target answer, target conversation, Band 7 target answer, Band 7+ target answer, Standard Answer, verifier state, certification wording, or target validation language.
Return actionable topic-session feedback only:
- ANNOTATIONS: anchor MUST FIX, BETTER SPOKEN CHOICE, and OPTIONAL POLISH directly to exact sourceQuote text copied from one learner answer. Each sourceQuote must appear verbatim in that answer. Use layers when the same quote has grammar plus spoken-choice issues. Prioritize real learner wording, not invented examples.
- Treat ANNOTATED ANSWERS as the primary workspace. Scan every answer for all meaningful local, anchorable spoken-language issues supported by the transcript: missing articles, singular/plural errors, subject-verb agreement, tense, missing sentence components, wrong word forms, wrong prepositions/collocations, structurally broken phrases, and clearly unnatural spoken wording with a stable natural alternative. Do not impose an arbitrary cap, but do not invent issues for accurate phrases.
- If a local repair is mentioned in coaching, retry advice, or a clean retry answer and can be grounded to exact learner wording, it must also appear as an annotation. Do not create a second duplicate annotation for the same original -> better repair.
- For complex broken stretches where several issues interact, anchor one larger meaningful phrase or sentence instead of several isolated token swaps. Put the detailed local layers inside the same annotation, and use combinedRepair for the complete better spoken version of that span.
- Severity rules: tense, article, determiner/pronoun choice, plurality/countability, preposition, agreement, missing verb/component, wrong word form, fixed-collocation error, or clearly broken structure = must_fix. A natural spoken alternative without an accuracy error = better_spoken_choice. Minor stylistic variation only = optional_polish.
- Lexical precision is part of local feedback. Do a sentence-level semantic wording audit before returning JSON: for every content-bearing noun, identity/role word, place/category word, verb phrase, collocation, and translated-sounding chunk, ask whether it is merely understandable or genuinely precise in natural spoken English for this whole answer. Pay special attention when a job-status noun is being used to mean a commute/lifestyle role, or when a place/category noun is paired with an unnatural traffic/transport collocation. Anchor imprecise but teachable wording as BETTER SPOKEN CHOICE, or MUST FIX when it distorts meaning. Do not rely on examples or memorized cases; infer the learner's intended meaning from the question and answer context.
- Semantic category fit is part of Part 1 feedback. Check whether each example actually belongs to the category the learner names: game platform/type, TV series vs film/book/franchise, person vs character/work title, hobby vs subject/skill, and activity vs whole lifestyle. If the clean retry answer changes a category to make it true and natural, anchor the original wording as a lexical precision or word-choice annotation.
- Answer-length control is part of Part 1 feedback. A one-sentence answer can be acceptable, but if it feels like only a bare answer, the clean retry answer should model direct answer + one reason/detail/contrast + natural stop. Do not treat the need for a short reason/detail as a grammar correction; put it in developmentTargets through the learning-assets pass.
- Platform/category precision matters even when grammar is correct. If the learner names an example under an over-specific or doubtful category such as a game franchise under "PC games", a film/book franchise under "TV series", or a work title under a broad media category, repair the category conservatively in the clean retry answer and local annotation.
- Regional/style variants: if two variants are both acceptable in ordinary spoken English, do not penalize one as an accuracy error just to standardize style or region. A preferred variant for consistency or naturalness may appear only as better_spoken_choice, never learner-fault must_fix.
- Do not treat ASR casing, punctuation, spacing, capitalization, transcript spelling, or written-form cleanup as learner language errors. Do not recommend inflated, essay-like, or "more formal" Part 1 wording; prefer short, natural, direct spoken English.
- Do not annotate or discuss transcript-only artifacts as learner errors anywhere in the result: capitalization, punctuation, spacing, ASR casing noise, spelling-only forms that cannot be confirmed in speech, or homophone spelling such as to/too when the spoken form is indistinguishable. If a span has a real structural issue plus casing/spelling cleanup, keep only the real structural issue and anchor only the real spoken-language problem.
- Avoid over-absolute grammar explanations. If a word or structure behaves differently by meaning or context, explain why the proposed wording is more natural in this answer rather than saying the learner's alternative is never grammatical.
- Pronunciation is not assessed in this mode. Treat that as a product premise, not a repeated learner-facing disclaimer. Do not claim pronunciation problems, correct pronunciation, pronunciation score impact, or delivery issues in estimateRationaleZh, bandEstimateRange.rationaleZh, speakingCeilingDiagnosis, annotations, thread-level patterns, retry plan, or material bank.
- Before returning every repair and every cleanRetryAnswers item, self-check: grammatical, natural spoken IELTS Part 1 English, intended meaning preserved, concise enough for Part 1, not more formal or inflated. Return one preferred repair, not slash-separated alternatives, in better/combinedRepair.
- CLEAN RETRY ANSWERS: return exactly one cleanRetryAnswers item for every Q in the thread. This is the learner's own answer rebuilt for immediate re-recording, not a Band target answer, model answer, or target conversation. Preserve real personal material, repair important grammar/collocation/structure, compress overlong detail, and never invent personal facts. A good Part 1 cleaner answer answers directly and normally includes one relevant reason, example, contrast, or concrete personal detail where the question invites it. One sentence is acceptable when adequate; two natural spoken sentences are often strongest for hometown, preferences, routines, experiences, or opinions; three may be appropriate to preserve a short contrast or important personal fact. Do not delete useful personal detail merely to satisfy "concise", do not turn a Part 1 repair into a mini Part 2 response, and do not pad an already-correct retry answer merely to appear higher band. Use noteZh only when you substantially compress, reorganize the answer, or need to preserve uncertainty because the intended stance cannot be safely recovered.
- CLEAN RETRY CERTIFICATION AWARENESS: each displayed clean retry answer will be rejected before display if it still contains a genuine MUST FIX. Avoid introducing alternative wording merely for variety when the learner's repaired answer is already correct and concise. A valid cleaner answer may still admit optional polish; optional variation must not be treated as failure or used to trigger endless paraphrasing. Acceptable contextual vocabulary choices must not be promoted to MUST FIX only because a different expression is more specific.
- RETRY REFERENCE CONTEXT: when input.retryReference is present, this is a same-thread retry. The learner may reuse wording previously displayed by the system as a certified cleaner answer. Analyze the current submitted answer honestly. If a genuine issue appears in wording substantially copied from the previous cleaner answer for the same question, still return the needed correction, but mark the affected annotation layer with origin "previous_cleaner_answer_conflict", include priorCertificationStatus when supplied, and add a brief systemRevisionNoteZh explaining that this is a previous system revision inconsistency rather than a new learner-introduced error. Do not mark mere shared common words, topic overlap, optional specificity preferences, transcript spelling/capitalization/punctuation/ASR formatting, or unsupported pronunciation as either MUST FIX or system conflict. Do not suppress genuinely new learner errors.
- Clean retry style: normally direct answer first, then one concise supporting detail or reason. Remove empty delay openers such as "That's an interesting question" or "That's a good question." Do not preserve unnecessary detours just because they appeared in the original. If several real details appear, choose the strongest one instead of copying all of them. If thread-level advice says the learner over-expanded, the clean retry answers must model shorter, more focused answers.
- Clean retry semantic self-check: do not keep a sentence merely because it is grammatical if the idea remains awkward, vague, over-generalized, or unnatural for spoken Part 1. Prefer natural category relationships: a field or subject should not be rewritten as a skill when that sounds awkward; an isolated habit should not become an entire lifestyle unless the learner clearly meant that. Rebuild toward the likely intended habit, routine, preference, object, activity, field, or detail without inventing facts.
- FINAL CLEAN-ANSWER STANCE CHECK: if the learner explicitly begins with a clear stance such as Yes, No, Not really, I would, or I wouldn't, do not silently reverse that stance merely because the supporting explanation is unclear or poorly phrased. Prefer repairing the supporting logic while preserving the stated position. If the answer contains a genuine contradiction and the intended stance cannot be recovered safely, preserve the uncertainty in noteZh or a feedback explanation rather than inventing a new personal preference. Do not use OPTIONAL POLISH to disguise a reversal of the learner's answer stance.
- FINAL CLEAN-ANSWER QUESTION SATISFACTION CHECK: after drafting cleanRetryAnswers, reread each original question. Each clean retry answer must directly answer that exact question and include a complete reason or detail when the question asks for or naturally requires one. If the learner implies a useful reason but states it unclearly, preserve that meaning and make the relationship explicit without inventing facts. Do not output a grammatically improved answer that leaves a "yes/no" stance unsupported, internally contradictory, or unrelated to the question. Do not preserve unrelated background merely because it is true personal material.
- FINAL GRAMMAR-TEACHING CONSISTENCY CHECK: when an annotation teaches a grammar repair also used in a clean retry answer, combinedRepair, explanationZh, and the clean retry answer must reflect the same grammatical meaning. For an experience extending from the past up to now, do not explain the correction as simple past if the clean retry answer uses present-perfect meaning.
- CONTEXTUAL GRAMMAR CHECK: distinguish a real grammar error from an acceptable tense/style choice. If a reported-speech or story-flow rewrite changes present wording into past wording but the learner's present-state meaning can still be true now, do not turn that stylistic rewrite into a local MUST FIX annotation.
- FINAL ANNOTATION COVERAGE CHECK: compare every clean retry answer against the learner's original answer before returning JSON. Every important locally teachable grammar, collocation, pronoun/reference, agreement, tense, missing-component, article/determiner, singular/plural, preposition, or word-form repair used in the clean retry answer must also appear in annotations when it can be grounded to exact learner wording. Do not annotate deletion of filler, broad compression, or a rewritten sentence unless there is a genuine teachable local problem. Do not add duplicate repair cards, and do not create spelling, capitalization, punctuation, or pronunciation annotations during this check.
- LEXICAL PRECISION CHECK: actively look for words that are grammatically possible but semantically imprecise for the learner's intended meaning, especially role/identity words, place/category words, object names, action verbs, and Chinese-influenced category phrases. Read the whole sentence before deciding whether the issue is real. If the clean retry answer changes such a word or phrase into a more accurate spoken category, create a local annotation with issueType "lexical precision" or "word choice" anchored to the exact learner wording.
- Only mark recurring when the same underlying error pattern appears across multiple answers.
- This is transcript-based. Do not assert pause length/frequency, speed, pronunciation, or delivery quality unless the transcript itself shows visible fillers/repetition/broken structure.
- MUST FIX: every important grammar, meaning, repeated low-level, word-form, collocation, or relevance/control issue. Do not cap meaningful items. Use questionRefs such as Q1 or Q1 / Q3.
- THREAD-LEVEL PATTERNS: return [] for Part 1 topic-thread results. Answer-local development belongs in developmentTargets; material and language assets belong in materialBank.
- ANSWER-BY-ANSWER COACHING: return [] for new results. Per-question retry guidance belongs in cleanRetryAnswers.
- HIGH-IMPACT PHRASE FIXES: return [] in this core pass unless a phrase fix is needed to support a local annotation. The separate part1_learning_assets pass builds the learning expression bank.
- DEVELOPMENT STATUS / DEVELOPMENT TARGETS / SPEAKING MATERIAL BANK: this core pass must not generate learner-facing learning assets. Return developmentTargets [], materialBank.myUsableMaterial [], and materialBank.reusableSpokenLanguage []. A separate part1_learning_assets pass will generate per-answer development, reusable personal material, and the expression bank after cleanRetryAnswers are certified.
- OPTIONAL POLISH: minor low-priority naturalness only; never put serious issues here.
- NEXT RETRY PLAN: return concise grounded actions: one priority accuracy pattern, one answer-length/focus rule, and one useful expression or personal material item to try naturally next time. Do not advise more complexity when the problem is overexpansion. If developmentStatus is "needed", the plan must say that core accuracy may be stable but answer development limits the current result. This is a training blocker for topic completion, not a red grammar error, and must not demand long prepared responses.
- NEXT RETRY FOCUS: keep as a compact legacy summary of nextRetryPlan.
Current estimate is a low-key topic-session training estimate under ideal delivery: assume the current answer can be spoken naturally and clearly. Base it on the learner's current submitted answers, not on your cleaner answers or Material Bank. Do not repeat pronunciation or full-test disclaimers in the visible rationale. Absence of MUST FIX does not automatically justify 6.5-7.0 or 7.0+ if the answers are consistently thin or show limited language range. Accurate but very concise answer sets should keep a numerical practice estimate, but the estimate must be conservative and the rationale should say in concise Chinese that the language is accurate but there is not yet enough real-detail development / language range. Natural Part 1 answers do not need to be long: direct answer plus one relevant detail/reason is sufficient for many questions. If you return a higher range, the rationale must cite actual evidence from the submitted answers: specific personal details, natural elaboration, flexible but spoken-appropriate wording, or coherent direct answers. Never return "no issues" plus no optional improvement path while lowering the estimate only with vague simple-vocabulary reasoning. If evidence genuinely straddles two adjacent half-bands, return a bandEstimateRange with exactly one half-band step, for example 4.5-5.0 or 5.0-5.5, never a wider range.
Return speakingCeilingDiagnosis as a concise Chinese teaching diagnosis. Part 1 ceiling is not abstract depth; it is natural, direct, specific conversation control. whyNotLowerZh should name what is already stable, whyNotHigherZh should name one real ceiling such as thin detail, template-like phrasing, over-expansion, limited range, or accuracy issues, and nextBandTriggerZh should give the smallest next retry move. Use 1-2 ceilingTags only. Do not invent an official Part 1 score rubric.`;

export const speakingPart1LearningAssetsInstruction = `This is the independent IELTS Speaking Part 1 learning-assets pass.
The core Part 1 analysis has already produced annotations and certified clean retry answers. Do not rescore, do not rewrite clean answers, do not create annotations, and do not discuss internal diagnostics.
Return operation exactly "part1_learning_assets".

Think like a strong IELTS Speaking coach responding to this exact Part 1 topic thread. Read the exact topic, each question, the learner's original answer, the clean retry answer, and annotations. Then produce the learning assets that should appear under the result UI.

Use this private workflow before writing JSON:
1. Internally brainstorm 20-30 useful spoken-language candidates for this exact topic thread, as if a Chinese IELTS learner asked: "在这样的 Part 1 topic 下，有哪些 7 分以上也实用、不小众、不文绉绉的口语表达？"
2. Group the candidates by the real semantic jobs in the questions and answers: preference/taste, frequency, past-vs-now change, reason, budget, shopping channel, comfort/function, identity/object category, feeling, contrast, habit/routine, or any better categories that fit this topic.
3. Remove items that are too easy, too obscure, too essay-like, too long, or already said by the learner.
4. Fill developmentTargets and reusableSpokenLanguage from the best remaining candidates. The final JSON must reflect this candidate-generation work; do not return the first few obvious phrases that come to mind.

Per-answer DEVELOPMENT:
- Return exactly one developmentTargets item for every submitted answer.
- For each question, decide the real coaching job: add one on-topic angle when the answer is too thin; upgrade wording when the content is already enough; tighten the direction if the learner's detail drifts away from the question.
- Part 1 development is answer-level coaching, not a phrase bank only. When the answer is a bare one-sentence reply, developmentMoveZh must name the missing conversation move: direct answer + one reason/detail/contrast + natural stop. Keep it compact; do not ask for a Part 3-style explanation.
- developmentTargets are not the correction area. Do not put grammar fixes, local error repairs, source -> replacement pairs, or labels such as "fix", "correct", "replace", "instead of", "修正", or "替代" here. Those belong only in annotations and cleanRetryAnswers from the core pass.
- If a wording improvement is already used as a correction in annotations or the clean retry answer, do not repeat that repair as a development chunk. Instead give alternative topic-useful expressions that are not framed as learner errors.
- Correct but plain learner wording still deserves development. Notice reusable plain phrases in the learner answer and offer natural alternatives that preserve the same semantic job: interest, preference, degree, time/change, reason, contrast, habit, feeling, identity, or condition. Do not copy stock idioms mechanically; generate wording from the actual topic and answer.
- phraseChunks are the payload. Give 6-10 chunks per answer. Each chunk should be a reusable spoken corpus block, not a full answer and not a bare noun. Combine verbs with objects, adjectives with concrete nouns, collocations, or short sentence frames.
- It is useful to give several natural ways to express the same learner meaning. For each answer, include at least 2-3 alternative phrasings for the learner's own plain wording when possible, plus 2-4 topic-adjacent chunks the learner did not say.
- Do not answer with only one chunk such as "Handmade gifts have a special charm." If one chunk is useful, add nearby alternatives and continuations: a feeling chunk, a reason chunk, a contrast chunk, and a more natural replacement for one plain learner phrase.
- purposeZh should be a short Chinese concept label, not a long instruction.
- Make chunks question-specific. Do not paste the same set into every answer unless the exact meaning genuinely repeats.
- For each answer, include both kinds when possible: anchored upgrades for wording the learner already attempted, and topic-adjacent chunks the learner did not say but could use in that answer. Do not leave a submitted answer without development just because the clean retry answer is grammatically acceptable.

Reusable MATERIAL:
- myUsableMaterial is for reusable personal answer material derived from the learner's own answer. It may be a polished stance, preference, reason, contrast, habit, feeling, fact, or short answer angle; it does not require a time/place/event/person.
- When the learner's answer is short but has a clear anchor such as a hometown, city, activity, preference, family reason, or role, you may create useful topic-anchored material around that confirmed anchor. It does not need to be a literal paraphrase of the original sentence. For example, a confirmed hometown/city may support a richer hometown answer angle. Do not mark it "pending confirmation"; the UI lets the learner delete items they do not want.
- Do not invent highly specific personal experiences, exact routines, dates, people, private facts, or emotions that are not reasonably suggested by the answer/topic. Keep generated material plausible, topic-relevant, and anchored to confirmed nouns/stances from the answer.
- Do not put the learner's original sentence or the clean retry sentence into developedExample unchanged, even when it is already correct. Paraphrase it, lightly expand it without inventing facts, or express the same idea in a more polished way.
- Each material item displayed to the learner must have developedExample as one polished English sentence or compact short paragraph, and translationZh as the Chinese translation/meaning of that English material. If you also fill explanationZh, it must be the same translation-like meaning, not a usage note.
- For every submitted answer with a recoverable stance, preference, reason, habit, feeling, fact, or answer angle, normally return at least one myUsableMaterial item. Use the clean retry only as meaning evidence; the displayed developedExample must be a new polished version, not a copied clean answer.
- developedExample must not start with disposable response lead-ins such as bare yes/no/absolutely/definitely/of course/not really. Preserve the real stance inside the sentence instead, for example through prefer, avoid, enjoy, tend to, would rather, or usually.
- Do not store raw transcript fragments or Chinese usage notes as explanationZh/translationZh. Do not write Chinese like "this phrase can be used for..." or "on the basis of..."; write the Chinese meaning of the displayed English material. Return [] only when the answer is blank, nonsensical, or has no recoverable learner meaning.

Reusable SPOKEN LANGUAGE:
- reusableSpokenLanguage is the current-topic expression bank. Return 12-20 useful current-topic spoken chunks whenever possible; 10 is the minimum for a normal Part 1 topic thread.
- Include the strongest phraseChunks from developmentTargets, then add more current-topic language that the learner did not say but could use for nearby Part 1 questions under the same topic.
- The learner may not have said these chunks. They should be tightly relevant to the current questions and useful for IELTS Part 1, with a mix of solid mid-level chunks and several natural/native-sounding but not obscure chunks. Think "useful 7+ spoken corpus", not rare literary vocabulary.
- Prefer corpus-like chunks and frames that a learner can actively reuse. Avoid plain words, complete model answers, and phrases already used by the learner or already shown in cleanRetryAnswers/material.
- Good expression-bank items can be compact first-person spoken frames when the frame itself is reusable and richer than the learner's wording. Prefer topic-shaped wording for preference, change, reason, comparison, habit, condition, and evaluation instead of stock idiom lists.
- Prefer canonical reusable frames over filled first-person examples: use base forms, noun phrases, or slots such as "be into sth", "be keen on sth", "spend time doing sth", "a lifelong pursuit", "bring sb joy and satisfaction", "not be one's cup of tea", "one's main pastime", not full personal sentences like "I'm really into [doing something]" or "It brings me immense joy".

Quality self-check before returning JSON:
- Every answered Q has a developmentTargets item with at least 5 meaningful phraseChunks.
- reusableSpokenLanguage has at least 10 current-topic items unless the topic is genuinely too narrow; if fewer, explain why in rationaleZh.
- No item comes from a different topic merely because the transcript mentions family, hometown, school, hobby, gifts, places, or work.
- No item is a machine placeholder such as "a specific reason", "a small detail", or "what matters to me most".
- Materials are polished English plus matching Chinese meaning, not raw transcript storage.`;

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
Current estimate: this is an ideal-delivery training estimate. Assume the current answer can be spoken naturally and clearly, and do not repeat pronunciation or full-test disclaimers in learner-facing rationale. If the answer clearly fits one half-band, return a single bandEstimateExcludingPronunciation and omit bandEstimateRange or set it to null. If the evidence genuinely straddles two adjacent half-bands, return bandEstimateRange as an object with lower, upper, and rationaleZh, with exactly one half-band step, such as { "lower": 5.5, "upper": 6.0, "rationaleZh": "..." }. Do not return bandEstimateRange as a string. Do not use a range as a generic uncertainty escape hatch. Never return placeholder range objects, identical lower/upper values, lower/upper values outside 1.0-9.0, or ranges wider than one adjacent half-band step.
Global target policy: keep the current estimate honest and conservative. Target answers / improved answers / model answers are pedagogical practice answers, not certified score guarantees. If the learner's current lower bound is below Band 7.0, generate a complete, natural, learnable Band 7 target answer with a clear margin over the original while preserving useful personal material. If the current lower bound is at or above 7.0 but not high-band-stable, generate a more mature Band 7+ target answer that improves precision, naturalness, development, and delivery, but do not label it Band 8+. If the current answer is already high-band-stable, switch to high-band stability. Do not inflate the current estimate to match the target. Do not label any learner-facing output as Band 8+, Advanced, Verified, Not Verified, or Band 9. Do not make stronger target answers more formal, more academic, or more essay-like by default; stronger means clearer logic, more precise language, stronger idea development, better examples, more natural flow, and examiner-friendly execution.
Score consistency: pronunciation is not assessed and must never be treated as a hidden reason for lowering the headline estimate. If bandEstimateExcludingPronunciation is lower than all three visible criteria, either lower the relevant visible criterion or make estimateRationaleZh name a real cap such as insufficient sample, off-task content, overlong Part 1, essay-like Part 3, or malformed answer. If all visible criteria are 7.0 and there is no cap/fatal issue, the headline estimate should not be 6.5.
Ceiling diagnosis: return speakingCeilingDiagnosis as a teaching diagnosis, not an official separate Part 1/2/3 score. Explain three things in concise Chinese: why the answer is not lower, why it is not yet the next stable level, and the smallest next-band trigger. Half bands mean the answer stably meets the lower whole band and shows some features of the next band, but not consistently. Do not mechanically ask "why not 8.0"; if the learner is around 6.5, explain the trigger for stable 7.0; if around 7.0, explain 7.5 or 8.0 only when evidence justifies that boundary.
High-band ceiling lens: do not cap coherent, relevant, mostly error-free, flexible answers at 7.0 by default. Decide whether the visible text is: correct but still too written or not spontaneous enough; stable 7 with some 8-like precision; an 8.0 candidate with flexible, natural, mostly error-free language; or a rare 8.5+ candidate with near-full flexibility and precision. Use only 1-2 ceilingTags that actually explain the current ceiling. textOnlyNoteZh is a quiet product premise, not a disclaimer to repeat on the result page.
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
- Part 1 ceiling is about natural, direct, specific conversation control. Do not reward over-developed or abstract essay-like answers merely because the grammar is good.
- If the learner gives a thin but meaningful answer, the cleaner answer should not stop at a grammar patch. Keep the real material and make it sound like a short conversation by adding a safe reason, feeling, concrete detail, or small contrast that is already implied by the answer. If the needed detail is not implied, use a bracketed starter rather than inventing a fact.
- Run a semantic-fit check on examples and categories before finalizing. A grammatically correct answer can still be wrong or awkward if the example does not fit the category, such as a film/book being treated as a TV series, a console/mobile game being called a PC game, or a character/work title being used as the show category. Repair the category conservatively without inventing facts.
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
- Part 2 ceiling must consider narrative control: timeline, scene detail, concrete action, emotional turn, cue-card coverage, and ending. Do not score only by grammar.

Part 3 rules:
- Abstract discussion, but face-to-face spoken answer, not Writing Task 2 spoken aloud.
- upgradedAnswer should normally be 4-6 spoken sentences, about 35-60 seconds.
- Use natural spoken discussion logic: direct position -> reason/contrast/condition -> example -> consequence/wider meaning.
- Band 7 Part 3 has a clear position, reason/contrast, example, and consequence. Band 7+ Part 3 has stronger cause/effect, more nuanced contrast, better examples, and more natural spoken transitions.
- A stronger Part 3 target should have spoken reasoning depth: claim, condition or contrast, example or observation, consequence, and natural discussion rhythm. Do not make it sound like Writing Task 2.
- Prefer spoken bridges such as "I'd say...", "I think...", "It really depends...", "One major change is...", and "A good example would be..."
- Avoid writing-style connectors and essay phrases such as "Furthermore", "Moreover", "Consequently", "It is universally acknowledged that", and "In contemporary society".
- Part 3 ceiling must consider whether the answer can generalize beyond personal experience, explain why/how, compare groups, use condition/concession, and discuss consequences, changes, or future. If an answer is mostly personal preference, diagnose it as too Part 1-like even if the grammar is good.
- If the original answer already has a position and example, do not give generic advice like "add an example"; identify the real issue, such as grammar, word form, pronunciation-transcript error, weak cause/effect, weak consequence, unclear comparison, or spoken clarity.
- Before finalizing any Band 7+ upgradedAnswer for an already-7.0 learner, self-check whether it clearly improves idea development, precision, organization, and naturalness without making it essay-like.`;

export const speakingTranscriptEvidenceInstruction = `Shared spoken-transcript feedback contract for all Speaking parts:
- Treat the ASR transcript as evidence of spoken language, not as an essay draft. The learner may have spoken with normal pauses, restarts, fillers, and no visible punctuation.
- Before selecting visible feedback, build an internal full candidate list of meaningful spoken-language issues across the whole answer or thread. Then choose the visible items by stable teaching priority: prompt/task mismatch or meaning breakdown; broken sentence/clause structure; recurring grammar or word-form pattern; high-impact collocation/word choice; sentence-control/run-on clarity; then optional spoken naturalness. Do not let the display budget show only the first obvious errors while missing later, higher-impact errors.
- For a Part 1 single-question answer around the mid-band range, do not stop after one minor preposition or wording issue when the answer also has visible opener, article/determiner, tense/modal, collocation, weak reference, or closing-formula problems. Return a compact but complete set of the highest-value items across fatalErrors and naturalnessHints, usually 3-5 items when the transcript has enough stable wording.
- Mandatory scan lanes for every answer before selecting visible items:
  1. sentence skeleton: missing subject/verb/complement, broken "the reason is that..." clauses, run-on answers that need spoken chunking;
  2. verb and noun collocation: wrong action + object pairs, wrong adaptation/source direction, wrong library/service/action wording, wrong access/distract/benefit patterns;
  3. noun form and countability: plural uncountables, "one of the ... way", schoolwork/work, fiction/novel/work distinctions;
  4. translated-sounding chunks that affect spoken naturalness: facility/service labels, electronic product/device wording, accident/conducive/indoor relaxation style phrases;
  5. part-task fit: Part 1 directness and personal specificity, Part 2 story timeline and cue-card spine, Part 3 generalisation, comparison, category scope, solution layers, and reasoning depth.
- Semantic precision beats easy grammar spotting. Prefer the issue that changes meaning or spoken clarity over a smaller article-only fix. Common high-impact patterns include: photo subject prepositions ("take photos of me", not "for me" when the person is the subject of the photo); camera "flash" vs "flashlight"; adaptation relation ("TV dramas are adapted from these stories", not "originate from them"); access structure ("people have access to books", not "people are accessible to books"); domain noun choice ("technology" for digital devices, not generic "science"); and passive/device-use endings such as "it depends on how people use them."
- SourceQuote span must be the smallest complete span that can be replaced without leaving the original sentence broken. If fixing only the inner word would leave bad grammar around it, widen the quote to include the surrounding frame: time transitions with adjacent adverbs, subject + non-finite verb phrases, and "when + subject + verb" clauses should be repaired as a whole.
- Visible feedback is allowed to be selective, but it must be selective after this scan. Obvious high-impact items in later sentences should not disappear merely because earlier low-level errors used the budget.
- Every visible repair must quote exact learner wording that appears in the submitted transcript. If a useful note cannot be anchored to exact source text, keep it out of fatalErrors, naturalnessHints, annotations, and other learner-facing repair arrays.
- Do not mark transcript-only artifacts as learner errors: capitalization, punctuation, spacing, proper-noun casing, book/title casing, ASR line breaks, spelling-only forms that cannot be confirmed in speech, or light fillers/restarts such as "well", "yes", "I think", "you know" when they are not excessive.
- Still mark audible language problems that affect clarity, accuracy, or naturalness: missing sentence components, malformed clauses, subject-verb agreement, tense, articles/determiners, singular/plural and countability, word form, preposition, collocation, word choice, Chinglish noun/verb phrases, and unclear long sentence control.
- A correction must be a complete natural spoken repair for that local issue. If the learner's phrase has both grammar and word-choice/collocation problems, fix both in the same repair instead of making a minimal grammar patch that leaves unnatural English. Prefer one clean repair over slash-separated alternatives.
- Explanations should be spoken-use oriented, not grammar-label oriented. Briefly say what the learner is trying to express, why the current wording is unclear or unnatural, and give the natural spoken version. Avoid explanations that only say "missing that", "word order", or "nominalization" when the real issue is the wrong collocation, wrong meaning relation, or too-written expression.
- Do not solve this by memorized blacklists. Infer the intended meaning from the question, part, and answer context. If a phrase is probably an ASR ambiguity rather than stable learner wording, skip it or mention it only as a low-priority check, never as a hard MUST FIX.
- Apply the same evidence standard across Part 1, Part 2, and Part 3. The teaching surface differs by part, but the definition of a real spoken-language problem is shared.`;

export const speakingProfileCapsuleInstruction = `Speaking Profile Capsule policy:
- If input.speakingProfileCapsule is present, treat it only as soft local context from previous Speaking practice records.
- Do not rebuild the whole report around the profile. The current transcript remains the primary evidence.
- Mention a recurring profile pattern only when the same issue appears in the current attempt. Keep the mention short and practical.
- Do not claim "always" or "never"; use cautious wording such as "this looks similar to a recent pattern" when relevant.
- Do not recommend expressions listed in masteredExpressions or speakingProfileCapsule.masteredExpressions as new range-building upgrades. If the learner uses a mastered expression incorrectly, correct the current misuse as an anchored issue, but do not teach it as a new asset.
- For overused chunks, respect the canonical field. For example, "be into sth" is the chunk; intensifiers such as "really" are modifiers and must not become part of the canonical chunk.`;

export const speakingPart3DiscussionFeedbackInstruction = `Part 3 discussion-thread feedback contract:
- Apply this only when sessionKind is "part3_discussion_thread". For Part 1 and Part 2, set part3Feedback.answers to an empty array.
- part3Feedback is the learner-facing source for Thinking Diagnosis, question frame, topic-bound language, and the final per-question Next Speakable Answers. Do not make the UI infer these from fatalErrors, naturalnessHints, band9Refinements, preservedStyle, or the generic upgradedAnswer.
- Feedback order must be answer-level diagnosis first, sentence-level repair second, and phrase-level annotation last. If the answer mainly fails because of scope, question type, comparison logic, solution layers, or overpacked sentence control, part3Feedback must say that clearly even when fatalErrors/naturalnessHints also contain useful local repairs.
- Return exactly one part3Feedback.answers item per submitted threadAnswers item, in the same order, with questionRef values Q1, Q2, Q3.
- Classify each questionFrame from the question's real demand:
  cause_reason = why / causes / reasons;
  change_trend = change over time;
  evaluation_stance = do you think / agree / should / likely / value judgment;
  comparison_contrast = compare two groups, periods, choices, or priorities;
  advantages_disadvantages = benefits and drawbacks;
  solution_suggestion = what should/can X do, improve, solve, encourage, protect, reduce;
  category_criteria = types, kinds, qualities, criteria, what makes X;
  consequence_impact = effects, impact, influence, results.
- First diagnose the learner's current answer, then decide the single main issue type from evidence:
  language_repair = grammar, collocation, or sentence structure affects clarity or naturalness;
  reasoning_upgrade = there is a position, but the reason, support, condition, contrast, or consequence is shallow or broken;
  part3_generalisation = the answer is too Part 1-like and stays around I/my experience instead of people, families, society, groups, or modern life;
  answer_scope = the question asks for types, kinds, categories, criteria, qualities, or "what makes X", and the answer names too few categories, uses too narrow a scope, or misses the requested classification;
  precision_upgrade = the answer is basically good, but wording is vague, generic, or not exact enough;
  compression_upgrade = the answer is complete but too long, written, over-explained, or hard to say naturally;
  nuance_upgrade = the answer is too absolute and needs a condition, concession, or "it depends" boundary;
  micro_upgrade = use only when the main move is a tiny delivery polish and none of the more specific issue types above is a better fit.
- Do not use a hard band threshold for feedbackMode. A learner can have good logic with grammar issues, or strong language with weak reasoning. Pick the mode from the answer evidence.
- Answer-control priority comes before local synonym polishing. If the answer opens with an absolute stance but the support actually argues for a balanced stance, diagnose the stance/control problem and rebuild the first sentence before polishing words. For evaluation questions, prefer a clear spoken position such as "They should value X, but not rely on it alone" when that matches the learner's real meaning.
- Question-frame priority comes before local wording. For category_criteria questions, diagnose answer_scope when the learner gives only one category or one narrow example. For solution_suggestion questions, diagnose whether the answer should split into two clear solution directions before repairing individual collocations. For comparison_contrast questions, diagnose the comparison dimension and the contrast logic before polishing local phrases.
- Severity layering matters. Do not label every unnatural word as MUST FIX. Reserve priority repair for stance/control failure, meaning breakdown, broken sentence skeleton, grammar that affects score, or a phrase that makes the answer unclear. Put acceptable-but-less-natural wording in better spoken choice, and keep optional polish out of the main path.
- When a sentence has several linked serious issues, use one sentence-level repair in the diagnosis or microUpgrade instead of scattering many tiny fragments. Local fatalErrors may still anchor the most representative source phrases, but the learner-facing Part 3 path should show the rebuilt spoken sentence.
- If a learner's sentence is a long chain of "there are two ways... the first... government should... the second...", microUpgrade should show the simplified spoken skeleton, not only individual phrase replacements.
- In each Part 3 thread, sessionPriorityZh should name the top learning path across questions, not just "fix grammar." Prefer priorities such as stance control, signal-vs-guarantee reasoning, sentence-level repair, or reducing repeated topic words when those are the real issues.
- Do not create separate "student mode" and "teacher/high-band mode". Decide per answer inside the same thread; Q1 can need language repair while Q2 only needs a micro-upgrade.
- Learner-facing diagnosis and guidance fields must be concise Chinese. English section titles are fine, but explanations should not become long bilingual paragraphs.
- thinkingDiagnosis is the main teaching surface. Use the new learner-facing fields first:
  questionThinkingZh = "这题怎么想": explain the question frame and thinking task, not praise. This must come before language repair. For category questions, say it needs 2-3 categories; for solution questions, split solution layers; for comparison questions, name the comparison dimension.
  retainedIdeaZh = "保留你的思路": one short Chinese line naming useful learner material worth keeping. Keep it compact.
  upgradeRuleZh = "升级规则": name the repair theme or thinking move, not a copied list of all local annotations. For language_repair, summarize the pattern category, such as Chinglish noun phrases, broken sentence skeleton, wrong access/adaptation collocation, or sentence control. Put detailed source -> repair pairs only in fatalErrors/naturalnessHints, not here, unless one phrase is the whole answer-level blocker.
  reusableFrameZh = "可迁移句型": one short Chinese note about how the English frame can transfer. Prefer notes like "把 X 换成 home cooking / family meals / reading / using libraries" rather than long explanation.
  reusableFrame = natural English sentence frame with A/B/C or X placeholders. This is the reusable pattern shown in Thinking Diagnosis, not a finished model answer. Do not use square-bracket prompt syntax like "[some people]" or "[reason]". It must look like learner material, not backend instructions.
  Keep legacy whatWorksZh/mainCeilingZh/bestNextMoveZh only as compatibility summaries if useful; do not rely on them as the main teaching surface.
- If an answer starts from "for me", "personally", "my family", or another personal-only frame and does not quickly generalise, diagnose it directly in Chinese: "这听起来太像 Part 1，需要立刻泛化到人群、社会场景或现实原因。" Do not soften this as merely "personal but universal".
- Even in language_repair mode, the final targetAnswer must still answer as Part 3. Preserve the learner's usable stance, but generalise beyond the personal view in the first sentence or immediately after it. For example, move from "for me" to groups such as working adults, busy families, children, older people, audiences, schools, media, or modern city life when semantically relevant.
- For answer_scope, the diagnosis must name the missing scope: categories, examples, criteria, groups, or qualities. The reusableFrame should teach a transferable classification pattern such as "People tend to choose a mix of A, B and C, depending on X." The targetAnswer must add concrete categories or criteria, not just say "a wide variety".
- For comparison_contrast, the diagnosis must say what two groups/times/situations are being compared and whether the answer has a balanced contrast, a condition, or a consequence. If the learner's idea is "technology can distract but can also help", targetAnswer should preserve that nuance in natural spoken wording.
- ctChain is a compact support structure, not a generic ideal outline. It should reflect the learner's answer and the needed next move. Fill claim, reason, exampleOrEvidence, contrastOrCondition, consequence only when useful. missingLinkZh and nextMoveZh should name the weakest logic link and next thinking move in Chinese.
- targetAnswer is the final Next Speakable Answer shown after diagnosis. For weak answers, it can be a full 4-6 sentence spoken answer. For stronger answers, prefer a shorter, more spoken micro-version that keeps the same logic instead of expanding into essay prose.
- For high-quality answers, keep the learner's logic and improve delivery only. Do not add more content just to look advanced.
- microUpgrade is a compact optional repair move for provider compatibility. It must not become another full answer or duplicate targetAnswer. Prefer a short sentence skeleton, contrast move, or corrected phrase; the UI primarily teaches the reusableFrame and final targetAnswer.
- Never put square-bracket placeholders in microUpgrade or targetAnswer. Bracket placeholders belong to backend prompts, not learner-facing material.
- For part3_generalisation, microUpgrade must not re-center the answer on "I / for me / personally". If preserving the learner's stance, convert it into a group contrast, e.g. busy people vs people who enjoy cooking, older people vs younger people, parents vs children, audiences vs performers. The sentence should sound like Part 3 discussion, not Part 1 personal preference.
- For answer_scope, microUpgrade must add actual categories, criteria, or groups. Do not return a generic line like "young people read a wide variety of books" unless it names the categories.
- Invalid Try this examples: "In my opinion, yes.", "Overall, I think...", "I'd say nowadays, young people read a wide variety of books.", "It depends on the situation." These are too generic unless they contain the actual repair, category, reason, contrast, or corrected phrase.
- Good compact repair rules by issue type: language_repair must include the corrected structure or phrase; part3_generalisation must move from I/my view to a group or wider context; answer_scope must include concrete categories or criteria; reasoning_upgrade must add a reason, contrast, example, or result; compression_upgrade must keep the key logic but make it shorter and more spoken.
- For compression_upgrade, precision_upgrade, nuance_upgrade, and micro_upgrade, targetAnswer must be shorter, more spoken, and easier to deliver than a full rewrite: normally 4-5 short sentences or about 20-30 seconds. Avoid formal essay diction such as "several compelling reasons", "enduring popularity stems from", "fundamentally about fostering", "whenever feasible", or similar inflated wording unless the learner already used it naturally and it fits spoken delivery.
- targetAnswerHighlights must quote exact substrings from targetAnswer. Use 1-3 highlights only. For micro_upgrade, prefer at most 2 highlights. Avoid visually over-marking nearly every clause.
- Before final JSON, run a language-quality pass over reusableFrame, microUpgrade, targetAnswer, and topicLanguage. Avoid non-native chunks such as plural uncountable nouns, reversed adaptation direction, Chinglish facility/software labels, and inflated essay diction. Prefer spoken collocations such as "classic Chinese novels", "traditional Chinese fiction", "be adapted into TV dramas", "library facilities", "library services", "digital distractions", and "get distracted by" when semantically appropriate.
- Before final JSON, compare targetAnswer with the original Part 3 transcript. If targetAnswer fixes a high-impact local phrase such as a wrong book category, adaptation relation, access structure, digital-device wording, technology/science noun choice, indoor/at-home phrase, example frame, or passive device-use ending, include that sourceQuote in fatalErrors or naturalnessHints when it can be anchored exactly.
- topicLanguage is a material bank, not another frame bank. It must contain only expressions that can fill the reusableFrame or targetAnswer for the current question set. Avoid broad category leakage: do not add technology/education/government language unless the questions themselves require that domain. Default to 2-3 compact sections. If the three questions cover distinct subtopics, use one section per question. Each section should contain 4-6 items; total topicLanguage should normally be 12-18 items, with a minimum of 8 useful items and a maximum of 20. Each item must include expression and a very short meaningZh. Use short Chinese section titles such as 书籍类型, 图书馆改进, 代际比较. Avoid long explanatory noteZh.
- Do not solve leakage by blacklists. Solve it by semantic fit: every topicLanguage item must help answer at least one of the current questions.
- Keep local learner-wording errors in fatalErrors/naturalnessHints for overlay. Keep broader topic vocabulary or reusable macro wording out of overlay; part3Feedback should focus on question frame, logic chain, and the target answer.`;

export const speakingFeedbackDepthInstruction = `Avoid endless sentence-level nitpicking, but do not make low/mid-band feedback sparse.
Low-noise feedback means layered, high-impact, and readable feedback, not little feedback.
Silent coverage pass before selecting displayed feedback: for any substantial low/mid-band answer, first scan the transcript clause by clause for clear high-impact problems. Check especially narrative tense consistency, subject-verb or clause-form errors, articles/determiners, malformed noun phrases or word order, high-impact awkward phrasing/collocation, and important task/cue-card coverage gaps for the relevant Part when they materially weaken the response. Then output the meaningful fixes without nitpicking trivial slips or likely ASR noise.
Coverage must be stable across replays. It is acceptable that two runs choose slightly different wording, but it is not acceptable for one run to expose the main teachable issues and another to show only one or two easy local fixes for the same low/mid answer. Always select after the full scan, not while reading left to right.
Classification rule: clear grammar errors must go in fatalErrors / MUST FIX, not only in naturalnessHints. This includes present tense inside an explicitly past narrative, missing articles in specific noun phrases, malformed non-finite clauses where a finite verb is needed, tense mismatch in a past narrative, subject-verb errors, article/determiner errors, clause-form errors, and malformed noun phrases. naturalnessHints are for understandable but non-fatal wording improvements, collocation upgrades, or smoother spoken phrasing.
Coverage rule: do not omit a separate unrelated clear grammar, word-form, collocation, or sentence-control problem merely to keep the page short. If one longer correction clearly covers linked errors, return one card explaining both; otherwise keep separate unrelated high-impact issues separate. Do not duplicate cards for the same underlying phrase. If the transcript has many issues, group recurring patterns through a representative span, but still include later high-impact problems when they are more important than earlier minor ones.
Correction depth by current estimate:
- Below 6.5: select about 5-8 high-impact visible correction items across fatalErrors and naturalnessHints when the transcript has enough material. Include at least 3-5 original phrase fixes if the answer contains enough stable wording. Use fatalErrors for clear grammar, collocation, word-choice, tense, or meaning problems that can affect IELTS score. Use naturalnessHints for important spoken phrase upgrades that are not fatal but would noticeably improve LR/GRA/FC. Do not list trivial slips, but do not hide obvious high-impact issues just because they occur later in the answer.
- 6.5-7.5: return fewer but still meaningful targeted fixes, focused on precision, coherence, spoken naturalness, and idea development.
- 8.0+ or high-band stable: keep feedback concise and do not force many corrections.
Do not invent errors. Do not correct every tiny spoken imperfection. Do not mark isolated likely ASR artifacts as definite grammar errors. If a phrase could be ASR, either avoid making it a Must Fix or phrase the explanation as "check this phrase". Functional-word homophones such as will/well, went/but, and of/off should not be heavily penalized unless repeated or meaning-breaking.
Do not skip original sentence or phrase problems just because the target answer rewrites or omits them. For each major fatalError or naturalnessHint, make explanationZh include a short target-link when useful, for example "Target answer uses this as: ..." or "Target answer rebuilds this idea as: ..." or "This phrase was omitted because ...".
Target answer linkage: upgradedAnswer must visibly apply the most important fixes from fatalErrors and naturalnessHints while preserving useful personal material. For a power-cut story, for example, use natural spoken repairs such as "the power went out", "everything went pitch black", "find a lighter and light some candles", and "the electricity company" where those ideas come from the learner.
band9Refinements must quote or reference exact learner wording in observation or explanationZh, otherwise the UI grounding filter may remove the item. Use this field for grounded idea/expression upgrades, not generic advice.
preservedStyle must explain what material is worth keeping and how it was rebuilt. For Part 2, keep concrete personal material such as childhood power cut, home alone, fear, TV/Ultraman, monsters/darkness, and calling parents when present, then explain how to rebuild scattered details into a story spine. Do not make upgradedAnswer a totally unrelated model answer.`;

export const speakingTeacherQualitySelfCheckInstruction = `Final teacher-quality self-check before returning Speaking JSON:
- Judge your own feedback as a demanding IELTS speaking teacher, not as a schema filler. If the learner answer has several important teachable issues, the visible feedback must not stop at one easy minor correction.
- Compare upgradedAnswer against the original transcript. If upgradedAnswer changes a local learner wording problem, that problem should normally appear in fatalErrors or naturalnessHints with exact original wording, unless it is only broad compression or harmless style.
- For Part 1 single-question answers, use fatalErrors for true accuracy problems and naturalnessHints for important spoken choices. Also use preservedStyle and/or reusableExample when the answer contains concrete reusable material, such as a habit, preference, reason, activity, person, place, or feeling. Do not make the learner infer all learning value only from upgradedAnswer.
- For Part 1, a mid-band answer with stable wording should normally expose a compact learning loop: score rationale, anchored local repairs, a cleaner compact answer, and at least one reusable material/expression when the transcript contains useful material.
- For Part 1, self-check that the cleaner answer actually answers the question with natural conversation control. If the answer is thin, the cleaner should normally include direct answer plus one reason/detail/contrast; if a named example does not fit its category, repair the category rather than keeping a grammatical but false pairing.
- For Part 2, do not route six-signal or story-module teaching into generic fatalErrors/naturalnessHints. Use part2Feedback as the source of truth.
- For Part 2, self-check the selected annotations against the story skeleton: setup, instruction or situation, key action, turning point/problem, help/solution, and ending. A low/mid story with many audible language problems should not end up with only two local word repairs unless the rest is genuinely stable.
- For Part 3, do not only repair grammar when the bigger issue is answer scope, generalisation, comparison, condition, consequence, or reasoning control.
- For Part 3, self-check the top priority path before returning JSON: stance/control first, then sentence skeleton and reasoning, then lexical variety and spoken naturalness. If the feedback contains many local repairs but no clear top-three path, revise it.
- Do not output internal self-check wording. Revise the JSON silently if this self-check fails.`;

export const speakingPart2NativeFeedbackInstruction = `Part 2 native feedback contract:
- For Part 2, part2Feedback is the learner-facing source for anchored transcript annotations, material type judgment, story modules, the six language signals, and the next speakable version. Do not make the UI infer those from fatalErrors, naturalnessHints, band9Refinements, or preservedStyle.
- Feedback order must be cue-card / answer-architecture diagnosis first, story-module repair second, and local annotation third. If the learner has good material but weak organization, priorityFocusZh must say that instead of making the result look like only a phrase-correction page.
- For Part 1 and Part 3, set part2Feedback to null.
- First classify materialType as person, place, object, experience_event, abstract_or_opinion_experience, or unclear.
- Before selecting annotations, identify the Part 2 route the answer needs: what it is/who it is, how long or when relevant, what it contains or what happened, how the learner's feeling changed, and why it matters. For object/old-thing cue cards, explicitly check whether the answer makes clear what the object is, who kept it/how long, what is inside or what it looks like, and why it has emotional value.
- annotations must be provider-native anchored annotations for necessary local repairs only: copy exact learner wording into sourceQuote, choose severity, and explain why that span deserves repair. If a note cannot be anchored to the learner's words, do not put it in annotations.
- Use must_fix only for issues that materially affect score, story clarity, meaning, or timeline control. Use better_spoken_choice for useful but non-fatal improvements. Use optional_polish sparingly.
- Do not use annotations for answer-building strategy, generic opener directness, richer story frames, low-yield polish, or language-signal enrichment. Route those to storyModules or languageSignals only. A clearer opener is usually not an annotation unless the original wording creates real confusion.
- Annotation selection must be stable for the same transcript. First make an internal full candidate list, then choose the visible annotations by this priority order: meaning/story/timeline-breaking must_fix issues; recurring grammar patterns; high-impact lexical precision/collocation; then optional spoken polish. If two candidates have similar value, keep the earlier sourceQuote in the transcript. Do not alternate between equally minor candidates across retests.
- Story skeleton beats isolated word spotting. In a narrative, prioritise phrases that carry the story logic: how the situation began, what someone told the learner to do, what the learner did next, how the problem happened, who helped, how it ended, and how the learner reflects on it. A broken key action sentence is higher priority than a small local wording issue.
- Annotation volume must adapt to the learner level and error density, but stay within a stable visible budget. For mid/high-band answers, prefer 0-3 high-signal annotations over many phrase cards. For 5.5-6.0 style answers, normally return 4-5 anchored repairs. For low-band or structurally unstable answers, return up to 6 anchored repairs and group related layers inside the same sourceQuote where possible. If one sentence repeatedly misses past tense, agreement, articles, word forms, or basic sentence structure, show the recurring pattern through a representative span or a grouped annotation rather than a different random set each pass.
- If a key story sentence has multiple problems, anchor the whole meaningful span and give one complete spoken repair. Do not leave the learner with only a corrected word when the actual problem is the sentence frame.
- If the learner says that someone photographed them, distinguish "take photos of me" from "take photos for me"; the latter means helping on my behalf. If the learner means a camera light, repair "flashlight" to "camera flash" or "the camera and its flash" as a meaning issue, not just an article issue.
- For transitions and clauses, include the surrounding words needed to make the repair grammatical. For example, repair a whole transition like "nowadays after years passed" rather than only "after years passed", and repair a whole clause like "when my parents and I watching photos" rather than only "watching photos".
- Mark opening and transition sentences when they block the story route. A clumsy opener such as "an important old thing that my family has kept..." or a vague transition such as "after years passed..." can be a higher-value repair than a smaller word-level issue if it controls the whole story.
- storyModules should be modular material, not a memorized answer: what/who/where, background, concrete details, what happened, feeling, why it mattered, and current/future influence. Mark AI-suggested additions as suggested_confirm and confirmationNeeded true when they are not confirmed personal memory.
- languageSignals are the main Part 2 language-growth surface, not a short afterthought. Return exactly six items every time in this order, one for each signal: idiomatic_expression, tense, connector, phrasal_verb, collocation, and clause. The UI only displays your fields; it will not infer, patch, classify, blacklist, or whitelist these signals locally.
- Before writing languageSignals, run a provider-side teacher planning pass:
  1. Inventory candidate evidence across the whole transcript for each signal before choosing any bestUpgrade. Evidence is used to explain a teaching decision; it is not a word-list trigger and must not automatically make a phrase wrong.
  2. Rank candidates by IELTS Part 2 teaching value: meaning/timeline errors first; then low-range, repetitive, or vague language habits; then accurate but narrow language; then optional enrichment. Choose the highest-value candidate for the card. Do not spend bestUpgrade on an acceptable vocabulary chunk when a stronger low-range signal exists in the same answer.
  3. Assign each useful expression or issue to one primary teaching role only. Do not double-count the same expression across idiom and phrasal_verb, connector and clause, or collocation and story vocabulary. If an item fits two roles, choose the role that teaches the clearest signal and use a different expression for the other role.
  4. Keep lexical material in the correct bucket: story/vocabulary material belongs in storyModules or nextSpeakableVersion, while languageSignals must teach the specific signal named by signal.
  5. Compose a planned nextSpeakableVersion from the learner's meaning and the chosen signal upgrades, then make every languageSignals bestUpgrade agree with that planned answer.
- Alternatives are not siblings of bestUpgrade. For each signal, bestUpgrade is the most urgent chosen learning asset; alternativeUpgrades are 2-3 additional high-value assets for the same signal. They may be kind "replace" when they improve a weak original slot, or kind "add" when the answer simply lacks a strong learnable expression in a natural story position. Keep legacy alternatives as short upgrade expressions only, but make alternativeUpgrades the richer teaching payload.
- Each alternativeUpgrade must preserve the original idea and teach the same signal. Do not replace a personality adjective with an unrelated idiom, do not replace an already effective connector with a same-level equivalent, and do not repeat the same sourceQuote, same upgrade, same leading frame, or same teaching asset as bestUpgrade. An alternative is not another example sentence for the same frame; it must give a different usable asset for the same signal. For connector, use a different relation/linker family; for tense, use a different time-layer frame; for clause, use a different clause frame or structure; for collocation, use a different collocation slot; for phrasal_verb, use a different action verb phrase; for idiom, use a different idiomatic function. If there are not enough weak original slots, use kind "add" with insertLocationZh to place high-value expressions in the planned answer; do not fabricate private facts.
- Do not spend bestUpgrade or alternativeUpgrades on near-synonym polishing when the learner's original expression is already accurate, natural, and doing the intended job. If the difference is only taste or register, mark it usable/strong, keep it, and spend the signal on a missing layer, repeated weak pattern, or another place where the answer gains real IELTS value.
- Field responsibility: qualityZh and nextMoveZh are diagnostic Chinese only. They may describe that the learner overuses simple coordination, has a flat timeline, lacks contrast/sequence/result relations, uses a narrow collocation range, has confusing clause structure, or needs richer signal awareness. They must not list concrete English expressions, connectors, clause frames, or examples such as "after that", "eventually", "as a result", "What made it...", or any other upgrade candidate. Put every concrete English recommendation only in bestUpgrade, alternatives, alternativeUpgrades.upgrade, sampleUpgrade, or nextSpeakableVersion.
- Before finalizing each languageSignals item, run a provider-side self-check:
  1. If the learner already used a valid expression, set foundInTranscript true and put exact wording in evidenceQuotes.
  2. Do not present an expression already used in the transcript as bestUpgrade or as a range-building alternative, unless you are explicitly telling the learner to keep it; even then, alternatives must expand range with different expressions.
  3. bestUpgrade must be the exact English expression/frame the learner should notice. Never put meta descriptions, grammar labels, or instructions in bestUpgrade, such as "future influence clause with will", "use past tense", "add a connector", or "adverb + adjective collocation". Put those explanations in nextMoveZh or guidanceZh.
  4. sampleUpgrade must contain sampleUpgradeHighlight exactly. sampleUpgradeHighlight should usually equal bestUpgrade; if grammar requires a slight inflection, set sampleUpgradeHighlight to the exact substring to highlight and make bestUpgrade a compact reusable frame, not the full sample sentence. For phrasal_verb, sampleUpgrade may include natural modifiers such as adverbs, but bestUpgrade and sampleUpgradeHighlight should mark only the phrasal verb core, e.g. bestUpgrade "look forward to" and highlight "looking forward to", not "eagerly looking forward to".
  5. If a languageSignals item has a bestUpgrade, that upgrade must be naturally integrated into nextSpeakableVersion and cited through usedInNextVersionQuote. Also include a matching nextSpeakableVersionHighlights item for the same exact quote and signal. If the expression cannot fit the next version without distorting meaning or flow, do not make it bestUpgrade; move it to alternatives or story/vocabulary material instead.
  6. Before returning JSON, compare bestUpgrade, sampleUpgradeHighlight, usedInNextVersionQuote, alternatives, and alternativeUpgrades. They must not duplicate each other by exact wording or by same leading frame with different example content. If an alternative repeats the same sourceQuote, same upgrade, or same teaching frame as bestUpgrade, replace it with another signal-consistent asset or omit it.
  7. Scan qualityZh, nextMoveZh, insertLocationZh, and guidanceZh for stray concrete English suggestions. If a concrete English expression/frame appears there, move it into bestUpgrade or alternativeUpgrades when it is worth teaching, otherwise remove it from the Chinese guidance.
- Treat the following as fixed Part 2 training standards, not optional style tips:
  1. Idiomatic expression: a Part 2 answer should contain one natural idiomatic expression. For this UI, treat an idiom as a mostly fixed expression whose meaning or force is not just the sum of the words, and whose main value is emotional stance, vividness, evaluation, or spoken naturalness. Distinguish it from a connector, discourse stance frame, collocation, and phrasal verb. A discourse stance frame such as "it is no exaggeration to say" or "it is safe to say" is formulaic and may be usable, but it is usually not the highest-value idiom signal if it only introduces an opinion. Do not polish one usable stance frame into another near-equivalent frame. If the learner already has a usable formulaic frame, either keep it and set foundInTranscript true, or add a more vivid idiom in a better story slot such as effort, pressure, admiration, turning point, or lasting influence. Some expressions can overlap with phrasal verbs in real English; do not double-count the same expression in both categories. If an expression could fit both, assign it to the stronger pedagogical role and use a different expression for the other signal.
  2. Tense: even when the topic is mainly about a past event, the rebuilt Part 2 answer should demonstrate flexible control across three time layers: past event/background, present reflection or current relevance, and future/current-future influence. The purpose of this signal is to diagnose the three-layer timeline first: which layers are present, which are accurate, and which are missing. Do not start by hunting isolated present-tense lines inside a past story. Do not call a present-tense line wrong just because the story is mostly past. If a line such as a birthday/age/status statement is a valid direct-scene frame, current fact, or present reflection, keep it and explain how it functions. Only flag tense when the time reference genuinely conflicts with the intended story timeline. In most past-event/person stories, if past narrative and present relevance are already usable, bestUpgrade should usually add the missing future/current-future influence at the end, such as "In the future, I hope..." or "I think his influence will..."; alternativeUpgrades can then improve a present reflection or a past-perfect background if those are weak.
  3. Connector: Part 2 should not rely on repeated basic coordination for story flow. In this UI, a connector means a reusable discourse marker or linker whose main job is to show relation between ideas: addition, contrast, sequence, result, concession, or reflection. Evaluate whether the answer over-relies on simple coordination instead of clear discourse relations; cite representative evidence, but do not automatically penalize any single connector. Do not use content-bearing story frames, topic-specific "special moment" frames, or full clause patterns as connector bestUpgrade. If the learner needs a story frame, put it in storyModules or clause instead. Alternatives should be short reusable linkers or linker frames, not whole content sentences. If a connector such as Moreover, However, Therefore, or Looking back already works, do not suggest replacing it with a near-synonym; spend the alternativeUpgrade on another weak relation or missing transition. Do not recommend basic default connectors such as so, and, or but as connector upgrades in Six Language Signals. They may be correct in English, but they have low training value for this product surface; prefer richer spoken linkers such as as a result, on top of that, nevertheless, looking back, at that point, not only that, or more importantly, depending on the relation.
  4. Phrasal verb: a Part 2 answer should contain one natural phrasal or phrasal-prepositional verb. For this UI, treat a phrasal verb as a verb plus particle/preposition functioning as an action or state-change unit in the story. The card teaches the phrasal verb core only: bestUpgrade and alternativeUpgrades.upgrade must be the core verb phrase such as "look forward to", "settle into", "figure out", or "stay up late"; do not include leading adverbs, intensifiers, adjective material, or wider sentence chunks in those upgrade fields. Put natural modifiers in sampleUpgrade or nextSpeakableVersion when they improve the sentence, but keep sampleUpgradeHighlight focused on the phrasal verb substring. First identify any valid phrasal verb already in the transcript. If present and natural, set foundInTranscript true, cite it, and recommend different alternatives for range; do not repeat the learner's existing expression as bestUpgrade. If absent or awkward, provide the best new one for this story plus 2-3 alternatives. Do not reuse the idiomatic_expression bestUpgrade here. In alternativeUpgrades, each item must say in Chinese which original verb/action it can replace, and the alternatives should usually target different original actions rather than being variants of the same bestUpgrade.
  5. Collocation: this signal is specifically about precise adverb + adjective first, then adverb + verb. When the learner uses an adjective or intensifier, judge the adjective and the modifier together. If there is a low-range intensifier + adjective or vague adjective in the transcript, prioritize that over an acceptable adjective + noun vocabulary chunk. Upgrade both parts when needed, turning basic intensity into a precise adverb + precise adjective. Do not use adjective + noun vocabulary chunks as the collocation bestUpgrade; those belong in storyModules or vocabulary/material development, not this signal. Collocation bestUpgrade and alternativeUpgrades should be adverb+adjective first. For alternatives, repeat the same judgment on other adjectives in the transcript; if there are no more useful adjectives, then use adverb+verb. If the whole answer lacks adverb+adjective, create one natural bestUpgrade at the most useful feeling/detail slot and explain that this is the missing signal.
  6. Clause: the Clause card should always teach awareness of a higher-quality subordinate/relative clause frame or sentence-level structure that the learner can accumulate for future Part 2 answers. Treat this as a structure-building pass, not a requirement to force a clause correction. First inventory existing clauses and judge whether they are accurate, varied, and useful. Then choose one high-value frame that either safely merges two meaningful information blocks from the learner's answer/planned answer or adds a transferable layer such as emphasis, concession, time progression, evaluation, reason contrast, or reflection. Strong examples include frames like "What made it memorable was that...", "The reason I still remember it is that...", "By the time..., I had already...", "It was not until... that...", "Even though..., I still...", "not because..., but because...", or an evaluative relative clause such as "..., which made the experience feel...". Do not make a bare subordinator or a simple low-value because/when/although sentence the bestUpgrade merely to fill the card. Basic subordinators may appear inside a valuable frame when they serve a real structural function, but they are not themselves the teaching asset. Alternatives should be complete high-quality clause frames or sentence-level examples with meaningful content, not bare conjunctions, low-information fragments, or "add a because clause" style advice.
- For every languageSignals item, fill requirementZh, foundInTranscript, evidence/evidenceQuotes, qualityZh, nextMoveZh, bestUpgrade, alternatives, alternativeUpgrades, insertLocationZh, sampleUpgrade, sampleUpgradeHighlight, sampleUpgrades, usedInNextVersionQuote, and profileSignalZh. bestUpgrade should be a compact English expression, phrase, connector, collocation, idiom, phrasal verb core, high-quality clause frame, or short tense frame; put Chinese coaching in nextMoveZh/insertLocationZh instead. sampleUpgrade should be one complete sentence that integrates bestUpgrade into the learner's current Part 2 story. sampleUpgradeHighlight must be an exact substring inside sampleUpgrade and should mark the expression the learner should notice, not surrounding intensifiers, modifiers, bare subordinators, or low-value connector words from a different signal. profileSignalZh should name any future habit/profile implication, such as repeated low-range intensifiers, overused clause frame, missing phrasal verbs, or narrow connector range, without claiming cross-session history unless provided in input.
- If the input includes masteredExpressions, treat them as expressions the learner has confirmed they already know. Do not use those expressions as bestUpgrade, alternatives, or alternativeUpgrades. If the learner uses a mastered expression incorrectly in the transcript, you may still correct the error as an anchored annotation or explain the misuse, but do not recommend it as a range-building upgrade.
- Examples mentioned in these instructions are not blacklists or whitelists. Generalize by function: signal quality, repetition, variety, topic fit, story role, and score usefulness.
- nextSpeakableVersion is the answer that replaces the old Band 7 Target Answer in the UI. It must integrate the storyModules and the useful languageSignals naturally, not sit beside a separate target answer. If the learner has enough material, make it a sustained Part 2 answer, normally around 120-180 words. If material is thin, use safe, clearly general expansions and do not invent private memory.
- For Part 2 only, upgradedAnswer is a compatibility field; it may match nextSpeakableVersion, but the real learner-facing rebuilt answer is part2Feedback.nextSpeakableVersion.
- nextSpeakableVersionHighlights must quote exact text from nextSpeakableVersion and label the story role and/or language signal it demonstrates. For language signal highlights, quote the same integrated upgrade named in usedInNextVersionQuote. Prefer signal-linked highlights over generic story highlights. Only include storyRole-only highlights when they mark an essential story module, not ordinary factual content.`;

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

  async analyzeSpeaking(params: SpeakingAnalysisRequest): Promise<string> {
    if (params.sessionKind === 'part1_topic_thread') {
      return this.generateJson(`${strictJsonInstruction}

You are an IELTS Speaking Part 1 topic-session feedback engine for a local-first practice app.
Chinese is for diagnosis and explanations. English is for learner wording, corrections, phrase fixes, reusable versions, and short frames.
${speakingTranscriptEvidenceInstruction}
${speakingProfileCapsuleInstruction}
${speakingPart1TopicThreadInstruction}

${speakingPart1TopicThreadSchemaInstruction}

Input:
${JSON.stringify(params, null, 2)}`, 0);
    }

    const partFocus = params.part === 1
      ? 'Part 1 focus: direct answer quality, naturalness, concise development, and whether the answer sounds spontaneous.'
      : params.part === 2
        ? 'Part 2 focus: cue card coverage, answer architecture/story structure, specificity/detail, and reusable story material / 万金油素材.'
        : 'Part 3 focus: abstract reasoning, comparison/generalization, example quality, and argument depth.';

    return this.generateJson(`${strictJsonInstruction}

You are an IELTS Speaking feedback engine for a local-first practice app.
Assess transcript-based speaking only. Do not provide a pronunciation score; pronunciation must be null. Treat ideal delivery as a quiet product premise, not a repeated learner-facing disclaimer.
Keep feedback concise, strict, and useful for a Chinese-speaking IELTS learner.
${partFocus}
${speakingPromptCalibration}
${speakingTranscriptEvidenceInstruction}
${speakingProfileCapsuleInstruction}
${speakingFeedbackDepthInstruction}
${speakingTeacherQualitySelfCheckInstruction}
${speakingPart2NativeFeedbackInstruction}
${speakingPart3DiscussionFeedbackInstruction}
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
${JSON.stringify(params, null, 2)}`, 0);
  }

  async generatePart1LearningAssets(params: import('./base').Part1LearningAssetsRequest): Promise<string> {
    return this.generateJson(`${strictJsonInstruction}

You are an IELTS Speaking Part 1 learning-assets engine for a local-first practice app.
Chinese is for short concept labels and translations. English is for reusable spoken chunks and polished learner material.
${params.repairFocus ? `This is automatic attempt ${params.attempt || 2} because the previous visible learning-assets payload was too sparse. Fill these missing learner-facing assets before returning JSON: ${params.repairFocus}. Do not mention this internal repair pass to the learner; produce the corrected full JSON payload.` : ''}
${speakingPart1LearningAssetsInstruction}

${speakingPart1LearningAssetsSchemaInstruction}

Input:
${JSON.stringify(params, null, 2)}`, 0.45);
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
This is an ideal-delivery single-question training estimate. Pronunciation must be null. Do not repeat pronunciation or full-test disclaimers in rationaleZh.
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

  async certifyPart1CleanRetry(params: {
    topic: string;
    threadId: string;
    threadAnswers: { questionId: string; question: string; answer: string }[];
    cleanRetryAnswers: { questionRef: string; answer: string; noteZh?: string }[];
    attempt: 1 | 2;
  }): Promise<string> {
    return this.generateJson(`${strictJsonInstruction}

You are a focused internal verifier for IELTS Speaking Part 1 clean retry answers.
Chinese is only for concise violation reasons. English is for candidate wording and safer versions.
${part1CleanRetryCertificationInstruction}

${part1CleanRetryCertificationSchemaInstruction}

Input:
${JSON.stringify(params, null, 2)}`, 0.1);
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
