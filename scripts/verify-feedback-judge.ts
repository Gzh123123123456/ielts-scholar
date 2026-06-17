import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {
  buildSpeakingFeedbackJudgePacket,
  buildTeacherJudgePrompt,
  FeedbackJudgePacket,
  runHardSafetyFeedbackJudge,
} from '../src/lib/feedbackJudgeHarness.ts';
import { safeAnalyzeSpeaking } from '../src/lib/ai/safety.ts';
import type {
  Part1AnswerAnnotation,
  Part2LanguageSignal,
  Part2LanguageSignalCheck,
  SpeakingFeedback,
  SpeakingThreadAnswer,
} from '../src/lib/ai/schemas.ts';

type ExpectedTeacherVerdict = 'pass' | 'fail';

interface JudgeCalibrationCase {
  id: string;
  expectedTeacherVerdict: ExpectedTeacherVerdict;
  packet: FeedbackJudgePacket;
}

interface ExternalJudgeResult {
  pass: boolean;
  score: number;
  confidence?: string;
  summary?: string;
  criticalGaps?: unknown[];
  strongPoints?: unknown[];
  nextFix?: string;
}

const outputDir = path.join(process.cwd(), 'local_practice_data', 'feedback_judge');
const outputPath = path.join(outputDir, 'latest-report.json');

const baseSpeakingFeedback = (overrides: Partial<SpeakingFeedback>): SpeakingFeedback => ({
  mode: 'practice',
  module: 'speaking',
  part: 1,
  question: 'What is your favorite time of the day?',
  transcript: '',
  bandEstimateExcludingPronunciation: 6,
  scores: {
    fluencyCoherence: 6,
    lexicalResource: 6,
    grammaticalRangeAccuracy: 6,
    pronunciation: null,
    pronunciationNote: 'Not formally assessed.',
  },
  fatalErrors: [],
  naturalnessHints: [],
  band9Refinements: [],
  preservedStyle: [],
  upgradedAnswer: '',
  reusableExample: null,
  obsidianMarkdown: '',
  ...overrides,
});

const makeAnnotation = (
  id: string,
  questionRef: string,
  sourceQuote: string,
  issueType: string,
  better: string,
  severity: 'must_fix' | 'better_spoken_choice' | 'optional_polish' = 'must_fix',
): Part1AnswerAnnotation => ({
  id,
  questionRef,
  sourceQuote,
  combinedRepair: better,
  layers: [{
    severity,
    issueType,
    original: sourceQuote,
    better,
    explanationZh: `Repair this as: ${better}`,
  }],
});

const makeSignal = (
  signal: Part2LanguageSignal,
  bestUpgrade: string,
): Part2LanguageSignalCheck => ({
  signal,
  status: 'thin',
  requirementZh: `${signal} check`,
  foundInTranscript: false,
  evidence: '',
  evidenceQuotes: [],
  qualityZh: 'Needs a more useful Part 2 spoken asset.',
  nextMoveZh: 'Use this in the rebuilt story only if it fits the learner meaning.',
  bestUpgrade,
  alternatives: [],
  alternativeUpgrades: [],
  insertLocationZh: 'Use in the next speakable version.',
  sampleUpgrade: bestUpgrade,
  sampleUpgradeHighlight: bestUpgrade,
  sampleUpgrades: [],
  usedInNextVersionQuote: bestUpgrade,
  profileSignalZh: '',
});

const morningTranscript = 'I prefer morning. because I usually get up early. it makes me feel refreshed and energetic. I really enjoy morning time cause I could have a delicious breakfast and start jogging. when I finish these 2 things I feel accomplished and satisfied. this kind of morning makes me feel great at the rest of the day';

const undercoveredMorningFeedback = baseSpeakingFeedback({
  transcript: morningTranscript,
  bandEstimateExcludingPronunciation: 7,
  scores: {
    fluencyCoherence: 7,
    lexicalResource: 7,
    grammaticalRangeAccuracy: 6.5,
    pronunciation: null,
    pronunciationNote: 'Not formally assessed.',
  },
  estimateRationaleZh: 'The answer is direct and specific, but this fixture intentionally undercovers obvious language issues.',
  fatalErrors: [{
    original: 'at the rest of the day',
    correction: 'for the rest of the day',
    tag: 'preposition',
    explanationZh: 'Use the fixed phrase "for the rest of the day."',
  }],
  upgradedAnswer: 'My favorite time of the day is definitely the morning. I usually get up early, and I just love how refreshed and energetic I feel. I make myself a nice breakfast and then go for a jog. After those two activities, I feel really accomplished and satisfied, and it sets a positive tone for the rest of the day.',
});

