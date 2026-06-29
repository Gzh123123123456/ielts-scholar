import type {
  SpeakingFeedback,
  SpeakingThreadAnswer,
  WritingFeedback,
  WritingTask1Feedback,
} from './ai/schemas';
import {
  buildSpeakingEvidenceLedger,
  buildWritingTask1EvidenceLedger,
  buildWritingTask2EvidenceLedger,
  EvidenceLedgerItem,
  EvidenceLedgerSummary,
  normalizeEvidenceText,
  summarizeEvidenceLedger,
} from './evidenceLedger';

export type FeedbackJudgeKind = 'speaking' | 'writing_task2' | 'writing_task1';

export type FeedbackJudgeSeverity = 'must_fix' | 'should_fix' | 'needs_teacher_judge';

export interface FeedbackJudgeFinding {
  severity: FeedbackJudgeSeverity;
  layer: 'prompt' | 'safety' | 'ledger' | 'ui' | 'history' | 'judge_harness';
  message: string;
  evidence?: string;
}

export interface FeedbackJudgeSurfaceSnapshot {
  scorePresent: boolean;
  hasAnnotatedEvidence: boolean;
  hasTargetOrCleanerAnswer: boolean;
  hasLearningAssets: boolean;
  hasInternalLeak: boolean;
  internalLeakMatches: string[];
  notes?: string[];
}

export interface FeedbackJudgePacket {
  id: string;
  title: string;
  kind: FeedbackJudgeKind;
  source: {
    part?: 1 | 2 | 3;
    task?: 'task1' | 'task2';
    question: string;
    transcriptOrEssay: string;
    threadAnswers?: SpeakingThreadAnswer[];
  };
  feedbackDigest: unknown;
  evidenceSummary: EvidenceLedgerSummary;
  evidence: Pick<
    EvidenceLedgerItem,
    'id' | 'sourceKind' | 'sourceRef' | 'sourceQuote' | 'issueType' | 'severity' | 'original' | 'better' | 'explanationZh' | 'anchor'
  >[];
  surface: FeedbackJudgeSurfaceSnapshot;
  teacherJudgeInstructions: string;
}

export interface HardSafetyJudgeResult {
  pass: boolean;
  findings: FeedbackJudgeFinding[];
}

const compact = (value = '') => value.replace(/\s+/g, ' ').trim();

const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean)));

const internalLeakPatterns = [
  /note could not be anchored/i,
  /could not be anchored/i,
  /saved transcript text/i,
  /provider_safety/i,
  /fallback_text/i,
  /debug/i,
  /validation error/i,
];

const findInternalLeaks = (text: string) =>
  unique(internalLeakPatterns.flatMap(pattern => {
    const match = text.match(pattern);
    return match ? [match[0]] : [];
  }));

