import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = Number(process.env.HISTORY_UI_PORT || 3011);
const baseUrl = `http://127.0.0.1:${port}`;
const serverCommand = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm';
const serverArgs = process.platform === 'win32'
  ? ['/d', '/s', '/c', `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`]
  : ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'];

const server = spawn(serverCommand, serverArgs, {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: false,
});

let serverOutput = '';
server.stdout.on('data', chunk => { serverOutput += chunk.toString(); });
server.stderr.on('data', chunk => { serverOutput += chunk.toString(); });

const stopServer = () => {
  if (server.killed) return;
  if (process.platform === 'win32' && server.pid) {
    spawnSync('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore' });
    return;
  }
  server.kill();
};

const waitForServer = async () => {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    try {
      const response = await fetch(`${baseUrl}/practice-history`);
      if (response.ok) return;
    } catch {}
    await delay(500);
  }
  throw new Error(`Vite server did not become ready at ${baseUrl}\n${serverOutput}`);
};

const expectText = async (page, text) => {
  await page.getByText(text, { exact: false }).first().waitFor({ timeout: 10000 });
};

const expectNoText = async (page, text) => {
  const body = await page.locator('body').innerText();
  if (body.includes(text)) {
    throw new Error(`Unexpected text was visible: ${text}`);
  }
};

const expectBodyPattern = async (page, pattern) => {
  const body = await page.locator('body').innerText();
  if (!pattern.test(body)) {
    throw new Error(`Expected body text to match ${pattern}\n${body.slice(0, 3000)}`);
  }
};

const openHistoryRecord = async (page, title) => {
  await page.goto(`${baseUrl}/practice-history`, { waitUntil: 'networkidle' });
  await expectText(page, 'Practice History');
  await expectText(page, title);
  const clicked = await page.evaluate((needle) => {
    const heading = [...document.querySelectorAll('h3')]
      .find(item => (item.textContent || '').includes(needle));
    const card = heading?.closest('.paper-card');
    const button = card ? [...card.querySelectorAll('button')][0] : null;
    button?.click();
    return Boolean(button);
  }, title);
  if (!clicked) throw new Error(`Could not open history record: ${title}`);
};

const estimateBlockText = async (page) =>
  page.evaluate(() => {
    const label = [...document.querySelectorAll('p')]
      .find(item => (item.textContent || '').trim() === 'IDEAL-DELIVERY ESTIMATE');
    return label?.parentElement?.innerText || '';
  });

const runWithRecords = async (browser, records, title, verify) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  await context.addInitScript((seedRecords) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('ielts_practice_records_v1', JSON.stringify(seedRecords));
  }, records);
  const page = await context.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') console.error(`[browser] ${msg.text()}`);
  });
  try {
    await openHistoryRecord(page, title);
    await verify(page);
  } finally {
    await context.close();
  }
};

const now = '2026-06-14T04:30:00.000Z';

const speakingScores = (fc = 6.5, lr = 6.5, gra = 6.5) => ({
  fluencyCoherence: fc,
  lexicalResource: lr,
  grammaticalRangeAccuracy: gra,
  pronunciation: null,
  pronunciationNote: 'Pronunciation is not formally assessed in V1.',
});

const baseSpeakingFeedback = (overrides) => ({
  mode: 'practice',
  module: 'speaking',
  part: overrides.part,
  sessionKind: overrides.sessionKind || 'single_question',
  question: overrides.question,
  transcript: overrides.transcript,
  bandEstimateExcludingPronunciation: overrides.bandEstimateExcludingPronunciation ?? 6.5,
  bandEstimateRange: overrides.bandEstimateRange,
  estimateRationaleZh: '回答相关，但仍有可修的准确性和自然度问题。',
  scores: overrides.scores || speakingScores(),
  fatalErrors: overrides.fatalErrors || [],
  naturalnessHints: overrides.naturalnessHints || [],
  band9Refinements: [],
  preservedStyle: overrides.preservedStyle || [],
  upgradedAnswer: overrides.upgradedAnswer || '',
  reusableExample: null,
  part2Feedback: overrides.part2Feedback,
  part3Feedback: overrides.part3Feedback,
  threadId: overrides.threadId,
  threadAnswers: overrides.threadAnswers,
  threadFeedback: overrides.threadFeedback,
  obsidianMarkdown: '',
});