const comprehensiveMorningFeedback = baseSpeakingFeedback({
  transcript: morningTranscript,
  bandEstimateExcludingPronunciation: 6.5,
  scores: {
    fluencyCoherence: 6.5,
    lexicalResource: 6.5,
    grammaticalRangeAccuracy: 6,
    pronunciation: null,
    pronunciationNote: 'Not formally assessed.',
  },
  estimateRationaleZh: 'The answer has useful routine material, but several audible accuracy and spoken-choice issues keep it below a stable 7.',
  fatalErrors: [
    {
      original: 'I prefer morning',
      correction: 'I prefer the morning',
      tag: 'article_naturalness',
      explanationZh: 'For a time of day, "the morning" sounds natural.',
    },
    {
      original: 'I could have a delicious breakfast',
      correction: 'I can have a nice breakfast',
      tag: 'habit_modal',
      explanationZh: 'This is a daily habit, so "can" or "get to" is clearer than "could".',
    },
    {
      original: 'at the rest of the day',
      correction: 'for the rest of the day',
      tag: 'preposition',
      explanationZh: 'The natural phrase is "for the rest of the day."',
    },
  ],
  naturalnessHints: [
    {
      original: 'start jogging',
      better: 'go for a jog',
      tag: 'spoken_collocation',
      explanationZh: '"Go for a jog" is the natural spoken action phrase here.',
    },
    {
      original: 'when I finish these 2 things',
      better: "once I've done both",
      tag: 'spoken_flow',
      explanationZh: 'This makes the transition sound less like a transcript and more like speech.',
    },
  ],
  preservedStyle: [
    {
      text: 'get up early, breakfast, jogging, feel accomplished',
      reasonZh: 'These are usable personal routine details.',
      expansionZh: 'They can transfer to routine, morning, healthy habit, or free-time questions.',
    },
  ],
  upgradedAnswer: 'My favorite time of the day is definitely the morning. I usually get up early, so I can have a nice breakfast and then go for a jog. Once I have done both, I feel refreshed and accomplished, and it sets a positive tone for the rest of the day.',
});

const hobbiesThreadAnswers: SpeakingThreadAnswer[] = [
  {
    questionId: 'h1',
    question: 'Do you have any hobbies?',
    answer: 'I like playing the piano especially the classical and jazz music.',
  },
  {
    questionId: 'h2',
    question: 'Did you have any hobbies when you were a child?',
    answer: 'well I would like to say that when I was a kid I used to be a big fan of PC games like pokemon',
  },
  {
    questionId: 'h3',
    question: "Do you have a hobby that you've had since childhood?",
    answer: 'oh that can be the piano I am really addicted to it even today I maintain this habit of playing the piano for 1 hour a day',
  },
  {
    questionId: 'h4',
    question: 'Do you have the same hobbies as your family members?',
    answer: "no title not at all my parents love watching tv series especially English tv series like sherlock holmes and harry potter and sometimes they would choose games of thrones but I'm not a big fan of tv series so that's it",
  },
];

const underdevelopedHobbiesThreadFeedback = baseSpeakingFeedback({
  part: 1,
  sessionKind: 'part1_topic_thread',
  topic: 'Hobbies',
  threadId: 'hobbies-fixture',
  question: hobbiesThreadAnswers.map((item, index) => `Q${index + 1}. ${item.question}`).join('\n'),
  transcript: hobbiesThreadAnswers.map((item, index) => `Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer}`).join('\n\n'),
  threadAnswers: hobbiesThreadAnswers,
  bandEstimateExcludingPronunciation: 6.5,
  scores: {
    fluencyCoherence: 6.5,
    lexicalResource: 6.5,
    grammaticalRangeAccuracy: 6,
    pronunciation: null,
    pronunciationNote: 'Not formally assessed.',
  },
  estimateRationaleZh: 'This fixture intentionally shows a mostly grammar-only Part 1 thread repair.',
  threadFeedback: {
    topic: 'Hobbies',
    threadId: 'hobbies-fixture',
    questionCount: 4,
    mustFix: [],
    annotations: [
      makeAnnotation('h-q1-1', 'Q1', 'the classical and jazz music', 'article', 'classical and jazz music'),
      makeAnnotation('h-q2-1', 'Q2', 'I would like to say that', 'overformal_opener', '', 'better_spoken_choice'),
      makeAnnotation('h-q3-1', 'Q3', 'I am really addicted to it', 'word_choice', "I'm really passionate about it", 'better_spoken_choice'),
      makeAnnotation('h-q4-1', 'Q4', 'games of thrones', 'proper_title', 'Game of Thrones', 'better_spoken_choice'),
    ],
    cleanRetryAnswers: [
      {
        questionRef: 'Q1',
        answer: 'I like playing the piano, especially classical and jazz music.',
      },
      {
        questionRef: 'Q2',
        answer: 'Well, when I was a kid, I used to be a big fan of PC games like Pokemon.',
      },
      {
        questionRef: 'Q3',
        answer: "Yes, it's playing the piano. I'm really passionate about it, and even today, I still play for an hour a day.",
      },
      {
        questionRef: 'Q4',
        answer: "No, not at all. My parents love watching TV series, especially English ones like Sherlock Holmes and Harry Potter, and sometimes they watch Game of Thrones. But I'm not a big fan of TV series myself.",
      },
    ],
    answerByAnswerCoaching: [],
    highImpactPhraseFixes: [],
    materialBank: {
      myUsableMaterial: [],
      reusableSpokenLanguage: [{
        sourceWording: 'I like playing the piano',
        reusableVersion: 'I have a passion for [hobby]',
        reuseFor: ['hobbies'],
        explanationZh: 'Generic phrase-bank item.',
      }],
    },
    optionalPolish: [],
    nextRetryFocusZh: 'Answer more naturally.',
  },
});

