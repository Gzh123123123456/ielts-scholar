import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { SerifButton } from '@/src/components/ui/SerifButton';
import { useApp } from '@/src/context/AppContext';
import { routedAnalyzeWriting, routedCoachWritingFramework, routedExtractWritingFramework } from '@/src/lib/ai';
import { formatBandEstimate } from '@/src/lib/bands';
import { writingTask2, WritingQuestion } from '@/src/data/questions/bank';
import {
  WritingFeedback,
  WritingFrameworkCoachFeedback,
  WritingFrameworkReadiness,
} from '@/src/lib/ai/schemas';
import {
  createRecordId,
  getActiveWritingTask2,
  saveActiveWritingTask2,
  summarizeDiagnostic,
  upsertPracticeRecord,
  ProviderDiagnosticSummary,
  WritingTask2PracticeRecord,
} from '@/src/lib/practiceRecords';
import { Send, ArrowRight, FileDown, AlertCircle, Sparkles, Trash2 } from 'lucide-react';

type LanguageBankView = {
  topicVocabulary: WritingFeedback['vocabularyUpgrade']['topicVocabulary'];
  expressionUpgrades: WritingFeedback['vocabularyUpgrade']['expressionUpgrades'];
};

const WRITING_ANALYSIS_TIMEOUT_MS = 90000;

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const withTimeout = async <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const hasLowSignalText = (text: string) => {
  const normalized = text.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return true;
  const words = normalized.split(' ').filter(Boolean);
  const uniqueWords = new Set(words);
  return normalized.replace(/\s/g, '').length < 20 || (words.length >= 5 && uniqueWords.size <= 2);
};

const isInsufficientTask2Sample = (text: string) => {
  const words = countWords(text);
  return words <= 20 || (words < 60 && hasLowSignalText(text));
};

const isPlaceholderModelAnswer = (text: string) =>
  !text.trim() ||
  text === 'Sample Band 9 essay content...' ||
  /too short for a high training estimate|provider returned incomplete|malformed or incomplete/i.test(text);

const humanizeKey = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/\b\w/g, character => character.toUpperCase());

const dimensionLabels: Record<string, string> = {
  TR: '任务回应 / Task Response',
  CC: '连贯性 / Coherence',
  LR: '词汇准确性 / Lexical Resource',
  GRA: '语法准确性 / Grammar',
};

const categoryLabels: Record<string, string> = {
  lexical_precision: '词汇准确性 / Lexical Precision',
  word_choice: '词汇选择 / Word Choice',
  grammar: '语法准确性 / Grammar',
  grammatical_accuracy: '语法准确性 / Grammar',
  coherence: '连贯性 / Coherence',
  cohesion: '衔接 / Cohesion',
  task_response: '任务回应 / Task Response',
  task_achievement: '任务完成度 / Task Achievement',
  provider_safety: '反馈格式 / Feedback Format',
  insufficient_sample: '样本不足 / Insufficient Sample',
};

const displayDimension = (value: string) => dimensionLabels[value] || humanizeKey(value);

const displayCategory = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return categoryLabels[normalized] || humanizeKey(value);
};

const shortenPhrase = (text: string, maxWords = 8) => {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const words = cleaned.split(' ').filter(Boolean);
  if (words.length <= maxWords) return cleaned;
  return `${words.slice(0, maxWords).join(' ')}...`;
};

const phraseLevel = (text: string, maxWords = 7) => {
  const cleaned = text.replace(/[.!?;:]+$/g, '').replace(/\s+/g, ' ').trim();
  const words = cleaned.split(' ').filter(Boolean);
  return words.length <= maxWords ? cleaned : words.slice(0, maxWords).join(' ');
};