const visibleSpeakingText = (feedback: SpeakingFeedback) => [
  feedback.estimateRationaleZh,
  feedback.speakingCeilingDiagnosis?.whyNotLowerZh,
  feedback.speakingCeilingDiagnosis?.whyNotHigherZh,
  feedback.speakingCeilingDiagnosis?.nextBandTriggerZh,
  feedback.highBandStabilityZh,
  feedback.nextStepZh,
  feedback.targetValidationZh,
  ...feedback.fatalErrors.flatMap(item => [item.original, item.correction, item.explanationZh]),
  ...feedback.naturalnessHints.flatMap(item => [item.original, item.better, item.explanationZh]),
  feedback.upgradedAnswer,
  ...(feedback.threadFeedback?.annotations || []).flatMap(item => [
    item.sourceQuote,
    item.combinedRepair,
    ...item.layers.flatMap(layer => [layer.original, layer.better, layer.explanationZh]),
  ]),
  ...(feedback.threadFeedback?.cleanRetryAnswers || []).flatMap(item => [item.answer, item.noteZh]),
  ...(feedback.threadFeedback?.developmentTargets || []).flatMap(item => [
    item.questionRef,
    item.topicFrameZh,
    item.reasonZh,
    item.developmentMoveZh,
    item.optionalDevelopedAnswer,
    ...(item.phraseScaffolds || []),
    ...(item.phraseChunks || []).flatMap(chunk => [chunk.text, chunk.purposeZh]),
  ]),
  feedback.threadFeedback?.nextRetryPlan?.priorityAccuracyPatternZh,
  feedback.threadFeedback?.nextRetryPlan?.answerLengthRuleZh,
  feedback.threadFeedback?.nextRetryPlan?.materialToTry,
  ...(feedback.threadFeedback?.nextRetryPlan?.actions || []),
  ...(feedback.threadFeedback?.materialBank.myUsableMaterial || []).flatMap(item => [
    item.sourceWording,
    item.reusableVersion,
    item.developedExample,
    item.explanationZh,
  ]),
  ...(feedback.threadFeedback?.materialBank.reusableSpokenLanguage || []).flatMap(item => [
    item.sourceWording,
    item.reusableVersion,
    item.explanationZh,
  ]),
  ...(feedback.part2Feedback?.annotations || []).flatMap(item => [
    item.sourceQuote,
    item.combinedRepair,
    ...item.layers.flatMap(layer => [layer.original, layer.better, layer.explanationZh]),
  ]),
  ...(feedback.part2Feedback?.storyModules || []).flatMap(item => [
    item.sourceWording,
    item.improvedVersion,
    item.coachingZh,
  ]),
  ...(feedback.part2Feedback?.languageSignals || []).flatMap(item => [
    item.evidence,
    ...(item.evidenceQuotes || []),
    item.qualityZh,
    item.nextMoveZh,
    item.bestUpgrade,
    ...(item.alternatives || []),
    ...(item.alternativeUpgrades || []).flatMap(upgrade => [
      upgrade.sourceQuote,
      upgrade.upgrade,
      upgrade.guidanceZh,
      upgrade.sampleUpgrade,
    ]),
    item.sampleUpgrade,
    item.usedInNextVersionQuote,
    item.profileSignalZh,
  ]),
  feedback.part2Feedback?.nextSpeakableVersion,
  ...(feedback.part3Feedback?.answers || []).flatMap(item => [
    item.thinkingDiagnosis?.questionThinkingZh,
    item.thinkingDiagnosis?.upgradeRuleZh,
    item.microUpgrade?.upgradedLine,
    item.microUpgrade?.whyItHelpsZh,
    item.targetAnswer,
  ]),
].map(value => compact(value)).join('\n');

const visibleTask2Text = (feedback: WritingFeedback) => [
  feedback.estimateRationaleZh,
  ...feedback.essayLevelWarnings.flatMap(item => [item.title, item.messageZh]),
  ...feedback.frameworkFeedback.flatMap(item => [
    item.issue,
    item.suggestionZh,
    item.paragraphFixZh,
    item.transferGuidanceZh,
    item.exampleFrame,
  ]),
  ...feedback.sentenceFeedback.flatMap(item => [
    item.sourceQuote,
    item.original,
    item.correction,
    item.explanationZh,
    item.primaryIssue,
    ...(item.secondaryIssues || []),
    ...(item.microUpgrades || []).flatMap(upgrade => [upgrade.original, upgrade.better, upgrade.explanationZh]),
  ]),
  ...feedback.vocabularyUpgrade.expressionUpgrades.flatMap(item => [
    item.original,
    item.better,
    item.explanationZh,
    item.reuseWhenZh,
    item.example,
  ]),
  feedback.modelAnswer,
].map(value => compact(value)).join('\n');

const visibleTask1Text = (feedback: WritingTask1Feedback) => [
  feedback.taskAchievement.feedback,
  feedback.overviewFeedback,
  feedback.keyFeaturesFeedback,
  feedback.comparisonFeedback,
  feedback.dataAccuracyFeedback,
  feedback.coherenceFeedback,
  ...feedback.languageCorrections.flatMap(item => [item.original, item.correction, item.explanation]),
  ...feedback.mustFix,
  feedback.rewriteTask,
  ...feedback.reusableReportPatterns,
  feedback.improvedReport,
  feedback.modelExcerpt,
].map(value => compact(value)).join('\n');