const incompleteCleanRetryHobbiesThreadFeedback = baseSpeakingFeedback({
  part: 1,
  sessionKind: 'part1_topic_thread',
  topic: 'Hobbies',
  threadId: 'hobbies-clean-retry-recovery-fixture',
  question: hobbiesThreadAnswers.map((item, index) => `Q${index + 1}. ${item.question}`).join('\n'),
  transcript: hobbiesThreadAnswers.map((item, index) => `Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer}`).join('\n\n'),
  threadAnswers: hobbiesThreadAnswers,
  bandEstimateExcludingPronunciation: 6,
  scores: {
    fluencyCoherence: 6,
    lexicalResource: 6,
    grammaticalRangeAccuracy: 5.5,
    pronunciation: null,
    pronunciationNote: 'Not formally assessed.',
  },
  estimateRationaleZh: 'This fixture intentionally omits two clean retry answers to test recovery.',
  threadFeedback: {
    topic: 'Hobbies',
    threadId: 'hobbies-clean-retry-recovery-fixture',
    questionCount: 4,
    mustFix: [],
    annotations: [
      makeAnnotation('h-recovery-q1', 'Q1', 'the classical and jazz music', 'article', 'classical and jazz music'),
      makeAnnotation('h-recovery-q2', 'Q2', 'PC games like pokemon', 'semantic_category', 'video games, especially Pokemon'),
      makeAnnotation('h-recovery-q4', 'Q4', 'games of thrones', 'proper_title', 'Game of Thrones', 'better_spoken_choice'),
    ],
    cleanRetryAnswers: [
      {
        questionRef: 'Q1',
        answer: 'I like playing the piano, especially classical and jazz music.',
      },
      {
        questionRef: 'Q3',
        answer: "Yes, definitely, playing the piano. I still play for about an hour every day.",
      },
    ],
    answerByAnswerCoaching: [],
    highImpactPhraseFixes: [],
    materialBank: {
      myUsableMaterial: [],
      reusableSpokenLanguage: [],
    },
    optionalPolish: [],
    developmentTargets: [],
    nextRetryFocusZh: 'Keep the clean retry answers complete.',
  },
});

const lostWayTranscript = 'To be honest, thanks to digital navigation, I seldom lose my way since I had a smartphone. But I do have the experience when I was seven. backing to 7, when I travelled to shanghai with my parents, there was a big mall there. Everthing was new and attractive to me. So when my mom told me to stay at the point waiting for her from wc, I started wondering. That could be one of the most regrettable things I have ever done. I lost my way in such a big, unknow city. I almost freaked out and started crying. After 5 minutes I told myself to calm down and ask stranger for help. An aunty help me call the police and I finally return to my parent. That is such a terrible experience, even today just thinking about it gives me chills.';