const getLanguageBankHighlightTerms = (
  vocabulary: LanguageBankView,
  sentenceFeedback: WritingFeedback['sentenceFeedback'] = [],
) => {
  const terms = [
    ...vocabulary.topicVocabulary.map(item => item.expression),
    ...vocabulary.expressionUpgrades.map(item => item.better),
    ...sentenceFeedback.flatMap(item => item.microUpgrades?.map(upgrade => upgrade.better) || []),
  ]
    .map(item => item.trim())
    .filter(item => item.length >= 6 && !/\.{3}|…/.test(item));
  return Array.from(new Set(terms.map(item => item.toLowerCase())))
    .map(lower => terms.find(item => item.toLowerCase() === lower) || lower)
    .sort((a, b) => b.length - a.length)
    .slice(0, 16);
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const markLanguageBankTerms = (text: string, terms: string[]) => {
  let marked = text;
  terms.forEach(term => {
    const pattern = new RegExp(`\\b(${escapeRegExp(term)})\\b`, 'gi');
    marked = marked.replace(pattern, '**$1**');
  });
  return marked;
};

const renderHighlightedModelAnswer = (text: string, terms: string[]) => {
  if (!terms.length) return text;
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
  return text.split(pattern).map((part, index) => (
    terms.some(term => term.toLowerCase() === part.toLowerCase())
      ? <mark key={`${part}-${index}`} className="language-bank-mark">{part}</mark>
      : <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
  ));
};

type ModelAnswerAnnotation = NonNullable<WritingFeedback['modelAnswerAnnotations']>[number];

const annotationClassNames: Record<ModelAnswerAnnotation['type'], string> = {
  topic_vocabulary: 'model-answer-mark model-answer-mark--topic',
  expression_upgrade: 'model-answer-mark model-answer-mark--expression',
  sentence_repair: 'model-answer-mark model-answer-mark--sentence',
  logic_repair: 'model-answer-mark model-answer-mark--logic',
};

const getValidModelAnswerAnnotations = (
  text: string,
  annotations?: WritingFeedback['modelAnswerAnnotations'],
) =>
  (annotations || [])
    .filter(item => item.quote.trim() && text.includes(item.quote))
    .filter((item, index, items) => items.findIndex(candidate => candidate.quote === item.quote) === index)
    .sort((a, b) => b.quote.length - a.quote.length)
    .slice(0, 14);

const renderAnnotatedModelAnswer = (
  text: string,
  annotations: ModelAnswerAnnotation[],
  fallbackTerms: string[],
) => {
  if (!annotations.length) return renderHighlightedModelAnswer(text, fallbackTerms);
  const spans = annotations
    .map(annotation => ({
      annotation,
      start: text.indexOf(annotation.quote),
      end: text.indexOf(annotation.quote) + annotation.quote.length,
    }))
    .filter(span => span.start >= 0)
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .reduce<{ annotation: ModelAnswerAnnotation; start: number; end: number }[]>((acc, span) => {
      const previous = acc[acc.length - 1];
      if (previous && span.start < previous.end) return acc;
      acc.push(span);
      return acc;
    }, []);

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  spans.forEach((span, index) => {
    if (span.start > cursor) {
      nodes.push(<React.Fragment key={`text-${index}`}>{text.slice(cursor, span.start)}</React.Fragment>);
    }
    nodes.push(
      <mark
        key={`${span.annotation.type}-${span.start}`}
        className={annotationClassNames[span.annotation.type]}
        aria-label={span.annotation.labelZh}
      >
        {text.slice(span.start, span.end)}
      </mark>,
    );
    cursor = span.end;
  });
  if (cursor < text.length) nodes.push(<React.Fragment key="text-end">{text.slice(cursor)}</React.Fragment>);
  return nodes;
};

const averageWritingScore = (feedback: WritingFeedback) =>
  Math.round(((feedback.scores.taskResponse +
    feedback.scores.coherenceCohesion +
    feedback.scores.lexicalResource +
    feedback.scores.grammaticalRangeAccuracy) / 4) * 2) / 2;

const getTargetModelLevel = (feedback: WritingFeedback) => {
  if (feedback.modelAnswerTargetLevel?.trim()) return feedback.modelAnswerTargetLevel.trim();
  const estimate = averageWritingScore(feedback);
  if (estimate <= 5.5) return 'Target Band 7.0';
  if (estimate <= 6.5) return 'Target Band 7.5';
  if (estimate <= 7.0) return 'Target Band 7.5-8.0';
  return 'Examiner-friendly refinement';
};

const uniqueStrings = (items: (string | undefined)[]) => {
  const seen = new Set<string>();
  return items
    .map(item => item?.trim())
    .filter((item): item is string => Boolean(item))
    .filter(item => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const getCorrectionIssues = (item: WritingFeedback['sentenceFeedback'][number]) =>
  uniqueStrings([
    item.primaryIssue,
    ...(item.secondaryIssues || []),
    displayCategory(item.tag),
    displayDimension(item.dimension),
  ]).slice(0, 5);

const conciseIssueLabels: Record<string, string> = {
  lexical_precision: '表达不地道',
  word_choice: '表达不地道',
  collocation: '搭配不自然',
  naturalness: '表达不地道',
  tone: '语气不够客观',
  task_response: '回应题目不清',
  off_topic: '开头跑题',
  paragraph_development: '论证展开不足',
  sentence_boundary: '句子结构混乱',
  article_plural_punctuation: '语法细节不稳',
  grammar: '语法不准确',
  grammatical_accuracy: '语法不准确',
};

const getConciseCorrectionIssue = (item: WritingFeedback['sentenceFeedback'][number]) => {
  const source = `${item.issueType || ''} ${item.tag || ''} ${item.primaryIssue || ''}`.toLowerCase();
  const key = Object.keys(conciseIssueLabels).find(label => source.includes(label));
  if (key) return conciseIssueLabels[key];
  if (item.dimension === 'LR') return '表达不地道';
  if (item.dimension === 'TR') return '回应题目不清';
  if (item.dimension === 'CC') return '句子衔接不清';
  return '语法不准确';
};

const getProblemQuote = (item: WritingFeedback['sentenceFeedback'][number]) => {
  const original = item.original.trim();
  const isPhraseLevelSource = (value: string) => {
    if (!value || !original.includes(value)) return false;
    const sourceWords = countWords(value);
    const originalWords = countWords(original);
    return value.length < original.length * 0.82 && sourceWords < Math.max(originalWords - 2, 2);
  };
  const candidates = [
    item.microUpgrades?.[0]?.original,
    item.sourceQuote,
  ]
    .map(value => value?.trim())
    .filter((value): value is string => Boolean(value));
  return candidates.find(isPhraseLevelSource) || '';
};

const renderOriginalSentence = (item: WritingFeedback['sentenceFeedback'][number]) => {
  const quote = getProblemQuote(item);
  if (!quote) return <span className="correction-source-sentence">{item.original}</span>;
  const index = item.original.indexOf(quote);
  if (index < 0) return <span>{item.original}</span>;
  return (
    <>
      {item.original.slice(0, index)}
      <mark className="correction-source-mark">{quote}</mark>
      {item.original.slice(index + quote.length)}
    </>
  );
};

type EssayParagraph = {
  text: string;
  start: number;
  end: number;
};

type AnnotatedCorrectionSpan = {
  correction: WritingFeedback['sentenceFeedback'][number];
  correctionIndex: number;
  correctionId: string;
  start: number;
  end: number;
  quote: string;
  paragraphIndex: number;
  matchLevel: 'phrase' | 'sentence';
};

const getCorrectionId = (item: WritingFeedback['sentenceFeedback'][number], index: number) =>
  item.id || `C${item.correctionNumber || index + 1}`;

const getCorrectionIdAliases = (item: WritingFeedback['sentenceFeedback'][number], index: number) => {
  const number = item.correctionNumber || index + 1;
  return new Set([getCorrectionId(item, index), `C${number}`, String(number)].map(value => value.toLowerCase()));
};

const getEssayParagraphs = (text: string): EssayParagraph[] => {
  if (!text) return [];
  const paragraphs: EssayParagraph[] = [];
  const separatorPattern = /\n\s*\n/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = separatorPattern.exec(text)) !== null) {
    const paragraphText = text.slice(cursor, match.index);
    if (paragraphText.trim()) {
      paragraphs.push({ text: paragraphText, start: cursor, end: match.index });
    }
    cursor = match.index + match[0].length;
  }
  const finalText = text.slice(cursor);
  if (finalText.trim()) {
    paragraphs.push({ text: finalText, start: cursor, end: text.length });
  }
  return paragraphs.length ? paragraphs : [{ text, start: 0, end: text.length }];
};

const getParagraphIndexForSpan = (paragraphs: EssayParagraph[], start: number) => {
  const index = paragraphs.findIndex(paragraph => start >= paragraph.start && start < paragraph.end);
  return index >= 0 ? index : 0;
};

const findTextSpans = (text: string, needle: string) => {
  const trimmed = needle.replace(/\s+/g, ' ').trim();
  if (!trimmed) return [];
  const pattern = new RegExp(trimmed.split(/\s+/).map(escapeRegExp).join('\\s+'), 'gi');
  const spans: { start: number; end: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    spans.push({ start: match.index, end: match.index + match[0].length });
    if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
  }
  return spans;
};

const findUniqueTextSpan = (text: string, needle: string) => {
  const spans = findTextSpans(text, needle);
  return spans.length === 1 ? spans[0] : null;
};

const getPhraseCandidates = (item: WritingFeedback['sentenceFeedback'][number]) =>
  uniqueStrings([
    item.sourceQuote,
    getProblemQuote(item),
    ...(item.microUpgrades || []).map(upgrade => upgrade.original),
  ])
    .filter(candidate => candidate.length >= 3)
    .filter(candidate => {
      const original = item.original.trim();
      if (!original) return true;
      return candidate.length < original.length * 0.9 && countWords(candidate) < Math.max(countWords(original) - 1, 2);
    })
    .sort((a, b) => b.length - a.length);

const findCorrectionSpan = (
  essayText: string,
  item: WritingFeedback['sentenceFeedback'][number],
) => {
  const originalSpan = findUniqueTextSpan(essayText, item.original);
  const phraseCandidates = getPhraseCandidates(item);

  if (originalSpan) {
    const originalText = essayText.slice(originalSpan.start, originalSpan.end);
    for (const candidate of phraseCandidates) {
      const localSpan = findUniqueTextSpan(originalText, candidate);
      if (localSpan) {
        return {
          start: originalSpan.start + localSpan.start,
          end: originalSpan.start + localSpan.end,
          matchLevel: 'phrase' as const,
        };
      }
    }
    return { ...originalSpan, matchLevel: 'sentence' as const };
  }

  for (const candidate of phraseCandidates) {
    const span = findUniqueTextSpan(essayText, candidate);
    if (span) return { ...span, matchLevel: 'phrase' as const };
  }

  return null;
};

const getAnnotatedCorrectionSpans = (
  essayText: string,
  sentenceFeedback: WritingFeedback['sentenceFeedback'],
  paragraphs: EssayParagraph[],
): AnnotatedCorrectionSpan[] =>
  sentenceFeedback
    .map((item, index) => {
      const span = findCorrectionSpan(essayText, item);
      if (!span) return null;
      return {
        correction: item,
        correctionIndex: index,
        correctionId: getCorrectionId(item, index),
        start: span.start,
        end: span.end,
        quote: essayText.slice(span.start, span.end),
        paragraphIndex: getParagraphIndexForSpan(paragraphs, span.start),
        matchLevel: span.matchLevel,
      };
    })
    .filter((item): item is AnnotatedCorrectionSpan => Boolean(item))
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .reduce<AnnotatedCorrectionSpan[]>((acc, span) => {
      const previous = acc[acc.length - 1];
      if (previous && span.start < previous.end) return acc;
      acc.push(span);
      return acc;
    }, []);

const getRelatedLogicItems = (
  correction: WritingFeedback['sentenceFeedback'][number] | null,
  correctionIndex: number,
  logicItems: WritingFeedback['frameworkFeedback'],
) => {
  if (!correction) return [];
  const aliases = getCorrectionIdAliases(correction, correctionIndex);
  return logicItems.filter(item => (
    item.relatedCorrectionIds || []
  ).some(id => aliases.has(id.toLowerCase()) || aliases.has(id.replace(/^C/i, '').toLowerCase())));
};

const isLogicItemRelatedToCorrection = (
  item: WritingFeedback['frameworkFeedback'][number],
  correction: WritingFeedback['sentenceFeedback'][number] | null,
  correctionIndex: number,
) => {
  if (!correction) return false;
  const aliases = getCorrectionIdAliases(correction, correctionIndex);
  return (item.relatedCorrectionIds || []).some(id => aliases.has(id.toLowerCase()) || aliases.has(id.replace(/^C/i, '').toLowerCase()));
};

const getVisibleMicroUpgrades = (item: WritingFeedback['sentenceFeedback'][number]) => {
  const problemQuote = getProblemQuote(item).toLowerCase();
  const unique = (item.microUpgrades || [])
    .filter((upgrade, index, items) => (
      items.findIndex(candidate => (
        candidate.original.toLowerCase() === upgrade.original.toLowerCase() &&
        candidate.better.toLowerCase() === upgrade.better.toLowerCase()
      )) === index
    ))
    .filter(upgrade => upgrade.original.toLowerCase() !== problemQuote);
  return unique.length > 1 ? unique : [];
};

const getVisibleTransferGuidance = (item: WritingFeedback['sentenceFeedback'][number]) => {
  const guidance = (item.transferGuidanceZh || defaultSentenceTransfer(item)).trim();
  if (!guidance || guidance.length > 110 || similarFeedbackText(guidance, item.explanationZh)) return '';
  return guidance;
};

const getShortUsageNote = (usageZh?: string) => {
  const usage = (usageZh || '').replace(/^用于[:：]?/, '').trim();
  return usage && usage.length <= 58 ? usage : '';
};

const defaultSentenceTransfer = (item: WritingFeedback['sentenceFeedback'][number]) => {
  const tag = item.tag.toLowerCase();
  if (/spelling|capital/.test(tag)) return '下次最后通读时专门扫一遍大小写和拼写，不要只看论点是否完整。';
  if (/article|plural|singular|noun/.test(tag)) return '下次检查名词短语：可数不可数、单复数、a / the 是否需要。';
  if (/punctuation|sentence_boundary/.test(tag)) return '下次看到两个完整分句时，优先用句号、分号或明确连接词，不要只用逗号连接。';
  if (item.dimension === 'LR') return '下次按短语块记忆表达，优先复用搭配，而不是临场逐词翻译。';
  if (item.dimension === 'TR') return '下次每写一句都回看题目关键词，确认它在推进任务回应。';
  if (item.dimension === 'CC') return '下次用“主题句 -> 原因 -> 例子 -> 回扣”检查段落推进。';
  return '下次写完后同时检查主谓、时态、单复数、搭配和标点。';
};

const defaultLogicTransfer = () =>
  '下次先判断这一部分的作用：提出立场、承认反方，还是证明主观点。';

type LogicLocation = NonNullable<WritingFeedback['frameworkFeedback'][number]['location']>;

const logicLocationOrder: LogicLocation[] = [
  'Whole Essay',
  'Introduction',
  'Body Paragraph 1',
  'Body Paragraph 2',
  'Conclusion',
  'Unknown / General',
];

const logicLocationLabels: Record<LogicLocation, string> = {
  'Whole Essay': '整篇文章',
  Introduction: '开头段',
  'Body Paragraph 1': '主体段一',
  'Body Paragraph 2': '主体段二',
  Conclusion: '结尾段',
  'Unknown / General': '相关部分',
};

const displayLogicLocationZh = (item: WritingFeedback['frameworkFeedback'][number]) =>
  logicLocationLabels[getDisplayLocation(item)];

const normalizeLearnerChineseText = (text?: string) =>
  (text || '')
    .replace(/\bWhole Essay\b/g, '整篇文章')
    .replace(/\bIntroduction\b/g, '开头段')
    .replace(/\bBody Paragraph 1\b/g, '主体段一')
    .replace(/\bBody Paragraph 2\b/g, '主体段二')
    .replace(/\bConclusion\b/g, '结尾段')
    .replace(/\bUnknown \/ General\b/g, '相关部分')
    .replace(/Paragraph-level issue: no single sentence correction fully solves this\.?/gi, '')
    .trim();

const similarFeedbackText = (a?: string, b?: string) => {
  const compact = (value?: string) => normalizeLearnerChineseText(value).replace(/\s+/g, '');
  const left = compact(a);
  const right = compact(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
};

const usefulLogicDiagnosis = (item: WritingFeedback['frameworkFeedback'][number]) => {
  const diagnosis = normalizeLearnerChineseText(item.suggestionZh);
  const fix = normalizeLearnerChineseText(item.paragraphFixZh);
  return diagnosis && !similarFeedbackText(diagnosis, fix) ? diagnosis : '';
};

const isWarningIssue = (issue: string) =>
  /under-length|insufficient sample|extremely insufficient|unreliable training estimate/i.test(issue);

const isWordCountWarning = (item: { title?: string; messageZh?: string }) =>
  /under-length|under 250|insufficient sample|extremely insufficient|unreliable training estimate|essay development warning|word-count|word count|低于\s*250|样本太短|样本不足|字数|训练估计/i
    .test(`${item.title || ''} ${item.messageZh || ''}`);

const isPureLocalLanguageIssue = (item: WritingFeedback['frameworkFeedback'][number]) => {
  const text = `${item.issue} ${item.suggestionZh} ${item.issueType || ''}`.toLowerCase();
  return /lexical|vocab|word choice|collocation|grammar|tense|article|punctuation|spelling/.test(text)
    && !/task response|off-topic|irrelevant|position|paragraph|structure|development|support|example|advantage|disadvantage|concession|coherence/.test(text);
};

const getDisplayLocation = (item: WritingFeedback['frameworkFeedback'][number]): LogicLocation => {
  if (item.location && logicLocationOrder.includes(item.location)) return item.location;
  const text = `${item.issue} ${item.suggestionZh}`.toLowerCase();
  if (/introduction|opening|intro/.test(text)) return 'Introduction';
  if (/body\s*(paragraph)?\s*1|first body/.test(text)) return 'Body Paragraph 1';
  if (/body\s*(paragraph)?\s*2|second body/.test(text)) return 'Body Paragraph 2';
  if (/conclusion|closing/.test(text)) return 'Conclusion';
  if (/whole|overall|essay|task response|position/.test(text)) return 'Whole Essay';
  return 'Unknown / General';
};

const normalizeWordCountWarning = (message: string, localWords: number) => {
  const localWarning = `当前约 ${localWords} 词，低于 Task 2 的 250 词要求。请扩展论点、解释和例子。`;
  const withoutProviderCount = message
    .replace(/\b\d{1,3}\s+words?\b/gi, '')
    .replace(/当前约\s*\d{1,3}\s*词/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!withoutProviderCount || /under\s*250|低于\s*Task 2\s*的\s*250|低于\s*250|字数|word/i.test(withoutProviderCount)) {
    return localWarning;
  }
  return `${localWarning} ${withoutProviderCount}`;
};

const getEssayWarnings = (feedback: WritingFeedback, isInsufficientSample: boolean, localWords: number) => {
  const explicit = Array.isArray(feedback.essayLevelWarnings) ? feedback.essayLevelWarnings : [];
  const legacy = feedback.frameworkFeedback
    .filter(item => isWarningIssue(item.issue))
    .map(item => ({
      title: item.issue,
      messageZh: item.paragraphFixZh || item.suggestionZh,
    }));
  const insufficient = isInsufficientSample
    ? [{
        title: 'Essay development warning',
        messageZh: 'This response is under 250 words or too low-signal, so the training estimate is capped. Expand body paragraphs before treating the estimate as reliable.',
      }]
    : [];
  const normalized = [...explicit, ...legacy, ...insufficient].map(item => (
    isWordCountWarning(item)
      ? { ...item, messageZh: normalizeWordCountWarning(item.messageZh, localWords) }
      : item
  ));
  const seen = new Set<string>();
  const merged = normalized.filter(item => {
    const key = isWordCountWarning(item) ? 'local-word-count-warning' : `${item.title}|${item.messageZh}`;
    if (!item.messageZh || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const firstWordCountWarning = merged.find(isWordCountWarning);
  return merged.filter(item => !isWordCountWarning(item) || item === firstWordCountWarning);
};

const providerDisplayNames: Record<string, string> = {
  mock: 'Mock provider',
  gemini: 'Gemini',
  deepseek: 'DeepSeek',
};

const displayProviderName = (providerName?: string) => {
  if (!providerName) return 'Provider not recorded';
  const normalized = providerName.trim().toLowerCase();
  return providerDisplayNames[normalized] || humanizeKey(providerName);
};

const getScoreTransparencyParts = (
  diagnostic: ProviderDiagnosticSummary | null,
  fallbackUsed: boolean,
  wordCount: number,
  isUnderTask2Minimum: boolean,
) => {
  const parts = ['Training estimate'];
  if (diagnostic?.providerName) parts.push(displayProviderName(diagnostic.providerName));
  if (diagnostic?.fallbackUsed || fallbackUsed) parts.push('fallback/normalization used');
  if (diagnostic?.normalizedFields?.length) parts.push(`${diagnostic.normalizedFields.length} normalized field${diagnostic.normalizedFields.length > 1 ? 's' : ''}`);
  if (diagnostic?.validationErrors?.length) parts.push(`${diagnostic.validationErrors.length} validation issue${diagnostic.validationErrors.length > 1 ? 's' : ''}`);
  if (isUnderTask2Minimum) parts.push(`capped under 250 words (${wordCount}/250)`);
  return parts;
};

const scoreDimensions = [
  {
    key: 'taskResponse',
    label: 'Task Response',
    helper: 'IELTS training dimension',
  },
  {
    key: 'coherenceCohesion',
    label: 'Coherence & Cohesion',
    helper: 'IELTS training dimension',
  },
  {
    key: 'lexicalResource',
    label: 'Lexical Resource',
    helper: 'IELTS training dimension',
  },
  {
    key: 'grammaticalRangeAccuracy',
    label: 'Grammar Range & Accuracy',
    helper: 'IELTS training dimension',
  },
] satisfies {
  key: keyof WritingFeedback['scores'];
  label: string;
  helper: string;
}[];

const getLogicFeedback = (feedback: WritingFeedback) =>
  feedback.frameworkFeedback.filter(item => !isWarningIssue(item.issue) && !isPureLocalLanguageIssue(item));

const groupedLogicFeedback = (items: WritingFeedback['frameworkFeedback']) =>
  logicLocationOrder
    .map(location => ({
      location,
      items: items.filter(item => getDisplayLocation(item) === location),
    }))
    .filter(group => group.items.length);

const getLogicGroupForCorrection = (
  correction: WritingFeedback['sentenceFeedback'][number] | null,
  correctionIndex: number,
  logicItems: WritingFeedback['frameworkFeedback'],
): LogicLocation | null => {
  const related = getRelatedLogicItems(correction, correctionIndex, logicItems);
  return related[0] ? getDisplayLocation(related[0]) : null;
};

const getLogicLocationForEssayParagraph = (paragraphIndex: number, paragraphCount: number): LogicLocation | null => {
  if (paragraphIndex < 0 || paragraphCount <= 0) return null;
  if (paragraphIndex === 0) return 'Introduction';
  if (paragraphIndex === 1) return 'Body Paragraph 1';
  if (paragraphIndex === 2) return 'Body Paragraph 2';
  if (paragraphIndex === paragraphCount - 1 && paragraphCount >= 4) return 'Conclusion';
  return null;
};

const canUseParagraphLogicMapping = (correction: WritingFeedback['sentenceFeedback'][number] | null) => {
  if (!correction) return false;
  const text = `${correction.dimension} ${correction.issueType || ''} ${correction.tag} ${correction.primaryIssue || ''}`.toLowerCase();
  return correction.dimension === 'TR'
    || correction.dimension === 'CC'
    || /task.response|task_response|coherence|cohesion|logic|paragraph|structure|development|support|position/.test(text);
};

const getSeverityTone = (item: WritingFeedback['sentenceFeedback'][number]) => {
  const text = `${item.severity || ''} ${item.issueType || ''} ${item.dimension || ''} ${item.tag || ''} ${item.primaryIssue || ''}`.toLowerCase();
  if (/fatal|major|task.response|task_response|off.topic|off_topic/.test(text) || item.dimension === 'TR') return 'major';
  if (/medium|coherence|cohesion|sentence.boundary|sentence_boundary/.test(text) || item.dimension === 'CC') return 'medium';
  if (/minor|polish|micro|article|plural|punctuation|spelling/.test(text)) return 'minor';
  return 'unknown';
};

type OverlayRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getOverlayPosition = (anchor: DOMRect, size: { width: number; height: number }, placementOnly = false): OverlayRect => {
  const margin = 16;
  const gap = 18;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxLeft = Math.max(margin, viewportWidth - size.width - margin);
  const maxTop = Math.max(margin, viewportHeight - size.height - margin);
  const anchorCenterX = anchor.left + anchor.width / 2;
  const anchorCenterY = anchor.top + anchor.height / 2;
  const preferRight = anchorCenterX >= viewportWidth / 2;
  let left = preferRight ? anchor.right + gap : anchor.left - size.width - gap;

  if (!placementOnly) {
    if (preferRight && left + size.width > viewportWidth - margin) left = anchor.left - size.width - gap;
    if (!preferRight && left < margin) left = anchor.right + gap;
  }
  left = clampNumber(left, margin, maxLeft);

  let top = anchorCenterY - size.height / 2;
  if (!placementOnly) {
    if (anchor.top < size.height + margin && anchor.bottom + gap + size.height <= viewportHeight - margin) {
      top = anchor.bottom + gap;
    }
    if (anchor.bottom > viewportHeight - size.height - margin && anchor.top - gap - size.height >= margin) {
      top = anchor.top - size.height - gap;
    }
  }
  top = clampNumber(top, margin, maxTop);

  return { left, top, width: size.width, height: size.height };
};

const getOverlayTether = (anchorEl: HTMLElement, rect: OverlayRect) => {
  const anchorRect = anchorEl.getBoundingClientRect();
  const anchorX = anchorRect.right - 2;
  const anchorY = anchorRect.top + Math.max(2, anchorRect.height * 0.18);
  const cardX = anchorX < rect.left ? rect.left : rect.left + rect.width;
  const cardY = clampNumber(anchorY, rect.top + 18, rect.top + rect.height - 18);
  return {
    anchorPoint: { x: anchorX, y: anchorY },
    cardPoint: { x: cardX, y: cardY },
  };
};

type AnnotationOverlayProps = {
  span: AnnotatedCorrectionSpan;
  anchorEl: HTMLElement | null;
  onClose: () => void;
};

const AnnotationOverlay = ({ span, anchorEl, onClose }: AnnotationOverlayProps) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [rect, setRect] = useState<OverlayRect>(() => ({
    left: 24,
    top: 96,
    width: 380,
    height: 300,
  }));
  const [anchorPoint, setAnchorPoint] = useState({ x: 0, y: 0 });
  const [cardPoint, setCardPoint] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null);
  const resizeRef = useRef<{ pointerId: number; x: number; width: number; ratio: number } | null>(null);

  const updateTether = (nextRect = rect) => {
    if (!anchorEl || isMobile) return;
    const next = getOverlayTether(anchorEl, nextRect);
    setAnchorPoint(next.anchorPoint);
    setCardPoint(next.cardPoint);
  };

  useEffect(() => {
    const syncMobile = () => setIsMobile(window.innerWidth < 768);
    syncMobile();
    window.addEventListener('resize', syncMobile);
    return () => window.removeEventListener('resize', syncMobile);
  }, []);

  useEffect(() => {
    if (!anchorEl || isMobile) return;
    const anchorRect = anchorEl.getBoundingClientRect();
    const nextWidth = clampNumber(Math.min(window.innerWidth - 32, 390), 300, 640);
    const nextHeight = clampNumber(300, 220, Math.max(220, window.innerHeight - 32));
    const nextRect = getOverlayPosition(anchorRect, { width: nextWidth, height: nextHeight });
    setRect(nextRect);
    updateTether(nextRect);
  }, [anchorEl, isMobile, span.correctionId]);

  useEffect(() => {
    updateTether();
    const onScroll = () => {
      if (!anchorEl || isMobile) return;
      updateTether();
    };
    const onResize = () => {
      if (!anchorEl || isMobile) return;
      const anchorRect = anchorEl.getBoundingClientRect();
      setRect(current => {
        const nextRect = getOverlayPosition(anchorRect, current, true);
        const nextTether = getOverlayTether(anchorEl, nextRect);
        setAnchorPoint(nextTether.anchorPoint);
        setCardPoint(nextTether.cardPoint);
        return nextRect;
      });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      if (cardRef.current?.contains(target)) return;
      if (target.closest('.annotated-essay-mark')) return;
      onClose();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [anchorEl, isMobile, onClose, rect.height, rect.left, rect.top, rect.width]);

  useEffect(() => {
    updateTether();
  }, [rect, anchorEl, isMobile]);

  const correction = span.correction;
  const visibleTransferGuidance = getVisibleTransferGuidance(correction);
  const maxHeight = typeof window === 'undefined' ? 520 : Math.max(220, window.innerHeight - 32);

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isMobile) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
  };

  const onDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const margin = 12;
    setRect(current => ({
      ...current,
      left: clampNumber(drag.left + event.clientX - drag.x, margin, window.innerWidth - current.width - margin),
      top: clampNumber(drag.top + event.clientY - drag.y, margin, window.innerHeight - 48),
    }));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const beginResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (isMobile) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      width: rect.width,
      ratio: rect.width / rect.height,
    };
  };

  const onResizeMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    const maxWidth = Math.min(640, window.innerWidth - rect.left - 12);
    const width = clampNumber(resize.width + event.clientX - resize.x, 300, maxWidth);
    const height = clampNumber(width / resize.ratio, 220, maxHeight);
    setRect(current => ({ ...current, width, height }));
  };

  const endResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (resizeRef.current?.pointerId === event.pointerId) resizeRef.current = null;
  };

  const content = (
    <>
      {!isMobile && anchorEl && (
        <svg className="annotation-tether" aria-hidden="true">
          <line x1={anchorPoint.x} y1={anchorPoint.y} x2={cardPoint.x} y2={cardPoint.y} />
        </svg>
      )}
      <div
        ref={cardRef}
        className={isMobile ? 'annotation-overlay annotation-overlay--sheet' : 'annotation-overlay'}
        style={isMobile ? undefined : { left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
      >
        <div
          className="annotation-overlay__header"
          onPointerDown={beginDrag}
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div>
            <p className="annotation-overlay__eyebrow">
              Correction {correction.correctionNumber ? `#${correction.correctionNumber}` : span.correctionId} · {span.correctionId}
            </p>
            <h4>{getConciseCorrectionIssue(correction)}</h4>
          </div>
          <button
            type="button"
            className="annotation-overlay__close"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            aria-label="Close annotation"
          >
            ×
          </button>
        </div>
        <div className="annotation-overlay__body">
          <section>
            <p className="annotation-overlay__label">Original</p>
            <p className="annotation-overlay__original">{renderOriginalSentence(correction)}</p>
          </section>
          <section>
            <p className="annotation-overlay__label">Corrected</p>
            <p className="annotation-overlay__corrected">{correction.correction}</p>
          </section>
          <section className="annotation-overlay__chips">
            <span>{correction.primaryIssue || getConciseCorrectionIssue(correction)}</span>
            {(correction.secondaryIssues || []).map(issue => <span key={issue}>{issue}</span>)}
          </section>
          {correction.microUpgrades?.length ? (
            <section className="annotation-overlay__stack">
              <p className="annotation-overlay__label">Micro upgrades</p>
              {correction.microUpgrades.map((upgrade, upgradeIndex) => (
                <div key={`${upgrade.original}-${upgradeIndex}`} className="annotation-overlay__upgrade">
                  <p><span>{upgrade.original}</span> <b>{upgrade.better}</b></p>
                  <p>{normalizeLearnerChineseText(upgrade.explanationZh)}</p>
                </div>
              ))}
            </section>
          ) : null}
          <section>
            <p className="annotation-overlay__label">Why this matters</p>
            <p>{normalizeLearnerChineseText(correction.explanationZh)}</p>
          </section>
          {visibleTransferGuidance && (
            <section>
              <p className="annotation-overlay__label">Transfer check</p>
              <p>{normalizeLearnerChineseText(visibleTransferGuidance)}</p>
            </section>
          )}
        </div>
        {!isMobile && (
          <button
            type="button"
            className="annotation-overlay__resize"
            aria-label="Resize annotation"
            onPointerDown={beginResize}
            onPointerMove={onResizeMove}
            onPointerUp={endResize}
            onPointerCancel={endResize}
          />
        )}
      </div>
    </>
  );

  return createPortal(content, document.body);
};

const isGenericExpressionNote = (text?: string) =>
  !text?.trim()
  || /把原文里比较口语或笼统的说法，换成更适合 Task 2 论证的短语|下次表达同一意思时，先替换关键词组，再检查句子是否推进论点|下次写到相同意思时，直接复用升级后的短语，再补上本题具体内容|这是 Task 2 论证中可以复用的句架|下次需要让步、转折、平衡观点或推进理由时使用|这是比单个词更适合记忆的搭配块|下次表达同一话题关系时，可以整块放进句子里/.test(text);

const getVocabularyUpgrade = (feedback: WritingFeedback): LanguageBankView => {
  const empty = {
    topicVocabulary: [] as WritingFeedback['vocabularyUpgrade']['topicVocabulary'],
    expressionUpgrades: [] as WritingFeedback['vocabularyUpgrade']['expressionUpgrades'],
  };
  const upgrade = (feedback.vocabularyUpgrade || empty) as WritingFeedback['vocabularyUpgrade'] & {
    userWordingUpgrades?: { original: string; better: string; explanationZh: string }[];
    collocationUpgrades?: string[];
    reusableSentenceFrames?: string[];
  };
  const topicVocabulary = (upgrade.topicVocabulary || [])
    .map((item: unknown) => {
      if (typeof item === 'string') {
        return {
          expression: item,
          meaningZh: '本题语境中的可复用话题词。',
          usageZh: '用于讨论题目中的具体对象或影响，不要当成万能作文套话。',
        };
      }
      if (item && typeof item === 'object' && 'expression' in item) {
        return item as WritingFeedback['vocabularyUpgrade']['topicVocabulary'][number];
      }
      return null;
    })
    .filter((item): item is WritingFeedback['vocabularyUpgrade']['topicVocabulary'][number] => Boolean(item));
  const lrCorrections: WritingFeedback['vocabularyUpgrade']['expressionUpgrades'] = feedback.sentenceFeedback
    .filter(item => item.dimension === 'LR')
    .flatMap(item => item.microUpgrades?.length
      ? item.microUpgrades.map(upgradeItem => ({
          category: 'from_essay' as const,
          original: upgradeItem.original,
          better: upgradeItem.better,
          explanationZh: upgradeItem.explanationZh,
          reuseWhenZh: '',
        }))
      : []);
  const legacyWording: WritingFeedback['vocabularyUpgrade']['expressionUpgrades'] = (upgrade.userWordingUpgrades || []).map(item => ({
    category: 'from_essay' as const,
    original: item.original,
    better: item.better,
    explanationZh: item.explanationZh,
    reuseWhenZh: '',
  }));
  const legacyCollocations: WritingFeedback['vocabularyUpgrade']['expressionUpgrades'] = (upgrade.collocationUpgrades || []).map(item => ({
    category: 'argument_frame' as const,
    better: item,
    explanationZh: '',
    reuseWhenZh: '',
  }));
  const legacyFrames: WritingFeedback['vocabularyUpgrade']['expressionUpgrades'] = (upgrade.reusableSentenceFrames || []).map(item => ({
    category: 'argument_frame' as const,
    better: item,
    explanationZh: '',
    reuseWhenZh: '',
  }));
  const expressionUpgrades: WritingFeedback['vocabularyUpgrade']['expressionUpgrades'] = [
    ...(upgrade.expressionUpgrades || []),
    ...legacyWording,
    ...lrCorrections,
    ...legacyCollocations,
    ...legacyFrames,
  ]
    .map(item => ({
      ...item,
      original: item.original ? phraseLevel(item.original) : undefined,
      better: phraseLevel(item.better, 14),
      explanationZh: isGenericExpressionNote(item.explanationZh) ? '' : item.explanationZh,
      reuseWhenZh: isGenericExpressionNote(item.reuseWhenZh) ? '' : item.reuseWhenZh,
    }))
    .filter((item, index, items) => items.findIndex(candidate => candidate.better.toLowerCase() === item.better.toLowerCase()) === index)
    .slice(0, 8);
  return {
    topicVocabulary: topicVocabulary.slice(0, 8),
    expressionUpgrades,
  };
};

const getLanguageBankMission = (feedback: WritingFeedback, vocabulary: LanguageBankView) => {
  const logicFix = normalizeLearnerChineseText(feedback.frameworkFeedback[0]?.paragraphFixZh);
  const mission = vocabulary.expressionUpgrades.length
    ? '重写最关键的一个主体段：先完成段落任务，再自然使用 2-3 个上方表达。'
    : '优先修正上方 Logic Review 指出的主要问题，再检查句子是否清晰。';
  return similarFeedbackText(mission, logicFix) ? [] : [mission];
};

const routeNotice = (
  route: { providerName: string; fallbackReason?: string; learnerReason: string },
  failureKind?: string,
) => {
  if (failureKind === 'provider_unavailable') return 'Provider unavailable. Your text is preserved.';
  if (route.fallbackReason && !/high-value final feedback/i.test(route.fallbackReason)) return route.fallbackReason;
  if (/cooling down|quota|reserve|discount protection|fallback|unavailable/i.test(route.learnerReason)) {
    return route.learnerReason;
  }
  return '';
};

const readinessLabels: Record<WritingFrameworkReadiness, string> = {
  not_ready: 'Not ready',
  almost_ready: 'Almost ready',
  ready_to_write: 'Ready to write',
};

const checklistLabels: Record<keyof WritingFrameworkCoachFeedback['checklist'], string> = {
  taskTypeAnswered: 'Task type answered',
  clearPosition: 'Clear position',
  bothViewsCovered: 'Both required views covered',
  supportExists: 'Usable examples or support',
  paragraphPlanClear: 'Paragraph plan is clear',
};

const formatCoachFeedback = (feedback: WritingFrameworkCoachFeedback, isMock: boolean) => {
  const lines = [
    `${readinessLabels[feedback.readiness]}${isMock ? ' (local mock)' : ''}`,
    feedback.message,
  ].filter(Boolean);

  const checklist = Object.entries(feedback.checklist)
    .map(([key, value]) => `${value ? 'OK' : 'Needs work'} - ${checklistLabels[key as keyof WritingFrameworkCoachFeedback['checklist']]}`)
    .join('\n');

  if (checklist) lines.push(`Checklist:\n${checklist}`);
  if (feedback.mainGaps.length) lines.push(`Main gaps:\n${feedback.mainGaps.map(item => `- ${item}`).join('\n')}`);
  if (feedback.finalFixes.length) lines.push(`Final small fixes:\n${feedback.finalFixes.map(item => `- ${item}`).join('\n')}`);
  if (feedback.nextQuestions.length) lines.push(`Next questions:\n${feedback.nextQuestions.map(item => `- ${item}`).join('\n')}`);
  if (feedback.readiness === 'ready_to_write' && feedback.readySummary) {
    lines.push(`Ready reason:\n${feedback.readySummary}`);
  }

  return lines.join('\n\n');
};

const Task2PhaseTabs = ({
  phase,
  hasFeedback,
  onChange,
}: {
  phase: 'framework' | 'writing' | 'results';
  hasFeedback: boolean;
  onChange: (phase: 'framework' | 'writing' | 'results') => void;
}) => {
  const tabs: { id: 'framework' | 'writing' | 'results'; label: string; disabled?: boolean }[] = [
    { id: 'framework', label: 'Phase 1: Framework' },
    { id: 'writing', label: 'Phase 2: Essay Editor' },
    { id: 'results', label: 'Phase 3: Final Analysis', disabled: !hasFeedback },
  ];

  return (
    <div className="practice-workspace phase-tabs gap-2 p-0.5 bg-paper-ink/5 rounded-sm mb-8 font-sans uppercase tracking-widest font-bold">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          disabled={tab.disabled}
          className={phase === tab.id ? 'phase-tab phase-tab-active' : 'phase-tab'}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default function WritingTask2Practice() {
  const { addDebugLog, saveSession, setProviderDiagnostic } = useApp();
  const [question, setQuestion] = useState<WritingQuestion | null>(null);
  const [phase, setPhase] = useState<'framework' | 'writing' | 'results'>('framework');
  const [frameworkChat, setFrameworkChat] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [frameworkInput, setFrameworkInput] = useState('');
  const [frameworkReadiness, setFrameworkReadiness] = useState<WritingFrameworkReadiness>('not_ready');
  const [latestFrameworkCoach, setLatestFrameworkCoach] = useState<WritingFrameworkCoachFeedback | null>(null);
  const [finalFrameworkSummary, setFinalFrameworkSummary] = useState('');
  const [frameworkSummaryGenerated, setFrameworkSummaryGenerated] = useState(false);
  const [essay, setEssay] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCoachingFramework, setIsCoachingFramework] = useState(false);
  const [isExtractingFramework, setIsExtractingFramework] = useState(false);
  const [frameworkExtractMessage, setFrameworkExtractMessage] = useState('');
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [feedbackFallbackUsed, setFeedbackFallbackUsed] = useState(false);
  const [feedbackDiagnostic, setFeedbackDiagnostic] = useState<ProviderDiagnosticSummary | null>(null);
  const [selectedCorrectionId, setSelectedCorrectionId] = useState<string | null>(null);
  const [openLogicLocation, setOpenLogicLocation] = useState<LogicLocation | null>(null);
  const [analyzedEssaySnapshot, setAnalyzedEssaySnapshot] = useState('');
  const [restoreMessage, setRestoreMessage] = useState('');
  const [providerErrorMessage, setProviderErrorMessage] = useState('');
  const [apiStatusMessage, setApiStatusMessage] = useState('');
  const discussionRef = useRef<HTMLDivElement | null>(null);
  const markerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const isFrameworkInputComposingRef = useRef(false);
  const coachRunIdRef = useRef(0);
  const cancelledCoachRunRef = useRef<number | null>(null);
  const analysisRunIdRef = useRef(0);
  const cancelledAnalysisRunRef = useRef<number | null>(null);
  const activeAttemptIdRef = useRef(createRecordId('wt2'));
  const restoredRecordRef = useRef<WritingTask2PracticeRecord | null>(null);
  const isRestoringRecordRef = useRef(false);

  useEffect(() => {
    const active = getActiveWritingTask2();
    if (active) {
      restoreWritingAttempt(active);
      return;
    }
    loadRandomQuestion();
  }, []);

  useEffect(() => {
    if (isRestoringRecordRef.current) {
      isRestoringRecordRef.current = false;
      return;
    }
    if (!question || isAnalyzing || isCoachingFramework || isExtractingFramework) return;
    persistWritingAttempt(providerErrorMessage ? 'provider_failed' : undefined);
  }, [
    question,
    phase,
    frameworkChat,
    frameworkInput,
    frameworkReadiness,
    latestFrameworkCoach,
    finalFrameworkSummary,
    frameworkSummaryGenerated,
    essay,
    feedback,
    feedbackFallbackUsed,
    analyzedEssaySnapshot,
    providerErrorMessage,
  ]);

  useEffect(() => {
    setSelectedCorrectionId(null);
  }, [feedback, analyzedEssaySnapshot]);

  const buildWritingRecord = (
    status: 'draft' | 'analyzed' | 'provider_failed' = feedback ? 'analyzed' : 'draft',
    overrides: {
      question?: WritingQuestion;
      phase?: 'framework' | 'writing' | 'results';
      essay?: string;
      feedback?: WritingFeedback | null;
      feedbackFallbackUsed?: boolean;
      providerDiagnostic?: ProviderDiagnosticSummary;
    } = {},
  ): WritingTask2PracticeRecord | null => {
    const recordQuestion = overrides.question || question;
    if (!recordQuestion) return null;
    const timestamp = new Date().toISOString();
    const existing = restoredRecordRef.current?.id === activeAttemptIdRef.current ? restoredRecordRef.current : null;
    const recordFeedback = overrides.feedback !== undefined ? overrides.feedback : feedback;
    const recordEssay = overrides.essay ?? recordFeedback?.essay ?? (analyzedEssaySnapshot || essay);
    return {
      id: activeAttemptIdRef.current,
      module: 'writing',
      mode: 'practice',
      status,
      task: 'task2',
      question: recordQuestion.question,
      questionId: recordQuestion.id,
      topic: recordQuestion.topicCategory,
      tags: recordQuestion.tags,
      taskType: recordQuestion.type,
      questionData: recordQuestion,
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
      analyzedAt: status === 'analyzed' ? existing?.analyzedAt || timestamp : existing?.analyzedAt,
      phase: overrides.phase || phase,
      frameworkChat,
      frameworkInput,
      frameworkReadiness,
      latestFrameworkCoach: latestFrameworkCoach || undefined,
      finalFrameworkSummary,
      frameworkSummaryGenerated,
      essay: recordEssay,
      feedback: status === 'provider_failed' ? undefined : recordFeedback || undefined,
      feedbackFallbackUsed: overrides.feedbackFallbackUsed ?? feedbackFallbackUsed,
      providerDiagnostic: overrides.providerDiagnostic || existing?.providerDiagnostic,
      obsidianMarkdown: status === 'provider_failed' ? undefined : recordFeedback?.obsidianMarkdown,
    };
  };

  const persistWritingAttempt = (
    status?: 'draft' | 'analyzed' | 'provider_failed',
    overrides?: Parameters<typeof buildWritingRecord>[1],
  ) => {
    const record = buildWritingRecord(status, overrides);
    if (!record) return;
    saveActiveWritingTask2(record);
    if (record.status !== 'draft') {
      upsertPracticeRecord(record);
    }
  };

  const restoreWritingAttempt = (record: WritingTask2PracticeRecord, message = '') => {
    isRestoringRecordRef.current = true;
    restoredRecordRef.current = record;
    activeAttemptIdRef.current = record.id;
    setQuestion(record.questionData || writingTask2.find(item => item.id === record.questionId) || {
      id: record.questionId || record.id,
      type: 'saved',
      question: record.question,
    });
    setPhase(record.feedback ? 'results' : record.phase);
    setFrameworkChat(record.frameworkChat.length ? record.frameworkChat : [{ role: 'ai', text: "First, define your position and two main arguments regarding this prompt. You may explain them in Chinese or English." }]);
    setFrameworkInput(record.frameworkInput);
    setFrameworkReadiness(record.frameworkReadiness || record.latestFrameworkCoach?.readiness || 'not_ready');
    setLatestFrameworkCoach(record.latestFrameworkCoach || null);
    setFinalFrameworkSummary(record.finalFrameworkSummary);
    setFrameworkSummaryGenerated(Boolean(record.frameworkSummaryGenerated));
    setEssay(record.essay);
    setFeedback(record.feedback || null);
    setAnalyzedEssaySnapshot(record.feedback?.essay || record.essay || '');
    setFeedbackFallbackUsed(Boolean(record.feedbackFallbackUsed || record.providerDiagnostic?.fallbackUsed));
    setFeedbackDiagnostic(record.providerDiagnostic || null);
    setProviderErrorMessage(record.status === 'provider_failed' ? 'AI provider temporarily unavailable. Please retry later. Your draft is preserved.' : '');
    setApiStatusMessage('');
    setFrameworkExtractMessage('');
    setRestoreMessage(message);
  };

  const cancelActiveAnalysis = (message?: string) => {
    const runId = analysisRunIdRef.current;
    cancelledAnalysisRunRef.current = runId;
    analysisRunIdRef.current = runId + 1;
    setIsAnalyzing(false);
    if (message) setApiStatusMessage(message);
  };

  const loadRandomQuestion = () => {
    cancelActiveAnalysis();
    const candidates = question && writingTask2.length > 1
      ? writingTask2.filter(item => item.id !== question.id && item.question !== question.question)
      : writingTask2;
    const pool = candidates.length ? candidates : writingTask2;
    const random = pool[Math.floor(Math.random() * pool.length)];
    activeAttemptIdRef.current = createRecordId('wt2');
    restoredRecordRef.current = null;
    setQuestion(random);
    setPhase('framework');
    setEssay('');
    setFeedback(null);
    setAnalyzedEssaySnapshot('');
    setFeedbackFallbackUsed(false);
    setFeedbackDiagnostic(null);
    setFrameworkChat([{ role: 'ai', text: "First, define your position and two main arguments regarding this prompt. You may explain them in Chinese or English." }]);
    setFrameworkReadiness('not_ready');
    setLatestFrameworkCoach(null);
    setFinalFrameworkSummary('');
    setFrameworkSummaryGenerated(false);
    setFrameworkExtractMessage('');
    setProviderErrorMessage('');
    setApiStatusMessage('');
    setRestoreMessage('');
    addDebugLog(`Loaded writing question: ${random.id}`);
  };

  const practiceSameQuestionAgain = () => {
    if (!question) return;
    cancelActiveAnalysis();
    activeAttemptIdRef.current = createRecordId('wt2');
    restoredRecordRef.current = null;
    setPhase('writing');
    setEssay('');
    setFeedback(null);
    setAnalyzedEssaySnapshot('');
    setFeedbackFallbackUsed(false);
    setFeedbackDiagnostic(null);
    setProviderErrorMessage('');
    setApiStatusMessage('Rewriting same question.');
    setFrameworkExtractMessage('');
    setRestoreMessage('');
    addDebugLog(`Started fresh rewrite for writing question: ${question.id}`);
    const timestamp = new Date().toISOString();
    saveActiveWritingTask2({
      id: activeAttemptIdRef.current,
      module: 'writing',
      mode: 'practice',
      status: 'draft',
      task: 'task2',
      question: question.question,
      questionId: question.id,
      topic: question.topicCategory,
      tags: question.tags,
      taskType: question.type,
      questionData: question,
      createdAt: timestamp,
      updatedAt: timestamp,
      phase: 'writing',
      frameworkChat,
      frameworkInput: '',
      frameworkReadiness,
      latestFrameworkCoach: latestFrameworkCoach || undefined,
      finalFrameworkSummary,
      frameworkSummaryGenerated,
      essay: '',
      feedbackFallbackUsed: false,
    });
  };

  const submitFrameworkNote = async () => {
    if (!frameworkInput.trim() || isCoachingFramework) return;

    const userInput = frameworkInput;
    const runId = coachRunIdRef.current + 1;
    coachRunIdRef.current = runId;
    cancelledCoachRunRef.current = null;
    setFrameworkChat(prev => [...prev, { role: 'user', text: userInput }]);
    setFrameworkInput('');
    setApiStatusMessage('');
    setIsCoachingFramework(true);

    const notes = [
      ...frameworkChat
        .filter(msg => msg.role === 'user' || msg.role === 'ai')
        .map(msg => `${msg.role === 'user' ? 'User note' : 'Coach feedback'}: ${msg.text.trim()}`)
        .filter(Boolean),
      `User note: ${userInput}`,
    ].join('\n\n');

    try {
      const { feedback: coachFeedback, diagnostic, route } = await routedCoachWritingFramework({
        task: 'task2',
        question: question?.question || '',
        notes,
      });
      if (cancelledCoachRunRef.current === runId || coachRunIdRef.current !== runId) {
        addDebugLog('Framework coach response ignored after cancellation.');
        return;
      }
      setProviderDiagnostic(diagnostic);
      const notice = routeNotice(route, diagnostic.failureKind);
      if (notice && (diagnostic.failureKind === 'provider_unavailable' || route.providerName === 'mock')) {
        setApiStatusMessage(notice);
      }
      if (diagnostic.failureKind === 'provider_unavailable') {
        setFrameworkChat(prev => [...prev, { role: 'ai', text: 'AI coach is temporarily unavailable. Your note is saved; continue planning manually and retry later.' }]);
        addDebugLog('Provider unavailable for framework coach.');
        return;
      }
      setLatestFrameworkCoach(coachFeedback);
      setFrameworkReadiness(coachFeedback.readiness);
      setFrameworkChat(prev => [...prev, {
        role: 'ai',
        text: formatCoachFeedback(coachFeedback, route.providerName === 'mock'),
      }]);
      addDebugLog(diagnostic.fallbackUsed ? 'Provider fallback used for framework coach.' : 'Framework coach feedback complete.');
    } catch (error) {
      if (cancelledCoachRunRef.current === runId || coachRunIdRef.current !== runId) {
        addDebugLog('Framework coach error ignored after cancellation.');
        return;
      }
      setFrameworkChat(prev => [...prev, { role: 'ai', text: 'Local mock coach: clarify your final position, one main reason, and one example from your own notes.' }]);
      addDebugLog(`Framework coach failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (coachRunIdRef.current === runId) {
        setIsCoachingFramework(false);
      }
    }

    requestAnimationFrame(() => {
      if (discussionRef.current) {
        discussionRef.current.scrollTop = discussionRef.current.scrollHeight;
      }
    });
  };

  const stopFrameworkCoach = () => {
    const runId = coachRunIdRef.current;
    cancelledCoachRunRef.current = runId;
    coachRunIdRef.current = runId + 1;
    setIsCoachingFramework(false);
    setApiStatusMessage('Coach generation stopped. Your notes are preserved.');
    addDebugLog('Framework coach generation cancelled by user.');
  };

  const deleteLastCoachFeedback = () => {
    setFrameworkChat(prev => {
      const lastCoachIndex = [...prev].map((msg, index) => ({ msg, index }))
        .reverse()
        .find(item => item.msg.role === 'ai' && item.index > 0)?.index;
      if (lastCoachIndex === undefined) return prev;
      return prev.filter((_, index) => index !== lastCoachIndex);
    });
    setLatestFrameworkCoach(null);
    setFrameworkReadiness('not_ready');
    setFrameworkExtractMessage('Latest coach feedback deleted. Your notes are unchanged.');
  };

  const handleFrameworkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitFrameworkNote();
  };

  const handleFrameworkInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isComposing = isFrameworkInputComposingRef.current || e.nativeEvent.isComposing;
    if (e.key !== 'Enter' || isComposing || (!e.ctrlKey && !e.metaKey)) return;

    e.preventDefault();
    void submitFrameworkNote();
  };

  const buildFrameworkNotes = () => {
    const chatNotes = frameworkChat
      .filter((msg, index) => msg.role === 'user' || index > 0)
      .map(msg => `${msg.role === 'user' ? 'User note' : 'Coach feedback'}: ${msg.text.trim()}`)
      .filter(Boolean);
    const draftInput = frameworkInput.trim();

    return [...chatNotes, draftInput].filter(Boolean).join('\n\n');
  };

  const extractFinalFramework = async () => {
    const notes = buildFrameworkNotes();
    setFrameworkExtractMessage('');
    setApiStatusMessage('');

    if (!notes.trim()) {
      const message = 'Add a few Coach Discussion notes first, then extract a framework summary.';
      setFrameworkExtractMessage(message);
      addDebugLog('Framework extraction skipped: empty notes.');
      return;
    }

    setIsExtractingFramework(true);
    addDebugLog('Extracting Writing Task 2 framework summary...');

    try {
      const { feedback: result, diagnostic, route } = await routedExtractWritingFramework({
        task: 'task2',
        question: question?.question || '',
        notes,
      });

      setProviderDiagnostic(diagnostic);
      const notice = routeNotice(route, diagnostic.failureKind);
      setApiStatusMessage(diagnostic.failureKind === 'provider_unavailable' ? notice : '');
      if (diagnostic.failureKind === 'provider_unavailable') {
        setFrameworkExtractMessage('AI provider temporarily unavailable. Please retry later. You can keep editing the framework manually.');
        addDebugLog('Provider unavailable for framework extraction.');
        persistWritingAttempt('provider_failed');
        return;
      }

      setFinalFrameworkSummary(result.editableSummary);
      setFrameworkSummaryGenerated(true);
      setFrameworkExtractMessage(
        diagnostic.fallbackUsed
          ? 'A safe fallback framework was generated. Please review and edit it before writing.'
          : route.providerName === 'mock'
            ? 'Local mock framework summary generated from your notes. You can edit it before moving to Phase 2.'
            : 'Framework summary generated from your notes. You can edit it before moving to Phase 2.',
      );
      addDebugLog(
        diagnostic.fallbackUsed
          ? 'Provider fallback used for framework extraction.'
          : 'Framework extraction complete.',
      );
    } catch (error) {
      console.error(error);
      const message = 'Framework extraction failed. You can keep editing the summary manually.';
      setFrameworkExtractMessage(message);
      addDebugLog(`Framework extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsExtractingFramework(false);
    }
  };

  const analyzeEssay = async () => {
    if (isAnalyzing) return;
    const submittedEssay = essay.trimEnd();
    if (!submittedEssay.trim()) {
      setProviderErrorMessage('Please write an essay before submitting for analysis.');
      addDebugLog('Writing analysis skipped: empty essay.');
      return;
    }
    if (!question) return;
    const submittedQuestion = question;
    const submittedFrameworkNotes = buildFrameworkNotes();
    const submittedFinalFrameworkSummary = finalFrameworkSummary;
    const runId = analysisRunIdRef.current + 1;
    analysisRunIdRef.current = runId;
    cancelledAnalysisRunRef.current = null;
    setIsAnalyzing(true);
    setProviderErrorMessage('');
    setApiStatusMessage('');
    setAnalyzedEssaySnapshot(submittedEssay);
    persistWritingAttempt('draft', {
      question: submittedQuestion,
      essay: submittedEssay,
      feedback: null,
      phase: 'writing',
    });
    addDebugLog("Analyzing essay...");
    try {
      const { feedback: result, diagnostic, route } = await withTimeout(routedAnalyzeWriting({
        task: 'task2',
        question: submittedQuestion.question,
        essay: submittedEssay,
        frameworkNotes: submittedFrameworkNotes,
        finalFrameworkSummary: submittedFinalFrameworkSummary,
      }, isInsufficientTask2Sample(submittedEssay)), WRITING_ANALYSIS_TIMEOUT_MS, 'Writing analysis timed out.');

      if (cancelledAnalysisRunRef.current === runId || analysisRunIdRef.current !== runId) {
        addDebugLog('Writing analysis response ignored after cancellation or newer run.');
        return;
      }

      setProviderDiagnostic(diagnostic);
      const diagnosticSummary = summarizeDiagnostic(diagnostic);
      setApiStatusMessage(routeNotice(route, diagnostic.failureKind));

      if (diagnostic.failureKind === 'provider_unavailable') {
        setFeedbackFallbackUsed(false);
        setFeedbackDiagnostic(diagnosticSummary);
        setProviderErrorMessage('AI provider temporarily unavailable. Please retry later. Your essay draft is preserved.');
        persistWritingAttempt('provider_failed', {
          question: submittedQuestion,
          essay: submittedEssay,
          feedback: null,
          phase: 'writing',
          providerDiagnostic: diagnosticSummary,
        });
        const failedBase = buildWritingRecord('provider_failed', {
          question: submittedQuestion,
          essay: submittedEssay,
          feedback: null,
          phase: 'writing',
        });
        if (failedBase) {
          upsertPracticeRecord({
            ...failedBase,
            providerDiagnostic: diagnosticSummary,
          });
        }
        addDebugLog('Provider unavailable for writing feedback.');
        return;
      }

      const resultEssay = result.essay?.trim() ? result.essay : submittedEssay;
      const resultFeedback: WritingFeedback = {
        ...result,
        question: result.question?.trim() ? result.question : submittedQuestion.question,
        essay: resultEssay,
      };
      setFeedbackFallbackUsed(diagnostic.fallbackUsed);
      setFeedbackDiagnostic(diagnosticSummary);
      setFeedback(resultFeedback);
      setAnalyzedEssaySnapshot(resultEssay);
      setPhase('results');
      persistWritingAttempt('analyzed', {
        question: submittedQuestion,
        essay: resultEssay,
        feedback: resultFeedback,
        feedbackFallbackUsed: diagnostic.fallbackUsed,
        phase: 'results',
        providerDiagnostic: diagnosticSummary,
      });
      const analyzedBase = buildWritingRecord('analyzed', {
        question: submittedQuestion,
        essay: resultEssay,
        feedback: resultFeedback,
        feedbackFallbackUsed: diagnostic.fallbackUsed,
        phase: 'results',
        providerDiagnostic: diagnosticSummary,
      });
      if (analyzedBase) {
        upsertPracticeRecord({
          ...analyzedBase,
          essay: resultEssay,
          feedback: resultFeedback,
          feedbackFallbackUsed: diagnostic.fallbackUsed,
          obsidianMarkdown: resultFeedback.obsidianMarkdown,
          providerDiagnostic: diagnosticSummary,
        });
      }

      saveSession({
        id: `wt2_${Date.now()}`,
        date: new Date().toISOString(),
        module: 'writing',
        mode: 'practice',
        question: submittedQuestion.question,
        essay: resultEssay,
        framework: submittedFinalFrameworkSummary,
        feedback: resultFeedback,
        providerDiagnostic: diagnosticSummary,
      });
      addDebugLog("Writing analysis complete");
      if (diagnostic.fallbackUsed) {
        addDebugLog("Provider fallback used for writing feedback.");
      }
    } catch (error) {
      console.error(error);
      if (cancelledAnalysisRunRef.current === runId || analysisRunIdRef.current !== runId) {
        addDebugLog('Writing analysis error ignored after cancellation or newer run.');
        return;
      }
      setFeedbackFallbackUsed(false);
      setFeedbackDiagnostic(null);
      if (error instanceof Error && /timed out/i.test(error.message)) {
        cancelledAnalysisRunRef.current = runId;
        setEssay(submittedEssay);
        persistWritingAttempt('draft', {
          question: submittedQuestion,
          essay: submittedEssay,
          feedback: null,
          phase: 'writing',
        });
        setApiStatusMessage('Analysis timed out. Your essay is preserved. Please retry.');
        setProviderErrorMessage('');
        addDebugLog('Writing analysis timed out.');
        return;
      }
      setProviderErrorMessage('Analysis failed. Your essay is preserved. Please retry.');
      addDebugLog(`Writing analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (analysisRunIdRef.current === runId) {
        setIsAnalyzing(false);
      }
    }
  };

  const stopAnalysis = () => {
    cancelActiveAnalysis('Analysis stopped. Your essay is preserved.');
    addDebugLog('Writing analysis cancelled by user.');
  };

  const exportMarkdown = () => {
    if (!feedback) return;
    const resultEssay = feedback.essay || analyzedEssaySnapshot || essay;
    const warnings = getEssayWarnings(feedback, isInsufficientTask2Sample(resultEssay), countWords(resultEssay));
    const logicFeedback = getLogicFeedback(feedback);
    const vocabulary = getVocabularyUpgrade(feedback);
    const missionItems = getLanguageBankMission(feedback, vocabulary);
    const fromEssayUpgrades = vocabulary.expressionUpgrades.filter(item => item.category === 'from_essay' || item.original);
    const argumentFrames = vocabulary.expressionUpgrades.filter(item => item.category === 'argument_frame' || !item.original);
    const highlightedModelAnswer = markLanguageBankTerms(feedback.modelAnswer, getLanguageBankHighlightTerms(vocabulary, feedback.sentenceFeedback));
    const targetLevel = getTargetModelLevel(feedback);
    const warningItems = warnings.length
      ? warnings.map(item => `- ${item.title}: ${item.messageZh}`).join('\n')
      : '- No essay-level warning.';
    const vocabularyItems = `### Topic Vocabulary
${vocabulary.topicVocabulary.length ? vocabulary.topicVocabulary.map(item => `- ${item.expression}\n  - 含义: ${item.meaningZh}\n  - 用于: ${item.usageZh.replace(/^用于[:：]?/, '')}${item.example ? `\n  - Example: ${item.example}` : ''}`).join('\n') : '- No topic vocabulary returned.'}

### Expression Upgrade
#### From Your Essay
${fromEssayUpgrades.length ? fromEssayUpgrades.map(item => [
  `- ${item.original ? `${item.original} -> ` : ''}${item.better}`,
  item.explanationZh && !isGenericExpressionNote(item.explanationZh) ? `  - 为什么这样改: ${item.explanationZh}` : '',
  item.reuseWhenZh && !isGenericExpressionNote(item.reuseWhenZh) ? `  - 什么时候复用: ${item.reuseWhenZh}` : '',
  item.example ? `  - Example: ${item.example}` : '',
].filter(Boolean).join('\n')).join('\n') : '- No phrase-level upgrade from this essay.'}

#### Reusable Argument Frames
${argumentFrames.length ? argumentFrames.map(item => [
  `- ${item.better}`,
  item.explanationZh && !isGenericExpressionNote(item.explanationZh) ? `  - 为什么这样改: ${item.explanationZh}` : '',
  item.reuseWhenZh && !isGenericExpressionNote(item.reuseWhenZh) ? `  - 什么时候复用: ${item.reuseWhenZh}` : '',
  item.example ? `  - Example: ${item.example}` : '',
].filter(Boolean).join('\n')).join('\n') : '- No reusable argument frame returned.'}`;
    const logicItems = logicFeedback.length
      ? logicFeedback.map((item, index) => {
          const related = item.relatedCorrectionIds?.length
            ? item.relatedCorrectionIds.map(id => `Correction #${id.replace(/^C/i, '')}`).join(', ')
            : '';
          const diagnosis = usefulLogicDiagnosis(item);
          return `### Logic Issue ${index + 1}: ${displayLogicLocationZh(item)} - ${item.issue}
${diagnosis ? `- 诊断: ${diagnosis}\n` : ''}- 这篇怎么改: ${normalizeLearnerChineseText(item.paragraphFixZh || item.suggestionZh)}
- 下次自查: ${normalizeLearnerChineseText(item.transferGuidanceZh) || defaultLogicTransfer()}${related ? `\n- Related: ${related}` : ''}${item.exampleFrame ? `\n- Example frame: ${item.exampleFrame}` : ''}`;
        }).join('\n\n')
      : '- No logic-level issue returned.';
    const sentenceItems = feedback.sentenceFeedback.length
      ? feedback.sentenceFeedback.map((item, index) => {
          const issues = getCorrectionIssues(item);
          return `### Correction #${item.correctionNumber || index + 1}
- Issues: ${issues.join(' / ')}
- Original: ${item.original}
- Suggested revision: ${item.correction}
- 为什么要改: ${item.explanationZh}
- 下次自查: ${item.transferGuidanceZh || defaultSentenceTransfer(item)}
${item.microUpgrades?.length ? `- Micro upgrades:
${item.microUpgrades.map(upgrade => `  - ${upgrade.original} -> ${upgrade.better}: ${upgrade.explanationZh}`).join('\n')}` : ''}`;
        }).join('\n\n')
      : '- No sentence-level correction returned.';
    const exportHasSubstantialModelAnswer = feedback.modelAnswer.trim().length > 24
      && !isPlaceholderModelAnswer(feedback.modelAnswer)
      && !isInsufficientTask2Sample(resultEssay);
    const markdown = `# IELTS Writing Task 2 Note

## Prompt
${feedback.question}

## My Essay
${resultEssay}

## Essay-level Warnings
${warningItems}

## Language Bank
${vocabularyItems}

## Logic & Structure Review
${logicItems}

## Sentence Corrections
${sentenceItems}

## Target Model Answer
- Training estimate: ${formatBandEstimate(averageWritingScore(feedback))}
- Target level: ${targetLevel}

### Next Rewrite Focus
${missionItems.length ? missionItems.map(item => `- ${item}`).join('\n') : '- 下次修改时至少主动使用两个 Language Bank 表达。'}

${exportHasSubstantialModelAnswer ? `${highlightedModelAnswer}${feedback.modelAnswerPersonalized ? '\n\nHighlighted phrases come from the Language Bank above.' : ''}` : '- No reliable personalized model answer for this attempt.'}`;
    const blob = new Blob([markdown || feedback.obsidianMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ielts-writing-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const writingWorkspaceClass = 'practice-workspace';
  const modelAnswerText = feedback?.modelAnswer?.trim() || '';
  const resultEssay = feedback?.essay || analyzedEssaySnapshot || essay;
  const resultWordCount = countWords(resultEssay);
  const isUnderTask2WordMinimum = resultWordCount > 0 && resultWordCount < 250;
  const isInsufficientSample = isInsufficientTask2Sample(resultEssay);
  const hasSubstantialModelAnswer = modelAnswerText.length > 24 && !isPlaceholderModelAnswer(modelAnswerText) && !isInsufficientSample;
  const isPersonalizedModelAnswer = Boolean(feedback?.modelAnswerPersonalized);
  const hasCoachFeedback = frameworkChat.some((msg, index) => msg.role === 'ai' && index > 0);
  const essayWarnings = feedback ? getEssayWarnings(feedback, isInsufficientSample, resultWordCount) : [];
  const logicFeedback = feedback ? getLogicFeedback(feedback) : [];
  const logicGroups = feedback ? groupedLogicFeedback(logicFeedback) : [];
  const vocabularyUpgrade = feedback ? getVocabularyUpgrade(feedback) : null;
  const revisionMission: string[] = [];
  const fromEssayUpgrades = vocabularyUpgrade
    ? vocabularyUpgrade.expressionUpgrades.filter(item => item.category === 'from_essay' || item.original)
    : [];
  const argumentFrames = vocabularyUpgrade
    ? vocabularyUpgrade.expressionUpgrades.filter(item => item.category === 'argument_frame' || !item.original)
    : [];
  const modelHighlightTerms = vocabularyUpgrade && feedback ? getLanguageBankHighlightTerms(vocabularyUpgrade, feedback.sentenceFeedback) : [];
  const scoreTransparencyParts = getScoreTransparencyParts(feedbackDiagnostic, feedbackFallbackUsed, resultWordCount, isUnderTask2WordMinimum);
  const modelAnswerAnnotations = feedback ? getValidModelAnswerAnnotations(modelAnswerText, feedback.modelAnswerAnnotations) : [];
  const essayParagraphs = useMemo(() => getEssayParagraphs(resultEssay), [resultEssay]);
  const annotatedCorrectionSpans = useMemo(
    () => feedback ? getAnnotatedCorrectionSpans(resultEssay, feedback.sentenceFeedback, essayParagraphs) : [],
    [essayParagraphs, feedback, resultEssay],
  );
  const selectedCorrectionSpan = annotatedCorrectionSpans.find(span => span.correctionId === selectedCorrectionId) || null;
  const selectedCorrection = selectedCorrectionSpan?.correction || null;
  const selectedCorrectionIndex = selectedCorrectionSpan?.correctionIndex ?? -1;
  const selectedRelatedLogic = selectedCorrection
    ? getRelatedLogicItems(selectedCorrection, selectedCorrectionIndex, logicFeedback)
    : [];
  const selectedParagraphLogicLocation = selectedCorrectionSpan
    && canUseParagraphLogicMapping(selectedCorrection)
    ? getLogicLocationForEssayParagraph(selectedCorrectionSpan.paragraphIndex, essayParagraphs.length)
    : null;
  const selectedRelatedLogicSet = new Set([
    ...selectedRelatedLogic,
    ...(selectedParagraphLogicLocation
      ? logicFeedback.filter(item => getDisplayLocation(item) === selectedParagraphLogicLocation)
      : []),
  ]);
  const selectedAnchorEl = selectedCorrectionId ? markerRefs.current[selectedCorrectionId] || null : null;
  const logicGroupKeys = logicGroups.map(group => group.location).join('|');

  useEffect(() => {
    if (!logicGroups.length) {
      setOpenLogicLocation(null);
      return;
    }
    setOpenLogicLocation(current => (
      current && logicGroups.some(group => group.location === current)
        ? current
        : logicGroups[0].location
    ));
  }, [logicGroupKeys]);

  useEffect(() => {
    const relatedLocation = getLogicGroupForCorrection(selectedCorrection, selectedCorrectionIndex, logicFeedback)
      || (selectedParagraphLogicLocation && logicGroups.some(group => group.location === selectedParagraphLogicLocation)
        ? selectedParagraphLogicLocation
        : null);
    if (relatedLocation) setOpenLogicLocation(relatedLocation);
  }, [logicFeedback, logicGroupKeys, selectedCorrection, selectedCorrectionIndex, selectedParagraphLogicLocation]);

  return (
    <PageShell size="wide">
      <TopBar />

      <div className={`${writingWorkspaceClass} mb-8`}>
        <PaperCard className="bg-paper-200 border-none">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40">Task 2 Question</span>
            <span className="question-type-badge">({question?.type})</span>
          </div>
          <h2 className="text-xl leading-relaxed">{question?.question}</h2>
        </PaperCard>
      </div>

      <Task2PhaseTabs phase={phase} hasFeedback={Boolean(feedback)} onChange={setPhase} />

      <div className={writingWorkspaceClass}>
        {providerErrorMessage && (
          <div className="mb-6 space-y-2">
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-sm font-sans">
              {providerErrorMessage}
            </div>
          </div>
        )}
        {apiStatusMessage && (
          <div className="mb-6 p-3 bg-paper-ink/5 border border-paper-ink/10 text-paper-ink/65 text-sm rounded-sm font-sans">
            {apiStatusMessage}
          </div>
        )}
      </div>

      <div className={writingWorkspaceClass}>
        {phase === 'framework' && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(460px,0.88fr)] xl:items-start">
            <PaperCard className="p-0 overflow-hidden xl:max-h-[calc(100vh-14rem)] xl:flex xl:flex-col">
              <div className="px-6 pt-6 pb-4 border-b border-paper-ink/10 bg-paper-ink/[0.02] shrink-0">
                <h3 className="text-base font-bold uppercase tracking-widest">Framework Notes</h3>
              </div>
              <div ref={discussionRef} className="px-6 py-5 space-y-3 max-h-[360px] xl:max-h-none xl:flex-1 overflow-auto">
                {frameworkChat.map((msg, i) => (
                  <div key={i} className="border-l-2 border-paper-ink/10 pl-3 py-1.5">
                    <p className="text-xs font-sans uppercase tracking-widest text-paper-ink/50 mb-1">
                      {msg.role === 'user'
                        ? 'Your Note'
                        : i === 0
                          ? 'Prompt Guidance'
                          : 'Coach Feedback'}
                    </p>
                    <p className={`${msg.role === 'user' ? 'text-paper-ink' : 'text-paper-ink-muted'} text-[17px] leading-8 whitespace-pre-wrap`}>
                      {msg.text}
                    </p>
                  </div>
                ))}
              </div>
              <form onSubmit={handleFrameworkSubmit} className="p-6 border-t border-paper-ink/10 space-y-3 shrink-0">
                <textarea
                  value={frameworkInput}
                  onChange={(e) => setFrameworkInput(e.target.value)}
                  onKeyDown={handleFrameworkInputKeyDown}
                  onCompositionStart={() => {
                    isFrameworkInputComposingRef.current = true;
                  }}
                  onCompositionEnd={() => {
                    isFrameworkInputComposingRef.current = false;
                  }}
                  placeholder="Planning notes (Chinese or English): thesis, two main arguments, and counter-view structure..."
                  rows={6}
                  autoFocus
                  className="w-full min-h-[180px] xl:min-h-[160px] bg-transparent border border-paper-ink/10 rounded-sm p-4 font-serif text-[17px] leading-relaxed resize-y placeholder:opacity-40 focus:border-accent-terracotta focus:shadow-[0_0_0_1px_rgba(166,77,50,0.2)]"
                />
                <p className="text-xs font-sans text-paper-ink/45">
                  Enter = newline. Ctrl+Enter / Cmd+Enter = Send to Coach.
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  {hasCoachFeedback && (
                    <SerifButton
                      type="button"
                      variant="outline"
                      onClick={deleteLastCoachFeedback}
                      className="px-4 py-2 text-xs flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete last coach feedback
                    </SerifButton>
                  )}
                  <SerifButton
                    type={isCoachingFramework ? 'button' : 'submit'}
                    variant="secondary"
                    onClick={isCoachingFramework ? stopFrameworkCoach : undefined}
                    disabled={!isCoachingFramework && !frameworkInput.trim()}
                    className="px-4 py-2 text-xs"
                  >
                    {isCoachingFramework ? 'Stop generating' : 'Send to Coach'}
                  </SerifButton>
                </div>
              </form>
            </PaperCard>

            <PaperCard className="xl:sticky xl:top-8 xl:max-h-[calc(100vh-4rem)] xl:overflow-hidden xl:flex xl:flex-col">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3 shrink-0">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest mb-3">Final Framework Summary</h3>
                  <p className="text-xs font-sans text-paper-ink/45">
                    Coach readiness: {readinessLabels[frameworkReadiness]}
                  </p>
                </div>
              </div>
              {frameworkExtractMessage && (
                <p className="text-xs font-sans text-paper-ink/55 bg-paper-ink/5 border border-paper-ink/10 rounded-sm px-3 py-2 mb-3 shrink-0">
                  {frameworkExtractMessage}
                </p>
              )}
              <textarea
                value={finalFrameworkSummary}
                onChange={(e) => setFinalFrameworkSummary(e.target.value)}
                placeholder="Final Framework Summary (Chinese or English)..."
                rows={12}
                className="w-full min-h-[420px] md:min-h-[520px] xl:min-h-[640px] xl:h-[68vh] xl:max-h-[calc(100vh-10rem)] xl:flex-1 bg-transparent border border-paper-ink/10 rounded-sm p-4 font-serif text-[17px] leading-relaxed resize-y overflow-auto placeholder:opacity-40 focus:border-accent-terracotta focus:shadow-[0_0_0_1px_rgba(166,77,50,0.2)]"
              />
              <div className="flex flex-col gap-3 border-t border-paper-ink/10 pt-4 mt-4 shrink-0">
                {frameworkSummaryGenerated ? (
                  <SerifButton
                    type="button"
                    onClick={() => setPhase('writing')}
                    className="w-full justify-center flex items-center gap-2"
                  >
                    Use This Framework &mdash; Start Writing <ArrowRight className="w-4 h-4" />
                  </SerifButton>
                ) : frameworkReadiness === 'ready_to_write' ? (
                  <SerifButton
                    type="button"
                    variant="outline"
                    onClick={extractFinalFramework}
                    disabled={isExtractingFramework}
                    className="w-full justify-center text-xs flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    {isExtractingFramework ? 'Extracting...' : <>Framework Ready &mdash; Generate Summary</>}
                  </SerifButton>
                ) : (
                  <p className="text-xs font-sans text-paper-ink/55 bg-paper-ink/5 border border-paper-ink/10 rounded-sm px-3 py-2">
                    Keep discussing with Coach before generating summary.
                  </p>
                )}
                {!frameworkSummaryGenerated && frameworkReadiness === 'ready_to_write' && (
                  <SerifButton
                    type="button"
                    variant="secondary"
                    onClick={() => setPhase('writing')}
                    className="w-full justify-center flex items-center gap-2"
                  >
                    Skip Framework Discussion &mdash; Start Writing <ArrowRight className="w-4 h-4" />
                  </SerifButton>
                )}
              </div>
            </PaperCard>
          </div>
        )}

        {phase === 'writing' && (
          <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.34fr)_minmax(0,0.66fr)] xl:items-start">
            <PaperCard className="xl:sticky xl:top-8 xl:max-h-[calc(100vh-4rem)] xl:overflow-hidden">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-3">Framework Summary</h3>
              <div className="xl:max-h-[calc(100vh-10rem)] xl:overflow-auto xl:pr-1">
                {finalFrameworkSummary.trim() ? (
                  <p className="text-[17px] leading-8 whitespace-pre-wrap">{finalFrameworkSummary}</p>
                ) : (
                  <p className="text-sm text-paper-ink/60">No final framework summary yet. You can go back to Phase 1 to refine it.</p>
                )}
              </div>
            </PaperCard>
            <div className="space-y-6">
              <PaperCard className="p-0">
                <textarea
                  value={essay}
                  onChange={(e) => setEssay(e.target.value)}
                  readOnly={isAnalyzing}
                  aria-readonly={isAnalyzing}
                  placeholder="Start writing your 250+ word essay here..."
                  autoFocus
                  className={`w-full min-h-[720px] p-8 bg-transparent border border-transparent rounded-sm font-serif text-xl leading-relaxed placeholder:opacity-40 resize-y focus:border-accent-terracotta focus:shadow-[0_0_0_1px_rgba(166,77,50,0.2)] ${isAnalyzing ? 'cursor-default bg-paper-ink/[0.025] text-paper-ink/70' : ''}`}
                />
              </PaperCard>
              <div className="flex flex-col gap-3 bg-paper-ink/5 p-4 rounded text-xs font-sans text-paper-ink/40 uppercase tracking-widest sm:flex-row sm:items-center sm:justify-between">
                <span>WORD COUNT: {countWords(essay)}</span>
                {isAnalyzing && (
                  <span className="text-[11px] normal-case tracking-normal text-paper-ink/55">
                    Analyzing the submitted version. Stop analysis to edit again.
                  </span>
                )}
                <div className="flex items-center gap-4">
                  {essay.trim() && (
                    <SerifButton type="button" onClick={() => setEssay('')} disabled={isAnalyzing} variant="outline" className="text-xs">
                      Clear draft
                    </SerifButton>
                  )}
                  {isAnalyzing && (
                    <SerifButton type="button" onClick={stopAnalysis} variant="outline" className="text-xs">
                      Stop analysis
                    </SerifButton>
                  )}
                  <SerifButton onClick={analyzeEssay} disabled={isAnalyzing || !essay.trim()} className="flex items-center gap-2">
                    {isAnalyzing ? "Analyzing..." : "Submit for Analysis"} <Send className="w-4 h-4" />
                  </SerifButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === 'results' && feedback && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {scoreDimensions.map((dimension) => (
                <PaperCard
                  key={dimension.key}
                  className="text-center p-3"
                >
                  <div title={`${dimension.label}: training estimate`} aria-label={`${dimension.label} training estimate`}>
                    <div className="text-[10px] font-sans font-bold text-paper-ink/50 uppercase mb-1 leading-snug">{dimension.label}</div>
                    <div className={isInsufficientSample ? 'text-xs font-bold text-paper-ink/50 uppercase tracking-widest font-sans pt-1' : 'text-xl font-bold text-accent-terracotta'}>
                      {isInsufficientSample ? 'Insufficient' : formatBandEstimate(feedback.scores[dimension.key])}
                    </div>
                    <div className="mt-1 text-[10px] font-sans text-paper-ink/35">{dimension.helper}</div>
                  </div>
                </PaperCard>
              ))}
            </div>

            <PaperCard className="bg-paper-ink/[0.025] py-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/45 mb-1">Score transparency</p>
                  <p className="text-sm leading-7 text-paper-ink/65">
                    {scoreTransparencyParts.join(' · ')}
                  </p>
                </div>
                {isUnderTask2WordMinimum && (
                  <p className="text-sm leading-7 text-red-900/80 lg:max-w-md">
                    Word count {resultWordCount}/250. Task 2 expects at least 250 words, so these estimates may be conservatively capped.
                  </p>
                )}
              </div>
            </PaperCard>

            {essayWarnings.length > 0 && (
              <section className="space-y-3">
                {essayWarnings.map((warning, index) => (
                  <PaperCard key={`${warning.title}-${index}`} className="border-l-2 border-l-red-800 bg-red-50/40 py-3">
                    <h4 className="text-sm font-bold leading-6 text-red-900 mb-1">{warning.title}</h4>
                    <p className="text-sm leading-7 text-paper-ink/85">{warning.messageZh}</p>
                  </PaperCard>
                ))}
              </section>
            )}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(380px,0.88fr)] xl:items-start">
              <section>
                <h3 className="text-sm font-bold uppercase tracking-widest mb-4">My Essay</h3>
                <PaperCard>
                  <div className="annotated-essay-scroll text-[17px] leading-8 text-paper-ink max-h-[520px] overflow-auto">
                    {essayParagraphs.map((paragraph, paragraphIndex) => {
                      const paragraphSpans = annotatedCorrectionSpans.filter(span => span.paragraphIndex === paragraphIndex);
                      const nodes: React.ReactNode[] = [];
                      let cursor = paragraph.start;
                      paragraphSpans.forEach(span => {
                        if (span.start > cursor) {
                          nodes.push(
                            <React.Fragment key={`essay-text-${paragraphIndex}-${cursor}`}>
                              {resultEssay.slice(cursor, span.start)}
                            </React.Fragment>,
                          );
                        }
                        const isSelected = selectedCorrectionId === span.correctionId;
                        nodes.push(
                          <button
                            key={`essay-mark-${span.correctionId}-${span.start}`}
                            type="button"
                            className={`annotated-essay-mark ${span.matchLevel === 'sentence' ? 'annotated-essay-mark--sentence' : ''} ${isSelected ? 'annotated-essay-mark--active' : ''}`}
                            data-severity={getSeverityTone(span.correction)}
                            ref={(element) => {
                              markerRefs.current[span.correctionId] = element;
                            }}
                            onClick={() => setSelectedCorrectionId(span.correctionId)}
                            aria-pressed={isSelected}
                          >
                            {resultEssay.slice(span.start, span.end)}
                          </button>,
                        );
                        cursor = span.end;
                      });
                      if (cursor < paragraph.end) {
                        nodes.push(
                          <React.Fragment key={`essay-text-${paragraphIndex}-end`}>
                            {resultEssay.slice(cursor, paragraph.end)}
                          </React.Fragment>,
                        );
                      }

                      const overlaySpan = paragraphSpans[0];
                      const overlayCorrection: WritingFeedback['sentenceFeedback'][number] | null = null;
                      return (
                        <div key={`essay-paragraph-${paragraphIndex}`} className="annotated-essay-paragraph">
                          <p className="whitespace-pre-wrap">{nodes}</p>
                          {overlayCorrection && (
                            <div className="annotated-correction-overlay">
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div>
                                  <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-1">
                                    Correction #{overlayCorrection.correctionNumber || overlaySpan.correctionIndex + 1}
                                  </p>
                                  <h4 className="text-base font-bold leading-7">{getConciseCorrectionIssue(overlayCorrection)}</h4>
                                </div>
                                <button
                                  type="button"
                                  className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/35 hover:text-paper-ink/65"
                                  onClick={() => setSelectedCorrectionId(null)}
                                >
                                  Close
                                </button>
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/35 mb-1">Original</p>
                                  <p className="text-sm leading-7 text-paper-ink/60">{renderOriginalSentence(overlayCorrection)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/35 mb-1">Corrected</p>
                                  <p className="text-[15px] leading-7 font-bold text-paper-ink/85">{overlayCorrection.correction}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <span className="border border-paper-ink/10 bg-paper-ink/5 text-paper-ink/60 px-2 py-1 rounded-sm text-[10px] uppercase font-sans font-bold tracking-widest">
                                    {overlayCorrection.primaryIssue || getConciseCorrectionIssue(overlayCorrection)}
                                  </span>
                                  {(overlayCorrection.secondaryIssues || []).map(issue => (
                                    <span key={issue} className="border border-paper-ink/10 bg-paper-50 text-paper-ink/50 px-2 py-1 rounded-sm text-[10px] uppercase font-sans font-bold tracking-widest">
                                      {issue}
                                    </span>
                                  ))}
                                </div>
                                {overlayCorrection.microUpgrades?.length ? (
                                  <div className="space-y-2">
                                    <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/35">Micro upgrades</p>
                                    {overlayCorrection.microUpgrades.map((upgrade, upgradeIndex) => (
                                      <div key={`${upgrade.original}-${upgradeIndex}`} className="text-sm leading-7 text-paper-ink/70 border border-paper-ink/10 bg-paper-50/70 rounded-sm px-3 py-2">
                                        <span className="line-through text-paper-ink/45">{upgrade.original}</span>
                                        <span className="mx-2 text-paper-ink/30">-&gt;</span>
                                        <span className="font-bold">{upgrade.better}</span>
                                        <p className="text-paper-ink/60">{upgrade.explanationZh}</p>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                                <div>
                                  <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/35 mb-1">为什么要改</p>
                                  <p className="text-sm leading-7 text-paper-ink/70">{normalizeLearnerChineseText(overlayCorrection.explanationZh)}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </PaperCard>
                {selectedCorrectionSpan && (
                  <AnnotationOverlay
                    span={selectedCorrectionSpan}
                    anchorEl={selectedAnchorEl}
                    onClose={() => setSelectedCorrectionId(null)}
                  />
                )}
              </section>

              <section>
                <h3 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-accent-terracotta" /> Logic & Structure Review
                </h3>
                <div className="max-h-[520px] overflow-auto pr-1 space-y-2">
                  {logicGroups.length ? logicGroups.map(group => (
                    <div key={group.location} className="border border-paper-ink/10 bg-paper-ink/[0.02] rounded-sm overflow-hidden">
                      <button
                        type="button"
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                        onClick={() => setOpenLogicLocation(group.location)}
                        aria-expanded={openLogicLocation === group.location}
                      >
                        <span className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/55">{logicLocationLabels[group.location]}</span>
                        <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/35">
                          {group.items.length} issue{group.items.length > 1 ? 's' : ''}
                        </span>
                      </button>
                      {openLogicLocation === group.location && (
                        <div className="px-4 pb-4 space-y-3 border-t border-paper-ink/10">
                      {group.items.map((f, i) => {
                        const isRelated = selectedRelatedLogicSet.has(f) || isLogicItemRelatedToCorrection(f, selectedCorrection, selectedCorrectionIndex);
                        return (
                          <div key={`${group.location}-${i}`} className={`mt-3 p-4 border rounded-sm flex items-start gap-3 transition-colors ${isRelated ? 'bg-accent-terracotta/5 border-accent-terracotta/30 ring-1 ring-accent-terracotta/15' : f.severity === 'fatal' ? 'bg-red-50/50 border-red-100' : 'bg-paper-50/70 border-paper-ink/10'}`}>
                            <div className={`w-2 h-2 rounded-full mt-1.5 ${isRelated ? 'bg-accent-terracotta' : f.severity === 'fatal' ? 'bg-red-800' : 'bg-accent-terracotta/70'}`} />
                            <div className="min-w-0 space-y-3">
                              <div>
                                <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-1">{displayLogicLocationZh(f)}</p>
                                <h5 className="text-[17px] font-bold leading-7">{f.issue}</h5>
                                {usefulLogicDiagnosis(f) && (
                                  <p className="mt-2 text-sm leading-7 text-paper-ink/60">{usefulLogicDiagnosis(f)}</p>
                                )}
                              </div>
                              <div>
                                <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-1">这篇怎么改</p>
                                <p className="text-base leading-8 text-paper-ink/70">
                                  {normalizeLearnerChineseText(f.paragraphFixZh || f.suggestionZh)}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-1">下次自查</p>
                                <p className="text-base leading-8 text-paper-ink/70">{normalizeLearnerChineseText(f.transferGuidanceZh) || defaultLogicTransfer()}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                        </div>
                      )}
                    </div>
                  )) : (
                    <PaperCard className="bg-paper-ink/5">
                      <p className="text-base leading-8 text-paper-ink/65">No big-picture logic issue returned for this attempt.</p>
                    </PaperCard>
                  )}
                </div>
              </section>
            </div>

            <PaperCard className="min-h-[220px]">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <h3 className="text-sm font-bold uppercase tracking-widest">
                  Target Model Answer
                </h3>
                <div className="flex flex-wrap gap-2 text-[10px] font-sans font-bold uppercase tracking-widest">
                  <span className="border border-paper-ink/10 bg-paper-ink/5 px-2 py-1 rounded-sm text-paper-ink/55">
                    Training estimate {formatBandEstimate(averageWritingScore(feedback))}
                  </span>
                  <span className="border border-accent-terracotta/20 bg-accent-terracotta/5 px-2 py-1 rounded-sm text-accent-terracotta">
                    Target level: {getTargetModelLevel(feedback)}
                  </span>
                </div>
              </div>
              {hasSubstantialModelAnswer && isPersonalizedModelAnswer && (
                <p className="text-sm leading-7 text-paper-ink/60 mb-3">
                  This answer preserves your position and demonstrates selected repairs from the workspace above.
                </p>
              )}
              <div className="min-h-[132px] rounded-sm border border-paper-ink/10 bg-paper-ink/[0.02] p-4">
                {hasSubstantialModelAnswer ? (
                  <>
                    <p className="text-[11px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-2">
                      高亮说明
                    </p>
                    <div className="text-[17px] text-paper-ink/75 leading-8 whitespace-pre-wrap">
                      {renderAnnotatedModelAnswer(modelAnswerText, modelAnswerAnnotations, modelHighlightTerms)}
                    </div>
                  </>
                ) : (
                  <p className="text-base leading-8 text-paper-ink/65">
                    {isInsufficientSample
                      ? 'Model-answer text is hidden for this insufficient sample so the saved record does not look more reliable than it is.'
                      : 'No substantial model answer was returned for this attempt.'}
                  </p>
                )}
              </div>
            </PaperCard>

            {vocabularyUpgrade && (
              <section>
                <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Language Bank</h3>
                <PaperCard className="bg-paper-ink/[0.02]">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-3">
                      <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40">Topic Vocabulary</p>
                      {vocabularyUpgrade.topicVocabulary.length ? vocabularyUpgrade.topicVocabulary.map((item, index) => (
                        <div key={`topic-${index}`} className="space-y-1">
                          <p className="text-base leading-7 font-bold">{item.expression}</p>
                          <p className="text-sm leading-7 text-paper-ink/65">{item.meaningZh}</p>
                          {getShortUsageNote(item.usageZh) && (
                            <p className="text-sm leading-7 text-paper-ink/55">用于：{getShortUsageNote(item.usageZh)}</p>
                          )}
                        </div>
                      )) : (
                        <p className="text-sm leading-7 text-paper-ink/50">本次没有可稳定提取的话题词。</p>
                      )}
                    </div>
                    <div className="space-y-3">
                      <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40">Expression Upgrade</p>
                      {fromEssayUpgrades.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/35">From Your Essay</p>
                          {fromEssayUpgrades.map((item, index) => (
                            <div key={`from-essay-${index}`} className="space-y-1">
                              {item.original && <p className="text-sm leading-7 text-paper-ink/55 line-through">{item.original}</p>}
                              <p className="text-base leading-7 font-bold">{item.better}</p>
                              {item.explanationZh && !isGenericExpressionNote(item.explanationZh) && (
                                <p className="text-sm leading-7 text-paper-ink/65">{item.explanationZh}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="space-y-3">
                        <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/35">Reusable Argument Frames</p>
                        {argumentFrames.map((item, index) => (
                          <div key={`argument-frame-${index}`} className="space-y-1">
                            <p className="text-base leading-7 font-bold">{item.better}</p>
                            {item.explanationZh && !isGenericExpressionNote(item.explanationZh) && (
                              <p className="text-sm leading-7 text-paper-ink/65">{item.explanationZh}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </PaperCard>
              </section>
            )}

            <details className="group border border-paper-ink/10 bg-paper-ink/[0.02] p-4">
              <summary className="cursor-pointer list-none text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/50 flex items-center justify-between">
                <span>Planning Reference / My Framework</span>
                <span className="text-paper-ink/35 group-open:hidden">Open</span>
                <span className="hidden text-paper-ink/35 group-open:inline">Close</span>
              </summary>
              <div className="mt-4 border-t border-paper-ink/10 pt-4">
                <div className="max-h-[220px] overflow-auto pr-1">
                  {finalFrameworkSummary.trim() ? (
                    <p className="text-base leading-8 whitespace-pre-wrap">{finalFrameworkSummary}</p>
                  ) : (
                    <p className="text-sm text-paper-ink/60">No final framework summary yet. You can go back to Phase 1 to refine it.</p>
                  )}
                </div>
              </div>
            </details>

            <div className="flex justify-between gap-4 border-t border-paper-ink/10 pt-6">
              <SerifButton onClick={exportMarkdown} variant="outline" className="flex-1 text-xs flex items-center justify-center gap-2">
                <FileDown className="w-4 h-4" /> Export Markdown
              </SerifButton>
              <SerifButton onClick={practiceSameQuestionAgain} variant="outline" className="flex-1 text-xs">Practice this question again</SerifButton>
              <SerifButton onClick={loadRandomQuestion} className="flex-1 text-xs">New Question</SerifButton>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
