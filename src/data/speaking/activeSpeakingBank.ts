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

export type Part1ThreadQuestionProvenance = 'active_bank_source' | 'product_supplement';

export interface Part1ThreadQuestion {
  id: string;
  question: string;
  topic: string;
  topicCategory?: SpeakingTopicCategory;
  tags?: string[];
  provenance: Part1ThreadQuestionProvenance;
  sourceQuestionId?: string;
  supplementId?: string;
}

export interface Part1TopicThreadSet {
  id: string;
  topicId: string;
  topic: string;
  title: string;
  topicCategory?: SpeakingTopicCategory;
  tags: string[];
  questions: Part1ThreadQuestion[];
}

const topicIdFromTitle = (topic: string) =>
  topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const sourceThreadQuestion = (question: SpeakingQuestion): Part1ThreadQuestion => ({
  id: question.id,
  question: question.question,
  topic: question.topic,
  topicCategory: question.topicCategory,
  tags: question.tags,
  provenance: 'active_bank_source',
  sourceQuestionId: question.id,
});

const productSupplementQuestion = (
  topic: string,
  topicCategory: SpeakingTopicCategory | undefined,
  tags: string[] | undefined,
  supplementId: string,
  question: string,
): Part1ThreadQuestion => ({
  id: supplementId,
  question,
  topic,
  topicCategory,
  tags,
  provenance: 'product_supplement',
  supplementId,
});

const threadBlueprints: Record<string, number[][]> = {
  'work-or-studies': [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19],
    [20, 21, 22],
  ],
  'home-accommodation': [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
  ],
  hometown: [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11],
    [12, 13, 14],
  ],
  'area-you-live-in': [
    [1, 2, 3, 4],
    [5, 6, 7],
  ],
  'city-you-live-in': [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11],
  ],
};

const defaultBlueprints = (count: number) => {
  if (count <= 0) return [];
  if (count === 1) return [[1]];
  if (count === 2) return [[1, 2]];
  if (count === 3) return [[1, 2, 3]];
  if (count === 4) return [[1, 2, 3, 4]];
  if (count === 5) return [[1, 2, 3], [3, 4, 5]];
  if (count === 6) return [[1, 2, 3], [4, 5, 6]];
  if (count === 7) return [[1, 2, 3, 4], [5, 6, 7]];
  const groups: number[][] = [];
  for (let index = 1; index <= count; index += 4) {
    const group = Array.from({ length: Math.min(4, count - index + 1) }, (_, offset) => index + offset);
    if (group.length >= 3) groups.push(group);
  }
  const last = groups[groups.length - 1];
  if (last && last.length < 3 && groups.length > 1) {
    groups.pop();
    groups.push(Array.from({ length: 3 }, (_, offset) => count - 2 + offset));
  }
  return groups;
};

const buildPart1TopicThreads = (): Part1TopicThreadSet[] => {
  const byTopic = speakingPart1.reduce((map, question) => {
    const topicId = topicIdFromTitle(question.topic);
    const list = map.get(topicId) || [];
    list.push(question);
    map.set(topicId, list);
    return map;
  }, new Map<string, SpeakingQuestion[]>());

  return Array.from(byTopic.entries()).flatMap(([topicId, questions]) => {
    const first = questions[0];
    const tags = first.tags || [first.topicCategory, first.topic].filter((value): value is string => Boolean(value));
    if (topicId === 'sports-team') {
      return [{
        id: 'sp1thread_2026may_sports-team_01',
        topicId,
        topic: first.topic,
        title: first.topic,
        topicCategory: first.topicCategory,
        tags,
        questions: [
          sourceThreadQuestion(first),
          productSupplementQuestion(first.topic, first.topicCategory, tags, 'sp1_2026may_sports-team_product_supplement_02', 'Did you play any team sports when you were a child?'),
          productSupplementQuestion(first.topic, first.topicCategory, tags, 'sp1_2026may_sports-team_product_supplement_03', 'Do you enjoy watching team sports?'),
          productSupplementQuestion(first.topic, first.topicCategory, tags, 'sp1_2026may_sports-team_product_supplement_04', 'Do you prefer team sports or individual sports?'),
        ],
      }];
    }

    const blueprints = threadBlueprints[topicId] || defaultBlueprints(questions.length);
    return blueprints
      .map(indexes => indexes.map(index => questions[index - 1]).filter(Boolean))
      .filter(group => group.length >= 3)
      .map((group, index): Part1TopicThreadSet => ({
        id: `sp1thread_2026may_${topicId}_${String(index + 1).padStart(2, '0')}`,
        topicId,
        topic: first.topic,
        title: first.topic,
        topicCategory: first.topicCategory,
        tags,
        questions: group.map(sourceThreadQuestion),
      }));
  });
};

export const speakingPart1TopicThreads: Part1TopicThreadSet[] = buildPart1TopicThreads();

export type { SpeakingQuestion };