const undercoveredLostWayFeedback = baseSpeakingFeedback({
  part: 2,
  question: 'Describe an occasion when you lost your way.',
  transcript: lostWayTranscript,
  bandEstimateExcludingPronunciation: 6,
  scores: {
    fluencyCoherence: 6,
    lexicalResource: 6,
    grammaticalRangeAccuracy: 5.5,
    pronunciation: null,
    pronunciationNote: 'Not formally assessed.',
  },
  estimateRationaleZh: 'This fixture intentionally marks only two easy local issues and misses the story skeleton.',
  upgradedAnswer: 'When I was seven, I got lost in a big mall while travelling with my parents. I wandered off, asked for help, and eventually got back to them.',
  part2Feedback: {
    materialType: 'experience_event',
    annotations: [
      makeAnnotation('lost-1', 'PART 2', 'backing to 7', 'word_form', 'back when I was seven'),
      makeAnnotation('lost-2', 'PART 2', 'I started wondering', 'word_choice', 'I started wandering off'),
    ],
    storyModules: [{
      role: 'what_happened',
      status: 'thin',
      sourceWording: 'I lost my way',
      improvedVersion: 'I got lost in a mall.',
      coachingZh: 'This needs a clearer story spine.',
    }],
    languageSignals: [
      makeSignal('idiomatic_expression', 'out of nowhere'),
      makeSignal('tense', 'I had never been there before'),
      makeSignal('connector', 'at that point'),
      makeSignal('phrasal_verb', 'wander off'),
      makeSignal('collocation', 'completely unfamiliar'),
      makeSignal('clause', 'What made it scary was that...'),
    ],
    priorityFocusZh: 'Fix two word choices.',
    nextSpeakableVersion: 'When I was seven, I got lost in a big mall while travelling with my parents. I wandered off, asked for help, and eventually got back to them.',
    nextSpeakableVersionHighlights: [],
  },
});

const familyAlbumTranscript = `an important old thing that my family has kept for a long time is the family album when I was a kid I really don't like taking photos I was afraid of camera and the flashlight but my parents insisted on taking photos for me especially every single special moment like my birthday,the day when I graduated from kindergarten and so on and nowadays after years passed I accidentally had this chance to open up the family album I finally realized that it is really meaningful for entire three-members small but warm family it was really touching when my parents and I watching photos which reminds us of the old days`;

const undercoveredFamilyAlbumFeedback = baseSpeakingFeedback({
  part: 2,
  question: 'Describe an important old thing that your family has kept for a long time.',
  transcript: familyAlbumTranscript,
  bandEstimateExcludingPronunciation: 5.5,
  scores: {
    fluencyCoherence: 5.5,
    lexicalResource: 5.5,
    grammaticalRangeAccuracy: 5,
    pronunciation: null,
    pronunciationNote: 'Not formally assessed.',
  },
  estimateRationaleZh: 'This fixture intentionally misses high-impact Part 2 semantic/span repairs.',
  upgradedAnswer: 'I would like to talk about a family photo album that my parents have kept for many years.',
  part2Feedback: {
    materialType: 'object',
    annotations: [
      makeAnnotation('album-1', 'PART 2', "when I was a kid I really don't like taking photos", 'tense', "When I was little, I really didn't like having my photo taken."),
      makeAnnotation('album-2', 'PART 2', 'camera', 'article', 'the camera'),
      makeAnnotation('album-3', 'PART 2', 'after years passed', 'transition', 'Years later'),
      makeAnnotation('album-4', 'PART 2', 'watching photos', 'collocation', 'looking at photos'),
      makeAnnotation('album-5', 'PART 2', 'which reminds', 'tense', 'which reminded'),
    ],
    storyModules: [{
      role: 'why_it_mattered',
      status: 'thin',
      sourceWording: 'meaningful',
      improvedVersion: 'It reminded us of old family memories.',
      coachingZh: 'The ending needs a clearer emotional value.',
    }],
    languageSignals: [
      makeSignal('idiomatic_expression', 'bring back memories'),
      makeSignal('tense', 'I used to dislike having my photo taken'),
      makeSignal('connector', 'Years later'),
      makeSignal('phrasal_verb', 'look through'),
      makeSignal('collocation', 'family memories'),
      makeSignal('clause', 'What touched me most was that...'),
    ],
    priorityFocusZh: 'The story has useful material, but several local language repairs are missing.',
    nextSpeakableVersion: 'I would like to talk about a family photo album that my parents have kept for many years.',
    nextSpeakableVersionHighlights: [],
  },
});