const speakingDigest = (feedback: SpeakingFeedback) => ({
  part: feedback.part,
  sessionKind: feedback.sessionKind,
  score: feedback.bandEstimateExcludingPronunciation,
  range: feedback.bandEstimateRange,
  estimateRationaleZh: feedback.estimateRationaleZh,
  targetState: feedback.targetState,
  highBandStabilityZh: feedback.highBandStabilityZh,
  nextStepZh: feedback.nextStepZh,
  fatalErrors: feedback.fatalErrors,
  naturalnessHints: feedback.naturalnessHints,
  upgradedAnswer: feedback.upgradedAnswer,
  threadFeedback: feedback.threadFeedback ? {
    annotationCount: feedback.threadFeedback.annotations?.length || 0,
    cleanRetryAnswers: feedback.threadFeedback.cleanRetryAnswers,
    developmentTargets: feedback.threadFeedback.developmentTargets || [],
    nextRetryPlan: feedback.threadFeedback.nextRetryPlan,
    materialCount: feedback.threadFeedback.materialBank.myUsableMaterial.length,
    myUsableMaterial: feedback.threadFeedback.materialBank.myUsableMaterial,
    expressionCount: feedback.threadFeedback.materialBank.reusableSpokenLanguage.length,
    reusableSpokenLanguage: feedback.threadFeedback.materialBank.reusableSpokenLanguage,
    nextRetryFocusZh: feedback.threadFeedback.nextRetryFocusZh,
  } : undefined,
  part2Feedback: feedback.part2Feedback ? {
    annotationCount: feedback.part2Feedback.annotations.length,
    storyModules: feedback.part2Feedback.storyModules,
    languageSignals: feedback.part2Feedback.languageSignals,
    nextSpeakableVersion: feedback.part2Feedback.nextSpeakableVersion,
  } : undefined,
  part3Feedback: feedback.part3Feedback ? {
    answerCount: feedback.part3Feedback.answers.length,
    answers: feedback.part3Feedback.answers.map(answer => ({
      questionRef: answer.questionRef,
      feedbackMode: answer.feedbackMode,
      thinkingDiagnosis: answer.thinkingDiagnosis,
      microUpgrade: answer.microUpgrade,
      targetAnswer: answer.targetAnswer,
    })),
  } : undefined,
});

const task2Digest = (feedback: WritingFeedback) => ({
  scores: feedback.scores,
  estimateRationaleZh: feedback.estimateRationaleZh,
  essayLevelWarnings: feedback.essayLevelWarnings,
  frameworkFeedback: feedback.frameworkFeedback,
  sentenceFeedback: feedback.sentenceFeedback,
  vocabularyUpgrade: feedback.vocabularyUpgrade,
  modelAnswer: feedback.modelAnswer,
});

const task1Digest = (feedback: WritingTask1Feedback) => ({
  estimatedBand: feedback.estimatedBand,
  taskAchievement: feedback.taskAchievement,
  overviewFeedback: feedback.overviewFeedback,
  keyFeaturesFeedback: feedback.keyFeaturesFeedback,
  comparisonFeedback: feedback.comparisonFeedback,
  dataAccuracyFeedback: feedback.dataAccuracyFeedback,
  coherenceFeedback: feedback.coherenceFeedback,
  languageCorrections: feedback.languageCorrections,
  mustFix: feedback.mustFix,
  improvedReport: feedback.improvedReport,
});

export const teacherJudgeSystemPrompt = `You are a senior IELTS product QA judge for an AI tutoring product.

Judge the product feedback as a teacher, not as a string matcher. You receive the learner input, product feedback digest, evidence ledger, and surface snapshot. Decide whether the feedback would satisfy a demanding IELTS coach/product owner.

Evaluate these qualities:
- Does it catch the important teachable language/content problems for this part without only picking one easy minor issue?
- Are important local repairs grounded in exact learner wording when possible?
- Does the target/cleaner answer visibly apply the main repairs while preserving the learner's meaning and material?
- Does the feedback route part-specific work to the right surface: Part 1 direct answer/material/expression, Part 2 story modules and six signals, Part 3 thinking/generalisation, Writing sentence/logic/language bank?
- Does it avoid internal debug language, unsupported claims, invented personal facts, over-formal writing-style upgrades, and score-feedback contradictions?
- For profile-aware or material-aware feedback, does it use previous patterns only when helpful rather than making the whole feedback revolve around the profile?

Speaking quality boundaries:
- Product quality does not require identical feedback on every replay, but it must not swing between "teacher-level" and "only one or two obvious local fixes" for the same level of answer. Treat missing core issues, wrong severity layers, and missing learner-facing surfaces as product failures.
- Part 1 feedback should help the learner move from "can answer" to a natural short conversation: direct answer, one reason, and one concrete detail or small contrast when the answer is thin. It should also catch semantic category mismatches in examples, not only grammar.
- Part 2 feedback must prioritise story skeleton and timeline clarity before word-level polishing. Key setup, instruction/action, turning point, help/solution, and ending sentences should not disappear just because two easy local errors were found first.
- Part 3 feedback must judge answer control before local wording. If the stance and support contradict each other, or the answer needs "yes, but not solely" rather than a flat "no", that is a higher priority than a synonym polish. Severity must separate priority reasoning repairs from better spoken choices.
- High-band-stable Speaking answers do not need an upgraded answer or forced local error cards. Accept a stability-style report when the estimate rationale and high-band stability guidance explain why the answer is already strong, and the evidence ledger anchors the answer as stability evidence.
- If one sentence contains several serious local problems, prefer a sentence-level repair that teaches the spoken sentence skeleton. Do not create a visually noisy page of fragments when the learner needs one rebuilt spoken line.
- If the UI says it is showing only top critical issues, the selected issues must be genuinely the highest-value issues. If important later issues are omitted, fail the packet even when each shown issue is individually correct.

Score must be a 0-100 product QA score, where 90+ means excellent teacher-level feedback, 75-89 means acceptable with minor gaps, 60-74 means usable but meaningfully incomplete, and below 60 fails.

Return JSON only:
{
  "pass": boolean,
  "score": number,
  "confidence": "low" | "medium" | "high",
  "summary": "one concise sentence",
  "criticalGaps": [
    {
      "layer": "prompt" | "safety" | "ledger" | "ui" | "history" | "unknown",
      "message": "what is missing or wrong",
      "evidence": "quote or reason"
    }
  ],
  "strongPoints": ["short strings"],
  "nextFix": "the smallest product-layer fix to try next"
}`;