const legacyPart1Question = 'What is your favorite time of the day?';
const legacyPart1Transcript = 'I prefer morning. because I usually get up early. it makes me feel refreshed and energetic. I really enjoy morning time cause I could have a delicious breakfast and start jogging. when I finish these 2 things I feel accomplished and satisfied. this kind of morning makes me feel great at the rest of the day';

const legacyPart1Record = {
  id: 'history_p1_single',
  module: 'speaking',
  mode: 'practice',
  status: 'analyzed',
  part: 1,
  sessionKind: 'single_question',
  question: legacyPart1Question,
  questionId: 'fixture_p1_single',
  topic: 'daily routine',
  createdAt: now,
  updatedAt: now,
  analyzedAt: now,
  transcript: legacyPart1Transcript,
  transcriptOrigin: 'manual',
  transcriptSource: 'manual',
  feedback: baseSpeakingFeedback({
    part: 1,
    sessionKind: 'single_question',
    question: legacyPart1Question,
    transcript: legacyPart1Transcript,
    bandEstimateExcludingPronunciation: 0,
    scores: speakingScores(7, 7, 6.5),
    fatalErrors: [
      {
        original: 'I prefer morning',
        correction: 'I prefer the morning.',
        tag: 'article',
        explanationZh: '这里需要 the morning，开头回答会更自然完整。',
      },
      {
        original: 'I could have a delicious breakfast',
        correction: 'I can have a nice breakfast',
        tag: 'tense_modal',
        explanationZh: '日常习惯用 can / get to，不用 could have。',
      },
      {
        original: 'at the rest of the day',
        correction: 'for the rest of the day',
        tag: 'preposition',
        explanationZh: '固定表达是 for the rest of the day。',
      },
    ],
    naturalnessHints: [
      {
        original: 'start jogging',
        better: 'go for a jog',
        tag: 'spoken_collocation',
        explanationZh: '这里用 go for a jog 更像自然口语。',
      },
      {
        original: 'when I finish these 2 things',
        better: 'after breakfast and a jog',
        tag: 'spoken_reference',
        explanationZh: '把 these two things 说清楚，听感更自然。',
      },
    ],
    preservedStyle: [
      {
        text: 'get up early, breakfast, jogging, feel accomplished',
        reasonZh: '这是一个可复用的 morning routine 素材。',
        expansionZh: '下次可以直接用作偏好、日常、健康习惯类问题的细节。',
      },
    ],
    upgradedAnswer: 'My favorite time of the day is definitely the morning. I usually get up early, and I feel refreshed and energetic. I make myself a nice breakfast and then go for a jog. After breakfast and a jog, I feel accomplished, and it sets a positive tone for the rest of the day.',
  }),
};

const part1ThreadQuestions = [
  { id: 'p1_thread_q1', question: 'What is your favorite time of the day?', topic: 'Daily routine', provenance: 'active_bank_source' },
  { id: 'p1_thread_q2', question: 'What do you usually do in the morning?', topic: 'Daily routine', provenance: 'active_bank_source' },
  { id: 'p1_thread_q3', question: 'Do you prefer busy mornings or quiet mornings?', topic: 'Daily routine', provenance: 'product_supplement' },
];

const part1ThreadAnswers = [
  {
    questionId: 'p1_thread_q1',
    question: part1ThreadQuestions[0].question,
    transcript: 'I prefer morning because it makes me feel fresh.',
    transcriptOrigin: 'manual',
    transcriptSource: 'manual',
    lockedAt: now,
  },
  {
    questionId: 'p1_thread_q2',
    question: part1ThreadQuestions[1].question,
    transcript: 'I usually have breakfast and go jogging.',
    transcriptOrigin: 'manual',
    transcriptSource: 'manual',
    lockedAt: now,
  },
  {
    questionId: 'p1_thread_q3',
    question: part1ThreadQuestions[2].question,
    transcript: 'I prefer quiet mornings because I can think clearly.',
    transcriptOrigin: 'manual',
    transcriptSource: 'manual',
    lockedAt: now,
  },
];