const booksReadingThreadAnswers: SpeakingThreadAnswer[] = [
  {
    questionId: 'b1',
    question: 'What are the types of books that young people like to read?',
    answer: "as far as I'm concerned nowadays young people tend to read some chinese traditional fictions like the journey to the west three kingdom history not only because they are the most classical and greatest fictions throughout the chinese history but also there are lots of tv series originate from them",
  },
  {
    questionId: 'b2',
    question: 'What should the government do to make libraries better?',
    answer: 'from my perspective there are two main ways to develop libraries conditions the first is hardware facility the quantities and the versions of collections of books always come first government should say the version of books and the introduce or purchase new books on time sequentially and the second is software facility for example the sanitation and the order in every library should be emphasized in order to create an accident environment for readers',
  },
  {
    questionId: 'b3',
    question: 'Do you think old people spend more time reading than young people?',
    answer: "in my opinion yes the main reason why older people spend more time reading than young people is elderly grew up in such a environment without electronic products like phone or computer or ipad one of the most common way to relax indoor is reading take my parents as example they spend most of the leisure time reading foreign fictions in their middle school which benefits them for entire whole life however nowadays young people are more accessible to the specific types of books thanks to the development of science so I wouldn't say electronic products extract young people's attention from books to PC games or something like that but I'd like to see them as a double-edged sword depends on how to use",
  },
];

const undercoveredBooksReadingFeedback = baseSpeakingFeedback({
  part: 3,
  sessionKind: 'part3_discussion_thread',
  topic: 'Books and reading',
  threadId: 'books-reading-fixture',
  question: booksReadingThreadAnswers.map((item, index) => `Q${index + 1}. ${item.question}`).join('\n'),
  transcript: booksReadingThreadAnswers.map((item, index) => `Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer}`).join('\n\n'),
  threadAnswers: booksReadingThreadAnswers,
  bandEstimateExcludingPronunciation: 5.5,
  scores: {
    fluencyCoherence: 5.5,
    lexicalResource: 5.5,
    grammaticalRangeAccuracy: 5,
    pronunciation: null,
    pronunciationNote: 'Not formally assessed.',
  },
  estimateRationaleZh: 'This fixture intentionally has answer-level scope but undercovered local semantic repairs.',
  fatalErrors: [
    { original: 'three kingdom history', correction: 'Romance of the Three Kingdoms', tag: 'title', explanationZh: 'Use the book title.' },
    { original: 'one of the most common way', correction: 'one of the most common ways', tag: 'grammar', explanationZh: 'Fix plural after one of.' },
    { original: "extract young people's attention", correction: 'distract young people from reading', tag: 'collocation', explanationZh: 'Use the natural verb.' },
  ],
  naturalnessHints: [],
  upgradedAnswer: 'Young people read classic novels, online fiction and self-help books. Libraries should update their collections and improve the reading environment. Older people often grew up with fewer digital distractions, while young people have access to more entertainment.',
  part3Feedback: {
    topic: 'Books and reading',
    threadId: 'books-reading-fixture',
    answers: booksReadingThreadAnswers.map((answer, index) => ({
      questionRef: `Q${index + 1}`,
      question: answer.question,
      answer: answer.answer,
      questionFrame: index === 0 ? 'category_criteria' : index === 1 ? 'solution_suggestion' : 'comparison_contrast',
      questionFrameLabelZh: 'Question frame',
      questionFrameGuidanceZh: index === 0 ? 'This is a types question.' : index === 1 ? 'This is a solution question.' : 'This is a comparison question.',
      ctChain: {},
      feedbackMode: index === 0 ? 'answer_scope' : 'language_repair',
      thinkingDiagnosis: {
        questionThinkingZh: index === 0 ? 'This category question needs 2-3 types.' : 'Repair the main sentence skeleton first.',
        upgradeRuleZh: 'Repair the main language pattern.',
        reusableFrame: index === 0
          ? 'People tend to choose a mix of A, B and C, depending on X.'
          : index === 1
            ? 'X could improve both A and B, for example by doing C.'
            : 'Older people may X because Y, while younger people often Z.',
      },
      targetAnswer: index === 0
        ? 'Young people read a mix of classic novels, online fiction and self-help books.'
        : index === 1
          ? 'The government should update library collections regularly and create a cleaner, quieter reading environment.'
          : 'Older people often grew up with fewer digital distractions, while young people have access to more forms of entertainment.',
      targetAnswerHighlights: [],
    })),
    topicLanguage: [],
    sessionPriorityZh: 'Fix answer scope and sentence skeleton.',
  },
});

