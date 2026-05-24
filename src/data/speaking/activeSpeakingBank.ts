import {
  SpeakingQuestion,
  SpeakingTopicCategory,
  speakingPart1 as v1SpeakingPart1,
  speakingPart2 as v1SpeakingPart2,
  speakingPart3 as v1SpeakingPart3,
} from '@/src/data/questions/bank';
import {
  speakingBank2026MayAugAll,
} from '@/src/data/speaking/speakingBank2026MayAug';
import type { SpeakingPrompt } from '@/src/data/speaking/speakingPromptTypes';

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const categoryMatchers: [SpeakingTopicCategory, string[]][] = [
  ['Work & Study', ['work', 'study', 'career', 'job', 'teacher', 'school', 'education', 'science', 'language']],
  ['Home & Hometown', ['home', 'hometown', 'accommodation', 'neighborhood', 'neighbourhood', 'area']],
  ['Family & People', ['family', 'friend', 'friends', 'people', 'old people', 'relationships', 'person']],
  ['Daily Life', ['daily life', 'routine', 'morning', 'going out', 'break', 'rest', 'walking', 'rules', 'planning']],
  ['Hobbies & Free Time', ['hobby', 'hobbies', 'sports', 'art', 'drawing', 'painting', 'creativity', 'activities']],
  ['Books & Reading', ['reading', 'books', 'stories']],
  ['Technology', ['technology', 'mobile phones', 'apps', 'internet', 'social media', 'electricity']],
  ['Travel & Places', ['travel', 'journey', 'city', 'public places', 'parks', 'places', 'nature', 'navigation']],
  ['Food & Health', ['food', 'health', 'dinner', 'meal']],
  ['Culture & Media', ['media', 'advertisements', 'museums', 'films', 'movies', 'culture', 'events', 'tradition']],
  ['Nature & Environment', ['nature', 'animals', 'plants', 'vegetables', 'fruit', 'wild animal']],
  ['Objects & Memories', ['objects', 'gifts', 'shoes', 'shopping', 'toys', 'memory', 'kept']],
];

const toTopicCategory = (prompt: SpeakingPrompt): SpeakingTopicCategory => {
  const haystack = normalize([prompt.topic, ...prompt.tags].join(' '));
  return categoryMatchers.find(([, keywords]) =>
    keywords.some(keyword => haystack.includes(normalize(keyword)))
  )?.[0] || 'Daily Life';
};

const mainlandPrompts = speakingBank2026MayAugAll
  .filter(prompt =>
    prompt.bankId === 'speaking-2026-05-08' &&
    prompt.region !== 'non_mainland' &&
    prompt.status !== 'non_mainland',
  )
  .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

const activeSeasonalPart1 = mainlandPrompts
  .filter(prompt => prompt.part === 1 && Boolean(prompt.question?.trim()))
  .map((prompt): SpeakingQuestion => {
    const topicCategory = toTopicCategory(prompt);
    return {
      id: prompt.id,
      part: 1,
      topic: prompt.topic,
      question: prompt.question?.trim() || prompt.topic,
      topicCategory,
      tags: [topicCategory],
    };
  });

const activeSeasonalPart2 = mainlandPrompts
  .filter(prompt => prompt.part === 2 && Boolean(prompt.cueCard?.prompt.trim()))
  .map((prompt): SpeakingQuestion => {
    const topicCategory = toTopicCategory(prompt);
    const cuePoints = prompt.cueCard?.points || [];
    const cueCard = [
      prompt.cueCard?.prompt.trim(),
      cuePoints.length ? 'You should say:' : '',
      ...cuePoints.map(point => `- ${point}`),
    ].filter(Boolean).join('\n');

    return {
      id: prompt.id,
      part: 2,
      topic: prompt.topic,
      question: prompt.cueCard?.prompt.trim() || prompt.topic,
      cueCard,
      topicCategory,
      tags: [topicCategory],
    };
  });

const activeSeasonalPart3 = mainlandPrompts
  .filter(prompt => prompt.part === 2 && Array.isArray(prompt.followUps) && prompt.followUps.length > 0)
  .flatMap((prompt): SpeakingQuestion[] => {
    const topicCategory = toTopicCategory(prompt);
    return (prompt.followUps || [])
      .map(question => question.trim())
      .filter(Boolean)
      .map((question, index) => ({
        id: `${prompt.id}_fu_${String(index + 1).padStart(2, '0')}`,
        part: 3,
        topic: prompt.topic,
        question,
        topicCategory,
        tags: [topicCategory],
      }));
  });

export const speakingPart1: SpeakingQuestion[] = activeSeasonalPart1.length
  ? activeSeasonalPart1
  : v1SpeakingPart1;

export const speakingPart2: SpeakingQuestion[] = activeSeasonalPart2.length
  ? activeSeasonalPart2
  : v1SpeakingPart2;

export const speakingPart3: SpeakingQuestion[] = activeSeasonalPart3.length
  ? activeSeasonalPart3
  : v1SpeakingPart3;

export const activeSpeakingBankStats = {
  source: 'speaking-2026-05-08-mainland',
  seasonalConvertibleCounts: {
    part1: activeSeasonalPart1.length,
    part2: activeSeasonalPart2.length,
    part3: activeSeasonalPart3.length,
  },
  fallbackCounts: {
    part1: v1SpeakingPart1.length,
    part2: v1SpeakingPart2.length,
    part3: v1SpeakingPart3.length,
  },
  activeCounts: {
    part1: speakingPart1.length,
    part2: speakingPart2.length,
    part3: speakingPart3.length,
  },
};

export type { SpeakingQuestion };
