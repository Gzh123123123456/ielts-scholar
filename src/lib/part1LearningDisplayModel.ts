import type {
  Part1AnswerAnnotation,
  Part1AnswerAnnotationLayer,
  Part1DevelopmentTarget,
  SpeakingMaterialBankItem,
  SpeakingThreadAnswer,
  SpeakingThreadFeedback,
} from './ai/schemas';

export type Part1LearningActionType =
  | 'correction'
  | 'expression_upgrade'
  | 'material_extraction'
  | 'true_development'
  | 'direction_reframing';

export type Part1LearningAction = {
  questionRef: string;
  type: Part1LearningActionType;
  summaryZh: string;
  examples: NonNullable<Part1DevelopmentTarget['phraseChunks']>;
};

export type Part1LearningDisplayModel = {
  answerCoaching: Part1DevelopmentTarget[];
  answerActions: Part1LearningAction[];
  userMaterials: SpeakingMaterialBankItem[];
  expressionBank: SpeakingMaterialBankItem[];
  sessionPatterns: NonNullable<SpeakingThreadFeedback['threadLevelPatterns']>;
  hiddenMaterialDiagnostics: string[];
};

export type Part1AnnotationSpan = {
  annotation: Part1AnswerAnnotation;
  start: number;
  end: number;
  visibleText: string;
};

const cleanText = (value?: string | null) => (value || '').replace(/"{3,}/g, '').replace(/\s+/g, ' ').trim();

const hasCjk = (text: string) => /[\u4e00-\u9fff]/.test(text);

const looksLikeMojibake = (text: string) => {
  const markers = text.match(/[�]|[鍙閸鈥銆绱鐨浣鏄宸粡涗竴姝璇]/g) || [];
  return markers.length >= 3;
};

const sentenceMark = (cluster: string, context: string) => {
  const cjk = hasCjk(context);
  if (/[?？]/.test(cluster)) return cjk ? '？' : '?';
  if (/[!！]/.test(cluster)) return cjk ? '！' : '!';
  return cjk ? '。' : '.';
};

export const normalizePart1LearnerText = (text = '') => {
  const source = cleanText(text);
  if (!source || looksLikeMojibake(source)) return '';
  return source
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([,.;:!?，。！？；：])/g, '$1')
    .replace(/([（(])\s+/g, '$1')
    .replace(/\s+([）)])/g, '$1')
    .replace(/([。！？.!?])(?:\s*[。！？.!?])+/g, match => sentenceMark(match, source))
    .replace(/([。！？])\s*[.!?]+$/g, '$1')
    .replace(/([.!?])\s*[。！？]+$/g, '$1')
    .trim();
};

export const normalizePart1ComparableText = (text = '') =>
  normalizePart1LearnerText(text)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const displayProperNouns: Record<string, string> = {
  ai: 'AI',
  beijing: 'Beijing',
  english: 'English',
  ielts: 'IELTS',
  pc: 'PC',
  wukong: 'Wukong',
  xiamen: 'Xiamen',
  zhongshan: 'Zhongshan',
};