const talentThreadAnswers: SpeakingThreadAnswer[] = [
  {
    questionId: 't1',
    question: 'Do you think artists with talents should focus on their talents?',
    answer: 'No. artists with talents should realize that they have talent and treasure it and keep from wasting it. if one put much more emphasis on talents they may ignore the significance of working hard. However, overly pay no attention to talents may lead to a regrettable ending',
  },
  {
    questionId: 't2',
    question: 'Is it possible for us to know whether children who are 3 or 4 years old will become musicians and painters when they grow up?',
    answer: 'It depends. It is quite easy to tell that weather the children have a talent in music or not. However, having a talent is not equal to becoming musicians or painters in the future. conditions of growing up do counts a lot. while there is no one could promise a kid without any visible talent in 3 or 4 years old would not become a specialist in the area.',
  },
  {
    questionId: 't3',
    question: 'Why do people like to watch talent shows?',
    answer: "From my perspective, the main reason why people like watching talent shows is talents and genius always are rare. it is hard to come by for ages in one's real life. While tv platform can gather a bunch of talents together at the same time and make them to do a competition. And the second reason is, people are curious about what talents can do. they probable know talents' rare, but may have no ideas about where talents' upper limits are. Under the specific requirements and pressure of talent shows, talents' potential can be tapped without limit.",
  },
];

const overfragmentedTalentFeedback = baseSpeakingFeedback({
  part: 3,
  sessionKind: 'part3_discussion_thread',
  topic: 'Natural talent',
  threadId: 'talent-fixture',
  question: talentThreadAnswers.map((item, index) => `Q${index + 1}. ${item.question}`).join('\n'),
  transcript: talentThreadAnswers.map((item, index) => `Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer}`).join('\n\n'),
  threadAnswers: talentThreadAnswers,
  bandEstimateExcludingPronunciation: 5.5,
  scores: {
    fluencyCoherence: 6,
    lexicalResource: 5.5,
    grammaticalRangeAccuracy: 5,
    pronunciation: null,
    pronunciationNote: 'Not formally assessed.',
  },
  estimateRationaleZh: 'This fixture intentionally fragments Part 3 into local wording fixes and misses answer-control priority.',
  fatalErrors: [
    { original: 'artists with talents', correction: 'talented artists', tag: 'word_choice', explanationZh: 'More natural wording.' },
    { original: 'keep from wasting it', correction: 'keep it from going to waste', tag: 'collocation', explanationZh: 'Use a complete spoken phrase.' },
    { original: 'if one put', correction: 'if they put', tag: 'grammar', explanationZh: 'Fix subject and verb.' },
    { original: 'overly pay no attention to talents', correction: 'paying no attention to their talent', tag: 'sentence_form', explanationZh: 'Fix sentence form.' },
    { original: 'weather the children have a talent', correction: 'whether children have talent', tag: 'word_form', explanationZh: 'Use whether.' },
    { original: 'do counts a lot', correction: 'do count a lot', tag: 'agreement', explanationZh: 'Fix verb agreement.' },
    { original: 'there is no one could promise', correction: 'no one can guarantee', tag: 'sentence_form', explanationZh: 'Fix clause control.' },
    { original: 'talents and genius always are rare', correction: 'genuine talent is rare', tag: 'word_choice', explanationZh: 'Use a natural phrase.' },
    { original: 'tv platform can gather', correction: 'talent shows can bring together', tag: 'collocation', explanationZh: 'Use a natural subject.' },
    { original: 'make them to do a competition', correction: 'let them compete', tag: 'verb_pattern', explanationZh: 'Fix verb pattern.' },
    { original: "where talents' upper limits are", correction: 'how far talented people can go', tag: 'spoken_clarity', explanationZh: 'Use a spoken version.' },
    { original: "talents' potential can be tapped without limit", correction: 'talented people can show their full potential', tag: 'spoken_clarity', explanationZh: 'Use natural spoken wording.' },
  ],
  naturalnessHints: [
    { original: 'treasure it', better: 'value their talent', tag: 'spoken_choice', explanationZh: 'Better spoken choice.' },
    { original: 'a regrettable ending', better: 'they may waste their potential', tag: 'spoken_choice', explanationZh: 'Say the consequence directly.' },
  ],
  upgradedAnswer: 'I think artists should value their talent, but they should not rely on it alone. Hard work and discipline help them develop it. Early talent is only a signal, not a guarantee. People enjoy talent shows because genuine talent is rare and viewers want to see how far contestants can go.',
  part3Feedback: {
    topic: 'Natural talent',
    threadId: 'talent-fixture',
    answers: talentThreadAnswers.map((answer, index) => ({
      questionRef: `Q${index + 1}`,
      question: answer.question,
      answer: answer.answer,
      questionFrame: index === 2 ? 'cause_reason' : 'evaluation_stance',
      questionFrameLabelZh: 'Question frame',
      questionFrameGuidanceZh: 'Repair local language.',
      ctChain: {},
      feedbackMode: 'language_repair',
      thinkingDiagnosis: {
        questionThinkingZh: 'Fix grammar and wording.',
        upgradeRuleZh: 'Improve word choice.',
      },
      microUpgrade: {
        focusZh: 'Language',
        upgradedLine: index === 0 ? 'talented artists should value their talent' : 'use more natural wording',
        whyItHelpsZh: 'It sounds better.',
      },
      targetAnswer: index === 0
        ? 'No. Talented artists should value their talent and work hard.'
        : index === 1
          ? 'It depends. Children can show early talent, but it is not equal to becoming musicians or painters.'
          : 'People like talent shows because talent is rare and shows gather talented individuals together.',
      targetAnswerHighlights: [],
    })),
    topicLanguage: [],
    sessionPriorityZh: 'Fix grammar.',
  },
});