export const buildTeacherJudgePrompt = (packet: FeedbackJudgePacket) =>
  `${teacherJudgeSystemPrompt}

Feedback judge packet:
${JSON.stringify(packet, null, 2)}`;

const surfaceFromSpeaking = (
  feedback: SpeakingFeedback,
  evidenceSummary: EvidenceLedgerSummary,
): FeedbackJudgeSurfaceSnapshot => {
  const text = visibleSpeakingText(feedback);
  const leaks = findInternalLeaks(text);
  return {
    scorePresent: Number.isFinite(feedback.bandEstimateExcludingPronunciation) || Boolean(feedback.bandEstimateRange),
    hasAnnotatedEvidence: evidenceSummary.anchored > 0,
    hasTargetOrCleanerAnswer: Boolean(
      feedback.upgradedAnswer.trim() ||
      feedback.highBandStabilityZh?.trim() ||
      feedback.threadFeedback?.cleanRetryAnswers.some(item => item.answer.trim()) ||
      feedback.part2Feedback?.nextSpeakableVersion.trim() ||
      feedback.part3Feedback?.answers.some(item => item.targetAnswer.trim()),
    ),
    hasLearningAssets: Boolean(
      feedback.preservedStyle.length ||
      feedback.threadFeedback?.materialBank.myUsableMaterial.length ||
      feedback.threadFeedback?.materialBank.reusableSpokenLanguage.length ||
      feedback.part2Feedback?.storyModules.length ||
      feedback.part2Feedback?.languageSignals.length ||
      feedback.part3Feedback?.topicLanguage?.some(section => section.items.length),
    ),
    hasInternalLeak: leaks.length > 0,
    internalLeakMatches: leaks,
  };
};

const surfaceFromTask2 = (
  feedback: WritingFeedback,
  evidenceSummary: EvidenceLedgerSummary,
): FeedbackJudgeSurfaceSnapshot => {
  const text = visibleTask2Text(feedback);
  const leaks = findInternalLeaks(text);
  return {
    scorePresent: Object.values(feedback.scores).every(score => Number.isFinite(score)),
    hasAnnotatedEvidence: evidenceSummary.anchored > 0,
    hasTargetOrCleanerAnswer: Boolean(feedback.modelAnswer.trim()),
    hasLearningAssets: Boolean(
      feedback.vocabularyUpgrade.topicVocabulary.length ||
      feedback.vocabularyUpgrade.expressionUpgrades.length ||
      feedback.reusableArguments.length,
    ),
    hasInternalLeak: leaks.length > 0,
    internalLeakMatches: leaks,
  };
};

const surfaceFromTask1 = (
  feedback: WritingTask1Feedback,
  evidenceSummary: EvidenceLedgerSummary,
): FeedbackJudgeSurfaceSnapshot => {
  const text = visibleTask1Text(feedback);
  const leaks = findInternalLeaks(text);
  return {
    scorePresent: Number.isFinite(feedback.estimatedBand),
    hasAnnotatedEvidence: evidenceSummary.anchored > 0,
    hasTargetOrCleanerAnswer: Boolean(feedback.improvedReport.trim() || feedback.modelExcerpt?.trim()),
    hasLearningAssets: feedback.reusableReportPatterns.length > 0,
    hasInternalLeak: leaks.length > 0,
    internalLeakMatches: leaks,
  };
};

const countWords = (value = '') => compact(value).split(/\s+/).filter(Boolean).length;