const part1ThreadFeedback = {
  topic: 'Daily routine',
  threadId: 'p1_thread_daily_routine',
  questionCount: 3,
  mustFix: [],
  annotations: [
    {
      id: 'p1_ann_1',
      questionRef: 'Q1',
      sourceQuote: 'I prefer morning',
      combinedRepair: 'I prefer the morning',
      layers: [{
        severity: 'must_fix',
        issueType: 'article',
        original: 'I prefer morning',
        better: 'I prefer the morning',
        explanationZh: 'morning 作为具体时段需要 the。',
      }],
    },
  ],
  cleanRetryAnswers: [
    { questionRef: 'Q1', answer: 'My favorite time of day is the morning because it makes me feel fresh.' },
    { questionRef: 'Q2', answer: 'I usually have breakfast and go for a jog.' },
    { questionRef: 'Q3', answer: 'I prefer quiet mornings because I can think clearly before the day gets busy.' },
  ],
  cleanRetryCertificationStatus: 'certified_first_attempt',
  part1SessionPriorityState: 'development_needed',
  developmentStatus: 'needed',
  developmentTargets: [
    {
      questionRef: 'Q2',
      reasonZh: '这个回答可以再加一个真实细节。',
      developmentMoveZh: '补一个 breakfast 或 jogging 后的感受。',
      optionalDevelopedAnswer: 'After that, I feel ready for the day.',
    },
  ],
  threadLevelPatterns: [],
  answerByAnswerCoaching: [],
  highImpactPhraseFixes: [],
  materialBank: {
    myUsableMaterial: [{
      sourceWording: 'breakfast and jogging',
      reusableVersion: 'I usually start my morning with breakfast and a quick jog.',
      reuseFor: ['morning routine', 'healthy habits'],
      explanationZh: '可以迁移到 routine / healthy lifestyle 类 Part 1 问题。',
      materialCore: 'morning routine',
      materialKind: 'reusable_personal_material',
      developedExample: 'I usually start my morning with breakfast and a quick jog.',
      materialKey: 'morning_routine_breakfast_jog',
    }],
    reusableSpokenLanguage: [{
      sourceWording: 'feel fresh',
      reusableVersion: 'it sets a positive tone for the rest of the day',
      reuseFor: ['preference reasons', 'routine answers'],
      explanationZh: '用于解释为什么某个习惯让一天更顺。',
      materialKey: 'sets_positive_tone',
    }],
  },
  optionalPolish: [],
  nextRetryFocusZh: '补充一个真实细节，同时保持 Part 1 简短自然。',
};

const part1ThreadRecord = {
  id: 'history_p1_thread',
  module: 'speaking',
  mode: 'practice',
  status: 'analyzed',
  part: 1,
  sessionKind: 'part1_topic_thread',
  topic: 'Daily routine',
  topicId: 'daily_routine',
  threadId: 'p1_thread_daily_routine',
  threadQuestions: part1ThreadQuestions,
  threadAnswers: part1ThreadAnswers,
  activeThreadIndex: 2,
  threadCompleted: true,
  question: part1ThreadQuestions[2].question,
  questionId: part1ThreadQuestions[2].id,
  createdAt: now,
  updatedAt: now,
  analyzedAt: now,
  transcript: part1ThreadAnswers.map(answer => answer.transcript).join('\n'),
  transcriptOrigin: 'manual',
  transcriptSource: 'manual',
  feedback: baseSpeakingFeedback({
    part: 1,
    sessionKind: 'part1_topic_thread',
    question: part1ThreadQuestions[2].question,
    transcript: part1ThreadAnswers.map(answer => answer.transcript).join('\n'),
    bandEstimateExcludingPronunciation: 6.5,
    bandEstimateRange: { lower: 6.5, upper: 7.0, rationaleZh: '边界区间。' },
    threadId: 'p1_thread_daily_routine',
    threadAnswers: part1ThreadAnswers.map(answer => ({
      questionId: answer.questionId,
      question: answer.question,
      answer: answer.transcript,
    })),
    threadFeedback: part1ThreadFeedback,
  }),
};