const cases: JudgeCalibrationCase[] = [
  {
    id: 'speaking-part1-morning-undercovered',
    expectedTeacherVerdict: 'fail',
    packet: buildSpeakingFeedbackJudgePacket({
      id: 'speaking-part1-morning-undercovered',
      title: 'Part 1 single answer with sparse feedback',
      feedback: undercoveredMorningFeedback,
    }),
  },
  {
    id: 'speaking-part1-morning-covered',
    expectedTeacherVerdict: 'pass',
    packet: buildSpeakingFeedbackJudgePacket({
      id: 'speaking-part1-morning-covered',
      title: 'Part 1 single answer with layered feedback',
      feedback: comprehensiveMorningFeedback,
    }),
  },
  {
    id: 'speaking-part1-hobbies-thread-thin',
    expectedTeacherVerdict: 'fail',
    packet: buildSpeakingFeedbackJudgePacket({
      id: 'speaking-part1-hobbies-thread-thin',
      title: 'Part 1 hobbies thread with grammar-only cleaner answers',
      feedback: underdevelopedHobbiesThreadFeedback,
      threadAnswers: hobbiesThreadAnswers,
    }),
  },
  {
    id: 'speaking-part2-lost-way-undercovered',
    expectedTeacherVerdict: 'fail',
    packet: buildSpeakingFeedbackJudgePacket({
      id: 'speaking-part2-lost-way-undercovered',
      title: 'Part 2 lost-way story with only two local repairs',
      feedback: undercoveredLostWayFeedback,
    }),
  },
  {
    id: 'speaking-part2-family-album-span-undercovered',
    expectedTeacherVerdict: 'fail',
    packet: buildSpeakingFeedbackJudgePacket({
      id: 'speaking-part2-family-album-span-undercovered',
      title: 'Part 2 family album with missing semantic and full-span repairs',
      feedback: undercoveredFamilyAlbumFeedback,
    }),
  },
  {
    id: 'speaking-part3-books-reading-undercovered',
    expectedTeacherVerdict: 'fail',
    packet: buildSpeakingFeedbackJudgePacket({
      id: 'speaking-part3-books-reading-undercovered',
      title: 'Part 3 books and reading with missing semantic repairs',
      feedback: undercoveredBooksReadingFeedback,
      threadAnswers: booksReadingThreadAnswers,
    }),
  },
  {
    id: 'speaking-part3-talent-overfragmented',
    expectedTeacherVerdict: 'fail',
    packet: buildSpeakingFeedbackJudgePacket({
      id: 'speaking-part3-talent-overfragmented',
      title: 'Part 3 talent thread with fragmented local repairs',
      feedback: overfragmentedTalentFeedback,
      threadAnswers: talentThreadAnswers,
    }),
  },
];

const parseJsonObject = (value: string): ExternalJudgeResult => {
  const trimmed = value.trim();
  const parsed = JSON.parse(trimmed) as ExternalJudgeResult;
  if (typeof parsed.pass !== 'boolean') throw new Error('Judge JSON missing boolean pass.');
  if (typeof parsed.score !== 'number') throw new Error('Judge JSON missing numeric score.');
  return parsed;
};

const runOpenAiJudge = async (packet: FeedbackJudgePacket): Promise<ExternalJudgeResult> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.');
  const model = process.env.FEEDBACK_JUDGE_OPENAI_MODEL || 'gpt-4.1-mini';
  const body = {
    model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: packet.teacherJudgeInstructions },
      { role: 'user', content: JSON.stringify(packet, null, 2) },
    ],
  };
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`OpenAI judge request failed: ${response.status} ${await response.text()}`);
  }
  const payload = await response.json() as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI judge response did not include message content.');
  return parseJsonObject(content);
};