const feedbackDigestAs = (packet: FeedbackJudgePacket) => packet.feedbackDigest as {
  part?: 1 | 2 | 3;
  sessionKind?: SpeakingFeedback['sessionKind'];
  score?: number;
  fatalErrors?: unknown[];
  naturalnessHints?: unknown[];
  threadFeedback?: {
    annotationCount?: number;
    cleanRetryAnswers?: unknown[];
    developmentTargets?: unknown[];
    nextRetryPlan?: unknown;
    materialCount?: number;
    myUsableMaterial?: unknown[];
    expressionCount?: number;
    reusableSpokenLanguage?: unknown[];
    nextRetryFocusZh?: string;
  };
  part2Feedback?: {
    annotationCount?: number;
    storyModules?: unknown[];
    languageSignals?: unknown[];
    nextSpeakableVersion?: string;
  };
  part3Feedback?: {
    answerCount?: number;
    answers?: Array<{
      feedbackMode?: string;
      thinkingDiagnosis?: unknown;
      microUpgrade?: unknown;
      targetAnswer?: string;
    }>;
  };
};

const addSpeakingBaselineQualityFindings = (
  packet: FeedbackJudgePacket,
  findings: FeedbackJudgeFinding[],
) => {
  if (packet.kind !== 'speaking') return;
  const digest = feedbackDigestAs(packet);
  const sourceWords = countWords(packet.source.transcriptOrEssay);
  const priorityEvidenceCount = packet.evidence.filter(item => item.severity === 'priority_repair').length;
  const anchoredPriorityEvidenceCount = packet.evidence.filter(
    item => item.severity === 'priority_repair' && item.anchor?.status === 'anchored',
  ).length;
  const answerCount = packet.source.threadAnswers?.length || 0;
  const richPart3EvidenceCoverage =
    anchoredPriorityEvidenceCount >= Math.max(7, answerCount * 2) ||
    (
      packet.evidenceSummary.anchored >= 10 &&
      packet.evidenceSummary.displayRequired >= 7
    );
  const part3PriorityCoverageGood =
    digest.part === 3 &&
    digest.sessionKind === 'part3_discussion_thread' &&
    packet.evidenceSummary.missingDisplayRequired === 0 &&
    richPart3EvidenceCoverage;
  const sourceNorm = normalizeEvidenceText(packet.source.transcriptOrEssay);
  const evidenceQuoteNorm = normalizeEvidenceText(packet.evidence
    .flatMap(item => [item.sourceQuote, item.original])
    .filter((item): item is string => Boolean(item))
    .join(' '));
  const evidenceRepairNorm = normalizeEvidenceText(packet.evidence
    .flatMap(item => [item.better, item.explanationZh, item.issueType])
    .filter((item): item is string => Boolean(item))
    .join(' '));
  const evidenceAllNorm = `${evidenceQuoteNorm} ${evidenceRepairNorm}`.trim();
  const addCoverageRegressionFinding = ({
    sourcePattern,
    quotePattern,
    repairPattern,
    message,
  }: {
    sourcePattern: RegExp;
    quotePattern: RegExp;
    repairPattern?: RegExp;
    message: string;
  }) => {
    if (!sourcePattern.test(sourceNorm)) return;
    if (part3PriorityCoverageGood && message.startsWith('Part 3')) return;
    if (!quotePattern.test(evidenceQuoteNorm)) {
      findings.push({
        severity: 'should_fix',
        layer: 'prompt',
        message,
        evidence: 'The learner wording is present in the source, but no anchored repair covers the needed full span.',
      });
      return;
    }
    if (repairPattern && !repairPattern.test(evidenceAllNorm)) {
      findings.push({
        severity: 'should_fix',
        layer: 'prompt',
        message,
        evidence: 'The source span is annotated, but the visible repair does not show the expected semantic correction.',
      });
    }
  };

  [
    {
      sourcePattern: /\btaking photos for me\b/,
      quotePattern: /\btaking photos for me\b/,
      repairPattern: /\btaking (?:photos|pictures) of me\b/,
      message: 'Photo-subject preposition issue is missing or under-repaired.',
    },
    {
      sourcePattern: /\b(?:camera|photos?|pictures?).{0,40}\bflashlight\b|\bflashlight\b.{0,40}\b(?:camera|photos?|pictures?)\b/,
      quotePattern: /\bflashlight\b/,
      repairPattern: /\bcamera flash\b|\bcamera and its flash\b/,
      message: 'Camera flash vs flashlight meaning issue is missing or under-repaired.',
    },
    {
      sourcePattern: /\bnowadays after years passed\b/,
      quotePattern: /\bnowadays after years passed\b/,
      message: 'Part 2 time-transition repair should cover the full transition span.',
    },
    {
      sourcePattern: /\bwhen my parents and i watching photos\b/,
      quotePattern: /\bwhen my parents and i watching photos\b/,
      repairPattern: /\bwhen my parents and i (?:were looking through|looked through|were looking at|looked at)\b/,
      message: 'Part 2 photo-looking clause should be repaired as a full clause, not a single verb phrase.',
    },
    {
      sourcePattern: /\bchinese traditional fictions\b/,
      quotePattern: /\bchinese traditional fictions\b/,
      repairPattern: /\bclassic chinese novels\b|\btraditional chinese fiction\b/,
      message: 'Part 3 book-category wording is missing or under-repaired.',
    },
    {
      sourcePattern: /\boriginate from them\b/,
      quotePattern: /\boriginate from them\b/,
      repairPattern: /\badapted from them\b|\badapted into tv\b|\btv adaptations\b/,
      message: 'Part 3 adaptation relation is missing or under-repaired.',
    },
    {
      sourcePattern: /\bmost classical and greatest fictions\b/,
      quotePattern: /\bmost classical and greatest fictions\b/,
      repairPattern: /\bmost famous classic novels\b|\bgreatest works of fiction\b/,
      message: 'Part 3 classic-novel noun phrase is missing or under-repaired.',
    },
    {
      sourcePattern: /\bhardware facility\b/,
      quotePattern: /\bhardware facility\b/,
      repairPattern: /\blibrary facilities\b|\bphysical facilities\b/,
      message: 'Part 3 library-facility wording is missing or under-repaired.',
    },
    {
      sourcePattern: /\bsoftware facility\b/,
      quotePattern: /\bsoftware facility\b/,
      repairPattern: /\blibrary services\b|\breading environment\b|\boverall reading environment\b/,
      message: 'Part 3 software-facility wording is missing or under-repaired.',
    },
    {
      sourcePattern: /\baccident environment\b/,
      quotePattern: /\baccident environment\b/,
      repairPattern: /\b(?:comfortable|clean|quiet|pleasant) (?:reading )?environment\b|\bplace to read\b/,
      message: 'Part 3 reading-environment wording is missing or under-repaired.',
    },
    {
      sourcePattern: /\belderly grew up\b/,
      quotePattern: /\belderly grew up\b|\belderly grew up in such a environment\b/,
      repairPattern: /\bolder people grew up\b|\bolder generation grew up\b/,
      message: 'Part 3 older-people sentence skeleton is missing or under-repaired.',
    },
    {
      sourcePattern: /\brelax indoor\b/,
      quotePattern: /\brelax indoor\b/,
      repairPattern: /\brelax indoors\b|\brelax at home\b/,
      message: 'Part 3 indoor-relaxation wording is missing or under-repaired.',
    },
    {
      sourcePattern: /\btake my parents as example\b/,
      quotePattern: /\btake my parents as example\b/,
      repairPattern: /\btake my parents as an example\b|\bfor example, my parents\b/,
      message: 'Part 3 example-frame wording is missing or under-repaired.',
    },
    {
      sourcePattern: /\bmore accessible to\b/,
      quotePattern: /\bmore accessible to\b|\byoung people are more accessible to\b/,
      repairPattern: /\bhave access to\b/,
      message: 'Part 3 access-structure wording is missing or under-repaired.',
    },
    {
      sourcePattern: /\bdevelopment of science\b/,
      quotePattern: /\bdevelopment of science\b/,
      repairPattern: /\bdevelopment of technology\b|\btechnology\b/,
      message: 'Part 3 technology/science noun choice is missing or under-repaired.',
    },
    {
      sourcePattern: /\bdepends on how to use\b/,
      quotePattern: /\bdepends on how to use\b/,
      repairPattern: /\bdepends on how (?:people use them|they are used)\b/,
      message: 'Part 3 device-use ending structure is missing or under-repaired.',
    },
  ].forEach(addCoverageRegressionFinding);

  if (digest.part === 1 && digest.sessionKind !== 'part1_topic_thread' && sourceWords >= 40 && (digest.score ?? 9) <= 7 && priorityEvidenceCount <= 1) {
    findings.push({
      severity: 'should_fix',
      layer: 'prompt',
      message: 'Part 1 single-question feedback may be undercovered for a substantial mid-band answer.',
      evidence: `${priorityEvidenceCount} priority repairs for ${sourceWords} words.`,
    });
  }

  if (digest.sessionKind === 'part1_topic_thread' && answerCount >= 3) {
    const cleanRetryCount = digest.threadFeedback?.cleanRetryAnswers?.length || 0;
    if (cleanRetryCount < answerCount) {
      findings.push({
        severity: 'must_fix',
        layer: 'prompt',
        message: 'Part 1 topic-thread feedback does not provide a cleaner retry answer for every submitted question.',
        evidence: `${cleanRetryCount}/${answerCount} clean retry answers present.`,
      });
    }

    const learningAssetCount =
      (digest.threadFeedback?.developmentTargets?.length || 0) +
      (digest.threadFeedback?.materialCount || 0) +
      (digest.threadFeedback?.expressionCount || 0);
    if (learningAssetCount === 0) {
      findings.push({
        severity: 'should_fix',
        layer: 'prompt',
        message: 'Part 1 topic-thread feedback has no visible material or expression assets.',
        evidence: 'Part 1 threads should surface reusable answer material or spoken language when the learner provides stable content.',
      });
    }

    if ((digest.threadFeedback?.annotationCount || 0) < Math.min(3, answerCount)) {
      findings.push({
        severity: 'should_fix',
        layer: 'prompt',
        message: 'Part 1 topic-thread annotations look sparse for a multi-answer thread.',
        evidence: `${digest.threadFeedback?.annotationCount || 0} annotations for ${answerCount} answers.`,
      });
    }

    if (sourceWords >= 80 && (digest.score ?? 9) <= 6.5 && (digest.threadFeedback?.annotationCount || 0) <= answerCount) {
      findings.push({
        severity: 'should_fix',
        layer: 'prompt',
        message: 'Part 1 topic-thread feedback may be too close to one local repair per answer.',
        evidence: `${digest.threadFeedback?.annotationCount || 0} annotations for ${answerCount} answers and ${sourceWords} source words.`,
      });
    }
  }

  if (digest.part === 2 && sourceWords >= 80 && (digest.score ?? 9) <= 6.5) {
    const annotationCount = digest.part2Feedback?.annotationCount || 0;
    if (annotationCount <= 2 || priorityEvidenceCount <= 2) {
      findings.push({
        severity: 'should_fix',
        layer: 'prompt',
        message: 'Part 2 feedback is likely undercovered for a long mid-band story.',
        evidence: `${annotationCount} Part 2 annotations and ${priorityEvidenceCount} priority repairs for ${sourceWords} words.`,
      });
    }

    if (!digest.part2Feedback?.nextSpeakableVersion?.trim()) {
      findings.push({
        severity: 'must_fix',
        layer: 'prompt',
        message: 'Part 2 feedback is missing the next speakable version.',
      });
    }

    if ((digest.part2Feedback?.languageSignals?.length || 0) !== 6) {
      findings.push({
        severity: 'must_fix',
        layer: 'prompt',
        message: 'Part 2 feedback must include exactly six language signals.',
        evidence: `${digest.part2Feedback?.languageSignals?.length || 0} signals present.`,
      });
    }
  }

  if (digest.sessionKind === 'part3_discussion_thread') {
    const part3AnswerCount = digest.part3Feedback?.answerCount || 0;
    if (answerCount > 0 && part3AnswerCount !== answerCount) {
      findings.push({
        severity: 'must_fix',
        layer: 'prompt',
        message: 'Part 3 discussion feedback does not match the submitted question count.',
        evidence: `${part3AnswerCount}/${answerCount} answer feedback items present.`,
      });
    }

    const missingThinking = (digest.part3Feedback?.answers || [])
      .filter(answer => !answer.thinkingDiagnosis || !answer.targetAnswer?.trim())
      .length;
    if (missingThinking > 0) {
      findings.push({
        severity: 'must_fix',
        layer: 'prompt',
        message: 'Part 3 feedback is missing thinking diagnosis or target answer for at least one answer.',
        evidence: `${missingThinking} incomplete Part 3 answer feedback items.`,
      });
    }

    const localIssueCount = (digest.fatalErrors?.length || 0) + (digest.naturalnessHints?.length || 0);
    const hasPart3ReasoningPriority = (digest.part3Feedback?.answers || []).some(answer => {
      if (
        answer.feedbackMode === 'reasoning_upgrade' ||
        answer.feedbackMode === 'answer_scope' ||
        answer.feedbackMode === 'part3_generalisation' ||
        answer.feedbackMode === 'nuance_upgrade'
      ) {
        return true;
      }
      return /\b(generalisation|generalization|scope|stance|contrast|condition|nuance|answerControl)\b|泛化|范围|立场|对比|条件|人群/.test(
        JSON.stringify(answer.thinkingDiagnosis || {}),
      );
    });
    if (localIssueCount >= 10 && !hasPart3ReasoningPriority) {
      findings.push({
        severity: 'should_fix',
        layer: 'prompt',
        message: 'Part 3 feedback looks over-fragmented into local language fixes without a clear reasoning priority.',
        evidence: `${localIssueCount} local issues, but no reasoning/scope/nuance feedback mode.`,
      });
    }
  }
};