const part2Question = 'Describe a famous person you admire.';
const part2Transcript = 'I want to talk about LeBron James. He is a famous basketball player and I watched him for many years. I first noticed him when I was in school, because my classmates often talked about his matches. What impressed me most is that he works very hard, keeps improving his body, and also helps young players. He gives me motivation when I feel lazy, so I think he is a good example of discipline.';

const part2Signals = ['idiomatic_expression', 'tense', 'connector', 'phrasal_verb', 'collocation', 'clause']
  .map(signal => ({
    signal,
    status: signal === 'idiomatic_expression' ? 'missing' : 'thin',
    requirementZh: '用一个自然可复用的口语信号。',
    foundInTranscript: false,
    evidence: '',
    evidenceQuotes: [],
    qualityZh: '当前信号还偏弱。',
    nextMoveZh: '补一个自然表达，不要变成作文腔。',
    bestUpgrade: signal === 'phrasal_verb' ? 'look up to' : `fixture ${signal.replaceAll('_', ' ')}`,
    alternatives: [],
    alternativeUpgrades: [],
    insertLocationZh: '放在人物评价句后。',
    sampleUpgrade: signal === 'phrasal_verb'
      ? 'I really look up to him because he has stayed disciplined for years.'
      : `This sentence uses fixture ${signal.replaceAll('_', ' ')} naturally.`,
    sampleUpgradeHighlight: signal === 'phrasal_verb' ? 'look up to' : `fixture ${signal.replaceAll('_', ' ')}`,
    sampleUpgrades: [],
    usedInNextVersionQuote: signal === 'phrasal_verb' ? 'look up to' : '',
    profileSignalZh: '',
  }));

const part2Record = {
  id: 'history_p2_story',
  module: 'speaking',
  mode: 'practice',
  status: 'analyzed',
  part: 2,
  sessionKind: 'single_question',
  question: part2Question,
  questionId: 'fixture_p2',
  topic: 'famous person',
  createdAt: now,
  updatedAt: now,
  analyzedAt: now,
  transcript: part2Transcript,
  transcriptOrigin: 'manual',
  transcriptSource: 'manual',
  feedback: baseSpeakingFeedback({
    part: 2,
    sessionKind: 'single_question',
    question: part2Question,
    transcript: part2Transcript,
    bandEstimateExcludingPronunciation: 6.5,
    fatalErrors: [],
    naturalnessHints: [{
      original: 'I watched him for many years',
      better: 'I have followed his career for years',
      tag: 'tense',
      explanationZh: '持续到现在的经历用现在完成时更自然。',
    }],
    upgradedAnswer: 'I want to talk about LeBron James. I have followed his career for years, and I really look up to him because he has stayed disciplined for such a long time. What impresses me most is that he keeps improving himself while also supporting younger players, so he feels like a strong example of long-term discipline.',
    part2Feedback: {
      materialType: 'person',
      materialTypeRationaleZh: '这是人物素材。',
      annotations: [{
        id: 'p2_ann_1',
        questionRef: 'PART 2',
        sourceQuote: 'I watched him for many years',
        combinedRepair: 'I have followed his career for years',
        layers: [{
          severity: 'must_fix',
          issueType: 'tense',
          original: 'I watched him for many years',
          better: 'I have followed his career for years',
          explanationZh: '持续经历用现在完成时。',
        }],
      }],
      storyModules: [{
        role: 'what_who_where',
        status: 'present',
        sourceWording: 'LeBron James',
        improvedVersion: 'a basketball player I have followed for years',
        coachingZh: '人物定位清楚。',
      }],
      languageSignals: part2Signals,
      priorityFocusZh: '把人物素材整理成可讲的故事线。',
      nextSpeakableVersion: 'I want to talk about LeBron James, a basketball player I have followed for years. I first noticed him when I was in school, and I really look up to him because he has stayed disciplined for such a long time. What impresses me most is that he keeps improving himself while also supporting younger players, so he feels like a strong example of long-term discipline.',
      nextSpeakableVersionHighlights: [{
        quote: 'look up to',
        signal: 'phrasal_verb',
        labelZh: '自然表达',
        whyItWorksZh: '可以表达 admire。',
      }],
    },
  }),
};

