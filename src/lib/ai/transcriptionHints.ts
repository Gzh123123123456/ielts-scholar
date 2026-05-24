import type { SpeakingPart } from './schemas';

const BASE_HINTS = [
  'jogging',
  'go jogging',
  'energetic',
  'workplace',
  'efficient',
  'commute',
  'daily routine',
  'breakfast',
  'office',
  'hometown',
  'childhood',
  'to some extent',
  'in my childhood',
  'when I was a kid',
  "I'd like to",
  'raining',
  'rainy',
  'electricity went off',
  'power went out',
  'power cut',
  'darkness',
  'candle',
  'candles',
  'lighter',
  'scared',
  'terrified',
  'TV series',
  'cartoon',
  'monsters',
  'went off',
  'came back',
  'power came back',
  'emergency',
];

const PART_HINTS: Record<SpeakingPart, string[]> = {
  1: ['short answer', 'personal detail', 'usually', 'prefer', 'like to'],
  2: ['cue card', 'experience', 'person', 'place', 'event', 'activity'],
  3: ['opinion', 'example', 'reason', 'advantage', 'disadvantage', 'society'],
};

const normalizeHint = (value: string) => value.replace(/\s+/g, ' ').trim();

const extractContextTerms = (text: string) => {
  const matches = text.match(/\b[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*){0,2}\b|[A-Za-z][A-Za-z'-]{4,}/g) || [];
  return matches
    .map(normalizeHint)
    .filter(item => item.length >= 4 && !/^(Describe|Speaking|Part|What|When|Where|Which|Would|Should|Could)$/i.test(item));
};

export const buildSpeakingTranscriptionHints = (input: {
  part: SpeakingPart;
  question: string;
  topic?: string;
  tags?: string[];
  cueCard?: string;
}) => {
  const candidates = [
    ...BASE_HINTS,
    ...PART_HINTS[input.part],
    input.topic || '',
    ...(input.tags || []),
    ...extractContextTerms(`${input.question} ${input.cueCard || ''} ${input.topic || ''} ${(input.tags || []).join(' ')}`),
  ];

  return Array.from(new Set(candidates.map(normalizeHint).filter(Boolean))).slice(0, 40);
};
