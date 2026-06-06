import { safeAnalyzePart1LearningAssets, safeAnalyzeSpeaking } from '../src/lib/ai/safety.ts';
import { buildSpeakingTrainingMarkdown } from '../src/lib/markdownExport.ts';

const failures = [];
const passes = [];

const assert = (condition, label, detail = '') => {
  if (condition) {
    passes.push(label);
  } else {
    failures.push(detail ? `${label}: ${detail}` : label);
  }
};

const makeProvider = raw => ({
  async analyzeSpeaking() {
    return raw;
  },
});

const makeLearningProvider = raw => ({
  async generatePart1LearningAssets() {
    return raw;
  },
});

const threadAnswers = [
  {
    questionId: 'q1',
    question: 'Where do you usually go in your local area?',
    answer: 'I usually go to the streetS near Zhongshan Road because there are many storeS and I can play black MYTH WUKONG with friends after work.',
  },
  {
    questionId: 'q2',
    question: 'Why do you like this area?',
    answer: 'I like it because it is in central Xiamen and the mall Circle is crowded but convenient for employee like me.',
  },
  {
    questionId: 'q3',
    question: 'Do you like giving gifts?',
    answer: 'Yes, I once hand make a photo album for my girlfriend on our anniversary because she knew that I am a big fan of handmade things.',
  },
  {
    questionId: 'q4',
    question: 'How much do you usually spend on shoes?',
    answer: 'Usually I spend around 400 yuan on shoes, because I want them comfortable and durable.',
  },
];