const part3Questions = [
  { id: 'p3_q1', question: 'Why do some people admire athletes?', topic: 'Famous people', discussionFrame: 'cause_reason', provenance: 'active_bank_source', bankGroupId: 'p3_fixture' },
  { id: 'p3_q2', question: 'Do celebrities influence young people?', topic: 'Famous people', discussionFrame: 'evaluation_stance', provenance: 'active_bank_source', bankGroupId: 'p3_fixture' },
  { id: 'p3_q3', question: 'How has fame changed because of social media?', topic: 'Famous people', discussionFrame: 'change_trend', provenance: 'active_bank_source', bankGroupId: 'p3_fixture' },
];

const part3Answers = part3Questions.map((question, index) => ({
  questionId: question.id,
  question: question.question,
  transcript: [
    'I think people admire athletes because they show discipline and success.',
    'Yes, celebrities can influence young people because they copy their lifestyle.',
    'Social media makes fame faster and more unstable than before.',
  ][index],
  transcriptOrigin: 'manual',
  transcriptSource: 'manual',
  lockedAt: now,
}));

const part3Record = {
  id: 'history_p3_discussion',
  module: 'speaking',
  mode: 'practice',
  status: 'analyzed',
  part: 3,
  sessionKind: 'part3_discussion_thread',
  question: part3Questions[2].question,
  questionId: part3Questions[2].id,
  topic: 'Famous people',
  topicId: 'famous_people',
  threadId: 'p3_discussion_famous_people',
  threadQuestions: part3Questions,
  threadAnswers: part3Answers,
  activeThreadIndex: 2,
  threadCompleted: true,
  createdAt: now,
  updatedAt: now,
  analyzedAt: now,
  transcript: part3Answers.map(answer => answer.transcript).join('\n'),
  transcriptOrigin: 'manual',
  transcriptSource: 'manual',
  feedback: baseSpeakingFeedback({
    part: 3,
    sessionKind: 'part3_discussion_thread',
    question: part3Questions[2].question,
    transcript: part3Answers.map(answer => answer.transcript).join('\n'),
    bandEstimateExcludingPronunciation: 6.5,
    threadId: 'p3_discussion_famous_people',
    threadAnswers: part3Answers.map(answer => ({
      questionId: answer.questionId,
      question: answer.question,
      answer: answer.transcript,
    })),
    part3Feedback: {
      threadId: 'p3_discussion_famous_people',
      answers: part3Answers.map((answer, index) => ({
        questionRef: `Q${index + 1}`,
        question: answer.question,
        answer: answer.transcript,
        questionFrame: part3Questions[index].discussionFrame,
        questionFrameLabelZh: '问题框架',
        questionFrameGuidanceZh: '先判断问题要求，再展开理由。',
        feedbackMode: 'reasoning_upgrade',
        ctChain: {
          claim: 'A clear claim',
          reason: 'A reason',
          exampleOrEvidence: 'An example',
          contrastOrCondition: '',
          consequence: 'A consequence',
          missingLinkZh: '理由还可以更具体。',
          nextMoveZh: '补一个现实场景。',
          bestUpgrade: 'This matters because...',
          alternatives: [],
          insertLocationZh: '放在观点后。',
        },
        thinkingDiagnosis: {
          questionThinkingZh: '这题先回答原因，再给现实例子。',
          retainedIdeaZh: '保留 discipline / influence 的思路。',
          upgradeRuleZh: '把个人感受扩展到人群和现实原因。',
          reusableFrameZh: '可迁移到其他社会话题。',
          reusableFrame: 'Many people admire X because it shows Y in real life.',
          bestNextMoveZh: '补一个现实原因。',
        },
        microUpgrade: {
          upgradedLine: 'Many young people copy celebrities because they see them as a shortcut to status.',
          focusZh: '把影响说成具体机制。',
        },
        targetAnswer: 'Many people admire athletes because they represent discipline in a visible way. When young people see that effort leading to success, it can feel more convincing than ordinary advice.',
        targetAnswerHighlights: [{
          quote: 'represent discipline in a visible way',
          type: 'reasoning_upgrade',
          labelZh: '原因表达',
        }],
      })),
      topicLanguage: [{
        title: 'fame and influence',
        items: [
          { expression: 'public influence', meaningZh: '公众影响力' },
          { expression: 'a role model', meaningZh: '榜样' },
        ],
      }],
      sessionPriorityZh: '优先把个人观点泛化到人群和社会场景。',
    },
  }),
};

