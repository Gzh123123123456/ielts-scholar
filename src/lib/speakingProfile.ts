import type { MasteredSpeakingExpressionHint, SpeakingProfileCapsule } from '@/src/lib/ai/providers/base';
import type { SpeakingFeedback } from '@/src/lib/ai/schemas';
import type { SpeakingPracticeRecord } from '@/src/lib/practiceRecords';

export interface SavedExpressionProfileItem {
  id: string;
  expression: string;
  originalSnippet: string;
  sourcePath?: string;
  sourceLabel?: string;
  module?: string;
  part?: number;
  count?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SpeakingProfileMemoryInput {
  masteredExpressions?: MasteredSpeakingExpressionHint[];
  savedExpressions?: SavedExpressionProfileItem[];
}

export interface SpeakingProfileEvidence {
  text: string;
  context: string;
  part?: 1 | 2 | 3;
}

export interface SpeakingProfileRepeatedChunk {
  canonical: string;
  count: number;
  recentCount: number;
  note: string;
  alternatives: string[];
  evidence: SpeakingProfileEvidence[];
}

export interface SpeakingProfileGrammarPattern {
  key: string;
  label: string;
  count: number;
  contexts: string[];
  evidence: SpeakingProfileEvidence[];
}

export interface SpeakingProfileMaterialCluster {
  material: string;
  count: number;
  partCounts: Partial<Record<1 | 2 | 3, number>>;
  useCases: string[];
  developmentFocus: string[];
  evidence: SpeakingProfileEvidence[];
}

export interface SpeakingProfilePart2Signal {
  signal: string;
  label: string;
  weakCount: number;
  totalCount: number;
  evidence: SpeakingProfileEvidence[];
}

export interface SpeakingProfilePart3Pattern {
  key: string;
  label: string;
  count: number;
  evidence: SpeakingProfileEvidence[];
}

export interface SpeakingProfileSummary {
  evidenceLabel: string;
  evidenceLevel: 'low' | 'building' | 'stable';
  totalAnalyzed: number;
  partCounts: Record<1 | 2 | 3, number>;
  repeatedChunks: SpeakingProfileRepeatedChunk[];
  grammarPatterns: SpeakingProfileGrammarPattern[];
  materialClusters: SpeakingProfileMaterialCluster[];
  part2Signals: SpeakingProfilePart2Signal[];
  part3Patterns: SpeakingProfilePart3Pattern[];
  savedExpressions: SavedExpressionProfileItem[];
}

type SpeakingAnswerEvidence = {
  part: 1 | 2 | 3;
  question: string;
  answer: string;
  context: string;
  timestamp: string;
};

const MAX_RECENT_ATTEMPTS = 20;

const part2SignalLabels: Record<string, string> = {
  idiomatic_expression: 'Idiomatic expression',
  tense: 'Tense timeline',
  connector: 'Connector range',
  phrasal_verb: 'Phrasal verb',
  collocation: 'Collocation',
  clause: 'Clause control',
};

const phraseCatalog = [
  {
    canonical: 'be into sth',
    note: 'This chunk is useful, but repeated use can narrow lexical range. The intensifier is only evidence, not part of the chunk.',
    alternatives: ['be interested in', 'be drawn to', 'be a big fan of', 'have a real interest in'],
    pattern: /\b(?:i(?:'m| am)|you(?:'re| are)|he(?:'s| is)|she(?:'s| is)|we(?:'re| are)|they(?:'re| are)|[a-z]+(?:'s| is| are| am| was| were))\s+(?:(?:really|very|quite|pretty|so|super|totally|actually|basically|extremely|especially|kind of|sort of)\s+)?(?:into|in\s+to)\b/gi,
  },
  {
    canonical: 'as far as I am concerned',
    note: 'This stance opener can sound memorized if it appears too often in Speaking.',
    alternatives: ["I'd say", 'For me', 'Honestly, I think', 'The way I see it'],
    pattern: /\bas\s+far\s+as\s+i\s+am\s+concerned\b/gi,
  },
  {
    canonical: 'I think',
    note: 'Frequent use is natural, but the profile flags it when it becomes the default stance frame.',
    alternatives: ["I'd say", 'I tend to think', 'It seems to me that', 'From my experience'],
    pattern: /\bi\s+think\b/gi,
  },
  {
    canonical: 'very + adjective',
    note: 'Repeated basic intensifier use can flatten description.',
    alternatives: ['deeply meaningful', 'particularly useful', 'highly effective', 'genuinely memorable'],
    pattern: /\bvery\s+(important|good|bad|nice|interesting|beautiful|useful|happy|sad|big|small|famous|popular)\b/gi,
  },
];

const grammarPatterns = [
  {
    key: 'tense_timeline',
    label: 'Tense timeline',
    pattern: /\btense|past tense|present tense|timeline|time layer|future influence|时态|过去|现在|将来|时间线/i,
  },
  {
    key: 'third_person_singular',
    label: 'Third-person singular',
    pattern: /\bthird[- ]person|subject[- ]verb|agreement|he\s+\w+|she\s+\w+|三单|主谓一致/i,
  },
  {
    key: 'preposition_collocation',
    label: 'Preposition / collocation',
    pattern: /\bpreposition|collocation|interested\s+on|in\s+to|搭配|介词/i,
  },
  {
    key: 'articles_plural',
    label: 'Articles / singular-plural',
    pattern: /\barticle|articles|plural|singular|countable|a\/an|冠词|单复数/i,
  },
  {
    key: 'word_form',
    label: 'Word form',
    pattern: /\bword form|adjective|adverb|noun form|verb form|词性|形式/i,
  },
];

export const canonicalizeSavedExpressionDraft = (text: string) => {
  const cleaned = normalizeWhitespace(text);
  if (phraseCatalog[0].pattern.test(cleaned)) {
    phraseCatalog[0].pattern.lastIndex = 0;
    return 'be into sth';
  }
  phraseCatalog.forEach(item => { item.pattern.lastIndex = 0; });
  return cleaned.length > 80 ? cleaned.slice(0, 80).trim() : cleaned;
};

const normalizeWhitespace = (text: string) => text.replace(/\s+/g, ' ').trim();

const normalizeKey = (text: string) =>
  normalizeWhitespace(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const sentenceAround = (text: string, index: number, fallback = text) => {
  const start = Math.max(
    text.lastIndexOf('.', index),
    text.lastIndexOf('?', index),
    text.lastIndexOf('!', index),
    text.lastIndexOf('\n', index),
  );
  const endCandidates = ['.', '?', '!', '\n']
    .map(mark => text.indexOf(mark, index + 1))
    .filter(position => position >= 0);
  const end = endCandidates.length ? Math.min(...endCandidates) : text.length;
  return normalizeWhitespace(text.slice(start >= 0 ? start + 1 : 0, end + 1)) || normalizeWhitespace(fallback);
};

const limit = <T,>(items: T[], max: number) => items.slice(0, max);

const recordTimestamp = (record: SpeakingPracticeRecord) =>
  record.analyzedAt || record.updatedAt || record.createdAt;

const answerEvidenceFromRecord = (record: SpeakingPracticeRecord): SpeakingAnswerEvidence[] => {
  const timestamp = recordTimestamp(record);
  if (record.threadAnswers?.length) {
    return record.threadAnswers
      .filter(answer => normalizeWhitespace(answer.transcript))
      .map(answer => ({
        part: record.part,
        question: answer.question,
        answer: answer.transcript,
        context: record.topic || record.feedback?.topic || answer.question,
        timestamp,
      }));
  }
  return normalizeWhitespace(record.transcript)
    ? [{
      part: record.part,
      question: record.question,
      answer: record.transcript,
      context: record.topic || record.feedback?.topic || record.question,
      timestamp,
    }]
    : [];
};

const collectAnswerEvidence = (records: SpeakingPracticeRecord[]) =>
  records
    .filter(record => record.status === 'analyzed' && record.feedback)
    .sort((a, b) => recordTimestamp(b).localeCompare(recordTimestamp(a)))
    .flatMap(answerEvidenceFromRecord);

const evidenceItem = (
  text: string,
  source: Pick<SpeakingAnswerEvidence, 'context' | 'part'>,
): SpeakingProfileEvidence => ({
  text: normalizeWhitespace(text),
  context: source.context,
  part: source.part,
});

const buildRepeatedChunks = (answers: SpeakingAnswerEvidence[]): SpeakingProfileRepeatedChunk[] => {
  const recentCutoff = new Set(answers.slice(0, MAX_RECENT_ATTEMPTS).map((_, index) => index));
  return phraseCatalog
    .map(item => {
      let count = 0;
      let recentCount = 0;
      const evidence: SpeakingProfileEvidence[] = [];
      answers.forEach((answer, answerIndex) => {
        item.pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = item.pattern.exec(answer.answer)) !== null) {
          count += 1;
          if (recentCutoff.has(answerIndex)) recentCount += 1;
          if (evidence.length < 3) {
            evidence.push(evidenceItem(sentenceAround(answer.answer, match.index, answer.answer), answer));
          }
        }
      });
      item.pattern.lastIndex = 0;
      return { ...item, count, recentCount, evidence };
    })
    .filter(item => item.count >= 3)
    .sort((a, b) => b.recentCount - a.recentCount || b.count - a.count)
    .map(({ canonical, count, recentCount, note, alternatives, evidence }) => ({
      canonical,
      count,
      recentCount,
      note,
      alternatives,
      evidence,
    }));
};

const feedbackIssueTexts = (feedback: SpeakingFeedback) => {
  const texts: { text: string; source: string }[] = [];
  feedback.fatalErrors?.forEach(item => {
    texts.push({
      text: `${item.tag} ${item.original} ${item.correction} ${item.explanationZh}`,
      source: item.original,
    });
  });
  feedback.naturalnessHints?.forEach(item => {
    texts.push({
      text: `${item.tag} ${item.original} ${item.better} ${item.explanationZh}`,
      source: item.original,
    });
  });
  feedback.threadFeedback?.annotations?.forEach(annotation => {
    annotation.layers.forEach(layer => {
      texts.push({
        text: `${layer.issueType} ${layer.original} ${layer.better} ${layer.explanationZh}`,
        source: layer.original || annotation.sourceQuote,
      });
    });
  });
  feedback.part2Feedback?.annotations?.forEach(annotation => {
    annotation.layers.forEach(layer => {
      texts.push({
        text: `${layer.issueType} ${layer.original} ${layer.better} ${layer.explanationZh}`,
        source: layer.original || annotation.sourceQuote,
      });
    });
  });
  return texts;
};

const buildGrammarPatterns = (records: SpeakingPracticeRecord[]): SpeakingProfileGrammarPattern[] => {
  const grouped = new Map<string, SpeakingProfileGrammarPattern>();
  records
    .filter(record => record.status === 'analyzed' && record.feedback)
    .forEach(record => {
      const feedback = record.feedback;
      if (!feedback) return;
      const context = record.topic || feedback.topic || record.question;
      feedbackIssueTexts(feedback).forEach(issue => {
        grammarPatterns.forEach(pattern => {
          if (!pattern.pattern.test(issue.text)) return;
          const existing = grouped.get(pattern.key) || {
            key: pattern.key,
            label: pattern.label,
            count: 0,
            contexts: [],
            evidence: [],
          };
          existing.count += 1;
          if (context && !existing.contexts.includes(context)) existing.contexts.push(context);
          if (existing.evidence.length < 3) {
            existing.evidence.push(evidenceItem(issue.source || issue.text, {
              part: record.part,
              context,
            }));
          }
          grouped.set(pattern.key, existing);
        });
      });
    });
  return [...grouped.values()]
    .filter(item => item.count >= 2)
    .sort((a, b) => b.count - a.count)
    .map(item => ({
      ...item,
      contexts: limit(item.contexts, 4),
      evidence: limit(item.evidence, 3),
    }));
};

const inferUseCases = (text: string) => {
  const normalized = text.toLowerCase();
  const useCases = new Set<string>();
  if (/\bsports?|basketball|football|athlete|player|sportsman\b/.test(normalized)) {
    ['sportsman', 'admired person', 'successful person'].forEach(item => useCases.add(item));
  }
  if (/\bfamous|celebrity|star|public figure|lebron|james|messi|ronaldo\b/.test(normalized)) {
    ['famous person', 'celebrity', 'role model'].forEach(item => useCases.add(item));
  }
  if (/\bplace|city|hometown|park|school|restaurant|museum\b/.test(normalized)) {
    ['place', 'hometown', 'public space'].forEach(item => useCases.add(item));
  }
  if (/\bgift|object|phone|book|album|computer|game\b/.test(normalized)) {
    ['object', 'gift', 'useful thing'].forEach(item => useCases.add(item));
  }
  if (/\bexperience|event|trip|journey|competition|performance\b/.test(normalized)) {
    ['experience', 'event', 'memorable activity'].forEach(item => useCases.add(item));
  }
  return [...useCases];
};

const nameCandidates = (text: string) => {
  const candidates = new Set<string>();
  const patterns = [
    /\bLe\s*Bron\s+James\b/gi,
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g,
  ];
  patterns.forEach(pattern => {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const candidate = normalizeWhitespace(match[0]).replace(/\bLebron\b/i, 'LeBron');
      if (!/^(Speaking Part|Part One|Part Two|Part Three|IELTS Speaking)$/.test(candidate)) {
        candidates.add(candidate);
      }
    }
  });
  return [...candidates];
};

const buildMaterialClusters = (records: SpeakingPracticeRecord[], answers: SpeakingAnswerEvidence[]) => {
  const grouped = new Map<string, SpeakingProfileMaterialCluster>();
  const add = (material: string, part: 1 | 2 | 3, context: string, evidence: string, useCases: string[] = []) => {
    const clean = normalizeWhitespace(material).replace(/\bLebron\b/i, 'LeBron');
    if (!clean || clean.length < 3 || clean.length > 60) return;
    const key = normalizeKey(clean);
    const existing = grouped.get(key) || {
      material: clean,
      count: 0,
      partCounts: {},
      useCases: [],
      developmentFocus: [],
      evidence: [],
    };
    existing.count += 1;
    existing.partCounts[part] = (existing.partCounts[part] || 0) + 1;
    [...useCases, ...inferUseCases(`${clean} ${context} ${evidence}`)].forEach(item => {
      if (!existing.useCases.includes(item)) existing.useCases.push(item);
    });
    [
      'add one specific moment',
      'explain why it matters to you',
      part === 3 ? 'turn the material into a general example' : '',
    ].filter(Boolean).forEach(item => {
      if (!existing.developmentFocus.includes(item)) existing.developmentFocus.push(item);
    });
    if (existing.evidence.length < 3) {
      existing.evidence.push(evidenceItem(evidence, { part, context }));
    }
    grouped.set(key, existing);
  };

  answers.forEach(answer => {
    nameCandidates(answer.answer).forEach(candidate => {
      add(candidate, answer.part, answer.context, sentenceAround(answer.answer, answer.answer.indexOf(candidate), answer.answer));
    });
  });

  records.forEach(record => {
    const feedback = record.feedback;
    const context = record.topic || feedback?.topic || record.question;
    feedback?.threadFeedback?.materialBank.myUsableMaterial.forEach(item => {
      add(item.materialCore || item.reusableVersion, record.part, context, item.reusableVersion || item.sourceWording || context, item.reuseFor);
    });
    if (feedback?.reusableExample?.example) {
      add(feedback.reusableExample.example, record.part, context, feedback.reusableExample.example, feedback.reusableExample.canBeReusedFor);
    }
  });

  return [...grouped.values()]
    .filter(item => item.count >= 2 || item.useCases.length >= 3)
    .sort((a, b) => b.count - a.count || b.useCases.length - a.useCases.length)
    .slice(0, 10)
    .map(item => ({
      ...item,
      useCases: limit(item.useCases, 6),
      developmentFocus: limit(item.developmentFocus, 3),
      evidence: limit(item.evidence, 3),
    }));
};

const buildPart2Signals = (records: SpeakingPracticeRecord[]): SpeakingProfilePart2Signal[] => {
  const grouped = new Map<string, SpeakingProfilePart2Signal>();
  records
    .filter(record => record.part === 2 && record.status === 'analyzed' && record.feedback?.part2Feedback)
    .forEach(record => {
      const feedback = record.feedback?.part2Feedback;
      if (!feedback) return;
      feedback.languageSignals.forEach(signal => {
        const existing = grouped.get(signal.signal) || {
          signal: signal.signal,
          label: part2SignalLabels[signal.signal] || signal.signal,
          weakCount: 0,
          totalCount: 0,
          evidence: [],
        };
        existing.totalCount += 1;
        if (signal.status === 'thin' || signal.status === 'missing') {
          existing.weakCount += 1;
          if (existing.evidence.length < 3) {
            existing.evidence.push(evidenceItem(
              signal.evidenceQuotes?.[0] || signal.evidence || signal.profileSignalZh || signal.qualityZh,
              { part: 2, context: record.topic || record.question },
            ));
          }
        }
        grouped.set(signal.signal, existing);
      });
    });
  return [...grouped.values()]
    .filter(item => item.weakCount > 0)
    .sort((a, b) => b.weakCount - a.weakCount || b.totalCount - a.totalCount);
};

const part3ModeLabel = (mode?: string) => {
  if (mode === 'part3_generalisation') return 'Generalisation';
  if (mode === 'logic_chain') return 'Reasoning chain';
  if (mode === 'example_support') return 'Example support';
  if (mode === 'nuance_upgrade') return 'Nuance / contrast';
  if (mode === 'compression_upgrade') return 'Answer control';
  if (mode === 'language_repair') return 'Language repair';
  return mode || 'Discussion pattern';
};

const buildPart3Patterns = (records: SpeakingPracticeRecord[]): SpeakingProfilePart3Pattern[] => {
  const grouped = new Map<string, SpeakingProfilePart3Pattern>();
  records
    .filter(record => record.part === 3 && record.status === 'analyzed' && record.feedback?.part3Feedback)
    .forEach(record => {
      record.feedback?.part3Feedback?.answers.forEach(answer => {
        const key = answer.feedbackMode || answer.questionFrame;
        const existing = grouped.get(key) || {
          key,
          label: part3ModeLabel(key),
          count: 0,
          evidence: [],
        };
        existing.count += 1;
        if (existing.evidence.length < 3) {
          existing.evidence.push(evidenceItem(
            answer.thinkingDiagnosis?.mainCeilingZh ||
              answer.thinkingDiagnosis?.bestNextMoveZh ||
              answer.microUpgrade?.focusZh ||
              answer.answer,
            { part: 3, context: record.topic || record.question },
          ));
        }
        grouped.set(key, existing);
      });
    });
  return [...grouped.values()]
    .filter(item => item.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
};

export const buildSpeakingProfile = (
  records: SpeakingPracticeRecord[],
  profile: SpeakingProfileMemoryInput = {},
): SpeakingProfileSummary => {
  const analyzed = records.filter(record => record.status === 'analyzed' && record.feedback);
  const answers = collectAnswerEvidence(records);
  const partCounts = {
    1: analyzed.filter(record => record.part === 1).length,
    2: analyzed.filter(record => record.part === 2).length,
    3: analyzed.filter(record => record.part === 3).length,
  } as Record<1 | 2 | 3, number>;
  const totalAnalyzed = analyzed.length;
  const evidenceLevel: SpeakingProfileSummary['evidenceLevel'] =
    totalAnalyzed >= 12 ? 'stable' : totalAnalyzed >= 4 ? 'building' : 'low';
  const evidenceLabel =
    evidenceLevel === 'stable'
      ? 'Stable local profile'
      : evidenceLevel === 'building'
        ? 'Profile is building'
        : 'Low evidence';

  return {
    evidenceLabel,
    evidenceLevel,
    totalAnalyzed,
    partCounts,
    repeatedChunks: limit(buildRepeatedChunks(answers), 8),
    grammarPatterns: limit(buildGrammarPatterns(analyzed), 6),
    materialClusters: buildMaterialClusters(analyzed, answers),
    part2Signals: limit(buildPart2Signals(analyzed), 6),
    part3Patterns: buildPart3Patterns(analyzed),
    savedExpressions: limit(profile.savedExpressions || [], 24),
  };
};

export const buildSpeakingProfileCapsule = (
  records: SpeakingPracticeRecord[],
  profile: SpeakingProfileMemoryInput = {},
): SpeakingProfileCapsule | undefined => {
  const summary = buildSpeakingProfile(records, profile);
  if (summary.totalAnalyzed === 0 && !summary.savedExpressions.length && !profile.masteredExpressions?.length) {
    return undefined;
  }
  return {
    evidenceLevel: summary.evidenceLevel,
    analyzedAttempts: summary.totalAnalyzed,
    partCounts: summary.partCounts,
    overusedChunks: summary.repeatedChunks.slice(0, 5).map(item => ({
      canonical: item.canonical,
      count: item.count,
      recentCount: item.recentCount,
      examples: item.evidence.slice(0, 2).map(evidence => evidence.text),
    })),
    grammarPatterns: summary.grammarPatterns.slice(0, 5).map(item => ({
      label: item.label,
      count: item.count,
      contexts: item.contexts.slice(0, 3),
      examples: item.evidence.slice(0, 2).map(evidence => evidence.text),
    })),
    part2WeakSignals: summary.part2Signals.slice(0, 6).map(item => ({
      signal: item.signal,
      weakCount: item.weakCount,
      examples: item.evidence.slice(0, 2).map(evidence => evidence.text),
    })),
    part3Patterns: summary.part3Patterns.slice(0, 4).map(item => ({
      label: item.label,
      count: item.count,
      examples: item.evidence.slice(0, 1).map(evidence => evidence.text),
    })),
    reusableMaterials: summary.materialClusters.slice(0, 6).map(item => ({
      material: item.material,
      useCases: item.useCases.slice(0, 5),
      examples: item.evidence.slice(0, 1).map(evidence => evidence.text),
    })),
    savedExpressions: summary.savedExpressions.slice(0, 12).map(item => ({
      expression: item.expression,
      originalSnippet: item.originalSnippet,
    })),
    masteredExpressions: (profile.masteredExpressions || []).slice(0, 30),
    instruction:
      'Use this profile only as soft context. Do not replace current-answer feedback. Mention a recurring pattern only when the same issue appears in the current attempt. Do not invent cross-session claims. Do not recommend mastered expressions as new upgrades.',
  };
};