export const buildSpeakingFeedbackJudgePacket = (
  input: {
    id: string;
    title: string;
    feedback: SpeakingFeedback;
    threadAnswers?: SpeakingThreadAnswer[];
  },
): FeedbackJudgePacket => {
  const evidence = buildSpeakingEvidenceLedger(input.feedback, { threadAnswers: input.threadAnswers });
  const evidenceSummary = summarizeEvidenceLedger(evidence);
  return {
    id: input.id,
    title: input.title,
    kind: 'speaking',
    source: {
      part: input.feedback.part as 1 | 2 | 3,
      question: input.feedback.question,
      transcriptOrEssay: input.feedback.transcript,
      threadAnswers: input.threadAnswers || input.feedback.threadAnswers,
    },
    feedbackDigest: speakingDigest(input.feedback),
    evidenceSummary,
    evidence,
    surface: surfaceFromSpeaking(input.feedback, evidenceSummary),
    teacherJudgeInstructions: teacherJudgeSystemPrompt,
  };
};

export const buildWritingTask2FeedbackJudgePacket = (
  input: {
    id: string;
    title: string;
    feedback: WritingFeedback;
  },
): FeedbackJudgePacket => {
  const evidence = buildWritingTask2EvidenceLedger(input.feedback);
  const evidenceSummary = summarizeEvidenceLedger(evidence);
  return {
    id: input.id,
    title: input.title,
    kind: 'writing_task2',
    source: {
      task: 'task2',
      question: input.feedback.question,
      transcriptOrEssay: input.feedback.essay,
    },
    feedbackDigest: task2Digest(input.feedback),
    evidenceSummary,
    evidence,
    surface: surfaceFromTask2(input.feedback, evidenceSummary),
    teacherJudgeInstructions: teacherJudgeSystemPrompt,
  };
};