const baseRaw = {
  mode: 'speaking',
  module: 'speaking',
  part: 1,
  sessionKind: 'part1_topic_thread',
  topic: 'Area and daily places',
  threadId: 'runtime_fixture_thread',
  question: 'Part 1 topic thread',
  transcript: threadAnswers.map(item => item.answer).join('\n'),
  bandEstimateExcludingPronunciation: 6,
  bandEstimateRange: { lower: 6, upper: 6.5, rationaleZh: '语言基本可理解，但需要修正局部表达并积累素材。' },
  estimateRationaleZh: '语言基本可理解，但需要修正局部表达并积累素材。',
  scores: {
    fluencyCoherence: 6,
    lexicalResource: 6,
    grammaticalRangeAccuracy: 6,
    pronunciation: null,
    pronunciationNote: 'Pronunciation is not formally assessed.',
  },
  fatalErrors: [],
  naturalnessHints: [],
  band9Refinements: [],
  preservedStyle: [],
  upgradedAnswer: '',
  reusableExample: null,
  nextStepZh: '请修正重点表达，并保留可复用素材。',
  threadAnswers,
  threadFeedback: {
    topic: 'Area and daily places',
    threadId: 'runtime_fixture_thread',
    questionCount: threadAnswers.length,
    mustFix: [
      {
        questionRefs: ['Q1'],
        learnerWording: 'streetS',
        betterVersion: 'streets',
        explanationZh: 'This is only capitalization / transcription casing noise.',
      },
      {
        questionRefs: ['Q1'],
        learnerWording: 'storeS',
        betterVersion: 'stores',
        explanationZh: 'This is only mixed uppercase ASR formatting noise.',
      },
      {
        questionRefs: ['Q1'],
        learnerWording: 'black MYTH WUKONG',
        betterVersion: 'Black Myth: Wukong',
        explanationZh: 'This is capitalization and punctuation only.',
      },
      {
        questionRefs: ['Q3'],
        learnerWording: 'hand make a photo album',
        betterVersion: 'make a photo album by hand',
        explanationZh: 'Use a natural verb phrase for handmade gifts.',
      },
      {
        questionRefs: ['Q2'],
        learnerWording: 'employee like me',
        betterVersion: 'as an office worker',
        explanationZh: 'Use a more natural spoken role phrase.',
      },
      {
        questionRefs: ['Q2'],
        learnerWording: 'mall Circle',
        betterVersion: 'shopping district',
        explanationZh: 'Use a clearer phrase for a commercial area.',
      },
      {
        questionRefs: ['Q3'],
        learnerWording: 'she knew that I am a big fan',
        betterVersion: 'she knew that I was a big fan',
        explanationZh: 'Reported speech tense backshift.',
      },
      {
        questionRefs: ['Q4'],
        learnerWording: 'consider as',
        betterVersion: 'consider is',
        explanationZh: 'Invalid repair fixture.',
      },
    ],
    annotations: [
      {
        id: 'broad_q2',
        questionRef: 'Q2',
        sourceQuote: threadAnswers[1].answer,
        layers: [
          {
            severity: 'better_spoken_choice',
            issueType: 'word_choice',
            original: 'employee like me',
            better: 'as an office worker',
            explanationZh: 'This is a more natural spoken role phrase.',
          },
        ],
      },
      {
        id: 'bad_repair_q4',
        questionRef: 'Q4',
        sourceQuote: 'consider as',
        layers: [
          {
            severity: 'must_fix',
            issueType: 'collocation',
            original: 'consider as',
            better: 'consider is',
            explanationZh: 'Invalid repair fixture.',
          },
        ],
      },
      {
        id: 'redundant_place_q2',
        questionRef: 'Q2',
        sourceQuote: 'places where I enjoy eating there',
        layers: [
          {
            severity: 'must_fix',
            issueType: 'structure',
            original: 'places where I enjoy eating there',
            better: 'places where I enjoy eating',
            explanationZh: 'Remove the redundant there.',
          },
        ],
      },
      {
        id: 'handmade_q3',
        questionRef: 'Q3',
        sourceQuote: 'hand make a photo album',
        layers: [
          {
            severity: 'must_fix',
            issueType: 'collocation',
            original: 'hand make a photo album',
            better: 'make a photo album by hand',
            explanationZh: 'Use a natural verb phrase for handmade gifts.',
          },
        ],
      },
    ],
    cleanRetryAnswers: threadAnswers.map((item, index) => ({
      questionRef: `Q${index + 1}`,
      answer: item.answer,
    })),
    cleanRetryCertificationStatus: 'certified_after_rewrite',
    developmentStatus: 'needed',
    developmentTargets: [
      {
        questionRef: 'Q1',
        reasonZh: '地点原因可保留。',
        developmentMoveZh: '用商圈/活动词块',
        phraseChunks: [
          { purposeZh: '商圈', text: 'the shopping district near Zhongshan Road' },
          { purposeZh: '下班放松', text: 'unwind with friends after work' },
          { purposeZh: '具体活动', text: 'play PC games with friends' },
          { purposeZh: '地点价值', text: 'a convenient place to hang out' },
        ],
      },
      {
        questionRef: 'Q2',
        reasonZh: '商圈和通勤意思明确。',
        developmentMoveZh: '换成通勤词块',
        phraseChunks: [
          { purposeZh: '职业身份', text: 'as someone who commutes every day' },
          { purposeZh: '商圈', text: 'a busy shopping district' },
          { purposeZh: '通勤不便', text: 'less convenient for commuting' },
          { purposeZh: '中心区域', text: 'a central urban area' },
        ],
      },
      {
        questionRef: 'Q3',
        reasonZh: '礼物素材具体。',
        developmentMoveZh: '换成纪念感词块',
        phraseChunks: [
          { purposeZh: '纪念意义', text: 'a thoughtful anniversary gift' },
          { purposeZh: '手作', text: 'make a photo album by hand' },
          { purposeZh: '投入感', text: 'put time and effort into it' },
          { purposeZh: '情感价值', text: 'sentimental value' },
        ],
      },
      {
        questionRef: 'Q4',
        reasonZh: '价格理由清楚。',
        developmentMoveZh: '用耐穿词块',
        phraseChunks: [
          { purposeZh: '舒适度', text: 'comfortable to wear' },
          { purposeZh: '耐穿', text: 'durable enough for daily use' },
          { purposeZh: '性价比', text: 'good value for money' },
          { purposeZh: '日常使用', text: 'hold up well over time' },
        ],
      },
    ],
    threadLevelPatterns: [
      {
        observationZh: '部分回答已经有真实原因和地点细节。',
        whyItMattersZh: 'Part 1 不需要无限扩展。',
        retryRule: '直接回答后保留一个真实理由即可。',
      },
    ],
    answerByAnswerCoaching: [],
    highImpactPhraseFixes: [
      {
        questionRefs: ['Q1'],
        original: 'go to the streetS near Zhongshan Road',
        better: 'go to the shopping district near Zhongshan Road',
        explanationZh: 'Use a natural place phrase.',
      },
      {
        questionRefs: ['Q2'],
        original: 'employee like me',
        better: 'as someone who commutes every day',
        explanationZh: 'Use a more precise spoken role phrase.',
      },
    ],
    materialBank: {
      myUsableMaterial: [
        {
          sourceWording: 'I once hand make a photo album for my girlfriend on our anniversary',
          reusableVersion: 'I once made a handmade photo album for my girlfriend on our anniversary.',
          reuseFor: ['Part 1 gifts and handmade things'],
          explanationZh: '这是一份亲手制作、带有纪念意义的周年礼物。',
          materialCore: 'handmade photo album for girlfriend on anniversary',
          materialKind: 'reusable_personal_material',
          part1UseCases: ['gifts', 'handmade things'],
          developmentMoveZh: '可以进一步说明为什么有意义。',
          developedExample: 'I once made a handmade photo album for my girlfriend on our anniversary.',
          expressionFrames: ['a handmade photo album', 'for our anniversary', 'put time and effort into it'],
          materialKey: 'gift_album',
        },
        {
          sourceWording: 'I was born and raised in Xiamen and my family and friends are here',
          reusableVersion: 'I was born and raised in Xiamen, and most of my family and friends are here.',
          reuseFor: ['Part 1 hometown and living questions'],
          explanationZh: '这句话保留了出生地和亲友都在本地的个人信息。',
          materialCore: 'Xiamen born and raised family and friends',
          materialKind: 'development_seed',
          part1UseCases: ['hometown', 'living'],
          developmentMoveZh: '补一个归属感或个人连接。',
          expressionFrames: ['born and raised in Xiamen', 'family and friends are here', 'a strong sense of belonging'],
          materialKey: 'xiamen_belonging',
        },
        {
          sourceWording: 'I can play black MYTH WUKONG with friends after work',
          reusableVersion: 'I go there to play PC games like Black Myth: Wukong with friends after work.',
          reuseFor: ['Part 1 local area, hobbies, and free-time questions'],
          explanationZh: '我下班后会和朋友一起玩《黑神话：悟空》这样的 PC 游戏。',
          materialCore: 'PC games Black Myth Wukong after work',
          materialKind: 'reusable_personal_material',
          part1UseCases: ['local area', 'free time'],
          developmentMoveZh: '说明这是你去那个地方的真实原因。',
          expressionFrames: ['play PC games after work', 'games like Black Myth: Wukong'],
          materialKey: 'black_myth_area',
        },
        {
          sourceWording: 'I lived in Xiamen for most of my life except for six years in Beijing',
          reusableVersion: 'I have lived in Xiamen for most of my life, except for the six years I spent in Beijing.',
          reuseFor: ['Part 1 hometown and living questions'],
          explanationZh: '我大部分时间都住在厦门，只有六年是在北京度过的。',
          materialCore: 'Xiamen long-term living with Beijing exception',
          materialKind: 'reusable_personal_material',
          part1UseCases: ['hometown', 'living'],
          materialKey: 'xiamen_beijing_living',
        },
        {
          sourceWording: 'yes absolutely I live in one of the most central area of Xiamen the inter-island area there is a big mall circle just across two blocks from where I live and it is really near to Zhongshan Road where tourists prefer to visit',
          reusableVersion: 'yes absolutely I live in one of the most central area of Xiamen the inter-island area there is a big mall circle just across two blocks from where I live and it is really near to Zhongshan Road where tourists prefer to visit',
          reuseFor: ['raw material should not display'],
          explanationZh: '',
          materialCore: 'raw crowded places answer',
          materialKind: 'reusable_personal_material',
          materialKey: 'raw_crowded_places_answer',
        },
        {
          sourceWording: 'definitely no I prefer quiet and relaxed places to crowded places because the crowded places often suffer from heavy transportation which leads to traffic jam it is not that much convenient for employee like me to commute',
          reusableVersion: 'definitely no I prefer quiet and relaxed places to crowded places because the crowded places often suffer from heavy transportation which leads to traffic jam it is not that much convenient for employee like me to commute',
          reuseFor: ['raw material should not display'],
          explanationZh: '',
          materialCore: 'raw preference answer',
          materialKind: 'reusable_personal_material',
          materialKey: 'raw_crowded_places_preference',
        },
        {
          sourceWording: 'commuting during rush hour is stressful',
          reusableVersion: 'As an employee, I find commuting during rush hour very stressful because of the heavy traffic.',
          reuseFor: ['imprecise role wording should not display'],
          explanationZh: '考生强调自己作为上班族通勤不便。',
          materialCore: 'stressful commute',
          materialKind: 'reusable_personal_material',
          developedExample: 'As an employee, I find commuting during rush hour very stressful because of the heavy traffic.',
          materialKey: 'imprecise_employee_material',
        },
      ],
      reusableSpokenLanguage: [
        {
          sourceWording: 'employee like me',
          reusableVersion: 'as an office worker',
          reuseFor: ['Part 1 work, commute, and daily routine questions'],
          explanationZh: 'A natural role phrase.',
        },
        {
          sourceWording: 'mall Circle',
          reusableVersion: 'a shopping district',
          reuseFor: ['Part 1 places and crowded area questions'],
          explanationZh: 'A clearer place phrase.',
        },
        {
          sourceWording: 'crowded but convenient for employee like me',
          reusableVersion: 'less convenient for commuting',
          reuseFor: ['Part 1 crowded places and daily routine questions'],
          explanationZh: 'A transferable commute phrase.',
        },
        {
          sourceWording: 'there are many storeS',
          reusableVersion: 'a commercial area',
          reuseFor: ['Part 1 local area and shopping questions'],
          explanationZh: 'A precise place-category phrase.',
        },
        {
          sourceWording: 'I once hand make a photo album',
          reusableVersion: 'put time and effort into it',
          reuseFor: ['Part 1 gifts and meaningful objects'],
          explanationZh: 'A reusable reason phrase.',
        },
        {
          sourceWording: 'mall Circle is crowded',
          reusableVersion: 'traffic congestion',
          reuseFor: ['Part 1 crowded places and transport'],
          explanationZh: 'A concise topic collocation.',
        },
        {
          sourceWording: 'crowded central area',
          reusableVersion: 'heavy traffic during rush hour',
          reuseFor: ['Part 1 crowded places and transport'],
          explanationZh: 'Current-topic expression.',
        },
        {
          sourceWording: 'tourists near Zhongshan Road',
          reusableVersion: 'crowds of visitors all year round',
          reuseFor: ['Part 1 crowded places and tourist areas'],
          explanationZh: 'Current-topic expression.',
        },
        {
          sourceWording: 'central Xiamen',
          reusableVersion: 'a dense urban area',
          reuseFor: ['Part 1 crowded places and city centers'],
          explanationZh: 'Current-topic expression.',
        },
        {
          sourceWording: 'many stores',
          reusableVersion: 'a busy commercial district',
          reuseFor: ['Part 1 crowded places and shopping areas'],
          explanationZh: 'Current-topic expression.',
        },
        {
          sourceWording: 'near where I live',
          reusableVersion: 'within walking distance',
          reuseFor: ['Part 1 local areas and nearby places'],
          explanationZh: 'Current-topic expression.',
        },
        {
          sourceWording: 'shops and mall',
          reusableVersion: 'a large shopping complex',
          reuseFor: ['Part 1 crowded places and shopping areas'],
          explanationZh: 'Current-topic expression.',
        },
        {
          sourceWording: 'commute',
          reusableVersion: 'less convenient for daily commuting',
          reuseFor: ['Part 1 crowded places and commuting'],
          explanationZh: 'Current-topic expression.',
        },
        {
          sourceWording: 'tourist area',
          reusableVersion: 'tourist flow at peak times',
          reuseFor: ['Part 1 crowded places and tourist areas'],
          explanationZh: 'Current-topic expression.',
        },
        {
          sourceWording: 'because',
          reusableVersion: 'because',
          reuseFor: ['generic connector'],
          explanationZh: 'Low-value control item.',
        },
        ...[
          'find a peaceful spot',
          'a popular tourist destination',
          'commute during rush hour',
          'heavy traffic congestion',
          'overwhelming numbers of people visiting',
          'for college / for university',
          'do a good job',
          'play as a team',
          'encourage someone',
          'win a scholarship',
          'won a scholarship at university',
          'which I had never done before',
          'It required.',
          'because I.',
          'For example, after.',
          'said good vocabulary',
          'a great way',
        ].map(item => ({
          sourceWording: item,
          reusableVersion: item,
          reuseFor: ['low-value expression controls'],
          explanationZh: 'Low-value expression control item.',
        })),
      ],
    },
    optionalPolish: [
      {
        questionRefs: ['Q4'],
        original: 'comfortable',
        better: 'comfortable to wear',
        explanationZh: 'Optional phrase completion.',
      },
    ],
    nextRetryFocusZh: '请练习修正后的表达。',
  },
};