const maybeRunExternalJudge = async (packet: FeedbackJudgePacket): Promise<ExternalJudgeResult | null> => {
  const provider = (process.env.FEEDBACK_JUDGE_PROVIDER || '').trim().toLowerCase();
  if (!provider) return null;
  if (provider === 'openai') return runOpenAiJudge(packet);
  throw new Error(`Unsupported FEEDBACK_JUDGE_PROVIDER: ${provider}`);
};

const runPart1CleanRetryRecoveryRegression = async () => {
  const result = await safeAnalyzeSpeaking(
    {
      analyzeSpeaking: async () => incompleteCleanRetryHobbiesThreadFeedback,
    } as unknown as Parameters<typeof safeAnalyzeSpeaking>[0],
    'fixture',
    {
      part: 1,
      sessionKind: 'part1_topic_thread',
      topic: 'Hobbies',
      threadId: 'hobbies-clean-retry-recovery-fixture',
      question: hobbiesThreadAnswers.map((item, index) => `Q${index + 1}. ${item.question}`).join('\n'),
      transcript: hobbiesThreadAnswers.map((item, index) => `Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer}`).join('\n\n'),
      threadAnswers: hobbiesThreadAnswers,
    },
  );

  const cleanRetryAnswers = result.feedback.threadFeedback?.cleanRetryAnswers || [];
  assert.equal(
    result.diagnostic.failureKind,
    undefined,
    `missing clean retry answers should be recovered, not treated as schema failure: ${result.diagnostic.validationErrors.join(' | ')}`,
  );
  assert.equal(cleanRetryAnswers.length, hobbiesThreadAnswers.length, 'safe Part 1 normalization must return one clean retry answer per locked answer');
  assert.deepEqual(cleanRetryAnswers.map(item => item.questionRef), ['Q1', 'Q2', 'Q3', 'Q4']);
  assert.match(cleanRetryAnswers.find(item => item.questionRef === 'Q2')?.answer || '', /video games, especially Pokemon/i);
  assert.match(cleanRetryAnswers.find(item => item.questionRef === 'Q4')?.answer || '', /Game of Thrones/);
  assert.ok(
    result.diagnostic.normalizedFields?.includes('part1CleanRetryFilled:Q2,Q4'),
    'diagnostic should expose which clean retry answers were filled',
  );
};

const main = async () => {
  const reportCases = [];
  let failed = false;
  const externalProvider = (process.env.FEEDBACK_JUDGE_PROVIDER || '').trim().toLowerCase() || 'not_configured';

  await runPart1CleanRetryRecoveryRegression();

  for (const item of cases) {
    const hardSafety = runHardSafetyFeedbackJudge(item.packet);
    let externalJudge: ExternalJudgeResult | null = null;
    let externalJudgeError = '';
    try {
      externalJudge = await maybeRunExternalJudge(item.packet);
      if (externalJudge) {
        const actual = externalJudge.pass ? 'pass' : 'fail';
        assert.equal(
          actual,
          item.expectedTeacherVerdict,
          `${item.id} teacher judge expected ${item.expectedTeacherVerdict} but got ${actual}`,
        );
      }
    } catch (error) {
      externalJudgeError = error instanceof Error ? error.message : String(error);
      failed = true;
    }

    if (!hardSafety.pass) failed = true;
    reportCases.push({
      id: item.id,
      expectedTeacherVerdict: item.expectedTeacherVerdict,
      hardSafety,
      externalJudge,
      externalJudgeError,
      teacherJudgePrompt: buildTeacherJudgePrompt(item.packet),
      packet: item.packet,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    externalProvider,
    requireExternalJudge: process.env.FEEDBACK_JUDGE_REQUIRE_EXTERNAL === 'true',
    cases: reportCases,
  };

  if (report.requireExternalJudge && externalProvider === 'not_configured') {
    failed = true;
  }

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Feedback judge report written to ${outputPath}`);
  reportCases.forEach(item => {
    const mustCount = item.hardSafety.findings.filter(finding => finding.severity === 'must_fix').length;
    const shouldCount = item.hardSafety.findings.filter(finding => finding.severity === 'should_fix').length;
    const teacherNeededCount = item.hardSafety.findings.filter(finding => finding.severity === 'needs_teacher_judge').length;
    const external = item.externalJudge
      ? `teacher=${item.externalJudge.pass ? 'pass' : 'fail'} score=${item.externalJudge.score}`
      : item.externalJudgeError
        ? `teacher=error ${item.externalJudgeError}`
        : 'teacher=skipped';
    console.log(`${item.id}: hard=${item.hardSafety.pass ? 'pass' : 'fail'} must=${mustCount} should=${shouldCount} teacher_needed=${teacherNeededCount} ${external}`);
  });

  if (failed) process.exitCode = 1;
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