const writingTask2Question = 'Some people think children should learn to cook at school. To what extent do you agree or disagree?';
const writingTask2Essay = 'I agree that children should learn to cook at school. It can help them become more independent and understand healthy food. Schools can teach basic cooking safely.';

const writingTask2Record = {
  id: 'history_writing_t2',
  module: 'writing',
  mode: 'practice',
  status: 'analyzed',
  task: 'task2',
  question: writingTask2Question,
  questionId: 'fixture_wt2',
  topic: 'education',
  tags: ['education'],
  taskType: 'opinion',
  createdAt: now,
  updatedAt: now,
  analyzedAt: now,
  phase: 'results',
  frameworkChat: [],
  frameworkInput: '',
  finalFrameworkSummary: 'Agree: independence and healthy habits.',
  frameworkSummaryGenerated: true,
  essay: writingTask2Essay,
  feedback: {
    mode: 'practice',
    module: 'writing',
    task: 'task2',
    question: writingTask2Question,
    essay: writingTask2Essay,
    scores: {
      taskResponse: 6.5,
      coherenceCohesion: 6.5,
      lexicalResource: 6.5,
      grammaticalRangeAccuracy: 6.0,
    },
    frameworkFeedback: [{
      issue: 'Body support is still thin',
      suggestionZh: '每个主体段需要更具体的解释和例子。',
      severity: 'medium',
      location: 'Body Paragraph 1',
      paragraphFixZh: '补一个学校厨房或健康饮食的例子。',
      transferGuidanceZh: '下次每段至少给一个具体场景。',
    }],
    essayLevelWarnings: [],
    sentenceFeedback: [{
      id: 'C1',
      correctionNumber: 1,
      paragraph: 'Body Paragraph 1',
      sourceQuote: 'It can help them become more independent',
      original: 'It can help them become more independent',
      correction: 'It can help them become more independent in daily life',
      dimension: 'TR',
      tag: 'development',
      explanationZh: '补出 daily life 后，论点更具体。',
      severity: 'medium',
      microUpgrades: [],
    }],
    vocabularyUpgrade: {
      topicVocabulary: [{
        original: 'healthy food',
        better: 'healthy eating habits',
        explanationZh: '更像 Task 2 主题表达。',
      }],
      expressionUpgrades: [{
        original: 'learn to cook',
        better: 'develop basic cooking skills',
        explanationZh: '更适合议论文表达。',
        category: 'from_essay',
      }],
    },
    modelAnswer: 'Schools should help children develop basic cooking skills because it supports independence and healthier eating habits.',
    modelAnswerAnnotations: [{
      quote: 'develop basic cooking skills',
      type: 'expression_upgrade',
      labelZh: '表达升级',
    }],
    modelAnswerPersonalized: true,
    modelAnswerTargetLevel: 'Band 7 target',
    reusableArguments: [],
    obsidianMarkdown: '',
  },
};

const writingTask1Instruction = 'The chart below shows the percentage of households using three types of transport in one city.';
const writingTask1Report = 'The chart shows that car use was the highest, while cycling was lower. Bus use changed slightly over the period.';