const run = async () => {
  const { feedback, diagnostic } = await safeAnalyzeSpeaking(makeProvider(baseRaw), 'fixture', {
    part: 1,
    question: 'Part 1 topic thread',
    transcript: baseRaw.transcript,
    sessionKind: 'part1_topic_thread',
    topic: baseRaw.topic,
    threadId: baseRaw.threadId,
    threadAnswers,
  });

  const displayModule = await import('../src/lib/part1LearningDisplayModel.ts').catch(error => ({ error }));
  assert(!displayModule.error, 'shared display model exists', displayModule.error?.message || '');
  const display = displayModule.buildPart1LearningDisplayModel
    ? displayModule.buildPart1LearningDisplayModel(feedback.threadFeedback, { answers: threadAnswers })
    : null;
  const markdown = buildSpeakingTrainingMarkdown(feedback);
  const allAnnotationText = JSON.stringify(feedback.threadFeedback?.annotations || []);
  const materialText = JSON.stringify(display?.userMaterials || feedback.threadFeedback?.materialBank.myUsableMaterial || []);
  const expressionText = JSON.stringify(display?.expressionBank || feedback.threadFeedback?.materialBank.reusableSpokenLanguage || []);
  const actionText = JSON.stringify(display?.answerActions || []);
  const normalizedSamples = displayModule.normalizePart1LearnerText
    ? [
      '可以补充一个真实细节。。',
      ' 可以说：as an office worker 。 ',
      '鍙互杩涗竴姝ヨ鏄?..',
      'Try "as an office worker," then stop.',
  ].map(item => displayModule.normalizePart1LearnerText(item))
    : [];
  const teachingMarkdown = markdown.replace(/^> Original answer:.*$/gm, '');
  const invalidSurfaceText = allAnnotationText + expressionText + teachingMarkdown;
  const invalidLeak = invalidSurfaceText.match(/consider is|places where I enjoy eating there/i)?.[0] || '';
  const lowValueExpressionLeak = expressionText.match(/find a peaceful spot|a popular tourist destination|commute during rush hour|heavy traffic congestion|overwhelming numbers of people visiting|for college\s*\/\s*for university|a concrete personal reason|a clearer personal feeling|a simple but useful contrast|one memorable supporting detail|do a good job|play as a team|encourage someone|win a scholarship|won a scholarship at university|which I had never done before|It required|because I|For example, after|said good vocabulary|a great way|the best way to encourage someone|and my teacher thought|just two blocks away|a big mall called Circle/i)?.[0] || '';
  const materialExpressionDuplicate = expressionText.match(/I once made a handmade photo album|I go there to play PC games|My hometown is Xiamen/i)?.[0] || '';
  const invalidLeakDetail = invalidLeak
    ? invalidSurfaceText.slice(Math.max(0, invalidSurfaceText.toLowerCase().indexOf(invalidLeak.toLowerCase()) - 80), invalidSurfaceText.toLowerCase().indexOf(invalidLeak.toLowerCase()) + invalidLeak.length + 120)
    : '';

  assert(!/streetS|storeS|black MYTH WUKONG|capitalization|uppercase|mixed uppercase|ASR formatting/i.test(allAnnotationText), 'transcript artifacts suppressed');
  assert(!invalidLeak, 'invalid repairs rejected before UI/export', invalidLeakDetail);
  assert(!lowValueExpressionLeak, 'low-value expression-bank items rejected', lowValueExpressionLeak);
  assert(!materialExpressionDuplicate, 'material paragraphs do not leak into expression bank', materialExpressionDuplicate);
  assert(!/"severity":"must_fix"[^}]*she knew that I am a big fan/i.test(allAnnotationText), 'state-dependent present is not mandatory');
  assert(!/knew that I am a big fan[^}]*knew that I was a big fan/i.test(allAnnotationText), 'state-dependent present is not shown as a local error');
  assert(display && threadAnswers.every((_, index) => actionText.includes(`Q${index + 1}`)), 'every meaningful answer receives an action');
  assert(display && threadAnswers.every((_, index) =>
    (display.answerCoaching || []).some(item => item.questionRef === `Q${index + 1}` && (item.phraseChunks || []).length > 0),
  ), 'every Part 1 answer receives visible development chunks');
  const developmentChunkText = (display?.answerCoaching || [])
    .flatMap(item => item.phraseChunks || [])
    .map(chunk => chunk.text)
    .join(' | ');
  const developmentPurposeText = (display?.answerCoaching || [])
    .flatMap(item => item.phraseChunks || [])
    .map(chunk => chunk.purposeZh || '')
    .join(' | ');
  assert(!`${developmentChunkText} ${expressionText} ${materialText}`.match(/hand make\b/i), 'learner error wording stays out of reusable learning assets');
  assert(!/as an office worker|make a photo album by hand|shopping district near Zhongshan Road/i.test(developmentChunkText), 'development chips do not repeat correction content', developmentChunkText);
  assert(!/correct|correction|fix|repair|replace|grammar|plural|singular|article|preposition|tense|mistake|error/i.test(developmentPurposeText), 'development chip labels do not describe corrections');
  assert(!JSON.stringify(display?.answerCoaching || []).includes('再补一个具体地点、朋友、设备或场景'), 'developed place answer does not force more content');
  assert(/handmade photo album|anniversary/i.test(materialText) && /Black Myth: Wukong|PC games/i.test(materialText), 'material seeds converted to visible packages');
  assert(!/big mall circle|not that much convenient|As an employee/i.test(materialText), 'raw or imprecise material packages are hidden');
  assert(/这是一份亲手制作、带有纪念意义的周年礼物|下班后与朋友玩游戏/i.test(materialText + markdown), 'material packages include Chinese sentence');
  assert(!/可以进一步|补一个|add more detail|further explain/i.test(materialText + markdown), 'material bank does not render raw coaching');
  assert(!/修正了|修正语法错误|并使表达更自然/i.test(markdown), 'clean retry notes stay hidden from learner-facing export');
  assert((display?.expressionBank || []).length >= 10, 'expression bank remains rich');
  assert(/as an office worker|working adult|someone who commutes/i.test(expressionText + markdown), 'lexical appropriacy alternatives preserved');
  assert(/shopping district|commercial area|shopping complex|large mall complex/i.test(expressionText + markdown), 'place meaning reconstruction preserved');
  assert(/heavy traffic during rush hour|crowds of visitors all year round|a busy commercial district|within walking distance/i.test(expressionText + actionText), 'topic-adjacent area expressions supplied');
  const richFirstPersonDisplay = displayModule.buildPart1LearningDisplayModel({
    topic: 'Preferences and habits',
    threadId: 'rich_first_person_frames',
    questionCount: 1,
    mustFix: [],
    annotations: [],
    cleanRetryAnswers: [],
    developmentStatus: 'needed',
    developmentTargets: [],
    threadLevelPatterns: [],
    answerByAnswerCoaching: [],
    highImpactPhraseFixes: [],
    materialBank: {
      myUsableMaterial: [],
      reusableSpokenLanguage: [
        'My shopping habits have changed over time.',
        'Comfort matters more to me than style.',
        'I tend to choose quality over design.',
        'It fits naturally into my daily routine.',
        'My budget affects what I choose.',
        'The quality lasts longer.',
        "I'm really into [doing something].",
        "It's become a lifelong pursuit.",
        'It brings me immense joy and satisfaction.',
        "It's not really my cup of tea.",
        "It's my main pastime.",
        'bond over a shared activity',
      ].map(item => ({
        sourceWording: '',
        reusableVersion: item,
        reuseFor: ['Part 1 preference or habit answer'],
        explanationZh: 'High-value spoken frame.',
      })),
    },
    optionalPolish: [],
    nextRetryFocusZh: '',
  }, {
    answers: [{ questionId: 'r1', question: 'What do you prefer?', answer: 'I like quiet places.' }],
  });
  const richFirstPersonText = JSON.stringify(richFirstPersonDisplay.expressionBank || []);
  assert(/shopping habits have changed|comfort matters|quality over design|daily routine|budget affects|quality lasts/i.test(richFirstPersonText), 'structured provider-supplied spoken frames survive expression filtering');
  assert(/be into sth/i.test(richFirstPersonText) && !/I'm really into \[doing something\]/i.test(richFirstPersonText), 'first-person expression examples normalize to reusable frames');
  assert(/a lifelong pursuit|bring sb immense joy and satisfaction|not be one's cup of tea|one's main pastime|bond over a shared activity/i.test(richFirstPersonText), 'sentence-like expression examples compact into phrase frames');
  assert(!/It brings me|It's not really|It's my main|It's become/i.test(richFirstPersonText), 'expression bank avoids full sentence display when a frame is available');
  const leadInMaterialDisplay = displayModule.buildPart1LearningDisplayModel({
    topic: 'Crowded places',
    threadId: 'lead_in_material',
    questionCount: 2,
    mustFix: [],
    annotations: [],
    cleanRetryAnswers: [
      { questionRef: 'Q1', answer: 'I prefer quiet parks because they help me relax.' },
      { questionRef: 'Q2', answer: 'My city is quite crowded because tourists visit all year round.' },
    ],
    developmentStatus: 'needed',
    developmentTargets: [],
    threadLevelPatterns: [],
    answerByAnswerCoaching: [],
    highImpactPhraseFixes: [],
    materialBank: {
      myUsableMaterial: [
        {
          sourceWording: 'I prefer quiet parks',
          reusableVersion: 'Definitely not. I prefer quiet parks because they help me relax after work.',
          reuseFor: ['Part 1 preference answers'],
          explanationZh: '我更喜欢安静的公园，因为它们能帮助我下班后放松。',
          materialCore: 'prefer quiet parks',
          materialKind: 'reusable_personal_material',
          part1UseCases: ['preference'],
          developedExample: 'Definitely not. I prefer quiet parks because they help me relax after work.',
          materialKey: 'quiet_parks_preference',
        },
        {
          sourceWording: 'my city is quite crowded',
          reusableVersion: 'Absolutely, my city tends to feel crowded because tourists visit throughout the year.',
          reuseFor: ['Part 1 city answers'],
          explanationZh: '我的城市很拥挤，因为全年都有游客来。',
          materialCore: 'city crowded because of tourists',
          materialKind: 'reusable_personal_material',
          part1UseCases: ['city'],
          developedExample: 'Absolutely, my city tends to feel crowded because tourists visit throughout the year.',
          materialKey: 'crowded_city_tourists',
        },
        {
          sourceWording: 'My family and close friends are all here',
          reusableVersion: 'definitely. My family and close friends are all here, which gives me a strong sense of belonging.',
          reuseFor: ['Part 1 hometown answers'],
          explanationZh: '家人和亲近的朋友都在这里，这让我很有归属感。',
          materialCore: 'family and close friends here',
          materialKind: 'reusable_personal_material',
          part1UseCases: ['hometown'],
          developedExample: 'definitely. My family and close friends are all here, which gives me a strong sense of belonging.',
          materialKey: 'family_friends_belonging',
        },
      ],
      reusableSpokenLanguage: [],
    },
    optionalPolish: [],
    nextRetryFocusZh: '',
  }, {
    answers: [
      { questionId: 'm1', question: 'Do you like crowded places?', answer: 'I prefer quiet parks because they help me relax.' },
      { questionId: 'm2', question: 'Is your city crowded?', answer: 'My city is quite crowded because tourists visit all year round.' },
    ],
  });
  const leadInMaterialText = JSON.stringify(leadInMaterialDisplay.userMaterials || []);
  assert(/I prefer quiet parks/i.test(leadInMaterialText) && /my city is quite crowded/i.test(leadInMaterialText), 'material keeps substantive stance after stripping response lead-ins');
  assert(/My family and close friends are all here/i.test(leadInMaterialText), 'material keeps hometown stance after stripping one-word lead-ins');
  assert(!/Definitely not|Absolutely,|definitely\./i.test(leadInMaterialText), 'material display strips disposable response lead-ins generically');
  const emptyProviderCrowdedDisplay = displayModule.buildPart1LearningDisplayModel({
    topic: 'Crowded places',
    threadId: 'crowded_no_provider_seed',
    questionCount: 1,
    mustFix: [],
    annotations: [],
    cleanRetryAnswers: [{ questionRef: 'Q1', answer: 'Yes, it is crowded because many tourists visit the city center.' }],
    developmentStatus: 'needed',
    developmentTargets: [],
    threadLevelPatterns: [],
    answerByAnswerCoaching: [],
    highImpactPhraseFixes: [],
    materialBank: { myUsableMaterial: [], reusableSpokenLanguage: [] },
    optionalPolish: [],
    nextRetryFocusZh: '',
  }, {
    answers: [{
      questionId: 'c1',
      question: 'Is the city where you live crowded?',
      answer: 'Yes, it is crowded because many tourists visit the city center.',
    }],
  });
  const emptyProviderCrowdedExpressionText = JSON.stringify(emptyProviderCrowdedDisplay.expressionBank || []);
  const emptyProviderCrowdedQuality = displayModule.evaluatePart1LearningPayloadQuality(emptyProviderCrowdedDisplay ? {
    topic: 'Crowded places',
    threadId: 'crowded_no_provider_seed',
    questionCount: 1,
    mustFix: [],
    annotations: [],
    cleanRetryAnswers: [{ questionRef: 'Q1', answer: 'Yes, it is crowded because many tourists visit the city center.' }],
    developmentStatus: 'needed',
    developmentTargets: [],
    threadLevelPatterns: [],
    answerByAnswerCoaching: [],
    highImpactPhraseFixes: [],
    materialBank: { myUsableMaterial: [], reusableSpokenLanguage: [] },
    optionalPolish: [],
    nextRetryFocusZh: '',
  } : undefined, [{
    questionId: 'c1',
    question: 'Is the city where you live crowded?',
    answer: 'Yes, it is crowded because many tourists visit the city center.',
  }]);
  assert((emptyProviderCrowdedDisplay.expressionBank || []).length === 0, 'display model does not invent expression bank items when provider returns none');
  assert(!emptyProviderCrowdedQuality.ok && /missing developmentTargets|reusableSpokenLanguage has 0/i.test(emptyProviderCrowdedQuality.summary), 'quality gate rejects empty provider learning payload');
  assert(!/thoughtful anniversary gift|laid-back coastal city|strong sense of belonging|gift from the heart/i.test(emptyProviderCrowdedExpressionText), 'empty-provider crowded result has no cross-topic local backfill');
  const partialCrowdedDisplay = displayModule.buildPart1LearningDisplayModel({
    topic: 'Crowded places',
    threadId: 'crowded_partial_provider_seed',
    questionCount: 3,
    mustFix: [],
    annotations: [],
    cleanRetryAnswers: [
      { questionRef: 'Q1', answer: 'Yes, it is crowded because the city attracts a lot of tourists.' },
      { questionRef: 'Q2', answer: 'There is a busy shopping district near where I live.' },
      { questionRef: 'Q3', answer: 'I prefer quieter places because heavy traffic makes commuting stressful.' },
    ],
    developmentStatus: 'needed',
    developmentTargets: [
      {
        questionRef: 'Q3',
        reasonZh: 'The preference is clear.',
        developmentMoveZh: 'Use commute/crowd chunks.',
        phraseChunks: [
          { purposeZh: '交通', text: 'rush-hour congestion' },
          { purposeZh: '避开人群', text: 'avoid the hustle and bustle' },
        ],
      },
    ],
    threadLevelPatterns: [],
    answerByAnswerCoaching: [],
    highImpactPhraseFixes: [],
    materialBank: {
      myUsableMaterial: [],
      reusableSpokenLanguage: [
        'overcrowded public transport',
        'traffic congestion',
        'packed with tourists',
        'avoid the rush hour',
      ].map(item => ({
        sourceWording: '',
        reusableVersion: item,
        reuseFor: ['Part 1 crowded places'],
        explanationZh: 'Current-topic expression.',
      })),
    },
    optionalPolish: [],
    nextRetryFocusZh: '',
  }, {
    answers: [
      { questionId: 'pc1', question: 'Is the city where you live crowded?', answer: 'Yes, it is crowded because the city attracts a lot of tourists.' },
      { questionId: 'pc2', question: 'Is there a crowded place near where you live?', answer: 'There is a busy shopping district near where I live.' },
      { questionId: 'pc3', question: 'Do you like crowded places?', answer: 'I prefer quieter places because heavy traffic makes commuting stressful.' },
    ],
  });
  const partialCrowdedExpressions = JSON.stringify(partialCrowdedDisplay.expressionBank || []);
  const partialCrowdedQuality = displayModule.evaluatePart1LearningPayloadQuality({
    topic: 'Crowded places',
    threadId: 'crowded_partial_provider_seed',
    questionCount: 3,
    mustFix: [],
    annotations: [],
    cleanRetryAnswers: [
      { questionRef: 'Q1', answer: 'Yes, it is crowded because the city attracts a lot of tourists.' },
      { questionRef: 'Q2', answer: 'There is a busy shopping district near where I live.' },
      { questionRef: 'Q3', answer: 'I prefer quieter places because heavy traffic makes commuting stressful.' },
    ],
    developmentStatus: 'needed',
    developmentTargets: [
      {
        questionRef: 'Q3',
        reasonZh: 'The preference is clear.',
        developmentMoveZh: 'Use commute/crowd chunks.',
        phraseChunks: [
          { purposeZh: '交通', text: 'rush-hour congestion' },
          { purposeZh: '避开人群', text: 'avoid the hustle and bustle' },
        ],
      },
    ],
    threadLevelPatterns: [],
    answerByAnswerCoaching: [],
    highImpactPhraseFixes: [],
    materialBank: {
      myUsableMaterial: [],
      reusableSpokenLanguage: [
        'overcrowded public transport',
        'traffic congestion',
        'packed with tourists',
        'avoid the rush hour',
      ].map(item => ({
        sourceWording: '',
        reusableVersion: item,
        reuseFor: ['Part 1 crowded places'],
        explanationZh: 'Current-topic expression.',
      })),
    },
    optionalPolish: [],
    nextRetryFocusZh: '',
  }, [
    { questionId: 'pc1', question: 'Is the city where you live crowded?', answer: 'Yes, it is crowded because the city attracts a lot of tourists.' },
    { questionId: 'pc2', question: 'Is there a crowded place near where you live?', answer: 'There is a busy shopping district near where I live.' },
    { questionId: 'pc3', question: 'Do you like crowded places?', answer: 'I prefer quieter places because heavy traffic makes commuting stressful.' },
  ]);
  assert((partialCrowdedDisplay.expressionBank || []).length === 6, 'partial crowded expression bank includes provider development chunks without keyword backfill');
  assert(/rush-hour congestion|avoid the hustle and bustle/i.test(partialCrowdedExpressions), 'development chunks are reusable expression-bank inputs');
  assert(!partialCrowdedQuality.ok && /expected at least 10|Q1, Q2/i.test(partialCrowdedQuality.summary), 'quality gate catches partial provider learning payload');
  assert(!/thoughtful anniversary gift|laid-back coastal city|strong sense of belonging/i.test(partialCrowdedExpressions), 'crowded expression backfill stays inside crowded-place topic');
  const scaffoldOnlyDisplay = displayModule.buildPart1LearningDisplayModel({
    topic: 'Hometown',
    threadId: 'hometown_scaffold_only_q4',
    questionCount: 4,
    mustFix: [],
    annotations: [],
    cleanRetryAnswers: [],
    developmentStatus: 'needed',
    developmentTargets: [
      {
        questionRef: 'Q4',
        reasonZh: 'The answer is accurate but short.',
        developmentMoveZh: 'Use staying-reason chunks.',
        phraseScaffolds: ['close family ties', 'have a strong sense of belonging'],
      },
    ],
    threadLevelPatterns: [],
    answerByAnswerCoaching: [],
    highImpactPhraseFixes: [],
    materialBank: { myUsableMaterial: [], reusableSpokenLanguage: [] },
    optionalPolish: [],
    nextRetryFocusZh: '',
  }, {
    answers: [
      { questionId: 'h1', question: 'Where is your hometown?', answer: 'My hometown is Xiamen. I was born and raised here.' },
      { questionId: 'h2', question: 'Is that a big city or a small place?', answer: 'It is a medium-sized coastal city.' },
      { questionId: 'h3', question: 'How long have you been living there?', answer: 'I have lived in Xiamen for most of my life.' },
      { questionId: 'h4', question: 'Do you think you will continue living there for a long time?', answer: 'Yes, definitely. My family and close friends are all here.' },
    ],
  });
  assert(scaffoldOnlyDisplay.answerCoaching.some(item =>
    item.questionRef === 'Q4' && (item.phraseChunks || []).some(chunk => /belonging|family ties/i.test(chunk.text)),
  ), 'scaffold-only Q4 development target still renders visible chunks');
  assert((scaffoldOnlyDisplay.expressionBank || []).length === 2, 'provider development scaffolds can appear in expression bank');
  assert(!(scaffoldOnlyDisplay.expressionBank || []).some(item => /gift from the heart|rush-hour congestion|scholarship/i.test(item.reusableVersion)), 'provider-empty expression bank does not import other topics');
  const unrecognizedDevelopmentOnlyDisplay = displayModule.buildPart1LearningDisplayModel({
    topic: 'Unmapped topic',
    threadId: 'unmapped_dev_only',
    questionCount: 1,
    mustFix: [],
    annotations: [],
    cleanRetryAnswers: [],
    developmentStatus: 'needed',
    developmentTargets: [{
      questionRef: 'Q1',
      reasonZh: 'Provider returned a development chip only.',
      developmentMoveZh: '',
      phraseScaffolds: ['close family ties'],
    }],
    threadLevelPatterns: [],
    answerByAnswerCoaching: [],
    highImpactPhraseFixes: [],
    materialBank: { myUsableMaterial: [], reusableSpokenLanguage: [] },
    optionalPolish: [],
    nextRetryFocusZh: '',
  }, {
    answers: [{ questionId: 'u1', question: 'Tell me about this.', answer: 'It is useful.' }],
  });
  assert((unrecognizedDevelopmentOnlyDisplay.expressionBank || []).length === 1, 'provider development chips can feed expression bank on any topic');
  const exactPolishedMaterialDisplay = displayModule.buildPart1LearningDisplayModel({
    topic: 'Hometown',
    threadId: 'hometown_exact_polished_material',
    questionCount: 1,
    mustFix: [],
    annotations: [],
    cleanRetryAnswers: [],
    developmentStatus: 'needed',
    developmentTargets: [],
    threadLevelPatterns: [],
    answerByAnswerCoaching: [],
    highImpactPhraseFixes: [],
    materialBank: {
      myUsableMaterial: [{
        sourceWording: 'I have lived in Xiamen for most of my life, except for the six years I spent in Beijing.',
        reusableVersion: 'I have lived in Xiamen for most of my life, except for the six years I spent in Beijing.',
        reuseFor: ['Part 1 hometown'],
        explanationZh: '我大部分时间都住在厦门，只有六年是在北京度过的。',
        materialCore: 'Xiamen long-term living with Beijing exception',
        materialKind: 'reusable_personal_material',
        developedExample: 'I have lived in Xiamen for most of my life, except for the six years I spent in Beijing.',
        materialKey: 'xiamen_beijing_exact_polished',
      }],
      reusableSpokenLanguage: [],
    },
    optionalPolish: [],
    nextRetryFocusZh: '',
  }, {
    answers: [{
      questionId: 'hm2',
      question: 'How long have you been living there?',
      answer: 'I have lived in Xiamen for most of my life, except for the six years I spent in Beijing.',
    }],
  });
  assert((exactPolishedMaterialDisplay.userMaterials || []).length === 0, 'exact-answer material is hidden even when it has a real Chinese translation');
  const paraphrasedMaterialDisplay = displayModule.buildPart1LearningDisplayModel({
    topic: 'Hometown',
    threadId: 'hometown_paraphrased_material',
    questionCount: 1,
    mustFix: [],
    annotations: [],
    cleanRetryAnswers: [{
      questionRef: 'Q1',
      answer: 'I have lived in Xiamen for most of my life, except for the six years I spent in Beijing.',
    }],
    developmentStatus: 'needed',
    developmentTargets: [],
    threadLevelPatterns: [],
    answerByAnswerCoaching: [],
    highImpactPhraseFixes: [],
    materialBank: {
      myUsableMaterial: [{
        sourceWording: 'I have lived in Xiamen for most of my life, except for the six years I spent in Beijing.',
        reusableVersion: 'Xiamen has been my home base for most of my life, apart from a six-year stretch in Beijing.',
        reuseFor: ['Part 1 hometown'],
        explanationZh: '厦门是我大部分人生里的家，只是中间有六年在北京生活。',
        materialCore: 'Xiamen long-term living with Beijing exception',
        materialKind: 'reusable_personal_material',
        developedExample: 'Xiamen has been my home base for most of my life, apart from a six-year stretch in Beijing.',
        materialKey: 'xiamen_beijing_paraphrased',
      }],
      reusableSpokenLanguage: [],
    },
    optionalPolish: [],
    nextRetryFocusZh: '',
  }, {
    answers: [{
      questionId: 'hm2',
      question: 'How long have you been living there?',
      answer: 'I have lived in Xiamen for most of my life, except for the six years I spent in Beijing.',
    }],
  });
  assert((paraphrasedMaterialDisplay.userMaterials || []).some(item => /home base|six-year stretch/i.test(item.developedExample || '')), 'paraphrased or expanded material remains visible');
  const metaMaterialDisplay = displayModule.buildPart1LearningDisplayModel({
    topic: 'Hometown',
    threadId: 'hometown_meta_material',
    questionCount: 1,
    mustFix: [],
    annotations: [],
    cleanRetryAnswers: [],
    developmentStatus: 'sufficient',
    developmentTargets: [],
    threadLevelPatterns: [],
    answerByAnswerCoaching: [],
    highImpactPhraseFixes: [],
    materialBank: {
      myUsableMaterial: [{
        sourceWording: 'I was born and raised in Xiamen',
        reusableVersion: 'My hometown is Xiamen, a coastal city where I was born and raised.',
        reuseFor: ['Part 1 hometown'],
        explanationZh: '这是出生地的核心信息，可以扩展使用。',
        materialCore: 'Xiamen born and raised',
        materialKind: 'reusable_personal_material',
        developedExample: 'My hometown is Xiamen, a coastal city where I was born and raised.',
        materialKey: 'meta_translation_control',
      }],
      reusableSpokenLanguage: [],
    },
    optionalPolish: [],
    nextRetryFocusZh: '',
  }, {
    answers: [{ questionId: 'hm1', question: 'Where is your hometown?', answer: 'I was born and raised in Xiamen.' }],
  });
  assert(!(metaMaterialDisplay.userMaterials || []).length, 'material bank hides meta Chinese notes instead of showing them as translations');
  const translationPreferredDisplay = displayModule.buildPart1LearningDisplayModel({
    topic: 'Hometown',
    threadId: 'hometown_translation_preferred',
    questionCount: 1,
    mustFix: [],
    annotations: [],
    cleanRetryAnswers: [],
    developmentStatus: 'sufficient',
    developmentTargets: [],
    threadLevelPatterns: [],
    answerByAnswerCoaching: [],
    highImpactPhraseFixes: [],
    materialBank: {
      myUsableMaterial: [{
        sourceWording: 'My family and close friends are all here',
        reusableVersion: 'My family and close friends are all here, which gives me a strong sense of belonging.',
        reuseFor: ['Part 1 hometown'],
        explanationZh: '在给出明确肯定的基础上，深入阐述家人朋友在身边带来的归属感和扎根感。',
        translationZh: '我的家人和亲近的朋友都在这里，这让我有很强的归属感。',
        materialCore: 'family and friends are here',
        materialKind: 'reusable_personal_material',
        developedExample: 'My family and close friends are all here, which gives me a strong sense of belonging.',
        materialKey: 'translation_preferred',
      }],
      reusableSpokenLanguage: [],
    },
    optionalPolish: [],
    nextRetryFocusZh: '',
  }, {
    answers: [{ questionId: 'hm3', question: 'Will you keep living there?', answer: 'My family and close friends are all here.' }],
  });
  const translationPreferredText = JSON.stringify(translationPreferredDisplay.userMaterials || []);
  assert(/我的家人和亲近的朋友都在这里/.test(translationPreferredText) && !/在给出明确肯定的基础上/.test(translationPreferredText), 'material cards prefer translation text over Chinese usage notes');
  if (displayModule.findPart1AnnotationDisplaySpans) {
    const spans = displayModule.findPart1AnnotationDisplaySpans(threadAnswers[1].answer, feedback.threadFeedback.annotations.filter(item => item.questionRef === 'Q2'));
    assert(spans.anchored.some(item => item.visibleText === 'employee like me'), 'annotation anchoring prefers local layer span');
  } else {
    assert(false, 'annotation anchoring helper exists');
  }
  assert(normalizedSamples.length > 0 && normalizedSamples.every((item, index) => item === displayModule.normalizePart1LearnerText(normalizedSamples[index])), 'learner-facing text normalizer is idempotent');
  assert(!normalizedSamples.join(' ').includes('..') && !/[。！？][。！？]/.test(normalizedSamples.join(' ')), 'learner-facing punctuation normalized globally');
  assert(!/鍙|杩|涗|竴|姝|璇/.test(normalizedSamples.join(' ')), 'learner-facing mojibake isolated');
  if (displayModule.normalizePart1TranscriptDisplayText) {
    const casingSample = displayModule.normalizePart1TranscriptDisplayText('I Was SOPHERMORE and iT WAS really hard because I needED to present and my presentation caME well.');
    assert(!/I Was|SOPHERMORE|iT WAS|needED|caME/.test(casingSample), 'transcript display casing normalized');
  } else {
    assert(false, 'transcript display casing normalizer exists');
  }
  const achievementAnswers = [
    {
      questionId: 'a1',
      question: 'Do you have an experience when you did something well?',
      answer: 'yes of course I could say quite a lot like I won the scholarship when I was in university',
    },
    {
      questionId: 'a2',
      question: 'Do you have an experience when your teacher thought you did a good job?',
      answer: 'yes I have this experience when I was preparing my final examination of presentation when I was sophomore and it was really hard because I needed to use English to describe my experience in my high school orchestra',
    },
    {
      questionId: 'a3',
      question: 'Do you often encourage your friends?',
      answer: 'yes when my friend and I play as a team in esports games I often tell my friend they did a good job',
    },
  ];
  const achievementDisplay = displayModule.buildPart1LearningDisplayModel({
    topic: 'Doing something well',
    threadId: 'achievement_fixture_thread',
    questionCount: achievementAnswers.length,
    mustFix: [],
    annotations: [],
    cleanRetryAnswers: achievementAnswers.map((item, index) => ({ questionRef: `Q${index + 1}`, answer: item.answer })),
    developmentStatus: 'needed',
    developmentTargets: [
      {
        questionRef: 'Q1',
        reasonZh: '经历可以说得更像成果。',
        developmentMoveZh: '用成果/认可词块',
        phraseChunks: [
          { purposeZh: '成果感', text: 'a strong sense of achievement' },
          { purposeZh: '认可', text: 'receive recognition for my work' },
          { purposeZh: '标准', text: 'meet the assessment criteria' },
          { purposeZh: '努力结果', text: 'see my hard work pay off' },
        ],
      },
      {
        questionRef: 'Q2',
        reasonZh: '展示经历需要技术词块。',
        developmentMoveZh: '用展示/技术词块',
        phraseChunks: [
          { purposeZh: '技术词汇', text: 'familiarize myself with technical vocabulary' },
          { purposeZh: '展示', text: 'give a polished presentation' },
          { purposeZh: '压力', text: 'perform well under pressure' },
          { purposeZh: '清晰表达', text: 'explain a technical topic clearly' },
        ],
      },
      {
        questionRef: 'Q3',
        reasonZh: '鼓励朋友需要团队表达。',
        developmentMoveZh: '用团队鼓励词块',
        phraseChunks: [
          { purposeZh: '鼓励', text: 'give teammates constructive encouragement' },
          { purposeZh: '团队合作', text: 'work effectively as a team' },
          { purposeZh: '正反馈', text: 'positive reinforcement' },
          { purposeZh: '共同表现', text: 'help the whole team perform better' },
        ],
      },
    ],
    threadLevelPatterns: [],
    answerByAnswerCoaching: [],
    highImpactPhraseFixes: [],
    materialBank: {
      myUsableMaterial: [],
      reusableSpokenLanguage: [
        'a strong sense of achievement',
        'receive recognition for my work',
        'meet the assessment criteria',
        'perform well under pressure',
        'give a polished presentation',
        'familiarize myself with technical vocabulary',
        'explain a technical topic clearly',
        'build confidence in public speaking',
        'see my hard work pay off',
        'give teammates constructive encouragement',
        'positive reinforcement',
        'make a meaningful contribution',
      ].map(item => ({
        sourceWording: '',
        reusableVersion: item,
        reuseFor: ['Part 1 doing-something-well topic'],
        explanationZh: 'Provider-generated topic expression.',
      })),
    },
    optionalPolish: [],
    nextRetryFocusZh: '',
  }, { answers: achievementAnswers });
  const achievementExpressionText = JSON.stringify(achievementDisplay.expressionBank || []);
  const achievementDevelopmentText = JSON.stringify(achievementDisplay.answerCoaching || []);
  assert((achievementDisplay.expressionBank || []).length >= 10, 'achievement topic receives enough high-value expression assets');
  assert(/familiarize myself with technical vocabulary|meet the assessment criteria|receive recognition for my work|perform well under pressure/i.test(achievementExpressionText + achievementDevelopmentText), 'achievement topic gets precise high-band chunks');
  assert(!/do a good job|play as a team|win a scholarship|the best way to encourage someone/i.test(achievementExpressionText), 'achievement low-value transcript fragments rejected');
  assert(achievementAnswers.every((_, index) =>
    (achievementDisplay.answerCoaching || []).some(item => item.questionRef === `Q${index + 1}` && (item.phraseChunks || []).length >= 4),
  ), 'achievement every answer receives development volume');
  const rawForThread = (topic, threadId, answers, threadFeedback = {}) => ({
    ...baseRaw,
    topic,
    threadId,
    transcript: answers.map(item => item.answer).join('\n'),
    threadAnswers: answers,
    threadFeedback: {
      ...baseRaw.threadFeedback,
      topic,
      threadId,
      questionCount: answers.length,
      mustFix: [],
      annotations: [],
      cleanRetryAnswers: answers.map((item, index) => ({ questionRef: `Q${index + 1}`, answer: item.answer })),
      developmentStatus: 'needed',
      developmentTargets: [],
      threadLevelPatterns: [],
      answerByAnswerCoaching: [],
      highImpactPhraseFixes: [],
      materialBank: { myUsableMaterial: [], reusableSpokenLanguage: [] },
      optionalPolish: [],
      nextRetryFocusZh: '',
      ...threadFeedback,
    },
  });
  const shoesAnswers = [
    {
      questionId: 's1',
      question: 'Do you like buying shoes? How often?',
      answer: 'well when I was young in middle school I mean I was a big fan of sneakers but now I buy shoes once a year',
    },
    {
      questionId: 's2',
      question: 'Have you ever bought shoes online?',
      answer: 'yeah definitely every time I buy shoes is online I have not bought shoes in the store for ages',
    },
    {
      questionId: 's3',
      question: 'How much money do you usually spend on shoes?',
      answer: 'well like I said I buy shoes once a year and every time I spend like around 400 yuan on shoes',
    },
    {
      questionId: 's4',
      question: 'Which do you prefer, fashionable shoes or comfortable shoes?',
      answer: 'if it were 10 years ago I probably would choose fashionable shoes but now definitely comfortable shoes',
    },
  ];
  const shoesRaw = rawForThread('Shoes', 'shoes_empty_provider_fixture', shoesAnswers, {
    developmentTargets: [{
      questionRef: 'Q1',
      reasonZh: 'Provider leaked generic placeholders.',
      developmentMoveZh: '',
      phraseChunks: [
        { purposeZh: '具体原因', text: 'a concrete personal reason' },
        { purposeZh: '个人感受', text: 'a clearer personal feeling' },
        { purposeZh: '对比', text: 'a simple but useful contrast' },
        { purposeZh: '细节', text: 'one memorable supporting detail' },
      ],
    }],
  });
  const { feedback: shoesFeedback } = await safeAnalyzeSpeaking(makeProvider(shoesRaw), 'fixture', {
    part: 1,
    question: 'Part 1 topic thread',
    transcript: shoesRaw.transcript,
    sessionKind: 'part1_topic_thread',
    topic: shoesRaw.topic,
    threadId: shoesRaw.threadId,
    threadAnswers: shoesAnswers,
  });
  const shoesDisplay = displayModule.buildPart1LearningDisplayModel(shoesFeedback.threadFeedback, { answers: shoesAnswers });
  const shoesQuality = displayModule.evaluatePart1LearningPayloadQuality(shoesFeedback.threadFeedback, shoesAnswers);
  const shoesDevelopmentText = JSON.stringify(shoesDisplay.answerCoaching || []);
  const shoesExpressionText = JSON.stringify(shoesDisplay.expressionBank || []);
  assert(!shoesQuality.ok, 'provider-underfilled shoes payload is rejected by generic learning quality gate');
  assert(!/a concrete personal reason|a clearer personal feeling|a simple but useful contrast|one memorable supporting detail/i.test(shoesDevelopmentText), 'shoes generic placeholder development chips are filtered');
  assert((shoesDisplay.expressionBank || []).length === 0, 'provider-underfilled shoes payload is not locally padded with keyword expressions');
  assert(!/get good wear out of them|hold up well over time|splurge on a good pair|break them in/i.test(shoesExpressionText), 'shoes expressions come from provider, not local topic-specific backfill');
  const achievementFallbackRaw = rawForThread('Doing something well', 'achievement_empty_provider_fixture', achievementAnswers);
  const { feedback: achievementFallbackFeedback } = await safeAnalyzeSpeaking(makeProvider(achievementFallbackRaw), 'fixture', {
    part: 1,
    question: 'Part 1 topic thread',
    transcript: achievementFallbackRaw.transcript,
    sessionKind: 'part1_topic_thread',
    topic: achievementFallbackRaw.topic,
    threadId: achievementFallbackRaw.threadId,
    threadAnswers: achievementAnswers,
  });
  const achievementFallbackDisplay = displayModule.buildPart1LearningDisplayModel(achievementFallbackFeedback.threadFeedback, { answers: achievementAnswers });
  const achievementFallbackQuality = displayModule.evaluatePart1LearningPayloadQuality(achievementFallbackFeedback.threadFeedback, achievementAnswers);
  const achievementFallbackQ3 = JSON.stringify((achievementFallbackDisplay.answerCoaching || []).filter(item => item.questionRef === 'Q3'));
  assert(!/close family ties|sense of belonging|rooted in my hometown|close friends/i.test(achievementFallbackQ3), 'doing-well team answer does not receive hometown development pollution');
  assert(!achievementFallbackQuality.ok, 'provider-empty achievement payload is rejected instead of receiving local topic backfill');
  const hobbyAnswers = [
    {
      questionId: 'hobby1',
      question: 'Do you have any hobbies?',
      answer: 'I like playing the piano, especially classical and jazz music.',
    },
    {
      questionId: 'hobby2',
      question: 'Did you have any hobbies when you were a child?',
      answer: 'When I was a kid, I was a big fan of PC games like Pokemon.',
    },
    {
      questionId: 'hobby3',
      question: "Do you have a hobby that you've had since childhood?",
      answer: 'I still practice the piano for an hour every day.',
    },
    {
      questionId: 'hobby4',
      question: 'Do you have the same hobbies as your family members?',
      answer: "No, my parents love watching TV series, but I'm not a big fan of them.",
    },
  ];
  const hobbyProviderThread = {
    topic: 'Hobbies',
    threadId: 'generic_hobby_provider_quality',
    questionCount: hobbyAnswers.length,
    mustFix: [],
    annotations: [],
    cleanRetryAnswers: hobbyAnswers.map((item, index) => ({ questionRef: `Q${index + 1}`, answer: item.answer })),
    developmentStatus: 'needed',
    developmentTargets: [
      {
        questionRef: 'Q1',
        reasonZh: 'Answer-specific expression upgrade.',
        developmentMoveZh: 'Use richer music-hobby chunks.',
        phraseChunks: [
          { purposeZh: '音乐类型', text: 'enjoy classical and jazz music' },
          { purposeZh: '投入感', text: 'lose myself in the music' },
          { purposeZh: '长期爱好', text: 'stick with it for years' },
          { purposeZh: '放松', text: 'play the piano to unwind' },
          { purposeZh: '状态', text: 'be completely in my element' },
        ],
      },
      {
        questionRef: 'Q2',
        reasonZh: 'Answer-specific expression upgrade.',
        developmentMoveZh: 'Use childhood-interest chunks.',
        phraseChunks: [
          { purposeZh: '以前喜欢', text: 'used to spend hours on PC games' },
          { purposeZh: '沉迷', text: 'spend hours playing after school' },
          { purposeZh: '兴趣变化', text: 'grow out of that phase' },
          { purposeZh: '阶段', text: 'a hobby I had as a kid' },
          { purposeZh: '回忆', text: 'bring back a lot of memories' },
        ],
      },
      {
        questionRef: 'Q3',
        reasonZh: 'Answer-specific expression upgrade.',
        developmentMoveZh: 'Use routine and consistency chunks.',
        phraseChunks: [
          { purposeZh: '坚持', text: 'keep up the habit every day' },
          { purposeZh: '练习', text: 'set aside an hour to practice' },
          { purposeZh: '放松', text: 'switch off after a long day' },
          { purposeZh: '长期', text: 'a hobby I have stuck with for years' },
          { purposeZh: '习惯', text: 'fit naturally into my daily routine' },
        ],
      },
      {
        questionRef: 'Q4',
        reasonZh: 'Answer-specific expression upgrade.',
        developmentMoveZh: 'Use contrast chunks.',
        phraseChunks: [
          { purposeZh: '不同兴趣', text: 'have completely different tastes' },
          { purposeZh: '不感兴趣', text: 'not be that into TV series' },
          { purposeZh: '对比', text: 'whereas my parents enjoy TV series' },
          { purposeZh: '偏好', text: 'be more drawn to music' },
          { purposeZh: '接受差异', text: "it's fine to have different hobbies" },
        ],
      },
    ],
    threadLevelPatterns: [],
    answerByAnswerCoaching: [],
    highImpactPhraseFixes: [],
    materialBank: {
      myUsableMaterial: [],
      reusableSpokenLanguage: [
        'enjoy a hobby for its rhythm',
        'lose myself in the music',
        'stick with a hobby for years',
        'pick up a hobby',
        'grow out of a phase',
        'set aside time to practise',
        'switch off after a long day',
        'have completely different tastes',
        'not feel drawn to something',
        'keep up a regular routine',
      ].map(item => ({
        sourceWording: '',
        reusableVersion: item,
        reuseFor: ['Part 1 current topic'],
        explanationZh: 'Provider-generated current-topic expression.',
      })),
    },
    optionalPolish: [],
    nextRetryFocusZh: '',
  };
  const hobbyDisplay = displayModule.buildPart1LearningDisplayModel(hobbyProviderThread, { answers: hobbyAnswers });
  const hobbyQuality = displayModule.evaluatePart1LearningPayloadQuality(hobbyProviderThread, hobbyAnswers);
  const hobbyExpressionText = JSON.stringify(hobbyDisplay.expressionBank || []);
  assert(hobbyQuality.ok, 'generic provider-supplied hobby payload passes without local topic-specific backfill');
  assert(!/laid-back atmosphere|sense of belonging|coastal city|family ties/i.test(hobbyExpressionText), 'generic hobby payload stays free of hometown pollution');
  const learningAssetsRun = await safeAnalyzePart1LearningAssets(makeLearningProvider({
    module: 'speaking',
    operation: 'part1_learning_assets',
    topic: 'Hobbies',
    threadId: 'hobby_learning_assets',
    questionCount: hobbyAnswers.length,
    developmentTargets: hobbyProviderThread.developmentTargets,
    materialBank: hobbyProviderThread.materialBank,
    rationaleZh: 'Provider produced current-topic development and expression assets.',
  }), 'fixture_learning_provider', {
    topic: 'Hobbies',
    threadId: 'hobby_learning_assets',
    threadAnswers: hobbyAnswers,
    cleanRetryAnswers: hobbyAnswers.map((answer, index) => ({
      questionRef: `Q${index + 1}`,
      answer: answer.answer,
    })),
    annotations: [],
    carriedMyUsableMaterial: [],
    attempt: 1,
  });
  const learningAssetsThread = {
    topic: learningAssetsRun.feedback.topic,
    threadId: learningAssetsRun.feedback.threadId,
    questionCount: learningAssetsRun.feedback.questionCount,
    mustFix: [],
    annotations: [],
    cleanRetryAnswers: hobbyAnswers.map((answer, index) => ({
      questionRef: `Q${index + 1}`,
      answer: answer.answer,
    })),
    developmentStatus: learningAssetsRun.feedback.developmentTargets.length ? 'needed' : 'sufficient',
    developmentTargets: learningAssetsRun.feedback.developmentTargets,
    threadLevelPatterns: [],
    answerByAnswerCoaching: [],
    highImpactPhraseFixes: [],
    materialBank: learningAssetsRun.feedback.materialBank,
    optionalPolish: [],
    nextRetryFocusZh: '',
  };
  const learningAssetsQuality = displayModule.evaluatePart1LearningPayloadQuality(learningAssetsThread, hobbyAnswers);
  assert(learningAssetsRun.feedback.operation === 'part1_learning_assets', 'independent learning-assets operation normalizes separately from core analysis');
  assert(!learningAssetsRun.diagnostic.failureKind, 'independent learning-assets provider payload parses without core feedback fallback');
  assert(learningAssetsQuality.ok, 'independent learning-assets payload satisfies generic Part 1 quality gate');
  const preferenceAnswers = [{
    questionId: 'pref1',
    question: 'Do you enjoy crowded places?',
    answer: 'Not really, they are not my cup of tea.',
  }];
  const preferenceLearningRun = await safeAnalyzePart1LearningAssets(makeLearningProvider({
    module: 'speaking',
    operation: 'part1_learning_assets',
    topic: 'Crowded places',
    threadId: 'preference_material_assets',
    questionCount: preferenceAnswers.length,
    developmentTargets: [{
      questionRef: 'Q1',
      reasonZh: 'Preference answer can be turned into reusable personal material.',
      developmentMoveZh: 'Keep the stance and make it recordable.',
      phraseChunks: [
        { text: 'crowded places do not really match my taste' },
        { text: 'prefer somewhere quieter' },
        { text: 'feel more relaxed in a calm place' },
        { text: 'avoid places that feel too busy' },
        { text: 'choose comfort over atmosphere' },
      ],
    }],
    materialBank: {
      myUsableMaterial: [{
        sourceWording: 'they are not my cup of tea',
        reusableVersion: 'I would usually say no because crowded places do not really match my taste.',
        reuseFor: ['Part 1 preference answers'],
        explanationZh: '我通常会说不喜欢，因为拥挤的地方不太符合我的喜好。',
        materialCore: 'crowded places do not match my taste',
        materialKind: 'reusable_personal_material',
        part1UseCases: ['preference'],
        developedExample: 'I would usually say no because crowded places do not really match my taste.',
        expressionFrames: [],
        materialKey: 'crowded_places_preference',
      }],
      reusableSpokenLanguage: [],
    },
    rationaleZh: 'Provider produced paraphrased personal stance material.',
  }), 'fixture_learning_provider', {
    topic: 'Crowded places',
    threadId: 'preference_material_assets',
    threadAnswers: preferenceAnswers,
    cleanRetryAnswers: [{ questionRef: 'Q1', answer: preferenceAnswers[0].answer }],
    annotations: [],
    carriedMyUsableMaterial: [],
    attempt: 1,
  });
  const preferenceThread = {
    topic: preferenceLearningRun.feedback.topic,
    threadId: preferenceLearningRun.feedback.threadId,
    questionCount: preferenceLearningRun.feedback.questionCount,
    mustFix: [],
    annotations: [],
    cleanRetryAnswers: [{ questionRef: 'Q1', answer: preferenceAnswers[0].answer }],
    developmentStatus: 'needed',
    developmentTargets: preferenceLearningRun.feedback.developmentTargets,
    threadLevelPatterns: [],
    answerByAnswerCoaching: [],
    highImpactPhraseFixes: [],
    materialBank: preferenceLearningRun.feedback.materialBank,
    optionalPolish: [],
    nextRetryFocusZh: '',
  };
  const preferenceDisplay = displayModule.buildPart1LearningDisplayModel(preferenceThread, { answers: preferenceAnswers });
  assert((preferenceDisplay.userMaterials || []).some(item => /match my taste/i.test(item.developedExample || item.reusableVersion)), 'paraphrased personal stance material remains visible without concrete fact requirements');
  const generatedHometownAnswers = [{
    questionId: 'gen1',
    question: 'Where is your hometown?',
    answer: 'My hometown is Xiamen.',
  }];
  const generatedHometownRun = await safeAnalyzePart1LearningAssets(makeLearningProvider({
    module: 'speaking',
    operation: 'part1_learning_assets',
    topic: 'Hometown',
    threadId: 'generated_hometown_material',
    questionCount: 1,
    developmentTargets: [{
      questionRef: 'Q1',
      reasonZh: 'The answer is short but has a clear city anchor.',
      developmentMoveZh: 'Use city-specific answer material.',
      phraseChunks: [
        { text: 'a vibrant coastal city' },
        { text: 'known for its relaxed pace of life' },
        { text: 'a place with a strong local character' },
        { text: 'a city that feels familiar and comfortable' },
        { text: 'a good balance between city life and seaside atmosphere' },
      ],
    }],
    materialBank: {
      myUsableMaterial: [{
        sourceWording: 'Xiamen',
        reusableVersion: 'My hometown, Xiamen, is a vibrant coastal city with a relaxed pace of life.',
        reuseFor: ['Part 1 hometown answers'],
        translationZh: '我的家乡厦门是一座充满活力的海滨城市，生活节奏比较放松。',
        explanationZh: 'This is generated from the city anchor.',
        materialCore: 'Xiamen coastal hometown angle',
        materialKind: 'reusable_personal_material',
        part1UseCases: ['hometown'],
        developedExample: 'My hometown, Xiamen, is a vibrant coastal city with a relaxed pace of life.',
        materialKey: 'generated_xiamen_hometown',
      }],
      reusableSpokenLanguage: [
        'a vibrant coastal city',
        'a relaxed pace of life',
        'a strong local character',
        'feel familiar and comfortable',
        'a good balance between city life and seaside atmosphere',
        'be known for sth',
        'one of the things I like about it',
        'a city with a distinct personality',
        'a place that feels like home',
        'not too overwhelming',
      ].map(item => ({
        sourceWording: '',
        reusableVersion: item,
        reuseFor: ['Part 1 hometown answers'],
        explanationZh: 'Generated current-topic expression.',
      })),
    },
    rationaleZh: 'Provider generated material from a confirmed city anchor.',
  }), 'fixture_learning_provider', {
    topic: 'Hometown',
    threadId: 'generated_hometown_material',
    threadAnswers: generatedHometownAnswers,
    cleanRetryAnswers: [{ questionRef: 'Q1', answer: generatedHometownAnswers[0].answer }],
    annotations: [],
    carriedMyUsableMaterial: [],
    attempt: 1,
  });
  const generatedHometownDisplay = displayModule.buildPart1LearningDisplayModel({
    topic: generatedHometownRun.feedback.topic,
    threadId: generatedHometownRun.feedback.threadId,
    questionCount: generatedHometownRun.feedback.questionCount,
    mustFix: [],
    annotations: [],
    cleanRetryAnswers: [{ questionRef: 'Q1', answer: generatedHometownAnswers[0].answer }],
    developmentStatus: 'needed',
    developmentTargets: generatedHometownRun.feedback.developmentTargets,
    threadLevelPatterns: [],
    answerByAnswerCoaching: [],
    highImpactPhraseFixes: [],
    materialBank: generatedHometownRun.feedback.materialBank,
    optionalPolish: [],
    nextRetryFocusZh: '',
  }, { answers: generatedHometownAnswers });
  assert((generatedHometownDisplay.userMaterials || []).some(item => /vibrant coastal city/i.test(item.developedExample || item.reusableVersion)), 'topic-anchored generated material can enter material bank');
  const emptyLearningAssetsRun = await safeAnalyzePart1LearningAssets(makeLearningProvider({
    module: 'speaking',
    operation: 'part1_learning_assets',
    topic: 'Unmapped topic',
    threadId: 'empty_learning_assets',
    questionCount: 1,
    developmentTargets: [],
    materialBank: { myUsableMaterial: [], reusableSpokenLanguage: [] },
    rationaleZh: 'Empty provider payload fixture.',
  }), 'fixture_learning_provider', {
    topic: 'Unmapped topic',
    threadId: 'empty_learning_assets',
    threadAnswers: [{
      questionId: 'u1',
      question: 'Do you like this topic?',
      answer: 'Yes, I do.',
    }],
    cleanRetryAnswers: [{ questionRef: 'Q1', answer: 'Yes, I do.' }],
    annotations: [],
    carriedMyUsableMaterial: [],
    attempt: 1,
  });
  assert(emptyLearningAssetsRun.feedback.materialBank.reusableSpokenLanguage.length === 0, 'independent learning-assets normalizer does not backfill expressions from local topic guesses');
  assert(diagnostic.normalizedFields.some(item => item.startsWith('part1')), 'runtime fixture executed safety normalization');

  console.log('Part 1 Runtime Fixture Verification');
  console.log(`Passes: ${passes.length}`);
  passes.forEach(item => console.log(`- PASS ${item}`));
  console.log(`Failures: ${failures.length}`);
  failures.forEach(item => console.log(`- FAIL ${item}`));
  if (failures.length) process.exitCode = 1;
};

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