export const normalizePart1TranscriptDisplayText = (
  text = '',
  options: { treatInitialAsSentenceStart?: boolean } = {},
) => {
  const source = normalizePart1LearnerText(text)
    .replace(/\bblack\s+myth\s*:?\s*wukong\b/gi, 'Black Myth: Wukong')
    .replace(/\bzhongshan\s+road\b/gi, 'Zhongshan Road');
  const treatInitialAsSentenceStart = options.treatInitialAsSentenceStart ?? true;
  const normalized = source.replace(/\b[A-Za-z][A-Za-z']*\b/g, (word, offset, fullText) => {
    const lower = word.toLowerCase();
    const proper = displayProperNouns[lower];
    if (proper) return proper;
    if (lower === 'i') return 'I';
    if (/^[a-z]+(?:'[a-z]+)?$/.test(word)) return word;

    const hasMixedInternalCase = /[a-z][A-Z]|[A-Z]{2,}[a-z]|[a-z][A-Z]{2,}/.test(word);
    const isAllCaps = /^[A-Z]{2,}$/.test(word);
    const isTitleCase = /^[A-Z][a-z]+(?:'[a-z]+)?$/.test(word);
    const before = fullText.slice(0, offset);
    const isSentenceStart = offset === 0
      ? treatInitialAsSentenceStart
      : /[.!?。！？]\s*$/.test(before);

    if (hasMixedInternalCase || isAllCaps) return lower;
    if (isTitleCase && !isSentenceStart) return lower;
    return word;
  });
  return normalized.replace(/\bblack myth\s*:\s*wukong\b/gi, 'Black Myth: Wukong');
};

export const part1LearningItemKey = (item: Pick<SpeakingMaterialBankItem, 'materialKey' | 'reusableVersion' | 'sourceWording'>) =>
  normalizePart1ComparableText(item.materialKey || item.reusableVersion || item.sourceWording || '');

export const part1DevelopmentChunkKey = (questionRef: string, chunk: Pick<NonNullable<Part1DevelopmentTarget['phraseChunks']>[number], 'text'>) =>
  normalizePart1ComparableText(`${questionRef} ${chunk.text || ''}`);

const lineList = (items: Array<string | undefined | null>) =>
  Array.from(new Set(items.map(item => normalizePart1LearnerText(item || '')).filter(Boolean)));

const stripPart1DiscourseLeadIn = (text = '') =>
  normalizePart1TranscriptDisplayText(text)
    .replace(/^(?:(?:yes absolutely|yes definitely|definitely not|absolutely not|certainly not|probably not|not really|yes|yeah|yep|no|nope|sure|of course|absolutely|definitely|certainly|actually|well|basically|honestly|personally)(?:\s*,|\s*\.|\s+))+/i, '')
    .trim();

const tidyPart1ExpressionFrame = (text = '') =>
  text
    .replace(/\[(?:doing\s+)?something\]/gi, 'sth')
    .replace(/\[[^\]]+\]/g, 'sth')
    .replace(/\bsomething\b/gi, 'sth')
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const abstractPart1FramePronouns = (text = '') =>
  text
    .replace(/\bmy\b/gi, "one's")
    .replace(/\bour\b/gi, "one's")
    .replace(/\b(?:me|us|you|him|her|them|someone|people)\b/gi, 'sb')
    .replace(/\b(?:really|very|quite|particularly|so)\s+(?=one's\b)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

const basePart1FrameVerb = (verb = '') => {
  const lower = verb.toLowerCase();
  if (/ies$/.test(lower)) return `${lower.slice(0, -3)}y`;
  if (/ches$|shes$|sses$|xes$|zes$|oes$/.test(lower)) return lower.slice(0, -2);
  if (/s$/.test(lower) && lower.length > 3) return lower.slice(0, -1);
  return lower;
};

const compactPart1SentenceExpression = (text = '') => {
  const personalVerbFrame = text.match(/^(?:i|we)\s+(?:(?:usually|often|sometimes|really|quite|just)\s+)?(tend to|try to|prefer|choose|avoid|enjoy|like|love|spend|need|want|use|visit|keep|look forward to)\s+(.+)$/i);
  if (personalVerbFrame) {
    return abstractPart1FramePronouns(tidyPart1ExpressionFrame(`${personalVerbFrame[1].toLowerCase()} ${personalVerbFrame[2]}`));
  }

  const affectiveFrame = text.match(/^it\s+(brings?|gives?|offers?|provides?)\s+(me|us|you|him|her|them|someone|people)\s+(.+)$/i);
  if (affectiveFrame) {
    return abstractPart1FramePronouns(tidyPart1ExpressionFrame(`${basePart1FrameVerb(affectiveFrame[1])} sb ${affectiveFrame[3]}`));
  }

  const makeFeelFrame = text.match(/^it\s+makes?\s+(me|us|you|him|her|them|someone|people)\s+(feel\s+.+)$/i);
  if (makeFeelFrame) {
    return abstractPart1FramePronouns(tidyPart1ExpressionFrame(`make sb ${makeFeelFrame[2]}`));
  }

  const expletiveFrame = text.match(/^(?:(?:it|this|that)(?:'s| is| has)?\s+(?:become|became|turned into)|(?:it|this|that)(?:'s| is| was| feels like| seems like))\s+(.+)$/i);
  if (!expletiveFrame) return '';
  const frame = abstractPart1FramePronouns(tidyPart1ExpressionFrame(expletiveFrame[1]))
    .replace(/^not\s+(?:really|very|quite|particularly|exactly)\s+/i, 'not ');
  if (/^not\s+/i.test(frame)) return frame.replace(/^not\s+/i, 'not be ');
  return frame;
};

const normalizePart1ChunkText = (text = '') => {
  const clean = normalizePart1TranscriptDisplayText(text);
  if (/^home to\b/i.test(clean)) return `be ${clean}`;
  if (/^hustle and bustle of\b/i.test(clean)) return `the ${clean}`;
  if (/^personally meaningful$/i.test(clean)) return 'a personally meaningful gift';
  if (/from all over$/i.test(clean)) return `${clean} the country`;
  return clean;
};

const normalizePart1ExpressionBankText = (text = '') => {
  const clean = tidyPart1ExpressionFrame(stripPart1DiscourseLeadIn(normalizePart1ChunkText(text)));
  const compact = normalizePart1ComparableText(clean);
  if (/^(?:i am|im|i m|i'm)\s+(?:really|quite|very|particularly|so)?\s*into\b/.test(compact)) return 'be into sth';
  if (/^be\s+(?:really|quite|very|particularly|so)?\s*into\b/.test(compact)) return 'be into sth';
  if (/^(?:i am|im|i m|i'm)\s+not\s+(?:really|particularly|that)?\s*keen on\b/.test(compact)) return 'not be keen on sth';
  if (/^not\s+be\s+(?:really|particularly|that)?\s*keen on\b/.test(compact)) return 'not be keen on sth';
  if (/^(?:i|we)\s+have\s+(?:a\s+)?passion\s+for\b/.test(compact)) return 'have a passion for sth';
  if (/^have\s+(?:a\s+)?passion\s+for\b/.test(compact)) return 'have a passion for sth';
  if (/^(?:i|we)\s+spend\s+(?:countless|a lot of|so much|my|our|free)?\s*(?:hours|time)\b/.test(compact)) return 'spend time doing sth';
  if (/^it(?:s| is)\s+a\s+great\s+way\s+to\b/.test(compact)) return clean.replace(/^it(?:'s| is)\s+/i, '');
  if (/^it(?:s| is)\s+a\s+hobby\s+i(?:ve| have)\s+kept\s+up\s+since\s+childhood$/.test(compact)) return 'keep up a hobby since childhood';
  if (/^(?:we|my family and i|my friends and i)\s+have\s+(?:quite\s+)?different\s+(?:interests|hobbies|tastes)$/.test(compact)) return 'have different interests';
  if (/^(?:i|we)\s+spend\s+(?:my|our)?\s*free\s+time\b/.test(compact)) return 'spend free time doing sth';
  const compactedSentence = compactPart1SentenceExpression(clean);
  if (compactedSentence) return compactedSentence;
  return clean;
};

const inferPart1ChunkPurposeZh = (text = '') => {
  const compact = normalizePart1ComparableText(text);
  if (/\b(be|get|make|take|give|keep|hold|come|go|feel|look|sound|turn|end|tend|used to|rather than|compared with|in terms of)\b/.test(compact)) return '表达';
  return '';
};

const isCorrectionLikePart1Purpose = (text = '') =>
  /修正|改正|纠正|错误|错|语法|单复数|冠词|介词|时态|替代|替换|换掉|改为|改成|correct|correction|fix|repair|replace|instead of|grammar|plural|singular|article|preposition|tense|mistake|error/i.test(text);

const sanitizePart1DevelopmentPurpose = (text = '') => {
  const clean = normalizePart1LearnerText(text);
  return clean && !isCorrectionLikePart1Purpose(clean) ? clean : '';
};

export const isLowValuePart1ReusableExpression = (text = '') => {
  const compact = normalizePart1ComparableText(text);
  const words = compact.split(' ').filter(Boolean);
  const wordCount = words.length;
  const hasSlot = /\[[^\]]+\]/.test(text);
  const hasReusableShape = hasSlot ||
    /\b(be|being|been|have|having|had|get|make|take|give|keep|hold|come|go|feel|look|sound|turn|end|tend|put|choose|spend|buy|purchase|send|receive|watch|play|practice|use|visit|shop|wear|invest|used to|keen on|into|look forward to|rather than|instead of|compared with|compared to|in contrast|in terms of|when it comes to|as long as|from time to time|every now and then|a [a-z]+ (?:of|for|with|to)|the [a-z]+ (?:of|for|with|to))\b/.test(compact);
  const expressiveFrame = /\b(?:interested|keen|fond|drawn|open|attached|suited)\s+(?:to|on|of|for)\b|\b(?:matters?|comes?|fits?|suits?|depends?|changes?|evolves?|lasts?)\b|\b(?:comfort|taste|style|routine|habit|priority|preference|budget|quality|function|design)\b/.test(compact);
  if (!compact) return true;
  if (/^(because|for example|a specific reason|one reason|one example|one detail|some detail|a concrete personal reason|a clearer personal feeling|a simple but useful contrast|one memorable supporting detail|comfortable to wear|good for me|nice place|big mall|a big mall called circle|quiet place|relaxed place|quiet and relaxed place|that is one reason|a great way|said good vocabulary|the best way to encourage someone|and my teacher thought|just two blocks away|find a peaceful spot|a popular tourist destination|commute during rush hour|heavy traffic congestion|overwhelming numbers of people visiting|for college for university|for university for college|for college|for university)$/.test(compact)) return true;
  if (/^(yes\b|yeah\b|no\b|sure\b|of course\b|i think\b|i would say\b|in my opinion\b|well\b|actually\b|basically\b|i prefer\b|i like\b|i was born\b|i grew up\b|since childhood\b|it depends on\b|it depends\b)/.test(compact)) return true;
  if (/^(and|so|then|which|that|where|when|because|for example)\b/.test(compact)) return true;
  if (/\b(?:because|after|before|when|where|which|that|if|so|and|but|to|for|with|about|said|required)\s*\.?$/.test(compact)) return true;
  if (/^(it|this|that|there)\s+(?:is|was|are|were|required|helps?)\b/.test(compact) && !hasSlot && !expressiveFrame) return true;
  if (/^(my|our|i|im|i am|ive|i have|id|i would|we|were|we are|weve|we have)\b/.test(compact) && !hasSlot && !hasReusableShape && !expressiveFrame) return true;
  if (/^(?:do|did|doing|done) a good job$|^play as a team$|^encourage someone$|^encourage teammates$|^(?:win|won) a scholarship(?: at university)?$|^presentation went well$|^went well$|^prepare a final presentation in english$|^learn vocabulary about\b/.test(compact)) return true;
  if (wordCount <= 1) return true;
  if (!hasReusableShape && !expressiveFrame && wordCount < 2) return true;
  return false;
};

const isRawCoachingText = (text = '') =>
  /add more detail|further explain|one more sentence|you can further|可以进一步|可以补充|再补|补一个|发展方向|训练动作|清晰地表达|提供了.*补充|提供了.*信息|给出了|保留了|丰富了回答|这句话|核心信息|居住时长|例外情况|补充信息|可以扩展|扩展使用|可用于|可以用于|适合用于|用.*替换|替换部分措辞/i.test(text);

const isPart1MaterialTranslationText = (text = '') => {
  const clean = normalizePart1LearnerText(text);
  if (!clean || !hasCjk(clean) || looksLikeMojibake(clean) || isRawCoachingText(clean)) return false;
  const compact = clean.replace(/\s+/g, '');
  if (/^(?:这个|这句|这段|这条|该|此|本|素材|表达|短语|句子|回答|考生|学习者|用户|用于|用来|适合)/.test(compact)) return false;
  if (/^这是/.test(compact) && /(?:信息|素材|表达|用法|用途|扩展|发展|保留|强调|说明|体现|展示)/.test(compact)) return false;
  if (/^在.+基础上/.test(compact)) return false;
  if (/^(?:表达了|说明了|强调了|保留了|提供了|体现了|展示了|描述了)/.test(compact)) return false;
  return true;
};

const isInvalidUsageText = (text = '') =>
  /\bconsider is\b|\bplaces where\b.*\bthere\b|\bwhere i enjoy eating there\b|\bhand make\b|\bhandmake\b|\bas an employee\b|\bemployee like me\b|\bnot that much convenient\b|\bheavy transportation\b|\btraffic jam\b/i.test(text);

const materialText = (item: Pick<SpeakingMaterialBankItem, 'sourceWording' | 'reusableVersion' | 'materialCore'>) =>
  `${item.materialCore || ''} ${item.sourceWording || ''} ${item.reusableVersion || ''}`;

const materialRepeatsKnownAnswer = (
  candidate: string,
  item: SpeakingMaterialBankItem,
  thread: SpeakingThreadFeedback | undefined,
  answers: SpeakingThreadAnswer[],
) => {
  const candidateKey = normalizePart1ComparableText(candidate);
  if (!candidateKey) return true;
  return [
    item.sourceWording,
    ...answers.map(answer => answer.answer),
    ...(thread?.cleanRetryAnswers || []).map(answer => answer.answer),
  ].some(known => normalizePart1ComparableText(known || '') === candidateKey);
};

const selectMaterialDisplayEnglish = (
  item: SpeakingMaterialBankItem,
  thread: SpeakingThreadFeedback | undefined,
  answers: SpeakingThreadAnswer[],
) => {
  const candidates = lineList([
    item.developedExample,
    item.reusableVersion,
  ]).map(candidate => stripPart1DiscourseLeadIn(candidate));
  return candidates.find(candidate =>
    candidate &&
    !isInvalidUsageText(candidate) &&
    !materialRepeatsKnownAnswer(candidate, item, thread, answers),
  ) || '';
};

const packageMaterial = (
  item: SpeakingMaterialBankItem,
  thread: SpeakingThreadFeedback | undefined,
  answers: SpeakingThreadAnswer[],
): SpeakingMaterialBankItem | null => {
  const source = normalizePart1TranscriptDisplayText(item.sourceWording || '');
  const reusable = stripPart1DiscourseLeadIn(item.reusableVersion || '');
  const displayEnglish = selectMaterialDisplayEnglish(item, thread, answers);
  const text = normalizePart1ComparableText(materialText(item));
  const explanationZh = [item.translationZh, item.explanationZh]
    .map(candidate => normalizePart1LearnerText(candidate || ''))
    .find(isPart1MaterialTranslationText) || '';
  if (!displayEnglish || !explanationZh) return null;
  if (isInvalidUsageText(displayEnglish)) return null;
  if (/^(yes|yeah|no|sure|of course|not really)$/.test(text)) return null;

  const frames = lineList(item.expressionFrames || [])
    .filter(frame => !isLowValuePart1ReusableExpression(frame) && !isInvalidUsageText(frame))
    .slice(0, 4);

  let materialCore = normalizePart1TranscriptDisplayText(item.materialCore || source || reusable);
  let reusableVersion = reusable &&
    !isInvalidUsageText(reusable) &&
    !materialRepeatsKnownAnswer(reusable, item, thread, answers)
    ? reusable
    : displayEnglish;

  const safeFrames = lineList(frames).filter(frame => !isLowValuePart1ReusableExpression(frame)).slice(0, 4);
  const developmentMoveZh = normalizePart1LearnerText(item.developmentMoveZh || '');

  return {
    ...item,
    sourceWording: source && !isInvalidUsageText(source) ? source : undefined,
    reusableVersion,
    materialCore,
    reuseFor: lineList(item.part1UseCases?.length ? item.part1UseCases : item.reuseFor).slice(0, 3),
    explanationZh,
    translationZh: explanationZh,
    developmentMoveZh: developmentMoveZh && !isRawCoachingText(developmentMoveZh) ? developmentMoveZh : undefined,
    developedExample: displayEnglish,
    expressionFrames: safeFrames,
    materialKind: 'reusable_personal_material',
  };
};

const expressionValueRank = (text = '') => {
  const compact = normalizePart1ComparableText(text);
  if (/\b(commut|traffic|transport|district|commercial|complex|atmosphere|collocation|precision|precise)\b/.test(compact)) return 0;
  if (/\b(criteria|recognition|achievement|pressure|polished|technical vocabulary|reinforcement|belonging|family ties|walking distance)\b/.test(compact)) return 1;
  if (/\b(handmade|anniversary|sentimental|keepsake|specific|concrete|category|range)\b/.test(compact)) return 2;
  if (/\b(rather than|compared with|after work|less crowded|more convenient|natural|idiomatic)\b/.test(compact)) return 3;
  return 4;
};

const expressionItem = (phrase: string, _source?: string, reuseFor: string[] = ['Part 1 answer upgrade']): SpeakingMaterialBankItem | null => {
  const reusableVersion = normalizePart1ExpressionBankText(phrase);
  if (!reusableVersion || isLowValuePart1ReusableExpression(reusableVersion) || isInvalidUsageText(reusableVersion)) return null;
  return {
    reusableVersion,
    reuseFor,
  };
};

const part1KnownExpressionSourceText = (thread: SpeakingThreadFeedback | undefined, answers: SpeakingThreadAnswer[] = []) =>
  normalizePart1ComparableText([
    ...answers.flatMap(answer => [answer.answer, answer.question]),
    ...(thread?.cleanRetryAnswers || []).map(item => item.answer),
    ...(thread?.annotations || []).flatMap(annotation => [
      annotation.sourceQuote,
      annotation.combinedRepair,
      ...annotation.layers.flatMap(layer => [layer.original, layer.better]),
    ]),
  ].filter(Boolean).join(' '));

const expressionRepeatsKnownWording = (phrase: string, knownText: string) => {
  const phraseKey = normalizePart1ComparableText(phrase);
  if (!knownText || !phraseKey) return false;
  if (knownText.includes(phraseKey)) return true;
  const phraseWords = phraseKey.split(' ').filter(word => word.length > 3);
  if (phraseWords.length < 3) return false;
  const overlap = phraseWords.filter(word => knownText.includes(word)).length;
  return overlap >= Math.ceil(phraseWords.length * 0.75);
};

type Part1CorrectionEntry = {
  original: string;
  better: string;
  combined: string;
};

const collectPart1CorrectionEntries = (thread: SpeakingThreadFeedback | undefined) => {
  const entries: Part1CorrectionEntry[] = [];
  const add = (original = '', better = '', combined = '') => {
    const entry = {
      original: normalizePart1ComparableText(original),
      better: normalizePart1ComparableText(better),
      combined: normalizePart1ComparableText(combined),
    };
    if (entry.original || entry.better || entry.combined) entries.push(entry);
  };

  (thread?.annotations || []).forEach(annotation => {
    add('', '', annotation.combinedRepair);
    annotation.layers.forEach(layer => add(layer.original, layer.better));
  });
  (thread?.mustFix || []).forEach(item => add(item.learnerWording, item.betterVersion));
  (thread?.highImpactPhraseFixes || []).forEach(item => add(item.original, item.better));

  return entries;
};

const phraseRepeatsCorrectionEntry = (phrase: string, entries: Part1CorrectionEntry[]) => {
  const phraseKey = normalizePart1ComparableText(phrase);
  if (!phraseKey) return false;
  return entries.some(entry => {
    const entryParts = [entry.original, entry.better, entry.combined].filter(Boolean);
    if (entryParts.some(part => part === phraseKey || part.includes(phraseKey) || phraseKey.includes(part))) {
      return true;
    }
    return entryParts.some(part => expressionRepeatsKnownWording(phraseKey, part));
  });
};

const expressionMaterialOverlap = (expression: SpeakingMaterialBankItem, materials: SpeakingMaterialBankItem[]) => {
  const expressionKey = normalizePart1ComparableText(expression.reusableVersion);
  if (!expressionKey) return true;
  return materials.some(material => {
    const materialKey = normalizePart1ComparableText(material.developedExample || material.reusableVersion || material.materialCore || material.sourceWording || '');
    if (!materialKey) return false;
    const expressionWordCount = expressionKey.split(' ').filter(Boolean).length;
    return materialKey === expressionKey || (
      expressionWordCount >= 3 &&
      materialKey.includes(expressionKey)
    );
  });
};

const collectExpressionItems = (
  thread: SpeakingThreadFeedback | undefined,
  materials: SpeakingMaterialBankItem[] = [],
  answers: SpeakingThreadAnswer[] = [],
) => {
  const items: SpeakingMaterialBankItem[] = [];
  const knownText = part1KnownExpressionSourceText(thread, answers);
  const push = (item: SpeakingMaterialBankItem | null) => {
    if (!item) return;
    items.push(item);
  };

  (thread?.materialBank.reusableSpokenLanguage || []).forEach(item => push(expressionItem(item.reusableVersion, item.sourceWording, item.reuseFor)));
  (thread?.developmentTargets || []).forEach(target => {
    [
      ...(target.phraseChunks || []).map(chunk => chunk.text),
      ...(target.phraseScaffolds || []),
    ].forEach(chunk => push(expressionItem(chunk, '', [`${target.questionRef} development`])));
  });
  [...(thread?.highImpactPhraseFixes || []), ...(thread?.optionalPolish || [])].forEach(item => {
    push(expressionItem(item.better, item.original, item.questionRefs.map(ref => `${ref} spoken upgrade`)));
  });

  const filtered = items
    .filter(item => !expressionMaterialOverlap(item, materials))
    .filter(item => !expressionRepeatsKnownWording(item.reusableVersion, knownText))
    .filter((item, index, all) =>
      all.findIndex(candidate => normalizePart1ComparableText(candidate.reusableVersion) === normalizePart1ComparableText(item.reusableVersion)) === index,
    );

  return filtered
    .filter((item, index, all) =>
      all.findIndex(candidate => normalizePart1ComparableText(candidate.reusableVersion) === normalizePart1ComparableText(item.reusableVersion)) === index,
    )
    .sort((left, right) => expressionValueRank(left.reusableVersion) - expressionValueRank(right.reusableVersion))
    .slice(0, 18);
};

const cleanDevelopmentTarget = (
  target: Part1DevelopmentTarget,
  correctionEntries: Part1CorrectionEntry[] = [],
): Part1DevelopmentTarget | null => {
  const reasonZh = normalizePart1LearnerText(target.reasonZh);
  const developmentMoveZh = normalizePart1LearnerText(target.developmentMoveZh);
  const rawChunks: NonNullable<Part1DevelopmentTarget['phraseChunks']> = [
    ...(target.phraseChunks || []),
    ...(target.phraseScaffolds || []).map(text => ({ text })),
  ];
  const phraseChunks = rawChunks
    .map((chunk): NonNullable<Part1DevelopmentTarget['phraseChunks']>[number] | null => {
      const text = normalizePart1ChunkText(chunk.text);
      if (!text || isLowValuePart1ReusableExpression(text)) return null;
      if (phraseRepeatsCorrectionEntry(text, correctionEntries)) return null;
      const purposeZh = sanitizePart1DevelopmentPurpose(chunk.purposeZh || inferPart1ChunkPurposeZh(text));
      return purposeZh ? { text, purposeZh } : { text };
    })
    .filter((chunk): chunk is NonNullable<Part1DevelopmentTarget['phraseChunks']>[number] => Boolean(chunk))
    .filter((chunk, index, all) =>
      all.findIndex(candidate => normalizePart1ComparableText(candidate.text) === normalizePart1ComparableText(chunk.text)) === index,
    )
    .slice(0, 12);
  const optionalDevelopedAnswer = normalizePart1TranscriptDisplayText(target.optionalDevelopedAnswer || '');
  if (!phraseChunks.length && !optionalDevelopedAnswer) return null;
  const overexpands = /再补|更多地点|朋友|设备|场景|add more|more detail/i.test(`${reasonZh} ${developmentMoveZh}`);
  if (overexpands && /已经|already|地点|原因|reason|because/i.test(reasonZh)) return null;
  return {
    ...target,
    reasonZh,
    developmentMoveZh,
    ...(optionalDevelopedAnswer ? { optionalDevelopedAnswer } : {}),
    phraseChunks,
  };
};

const materialMatchesAnswer = (item: SpeakingMaterialBankItem, answer = '') => {
  const answerKey = normalizePart1ComparableText(answer);
  const itemKey = normalizePart1ComparableText(materialText(item));
  if (!answerKey || !itemKey) return false;
  return itemKey.split(' ').filter(word => word.length > 3).some(word => answerKey.includes(word));
};

const expressionMatchesAnswer = (item: SpeakingMaterialBankItem, answer = '') => {
  const answerKey = normalizePart1ComparableText(answer);
  const itemKey = normalizePart1ComparableText(`${item.sourceWording || ''} ${item.reusableVersion}`);
  if (!answerKey || !itemKey) return false;
  return itemKey.split(' ').filter(word => word.length > 4).some(word => answerKey.includes(word));
};

const buildAnswerDevelopmentActions = (
  thread: SpeakingThreadFeedback | undefined,
  answers: SpeakingThreadAnswer[],
  materials: SpeakingMaterialBankItem[],
  expressions: SpeakingMaterialBankItem[],
  coaching: Part1DevelopmentTarget[],
): Part1LearningAction[] => answers.map((answer, index) => {
  const questionRef = `Q${index + 1}`;
  const matchedExpression = expressions.find(item => expressionMatchesAnswer(item, answer.answer));
  const hasCorrection = (thread?.annotations || []).some(annotation =>
    annotation.questionRef === questionRef &&
    annotation.layers.some(layer => layer.severity === 'must_fix'),
  );
  const target = coaching.find(item => item.questionRef === questionRef);
  if (target) {
    return {
      questionRef,
      type: target.developmentMode === 'needs_content' ? 'true_development' : 'expression_upgrade',
      summaryZh: target.developmentMoveZh,
      examples: target.phraseChunks || [],
    };
  }
  if (hasCorrection) {
    return {
      questionRef,
      type: 'correction',
      summaryZh: '先把上面的准确性问题说稳，再保留原意换一个更自然的词块。',
      examples: matchedExpression ? [{ text: matchedExpression.reusableVersion }] : [],
    };
  }
  const material = materials.find(item => materialMatchesAnswer(item, answer.answer));
  if (material) {
    return {
      questionRef,
      type: 'material_extraction',
      summaryZh: '',
      examples: [],
    };
  }
  const expression = matchedExpression;
  if (expression) {
    return {
      questionRef,
      type: 'expression_upgrade',
      summaryZh: '',
      examples: [{ text: expression.reusableVersion }],
    };
  }
  return {
    questionRef,
    type: 'expression_upgrade',
    summaryZh: '',
    examples: [],
  };
});

export const buildPart1LearningDisplayModel = (
  thread: SpeakingThreadFeedback | undefined,
  options: { answers?: SpeakingThreadAnswer[] } = {},
): Part1LearningDisplayModel => {
  const answers = options.answers || [];
  const hiddenMaterialDiagnostics: string[] = [];
  const userMaterials = (thread?.materialBank.myUsableMaterial || [])
    .map(item => {
      const packaged = packageMaterial(item, thread, answers);
      if (!packaged) hiddenMaterialDiagnostics.push(`hidden:${normalizePart1ComparableText(materialText(item)).slice(0, 80)}`);
      return packaged;
    })
    .filter((item): item is SpeakingMaterialBankItem => Boolean(item))
    .filter((item, index, all) =>
      all.findIndex(candidate => normalizePart1ComparableText(`${candidate.materialCore || ''} ${candidate.reusableVersion}`) === normalizePart1ComparableText(`${item.materialCore || ''} ${item.reusableVersion}`)) === index,
    );
  const expressionBank = collectExpressionItems(thread, userMaterials, answers);
  const correctionEntries = collectPart1CorrectionEntries(thread);
  const answerCoaching = (thread?.developmentTargets || [])
    .map(target => cleanDevelopmentTarget(target, correctionEntries))
    .filter((item): item is Part1DevelopmentTarget => Boolean(item));
  return {
    answerCoaching,
    answerActions: buildAnswerDevelopmentActions(thread, answers, userMaterials, expressionBank, answerCoaching),
    userMaterials,
    expressionBank,
    sessionPatterns: (thread?.threadLevelPatterns || []).map(item => ({
      observationZh: normalizePart1LearnerText(item.observationZh),
      whyItMattersZh: normalizePart1LearnerText(item.whyItMattersZh),
      retryRule: normalizePart1LearnerText(item.retryRule),
    })).filter(item => item.observationZh && item.retryRule),
    hiddenMaterialDiagnostics,
  };
};

export type Part1LearningPayloadQuality = {
  ok: boolean;
  issues: string[];
  summary: string;
  missingDevelopmentRefs: string[];
  thinDevelopmentRefs: string[];
  expressionCount: number;
};

export const evaluatePart1LearningPayloadQuality = (
  thread: SpeakingThreadFeedback | undefined,
  answers: SpeakingThreadAnswer[] = [],
): Part1LearningPayloadQuality => {
  const display = buildPart1LearningDisplayModel(thread, { answers });
  const answeredRefs = answers
    .map((answer, index) => ({ ref: `Q${index + 1}`, answer: answer.answer.trim() }))
    .filter(item => item.answer)
    .map(item => item.ref);
  const targetByRef = new Map(display.answerCoaching.map(target => [target.questionRef, target] as const));
  const missingDevelopmentRefs = answeredRefs.filter(ref => !targetByRef.has(ref));
  const thinDevelopmentRefs = answeredRefs.filter(ref => {
    const target = targetByRef.get(ref);
    if (!target) return false;
    return (target.phraseChunks || []).length < 5;
  });
  const expressionCount = display.expressionBank.length;
  const issues = [
    ...(missingDevelopmentRefs.length ? [`missing developmentTargets for ${missingDevelopmentRefs.join(', ')}`] : []),
    ...(thinDevelopmentRefs.length ? [`developmentTargets too thin for ${thinDevelopmentRefs.join(', ')}`] : []),
    ...(expressionCount < 10 ? [`reusableSpokenLanguage has ${expressionCount} displayable items; expected at least 10 current-topic items`] : []),
  ];

  return {
    ok: issues.length === 0,
    issues,
    summary: issues.join('; '),
    missingDevelopmentRefs,
    thinDevelopmentRefs,
    expressionCount,
  };
};

const normalizePart1MatchChar = (char: string) =>
  char.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/u, ' ');

const buildPart1SearchText = (text: string) => {
  let normalized = '';
  const originalIndexes: number[] = [];
  Array.from(text).forEach((char, index) => {
    const next = normalizePart1MatchChar(char);
    if (!next) return;
    if (/\s/.test(next)) {
      if (!normalized.endsWith(' ')) {
        normalized += ' ';
        originalIndexes.push(index);
      }
      return;
    }
    normalized += next;
    originalIndexes.push(index);
  });
  return { normalized, originalIndexes };
};

const findUniqueSpan = (answer: string, quote: string) => {
  const search = buildPart1SearchText(answer);
  const needle = buildPart1SearchText(quote).normalized.trim();
  if (!needle) return null;
  const first = search.normalized.indexOf(needle);
  if (first < 0 || search.normalized.indexOf(needle, first + 1) >= 0) return null;
  const end = first + needle.length;
  const originalStart = search.originalIndexes[first];
  const originalEnd = (search.originalIndexes[end - 1] ?? originalStart) + 1;
  if (!Number.isFinite(originalStart) || !Number.isFinite(originalEnd) || originalEnd <= originalStart) return null;
  return { start: originalStart, end: originalEnd };
};

const severityRank: Record<Part1AnswerAnnotationLayer['severity'], number> = {
  must_fix: 3,
  better_spoken_choice: 2,
  optional_polish: 1,
};

const sortLayers = (layers: Part1AnswerAnnotationLayer[]) =>
  [...layers].sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);

const isFormatOnlyLayer = (layer: Part1AnswerAnnotationLayer) => {
  const original = normalizePart1ComparableText(layer.original);
  const better = normalizePart1ComparableText(layer.better);
  if (!original || !better) return true;
  if (original === better) return true;
  const letters = (text: string) => normalizePart1ComparableText(text).replace(/[^a-z]/g, '');
  if (letters(layer.original) === letters(layer.better)) return true;
  return /\b(casing|capitalization|uppercase|lowercase|punctuation|spacing|asr|transcript)\b/i.test(`${layer.issueType} ${layer.explanationZh}`);
};

export const findPart1AnnotationDisplaySpans = (
  answer: string,
  annotations: Part1AnswerAnnotation[],
) => {
  const anchored: Part1AnnotationSpan[] = [];
  const unanchored: Part1AnswerAnnotation[] = [];
  annotations.forEach(annotation => {
    const layers = sortLayers(annotation.layers.filter(layer => !isFormatOnlyLayer(layer) && !isInvalidUsageText(layer.better)));
    if (!layers.length) return;
    const localLayers: Part1AnswerAnnotationLayer[] = [];
    const broadLayers: Part1AnswerAnnotationLayer[] = [];
    layers.forEach(layer => {
      const sameAsSource = normalizePart1ComparableText(layer.original) === normalizePart1ComparableText(annotation.sourceQuote);
      const localSpan = !sameAsSource ? findUniqueSpan(answer, layer.original) : null;
      if (localSpan) {
        const localAnnotation = {
          ...annotation,
          id: `${annotation.id}_${localSpan.start}_${localSpan.end}`,
          sourceQuote: answer.slice(localSpan.start, localSpan.end),
          layers: [layer],
          combinedRepair: undefined,
        };
        anchored.push({
          annotation: localAnnotation,
          start: localSpan.start,
          end: localSpan.end,
          visibleText: localAnnotation.sourceQuote,
        });
        localLayers.push(layer);
      } else {
        broadLayers.push(layer);
      }
    });
    if (!broadLayers.length) return;
    const span = findUniqueSpan(answer, annotation.sourceQuote);
    const broadAnnotation = { ...annotation, layers: broadLayers };
    if (!span) {
      unanchored.push(broadAnnotation);
      return;
    }
    anchored.push({
      annotation: { ...broadAnnotation, sourceQuote: answer.slice(span.start, span.end) },
      start: span.start,
      end: span.end,
      visibleText: answer.slice(span.start, span.end),
    });
  });
  return { anchored: anchored.sort((a, b) => a.start - b.start), unanchored };
};