const writingTask1Record = {
  id: 'history_writing_t1',
  module: 'writing_task1',
  mode: 'practice',
  status: 'analyzed',
  task: 'task1',
  question: writingTask1Instruction,
  questionId: 'fixture_wt1',
  topic: 'transport chart',
  tags: ['chart'],
  taskType: 'line_chart',
  prompt: writingTask1Instruction,
  instruction: writingTask1Instruction,
  visualBrief: 'Line chart fixture.',
  dataSummary: ['Cars highest', 'Cycling lower', 'Bus slight change'],
  quickPlan: {
    overview: 'Cars remain highest.',
    keyFeatures: 'Cars highest; cycling lowest.',
    comparisons: 'Compare car and cycling.',
    paragraphPlan: 'Overview, detail one, detail two.',
  },
  createdAt: now,
  updatedAt: now,
  analyzedAt: now,
  report: writingTask1Report,
  feedback: {
    mode: 'practice',
    module: 'writing_task1',
    task: 'task1',
    taskType: 'line_chart',
    instruction: writingTask1Instruction,
    visualBrief: 'Line chart fixture.',
    report: writingTask1Report,
    estimatedBand: 6.5,
    taskAchievement: {
      score: 6.5,
      feedback: 'Overview is present but could be sharper.',
    },
    overviewFeedback: 'Overview identifies the main trend.',
    keyFeaturesFeedback: 'Key figures need more detail.',
    comparisonFeedback: 'Comparisons are basic but clear.',
    dataAccuracyFeedback: 'No obvious data contradiction in fixture.',
    coherenceFeedback: 'Organisation is readable.',
    languageCorrections: [{
      original: 'changed slightly',
      correction: 'changed only slightly',
      explanation: 'A small emphasis improves precision.',
    }],
    mustFix: ['Add more precise data references.'],
    rewriteTask: 'Rewrite with two clearer comparisons.',
    reusableReportPatterns: ['A was consistently higher than B.'],
    improvedReport: 'Overall, car use remained the most common form of transport, while cycling was consistently lower.',
    modelExcerpt: 'Overall, car use remained the dominant form of transport.',
    targetState: 'generated_target',
    obsidianMarkdown: '',
  },
};

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });

  await runWithRecords(browser, [legacyPart1Record], legacyPart1Question, async (page) => {
    await expectText(page, 'PART 1 · SINGLE ANSWER REVIEW');
    await expectText(page, 'ANNOTATED ANSWER');
    await expectText(page, '可积累素材');
    await expectText(page, '可积累表达');
    await expectNoText(page, 'LANGUAGE PERFORMANCE');
    await expectNoText(page, 'MUST FIX');
    await expectNoText(page, 'could not be anchored');
    const marks = await page.locator('.part1-answer-mark').count();
    if (marks < 3) throw new Error(`Expected at least 3 anchored Part 1 single annotations, saw ${marks}`);
    const estimateText = await estimateBlockText(page);
    if (!/IDEAL-DELIVERY ESTIMATE\s+-$/.test(estimateText.trim())) {
      throw new Error(`Expected missing headline estimate to display "-", saw: ${estimateText}`);
    }
  });

  await runWithRecords(browser, [part1ThreadRecord], 'Daily routine', async (page) => {
    await expectText(page, 'PART 1 · TOPIC THREAD');
    await expectText(page, 'ANNOTATED ANSWERS');
    await expectText(page, 'MATERIAL DEVELOPMENT');
    await expectText(page, '可积累素材');
    await expectText(page, '可积累表达');
    await expectNoText(page, 'PART 1 · SINGLE ANSWER REVIEW');
    await expectNoText(page, 'could not be anchored');
  });

  await runWithRecords(browser, [part2Record], part2Question, async (page) => {
    await expectText(page, 'PART 2 STORY TRAINER');
    await expectText(page, 'Six language signals');
    await expectText(page, 'NEXT SPEAKABLE VERSION');
    await expectNoText(page, 'could not be anchored');
  });

  await runWithRecords(browser, [part3Record], 'How has fame changed because of social media?', async (page) => {
    await expectText(page, 'PART 3 DISCUSSION ANSWERS');
    await expectText(page, 'THINKING DIAGNOSIS');
    await expectText(page, 'THREE NEXT SPEAKABLE ANSWERS');
    await expectNoText(page, 'could not be anchored');
  });

  await runWithRecords(browser, [writingTask2Record], writingTask2Question, async (page) => {
    await expectText(page, 'My Essay');
    await expectText(page, 'Training estimate');
    await expectText(page, 'develop basic cooking skills');
  });

  await runWithRecords(browser, [writingTask1Record], writingTask1Instruction, async (page) => {
    await expectText(page, 'My Report');
    await expectText(page, writingTask1Instruction);
    await expectBodyPattern(page, /Training\s+Estimate/i);
    await expectText(page, 'Diagnosis of My Report');
  });

  await browser.close();
  console.log('verify:history-restore-ui passed');
} finally {
  stopServer();
}