export const buildWritingTask1FeedbackJudgePacket = (
  input: {
    id: string;
    title: string;
    feedback: WritingTask1Feedback;
  },
): FeedbackJudgePacket => {
  const evidence = buildWritingTask1EvidenceLedger(input.feedback);
  const evidenceSummary = summarizeEvidenceLedger(evidence);
  return {
    id: input.id,
    title: input.title,
    kind: 'writing_task1',
    source: {
      task: 'task1',
      question: input.feedback.instruction,
      transcriptOrEssay: input.feedback.report,
    },
    feedbackDigest: task1Digest(input.feedback),
    evidenceSummary,
    evidence,
    surface: surfaceFromTask1(input.feedback, evidenceSummary),
    teacherJudgeInstructions: teacherJudgeSystemPrompt,
  };
};

export const runHardSafetyFeedbackJudge = (packet: FeedbackJudgePacket): HardSafetyJudgeResult => {
  const findings: FeedbackJudgeFinding[] = [];

  if (!packet.surface.scorePresent) {
    findings.push({
      severity: 'must_fix',
      layer: 'ui',
      message: 'No score is available in the feedback surface snapshot.',
    });
  }

  if (packet.evidenceSummary.missingDisplayRequired > 0) {
    findings.push({
      severity: 'must_fix',
      layer: 'ledger',
      message: 'At least one display-required evidence item could not be anchored.',
      evidence: `${packet.evidenceSummary.missingDisplayRequired} required evidence items missing stable anchors.`,
    });
  }

  if (packet.surface.hasInternalLeak) {
    findings.push({
      severity: 'must_fix',
      layer: 'ui',
      message: 'Internal/debug wording appears in learner-facing feedback text.',
      evidence: packet.surface.internalLeakMatches.join(', '),
    });
  }

  if (!packet.surface.hasTargetOrCleanerAnswer) {
    findings.push({
      severity: 'should_fix',
      layer: 'prompt',
      message: 'The packet has no visible target, cleaner answer, model answer, or next speakable version.',
    });
  }

  addSpeakingBaselineQualityFindings(packet, findings);

  findings.push({
    severity: 'needs_teacher_judge',
    layer: 'judge_harness',
    message: 'Hard-safety checks do not judge teaching quality. Run or review the teacher-judge packet for product-quality acceptance.',
  });

  return {
    pass: !findings.some(finding => finding.severity === 'must_fix'),
    findings,
  };
};
