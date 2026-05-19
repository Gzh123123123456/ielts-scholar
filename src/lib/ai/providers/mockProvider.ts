import { AIProvider } from './base';
import {
  SpeakingFeedback,
  SpeakingTargetValidationResult,
  WritingFeedback,
  WritingFrameworkCoachFeedback,
  WritingFrameworkReadiness,
  WritingFrameworkSummary,
  WritingTargetValidationResult,
  WritingTask1Feedback,
} from '../schemas';
import { getTargetLabel } from '../../bands';

const firstNonEmptyLine = (text: string, fallback: string): string => {
  const line = text
    .split(/\r?\n/)
    .map(item => item.trim())
    .find(Boolean);

  return line || fallback;
};

const shorten = (text: string, maxLength = 180): string => {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 3)}...` : cleaned;
};

const countWords = (text: string): number =>
  text.trim().split(/\s+/).filter(Boolean).length;

export class MockProvider implements AIProvider {
  async analyzeSpeaking(params: {
    part: number;
    question: string;
    transcript: string;
    targetRepairFocus?: string;
    targetAttempt?: number;
    priorTargetAnswer?: string;
  }): Promise<SpeakingFeedback> {
    await new Promise(r => setTimeout(r, 1500));
    const transcriptWords = params.transcript.trim().split(/\s+/).filter(Boolean).length;
    const looksHighBand = transcriptWords >= (params.part === 2 ? 170 : params.part === 3 ? 95 : 45)
      && /\b(because|although|for example|for instance|which means|as a result|on the other hand|it depends|what matters is|the reason is)\b/i.test(params.transcript);
    const looksStrong = transcriptWords >= (params.part === 2 ? 140 : params.part === 3 ? 75 : 35)
      && /\b(because|although|for example|for instance|which means|as a result|on the other hand)\b/i.test(params.transcript);
    const conservativeEstimate = looksHighBand
      ? 8.0
      : looksStrong
      ? 7.0
      : params.part === 3
        ? 5.5
        : transcriptWords < 20
          ? 5.0
          : 6.0;
    const targetFloor = conservativeEstimate >= 7 ? 8 : 7;
    const targetAnswerLayer = conservativeEstimate >= 8
      ? 'high_band_stability'
      : conservativeEstimate >= 7
        ? 'band_8_plus'
        : 'band_7_to_7_5';
    const demoBorderlineTarget = conservativeEstimate >= 7 && conservativeEstimate < 8 && params.part === 3;
    const targetAnswerStatus = demoBorderlineTarget ? 'borderline' : 'meets_target';
    const targetSelfScore = demoBorderlineTarget ? 7.5 : conservativeEstimate >= 7 ? 8.0 : 7.0;
    const hasGrammarDemoError = /\bI likes\b/i.test(params.transcript);
    return {
      mode: 'practice',
      module: 'speaking',
      part: params.part as any,
      question: params.question,
      transcript: params.transcript,
      bandEstimateExcludingPronunciation: conservativeEstimate,
      estimateRationaleZh: conservativeEstimate >= 7
        ? '可见语言维度已经接近 7.0：有清楚延展、例子或因果关系；发音未评估。'
        : '当前回答仍按单题训练样本保守估计：内容延展、自然口语节奏或 Part 适配还不稳定；发音未评估。',
      targetBandFloor: targetFloor,
      targetLayer: conservativeEstimate >= 8
        ? '高分稳定检查'
        : conservativeEstimate >= 7 ? 'Band 8+ Examiner-Friendly Answer' : 'Band 7.0+ Target Answer',
      targetValidationZh: demoBorderlineTarget
        ? '这版目标答案还没有稳定达到目标层级，需要继续强化推理链和例子。'
        : conservativeEstimate >= 8
        ? '目标层级已达到。下一步重点是自然输出、时间控制和迁移练习。'
        : conservativeEstimate >= 7
        ? '升级答案需要明显加强逻辑、例子和自然口语表达，而不是只换高级词。'
        : '目标答案需要稳定达到 7.0-7.5 层级，不能只是轻微润色。',
      targetUpgradeFocusZh: params.part === 1
        ? 'Part 1: compact, natural, specific.'
        : params.part === 2
          ? 'Part 2: story spine with setting, scene, action, change, feeling, and meaning.'
          : 'Part 3: claim, contrast or condition, example, and consequence in spoken style.',
      targetAnswerFloor: targetFloor,
      targetAnswerLayer,
      targetAnswerStatus,
      targetAnswerSelfScores: {
        fluencyCoherence: targetSelfScore,
        lexicalResource: targetSelfScore,
        grammaticalRangeAccuracy: targetSelfScore,
        pronunciation: null,
      },
      targetAnswerRationaleZh: demoBorderlineTarget
        ? 'Mock demo: this Part 3 target is intentionally marked borderline because its reasoning depth is still closer to 7.5 than 8.0.'
        : conservativeEstimate >= 8
        ? '当前答案本身已经达到高分层；mock 不再制造更高替换答案。'
        : 'Mock target answer includes a self-check score at or above the target floor.',
      targetAnswerRepairFocusZh: demoBorderlineTarget
        ? 'Part 3 需要更清楚的 condition/contrast、例子和 consequence，不能只补一句泛泛影响。'
        : '',
      highBandStabilityZh: conservativeEstimate >= 8
        ? '保持自然、清晰和限时稳定；不要为了显得更高级而拉长或书面化。'
        : '',
      nextStepZh: conservativeEstimate >= 8
        ? '换一道相近题复述同一素材，检查是否还能稳定输出。'
        : '重新朗读目标答案，再用自己的细节替换其中的示例。',
      scoreConsistencyNoteZh: '',
      scores: {
        fluencyCoherence: conservativeEstimate,
        lexicalResource: Math.min(conservativeEstimate + 0.5, 7.0),
        grammaticalRangeAccuracy: conservativeEstimate,
        pronunciation: null,
        pronunciationNote: 'Not formally assessed in V1; this is a single-question training estimate only.',
      },
      fatalErrors: hasGrammarDemoError ? [
        {
          original: 'I likes to play football',
          correction: 'I like to play football',
          tag: 'grammar',
          explanationZh: '主谓一致错误。I 是第一人称，动词不需要加 -s。',
        },
      ] : [],
      naturalnessHints: conservativeEstimate >= 8 ? [] : [
        {
          original: 'It is very good',
          better: "It's absolutely fantastic",
          tag: 'word_choice',
          explanationZh: '可以使用更自然的副词和形容词搭配，让口语表达更生动。',
        },
      ],
      band9Refinements: conservativeEstimate >= 8 ? [
        {
          observation: 'The answer is already strong enough for the target layer.',
          refinement: 'Keep the same natural rhythm and practise transferring it to a nearby question.',
          explanationZh: '这不是错误修改；只是高分稳定练习，重点是自然、限时和迁移。',
        },
      ] : [
        {
          observation: 'The answer is clear, but it could sound more spontaneous.',
          refinement: conservativeEstimate >= 7
            ? "cities are trying to become more liveable / this probably leads to / a good example would be"
            : "I usually... / it helps me... / one small example is...",
          explanationZh: 'Band 7.0+ 口语不只是更复杂，也要像真实交流。Part 1 尤其适合简短、自然、带一点个人细节的回答。',
        },
      ],
      preservedStyle: [
        {
          text: 'I used to be a shy boy',
          expansionZh: params.part === 1
            ? 'Add one real classroom or social detail, then one short feeling/reason. Keep it to 2-3 sentences.'
            : params.part === 2
              ? 'Build it into a story spine: when this happened, what you did, what changed, how you felt, and why it mattered.'
              : 'Turn the personal change into an abstract point: confidence depends on context, support, and repeated practice.',
          sampleNextStep: params.part === 3
            ? 'For example, shy people may become more confident when the environment feels supportive.'
            : 'For example, I used to avoid speaking in class, but now I feel more comfortable sharing small opinions.',
          transferQuestions: params.part === 1
            ? ['Were you confident when you were a child?', 'Do you like meeting new people?']
            : params.part === 2
              ? ['Describe a time when you changed.', 'Describe a person who helped you.']
              : ['Why do some people become more confident with age?', 'How can schools help shy students?'],
          partUseZh: params.part === 1
            ? 'Part 1: keep it short and personal.'
            : params.part === 2
              ? 'Part 2: stretch it into a believable story with scene and feeling.'
              : 'Part 3: use it as an example, then explain the wider reason or consequence.',
          riskNoteZh: params.part === 1
            ? 'Risk: do not turn this into a long Part 2 story.'
            : params.part === 2
              ? 'Risk: do not only say you changed; show the scene and the turning point.'
              : 'Risk: do not stay at personal story level; generalize the point.',
          reasonZh: '保留了个人成长故事，这在 Part 1 中很真实。',
        },
      ],
      upgradedAnswer: conservativeEstimate >= 8
        ? params.transcript
        : params.targetRepairFocus && conservativeEstimate >= 7
          ? (params.part === 1
              ? "Yes, definitely. I usually read short essays or fiction after a busy day, especially on the subway home. It gives me a quiet reset, and I can talk about one idea from the book with my friends later."
              : params.part === 2
                ? `One activity I remember clearly is vibe coding, basically using AI tools to build apps through natural-language prompts. I tried it one evening in my room after getting stuck on a small project. At first I only had a rough idea, but the turning point came when I described the feature in plain English and then tested each version like a real user. The specific scene I remember is watching a broken page finally work after several failed prompts. I felt a mix of relief and excitement because it changed coding from something distant into something I could actually explore. That is why it mattered to me: it gave me confidence and a practical way to turn ideas into small products.`
                : "I'd say the biggest change is that cities are trying to become more liveable, although the results are uneven. For example, in some districts, old industrial land has been turned into housing with metro links and parks, so daily life is less dependent on cars. The turning point is not just urban expansion; it is whether planning reduces stress for ordinary residents. If transport, housing and public space improve together, the city becomes denser but also easier to live in.")
        : conservativeEstimate >= 7
        ? (params.part === 1
            ? "Yes, definitely. I tend to read short essays or fiction when I want to slow down a bit, especially after a busy day. It is not a huge hobby, but it gives me a quiet way to reset."
            : params.part === 2
              ? "One routine I genuinely enjoy is having a slow but active morning when my schedule allows it. I usually make a simple breakfast, go for a short jog, and then sit down to work while my mind still feels clear. What I like is the sense of control it gives me: the day starts with something healthy rather than a rush of messages and deadlines. It is a small routine, but it makes the rest of the day feel more balanced and manageable."
              : "I'd say the biggest change is that cities have become denser, but also more aware of liveability. In many places, rural edges have turned into residential districts because of population growth and housing demand. At the same time, local governments are adding parks and improving public transport, partly because people are more concerned about health, commuting pressure and car dependence. So the change is not simply that cities are getting bigger; they are also trying, with mixed success, to become easier places to live in.")
        : params.part === 1
          ? "Yes, I do. I usually read short novels or articles when I want to relax. It helps me slow down after a busy day, and it gives me something interesting to think about."
          : params.part === 2
            ? "One daily routine I really enjoy is having a slow but active morning. If I don't have an early class or meeting, I like to wake up naturally, make a simple breakfast, and then go for a short jog or do some light exercise. After that, I usually feel much more awake, so I can sit down and focus on work or study without feeling rushed. In the evening, I might play PC games with my roommates or call my family for a while. I like this routine because it gives me a balance between activity, productivity, and connection with people I care about."
            : "I'd say cities have become much larger and more convenient in recent years. In many places, areas that used to feel quite rural have turned into residential districts with apartments, shops, and better public services. A good example would be public transport, because buses and metro lines now connect places that were hard to reach before. At the same time, many cities have added more parks and green spaces, so they are not just bigger and busier. I think the main result is that modern cities can feel more liveable, although they also need careful planning to avoid overcrowding.",
      reusableExample: {
        example: 'The rapid transformation of my city',
        canBeReusedFor: params.part === 1
          ? ['What kind of books do you usually read?', 'Did you enjoy reading when you were a child?', 'Do you prefer paper books or e-books?']
          : params.part === 2
            ? ['Describe a daily routine you enjoy.', 'Describe something you do to relax.', 'Describe a productive day you had.']
            : ['How have cities changed in recent years?', 'What changes make a city more liveable?', 'How has public transport changed people\'s lives?'],
        explanationZh: '这个短语可以用来描述城市变化或发展类话题。',
      },
      obsidianMarkdown: '',
    };
  }

  async validateSpeakingTarget(params: {
    part: number;
    question: string;
    candidateTargetAnswer: string;
    targetFloor: number;
    originalCurrentScore?: number;
    targetLayer?: string;
  }): Promise<SpeakingTargetValidationResult> {
    await new Promise(r => setTimeout(r, 450));
    const answer = params.candidateTargetAnswer.toLowerCase();
    const passesBand8 = params.targetFloor < 8 ||
      /turning point|specific scene|less dependent on cars|quiet reset|natural-language prompts/.test(answer);
    const score = passesBand8 ? params.targetFloor : Math.max(7, params.targetFloor - 0.5);

    return {
      module: 'speaking',
      operation: 'speaking_target_validation',
      targetFloor: params.targetFloor,
      status: passesBand8 ? 'meets_target' : 'borderline',
      scores: {
        fluencyCoherence: score,
        lexicalResource: score,
        grammaticalRangeAccuracy: score,
        pronunciation: null,
      },
      rationaleZh: passesBand8
        ? 'Mock independent validator: target answer now reaches the required floor.'
        : 'Mock independent validator: this target is still closer to 7.5 than stable 8.0.',
      repairFocusZh: passesBand8
        ? ''
        : '这版目标答案还没有稳定达到目标层级，需要继续强化。请加入更清楚的场景、转折、例子和结果，而不是只换词。',
    };
  }

  async analyzeWriting(params: {
    task: string;
    question: string;
    essay: string;
    frameworkNotes?: string;
    finalFrameworkSummary?: string;
    targetRepairFocus?: string;
    targetAttempt?: number;
    priorTargetAnswer?: string;
  }): Promise<WritingFeedback> {
    await new Promise(r => setTimeout(r, 2000));
    const words = countWords(params.essay);
    const isExtremelyShort = words <= 20;
    const isUnderLength = words < 250;
    const looksTask2HighBand = words >= 320 &&
      /\b(however|although|provided that|for example|for instance|therefore|as a result)\b/i.test(params.essay);
    const looksTask2Band7 = words >= 260 &&
      /\b(however|although|for example|for instance|because|therefore)\b/i.test(params.essay);
    const scores = isExtremelyShort
      ? {
        taskResponse: 3.0,
        coherenceCohesion: 3.0,
        lexicalResource: 3.5,
        grammaticalRangeAccuracy: 3.5,
      }
      : isUnderLength
        ? {
          taskResponse: 5.0,
          coherenceCohesion: 5.0,
          lexicalResource: 5.0,
          grammaticalRangeAccuracy: 5.0,
        }
        : looksTask2HighBand
          ? {
            taskResponse: 8.0,
            coherenceCohesion: 8.0,
            lexicalResource: 8.0,
            grammaticalRangeAccuracy: 8.0,
          }
          : looksTask2Band7
            ? {
              taskResponse: 7.0,
              coherenceCohesion: 7.0,
              lexicalResource: 7.0,
              grammaticalRangeAccuracy: 7.0,
            }
            : {
              taskResponse: 6.5,
              coherenceCohesion: 6.5,
              lexicalResource: 6.5,
              grammaticalRangeAccuracy: 6.5,
            };
    const averageScore = (scores.taskResponse + scores.coherenceCohesion + scores.lexicalResource + scores.grammaticalRangeAccuracy) / 4;
    const targetFloor = averageScore >= 7 ? 8 : 7;
    const targetAnswerLayer = averageScore >= 8
      ? 'high_band_stability'
      : averageScore >= 7
        ? 'band_8_plus'
        : 'band_7_to_7_5';
    const targetSelfScore = averageScore >= 7 ? 8.0 : 7.0;
    const lengthNote = isExtremelyShort
      ? '样本太短，无法形成可靠 Task 2 估计。先扩展到完整四段结构，再看论证和语言问题。'
      : isUnderLength
        ? '文章低于 250 词，训练估计会保守处理。请补足论点展开、例子和结论。'
        : '结构基本完整；下一步重点检查立场、段落推进和例证质量。';
    // Mock/demo fixture only: production topic vocabulary must come from real provider output,
    // not from UI or safety-layer keyword rules.
    const isRemoteWorkPrompt = /work from home|remote work|travelling to an office|traveling to an office/i.test(params.question);

    return {
      mode: 'practice',
      module: 'writing',
      task: params.task as any,
      question: params.question,
      essay: params.essay,
      scores,
      estimateRationaleZh: isUnderLength
        ? '文章长度不足，当前估计按训练保守值处理。'
        : '当前估计主要受任务回应深度、段落推进、词汇精确度和句子控制限制。',
      targetBandFloor: targetFloor,
      targetLayer: averageScore >= 8 ? '高分稳定检查' : getTargetLabel(averageScore, 'modelAnswer'),
      targetValidationZh: averageScore >= 8
        ? '目标层级已达到。下一步重点是限时稳定、复盘表达和迁移到新题。'
        : isUnderLength
        ? '目标范文会补足完整任务回应和段落发展；原文长度不足的材料不会被机械保留。'
        : '目标范文必须直接修复 Logic Review 和句子反馈指出的问题，不能只是更正式。',
      targetUpgradeFocusZh: isRemoteWorkPrompt
        ? '补足让步段，解释缺点为什么存在、如何缓解、为什么不压过优点。'
        : '把兴趣与职业现实连接起来，增强任务回应和段落功能。',
      targetAnswerFloor: targetFloor,
      targetAnswerLayer,
      targetAnswerStatus: 'meets_target',
      targetAnswerSelfScores: {
        taskResponse: targetSelfScore,
        coherenceCohesion: targetSelfScore,
        lexicalResource: targetSelfScore,
        grammaticalRangeAccuracy: targetSelfScore,
      },
      targetAnswerRationaleZh: averageScore >= 8
        ? '当前作文本身已经进入高分稳定层；mock 不再制造更高替换范文。'
        : 'Mock model answer is self-checked at or above the target floor.',
      targetAnswerRepairFocusZh: '',
      highBandStabilityZh: averageScore >= 8
        ? '保持立场清晰、段落功能稳定、限时完成和新题迁移。'
        : '',
      nextStepZh: averageScore >= 8
        ? '保存这版结构，换一道同类型题限时迁移。'
        : '对照目标范文重写一次，重点检查段落推进和例子具体性。',
      scoreConsistencyNoteZh: 'Mock feedback includes a blocker for every sub-7 dimension so the visible score and diagnosis agree.',
      essayLevelWarnings: isUnderLength
        ? [{
            title: 'Essay development warning',
            messageZh: lengthNote,
          }]
        : [],
      frameworkFeedback: [
        {
          issue: isRemoteWorkPrompt ? 'Disadvantages need a clearer paragraph role' : 'Framework needs sharper development',
          suggestionZh: isUnderLength
            ? '字数和段落展开不足时，考官很难看到完整立场、论证链和例证，因此 Task Response 和 Coherence 都会被保守评估。'
            : isRemoteWorkPrompt
              ? 'outweigh 类题目不能只写远程办公的好处；如果缺点没有被认真处理，考官会觉得任务回应不完整。'
              : '主体段如果只停留在判断句，缺少原因和例子，Task Response 会显得论证不充分，Coherence 也会缺少推进感。',
          severity: isUnderLength ? 'fatal' : 'naturalness',
          location: 'Whole Essay',
          issueType: 'paragraph_development',
          relatedCorrectionIds: ['C1'],
          paragraphFixZh: isRemoteWorkPrompt
            ? 'BP1 可以保留 flexible working arrangements、commuting time 和 widen the recruitment pool 这些优势。BP2 要先承认一个缺点，例如 face-to-face communication 变少、team cohesion 下降或 blurred work-life boundaries，然后解释这些问题可以通过固定会议和清晰管理来缓解，所以不超过主要优势。'
            : '这次先把每个主体段改成“主题句 -> 原因 -> 具体例子 -> 回扣立场”。如果 Phase 1 框架里已经有例子，但正文没有写出来，就把例子补进对应主体段，而不是继续打磨单句。',
          exampleFrame: isRemoteWorkPrompt
            ? 'Although weaker team cohesion remains a concern, it can be addressed through regular check-ins, so it does not outweigh the benefits of flexibility.'
            : 'This is not to suggest that the opposing view has no value; rather, the main issue is...',
          transferGuidanceZh: isRemoteWorkPrompt
            ? '下次遇到 advantages/disadvantages 或 outweigh 题，先列出“优势段”和“让步段”的角色：优势段证明好处，让步段承认一个真实缺点，再说明它为什么不足以改变你的总判断。'
            : '下次写教育、科技、社会类双边题时，先检查每个主体段有没有完成自己的段落角色：让步段负责承认一边，主观点段负责证明你的立场。',
        },
      ],
      sentenceFeedback: [
        {
          id: 'C1',
          paragraph: 'Introduction',
          issueType: 'lexical_precision',
          primaryIssue: 'Lexical precision',
          secondaryIssues: ['Task response clarity', 'Sentence boundary'],
          microUpgrades: [
            {
              original: 'study what they want',
              better: 'pursue subjects they are genuinely interested in',
              explanationZh: '把 want 这种泛词换成更具体的学习动机表达，后面更容易接原因和例子。',
            },
          ],
          transferGuidanceZh: '下次遇到 want / good / bad 这类泛词，先换成更具体的学术短语，再检查这句话是否已经回应题目立场。',
          original: 'People should study what they want.',
          correction: 'Individuals should be encouraged to pursue subjects they are passionate about.',
          dimension: 'LR',
          tag: 'lexical_precision',
          explanationZh: '可以用更正式、更准确的表达替代口语化词组，但前提是先把文章写成完整论证。',
        },
        {
          id: 'C2',
          paragraph: 'Body Paragraph 1',
          issueType: 'article_plural_punctuation',
          primaryIssue: 'Grammar accuracy',
          secondaryIssues: ['Article', 'Plural form', 'Punctuation'],
          microUpgrades: [
            {
              original: 'a important reason',
              better: 'an important reason',
              explanationZh: '元音音素前用 an，这是小错，但会影响 GRA 的稳定感。',
            },
            {
              original: 'many student',
              better: 'many students',
              explanationZh: 'many 后面需要复数名词，写完数量词要立刻回看名词形式。',
            },
          ],
          transferGuidanceZh: '下次写完主体段后，单独扫一遍 a/an/the、many + 复数、逗号连接两个完整句这些小错误。',
          original: 'A important reason is that many student feel motivated, they can learn more.',
          correction: 'An important reason is that many students feel more motivated, so they can learn more effectively.',
          dimension: 'GRA',
          tag: 'article_plural_punctuation',
          explanationZh: '这句话同时有冠词、单复数和逗号连接句的问题。大逻辑成立时，小语法也要补齐，否则会压低语法准确度。',
        },
      ],
      vocabularyUpgrade: {
        topicVocabulary: isRemoteWorkPrompt
          ? [
              {
                expression: 'flexible working arrangements',
                meaningZh: '灵活办公安排，例如在家办公、弹性时间或混合办公。',
                usageZh: '用于写远程办公的主要优势，说明员工可以更自主地安排工作地点和时间。',
                example: 'Flexible working arrangements can make employees more productive.',
              },
              {
                expression: 'work-life balance',
                meaningZh: '工作与生活之间的平衡。',
                usageZh: '用于论证远程办公能减少通勤压力、给家庭和个人生活留出更多空间。',
                example: 'Working from home may improve work-life balance.',
              },
              {
                expression: 'commuting time',
                meaningZh: '上下班通勤时间。',
                usageZh: '用于解释在家办公的直接好处：节省时间、降低交通成本和疲劳感。',
                example: 'Employees can save commuting time and start work with more energy.',
              },
              {
                expression: 'widen the recruitment pool',
                meaningZh: '扩大招聘范围，让公司可以招到不同地区的人才。',
                usageZh: '用于写雇主层面的优势，尤其适合说明公司不再只依赖本地员工。',
                example: 'Remote work can widen the recruitment pool for employers.',
              },
              {
                expression: 'face-to-face communication',
                meaningZh: '面对面沟通。',
                usageZh: '用于写远程办公的缺点，例如沟通效率下降、误解增加或协作变慢。',
                example: 'Some tasks still require face-to-face communication.',
              },
              {
                expression: 'team cohesion',
                meaningZh: '团队凝聚力。',
                usageZh: '用于讨论长期远程办公可能削弱同事之间的信任、归属感和协作默契。',
                example: 'A lack of informal contact may weaken team cohesion.',
              },
              {
                expression: 'professional isolation',
                meaningZh: '职业上的孤立感。',
                usageZh: '用于写员工层面的负面影响，尤其是缺少同事支持、反馈和职场连接。',
                example: 'Remote employees may experience professional isolation.',
              },
            ]
          : [
              {
                expression: 'academic autonomy',
                meaningZh: '学生在学习方向上拥有一定选择权。',
                usageZh: '用于讨论是否应该允许学生选择课程、专业或学习路径。',
                example: 'Academic autonomy can make students more responsible for their learning.',
              },
              {
                expression: 'long-term employability',
                meaningZh: '长期就业竞争力，而不只是眼前找工作。',
                usageZh: '用于把教育选择和未来职业发展连接起来。',
                example: 'Practical subjects can improve students\' long-term employability.',
              },
            ],
        expressionUpgrades: isRemoteWorkPrompt
          ? [
              {
                category: 'from_essay',
                original: 'work at home',
                better: 'work remotely',
                explanationZh: 'work remotely 更简洁，也更符合远程办公话题的常见表达。',
                reuseWhenZh: '下次讨论在家办公、线上办公或不去办公室时使用。',
                example: 'Many employees now prefer to work remotely several days a week.',
              },
              {
                category: 'argument_frame',
                better: 'Although ... remains a concern, ...',
                explanationZh: '用来承认远程办公的缺点，再转向你的判断，适合 outweigh 类题目。',
                reuseWhenZh: '下次需要先承认一个反方问题，再说明它不是决定性问题时使用。',
                example: 'Although weaker team cohesion remains a concern, it can be reduced through regular check-ins.',
              },
              {
                category: 'argument_frame',
                better: 'The main advantage is not simply ..., but ...',
                explanationZh: '这个句架能把优势写得更深入，避免只停留在“方便”。',
                reuseWhenZh: '下次想把一个表层优势推进到更深层影响时使用。',
                example: 'The main advantage is not simply saving commuting time, but improving employees\' control over their day.',
              },
              {
                category: 'argument_frame',
                better: 'This can be addressed through ..., so it does not outweigh ...',
                explanationZh: '适合处理缺点：先给解决方式，再说明该缺点不足以推翻优势。',
                reuseWhenZh: '下次写 advantages outweigh disadvantages 时，用来压低反方缺点的权重。',
                example: 'This can be addressed through clear supervision, so it does not outweigh the benefits of flexibility.',
              },
            ]
          : [
              {
                category: 'from_essay',
                original: 'study what they want',
                better: 'pursue subjects they are genuinely interested in',
                explanationZh: '原表达意思能懂，但比较口语、范围太宽；升级后更适合教育类议论文。',
                reuseWhenZh: '下次讨论兴趣、选课、学习动力或个人发展时使用。',
                example: 'Students who pursue subjects they are genuinely interested in are more likely to study consistently.',
              },
              {
                category: 'argument_frame',
                better: 'This is not to suggest that ..., but the stronger concern is ...',
                explanationZh: '这是让步后回到自己主观点的句架，能避免两边观点松散并列。',
                reuseWhenZh: '下次题目要求讨论两种看法，而你需要承认一边再强调自己的立场时使用。',
                example: 'This is not to suggest that career prospects are irrelevant, but the stronger concern is whether students can sustain their motivation.',
              },
              {
                category: 'argument_frame',
                better: 'connect personal interests with realistic career pathways',
                explanationZh: '把“兴趣”和“就业”连接成一个更成熟的折中观点。',
                reuseWhenZh: '下次教育、职业、专业选择类题目需要提出平衡方案时使用。',
              },
            ],
      },
      modelAnswer: params.targetRepairFocus
        ? `Many people believe that students should be free to choose what they study, while others think institutions should direct them towards subjects with clearer career value. I agree that personal choice should remain the starting point, but it needs to be combined with informed guidance rather than left entirely to chance.

The strongest reason for allowing choice is that interest often produces sustained effort. For example, a student who is genuinely drawn to computer science may build small apps outside class, ask better questions and keep practising after initial failures. This kind of self-driven work is difficult to create through pressure alone, and it can become more valuable than simply following a subject that adults describe as practical. In this way, personal interest can support both academic performance and employability.

This is not to suggest that career prospects are irrelevant. Some teenagers choose subjects because they sound exciting, without understanding the labour market or the skills needed to succeed. Schools should therefore make the choice more informed by offering career talks, sample projects and advice about transferable skills. For instance, a student interested in art could also learn digital design, communication or basic business skills, which makes the pathway more realistic.

Overall, students should not be forced into subjects chosen only by adults, because this can damage motivation and long-term development. A better approach is guided autonomy: learners choose their main direction, while teachers help them connect that choice with concrete skills, examples and future opportunities.`
        : isRemoteWorkPrompt
        ? `In recent years, many employees have been allowed to work remotely instead of travelling to an office every day. In my view, this trend has more advantages than disadvantages, provided that companies manage communication carefully.

The most obvious benefit is that flexible working arrangements give workers greater control over their daily routine. When people save commuting time, they can start work with more energy and use the extra time for rest, exercise, self-improvement or family responsibilities. This can improve work-life balance without necessarily reducing productivity. It can also benefit employers, because remote work may widen the recruitment pool and allow companies to hire skilled people who live far from the main office.

Admittedly, the perceived drawbacks should not be ignored. Some tasks are easier when colleagues can rely on face-to-face communication, and a lack of informal contact may weaken team cohesion. In addition, employees who lack self-discipline may find it difficult to separate work from private life, which can lead to stress or professional isolation. However, these problems can be addressed through regular check-ins, clear deadlines and occasional office meetings, so they do not outweigh the benefits of flexibility.

Overall, working from home is not suitable for every job or every employee, but it offers practical advantages for both workers and organisations. As long as companies maintain effective communication and reasonable supervision, the advantages of remote work are likely to be greater than its disadvantages.`
        : `Many people believe that students should be free to choose the subjects they study, while others argue that schools and universities should guide them towards more practical fields. In my view, students need academic autonomy, but this freedom should be supported by realistic advice.

The main reason is that learners are more likely to work hard when they can pursue subjects they are genuinely interested in. Interest often leads to deeper reading, more consistent practice and better long-term performance. For example, a student who enjoys design or computer science may spend extra time building projects outside class, which can gradually become evidence of real ability. In this sense, personal choice can improve both motivation and long-term employability.

This is not to suggest that career prospects are irrelevant. Some teenagers may choose a subject only because it sounds attractive, without understanding the job market or the skills required. If schools ignore this problem, students may graduate with limited options. However, this risk can be reduced if teachers help them connect personal interests with realistic career pathways, such as combining creative subjects with business, technology or communication skills.

Overall, students should not be forced into subjects chosen only by adults, because this may damage motivation and personal development. A better approach is to let them choose their main direction while giving them clear guidance about employment, transferable skills and future study routes.`,
      modelAnswerAnnotations: isRemoteWorkPrompt
        ? [
            { quote: 'work remotely', type: 'expression_upgrade', labelZh: '更自然的话题表达' },
            { quote: 'flexible working arrangements', type: 'topic_vocabulary', labelZh: '话题词汇' },
            { quote: 'save commuting time', type: 'topic_vocabulary', labelZh: '话题词汇' },
            { quote: 'work-life balance', type: 'topic_vocabulary', labelZh: '话题词汇' },
            { quote: 'widen the recruitment pool', type: 'topic_vocabulary', labelZh: '话题词汇' },
            { quote: 'the perceived drawbacks should not be ignored', type: 'expression_upgrade', labelZh: '让步框架' },
            { quote: 'face-to-face communication', type: 'topic_vocabulary', labelZh: '话题词汇' },
            { quote: 'team cohesion', type: 'topic_vocabulary', labelZh: '话题词汇' },
            { quote: 'employees who lack self-discipline may find it difficult to separate work from private life', type: 'sentence_repair', labelZh: '句子层面升级' },
            { quote: 'However, these problems can be addressed through regular check-ins, clear deadlines and occasional office meetings, so they do not outweigh the benefits of flexibility.', type: 'logic_repair', labelZh: '补足缺点段后的回扣' },
          ]
        : [
            { quote: 'academic autonomy', type: 'topic_vocabulary', labelZh: '话题词汇' },
            { quote: 'pursue subjects they are genuinely interested in', type: 'expression_upgrade', labelZh: '表达升级' },
            { quote: 'connect personal interests with realistic career pathways', type: 'logic_repair', labelZh: '逻辑修复' },
          ],
      modelAnswerPersonalized: Boolean(params.finalFrameworkSummary || params.frameworkNotes || params.essay.trim()),
      modelAnswerTargetLevel: averageScore >= 8 ? '高分稳定检查' : getTargetLabel(averageScore, 'modelAnswer'),
      reusableArguments: [
        {
          argument: 'Personal interest leads to better academic performance',
          canBeReusedFor: ['Education', 'Work satisfaction'],
          explanationZh: '这是一个教育和职业类都可复用的论点，但需要具体例子支撑。',
        },
      ],
      obsidianMarkdown: `# IELTS Writing Note

## Prompt
${params.question}

## Training Estimate
${scores.taskResponse.toFixed(1)}

## Length Note
${lengthNote}

## Essay
${params.essay}`,
    };
  }

  async validateWritingTarget(params: {
    task: string;
    question: string;
    candidateTargetAnswer: string;
    targetFloor: number;
    originalCurrentScore?: number;
    targetLayer?: string;
  }): Promise<WritingTargetValidationResult> {
    await new Promise(r => setTimeout(r, 450));
    const answer = params.candidateTargetAnswer;
    const passesBand8 = params.targetFloor < 8 ||
      (/For example, a student/i.test(answer) && /guided autonomy/i.test(answer));
    const score = passesBand8 ? params.targetFloor : Math.max(7, params.targetFloor - 0.5);

    return {
      module: 'writing',
      operation: 'writing_target_validation',
      targetFloor: params.targetFloor,
      status: passesBand8 ? 'meets_target' : 'borderline',
      scores: {
        taskResponse: score,
        coherenceCohesion: score,
        lexicalResource: score,
        grammaticalRangeAccuracy: score,
      },
      rationaleZh: passesBand8
        ? 'Mock independent validator: model answer now reaches the required floor.'
        : 'Mock independent validator: this model answer is still closer to 7.5 than stable 8.0.',
      repairFocusZh: passesBand8
        ? ''
        : '这版目标答案还没有稳定达到目标层级，需要继续强化。请强化任务回应、段落功能、具体例子和推理机制，而不是只让措辞更正式。',
    };
  }

  async analyzeWritingTask1(params: {
    task: 'task1';
    taskType: string;
    instruction: string;
    visualBrief: string;
    dataSummary: string;
    report: string;
    expectedOverview?: string;
    expectedKeyFeatures?: string[];
    expectedComparisons?: string[];
    commonTraps?: string[];
    reusablePatterns?: string[];
  }): Promise<WritingTask1Feedback> {
    await new Promise(r => setTimeout(r, 900));

    const words = countWords(params.report);
    const lower = params.report.toLowerCase();
    const hasOverview = /\b(overall|in general|it is clear|it can be seen|the main trend|broadly)\b/.test(lower);
    const hasNumbers = /\d|percent|percentage|million|thousand|km|tonnes|units/.test(lower);
    const comparisonExpected = !['process'].includes(params.taskType.toLowerCase());
    const hasComparison = /\b(compared|whereas|while|than|higher|lower|largest|smallest|respectively|in contrast)\b/.test(lower);
    const isExtremelyShort = words <= 20;
    const isUnderLength = words < 150;
    const estimatedBand = isExtremelyShort
      ? 3.0
      : isUnderLength
        ? 5.0
        : hasOverview && hasNumbers && (!comparisonExpected || hasComparison)
          ? 6.5
          : 6.0;
    const mustFix = [
      isExtremelyShort ? '样本太短，无法判断完整 Task 1 表现。先写出 introduction、overview 和两个细节段。' : '',
      !isExtremelyShort && isUnderLength ? '字数低于 150 词，训练估计会保守处理。请补足关键数据和比较。' : '',
      !hasOverview ? '补写 overview：用一句话概括全图最大趋势、主要差异或流程结果。' : '',
      !hasNumbers ? '加入准确数据：至少写 3 个来自题目的数字、单位、排名或阶段信息。' : '',
      comparisonExpected && !hasComparison ? '增加比较：用 higher than, whereas, in contrast 等表达说明关键差异。' : '',
      '不要解释原因，除非题目视觉信息本身明确给出原因。',
    ].filter(Boolean);
    const patterns = params.reusablePatterns?.length
      ? params.reusablePatterns
      : [
        'Overall, X remained dominant, while Y declined and Z rose.',
        'By the end of the period, the gap between X and Y had narrowed considerably.',
        'The most notable exception was X, where the figure changed from ... to ...',
      ];

    const improvedReport = `Overall, the visual shows a clear main pattern, with the most important changes concentrated in the largest categories. The strongest body paragraph should group the leading figures together, while a second paragraph can compare the smaller or less dramatic figures. Exact numbers should support each point, but the report should avoid explaining why the changes happened unless the visual provides that information.`;
    const rewriteTask = [
      '- 重写 introduction：只改写题目，不加入原因或个人观点。',
      '- 重写 overview：用一句话概括全图最大趋势、最高/最低项或流程终点。',
      '- 补充主体段 1：选择最重要的 key feature，并加入准确数字或阶段。',
      '- 补充主体段 2：加入至少一个比较关系，例如 higher than, whereas, in contrast。',
      '- 检查语言：避免 explain why，改用 shows, illustrates, increased from X to Y 等描述性表达。',
    ].join('\n');

    return {
      mode: 'practice',
      module: 'writing_task1',
      task: 'task1',
      taskType: params.taskType,
      instruction: params.instruction,
      visualBrief: params.visualBrief,
      report: params.report,
      estimatedBand,
      taskAchievement: {
        score: estimatedBand,
        feedback: isUnderLength
          ? '这篇报告低于 Task 1 字数要求，所以估计必须保守。先补全 overview 和两组细节。'
          : '这篇报告回应了图表，但表现主要取决于 overview 是否概括全图，以及数据选择是否抓住重点。',
      },
      overviewFeedback: hasOverview
        ? '已经有 overview 信号。下一步要确认它概括的是全图主趋势，而不是某一个孤立数据点。'
        : '没有清楚的 overview。建议在细节段前加入一句总览，例如 "Overall, ...", 概括主要趋势或最突出的差异。',
      keyFeaturesFeedback: hasNumbers
        ? '已经使用了可量化信息。继续筛选最大变化、最高/最低值和最突出的阶段，不需要覆盖每个数字。'
        : '关键信息不够具体，需要从视觉信息中加入数字、单位或明确数值，例如 "rose from X to Y"。',
      comparisonFeedback: comparisonExpected
        ? (hasComparison
          ? '已经有比较语言。注意比较应服务于分组，而不只是用 while/whereas 连接两个句子。'
          : '需要加入比较关系，例如 higher than, whereas, in contrast, 或 the largest proportion，把类别、时间段或地点放在一起比较。')
        : '如果是流程图，重点不是类别比较，而是阶段顺序和变化结果。',
      dataAccuracyFeedback: hasNumbers
        ? '已经包含数字。请逐个检查数值、单位和排名是否与题目数据一致，避免近似数字造成误导。'
        : '没有检测到数据引用，这会让 Academic Task 1 显得太泛泛。至少加入 3 个准确数据点。',
      coherenceFeedback: '建议使用四个紧凑段落：改写题目、overview、细节组 1、细节组 2。细节段按趋势、大小或阶段分组。',
      languageCorrections: [
        {
          original: 'The chart explains why...',
          correction: 'The chart shows that...',
          explanation: 'Task 1 只描述可见信息，不要自行推测原因。可以改成 "The chart shows that..."。',
        },
      ],
      mustFix,
      rewriteTask,
      reusableReportPatterns: patterns,
      improvedReport,
      modelExcerpt: improvedReport,
      obsidianMarkdown: `# IELTS Writing Task 1 Note

## Prompt
${params.instruction}

## Training Estimate
${estimatedBand.toFixed(1)}

## Must Fix
${mustFix.map(item => `- ${item}`).join('\n')}

## Rewrite Task
${rewriteTask}

## Reusable Patterns
${patterns.map(item => `- ${item}`).join('\n')}`,
    };
  }

  async extractWritingFramework(params: {
    task: 'task2';
    question: string;
    notes: string;
  }): Promise<WritingFrameworkSummary> {
    await new Promise(r => setTimeout(r, 700));

    const source = params.notes.trim();
    const anchor = firstNonEmptyLine(source, 'Use the strongest idea from the Phase 1 notes.');
    const conciseAnchor = shorten(anchor);
    const isCauseSolution = /(why|cause|reason|happen|happening).*(what can be done|solution|solve|measure|address|tackle)|problem.*solution|cause.*solution/i.test(params.question);

    const notDecided = 'Not decided yet / 需要继续补充';
    const summary = {
      mode: 'practice' as const,
      module: 'writing' as const,
      task: params.task,
      question: params.question,
      sourceNotes: params.notes,
      position: conciseAnchor ? `Local mock summary from notes: ${conciseAnchor}` : notDecided,
      viewA: notDecided,
      viewB: notDecided,
      myOpinion: notDecided,
      paragraphPlan: source ? `Use only confirmed notes so far: ${shorten(source, 240)}` : notDecided,
      possibleExample: 'Suggested example, please confirm: add an example only if it matches your own notes.',
    };

    return {
      ...summary,
      editableSummary: isCauseSolution ? `Position
- 中文逻辑: ${summary.position}
- English thesis draft: 需要继续补充 / Not decided yet

Cause Analysis
- 中文逻辑: ${summary.viewA}
- English topic sentence draft: 需要继续补充 / Not decided yet
- Support points: ${summary.possibleExample}

Solution Plan
- 中文逻辑: ${summary.viewB}
- English topic sentence draft: 需要继续补充 / Not decided yet
- Practical measures: 需要继续补充 / Not decided yet

My Position
- 中文逻辑: ${summary.myOpinion}
- English position sentence: 需要继续补充 / Not decided yet

Paragraph Plan
1. Introduction / thesis: ${summary.paragraphPlan}
2. Body 1 cause analysis: 需要继续补充 / Not decided yet
3. Body 2 solution plan: 需要继续补充 / Not decided yet
4. Conclusion: 需要继续补充 / Not decided yet

Topic-specific argument frames
- One reason this happens is...
- A practical response would be...
- This would reduce the problem because...`
        : `Position
- 中文逻辑: ${summary.position}
- English thesis draft: 需要继续补充 / Not decided yet

View A / Concession side
- 中文逻辑: ${summary.viewA}
- English topic sentence draft: 需要继续补充 / Not decided yet
- Support points: ${summary.possibleExample}
- Useful sentence frame: This is not to suggest that...

View B / Main argument side
- 中文逻辑: ${summary.viewB}
- English topic sentence draft: 需要继续补充 / Not decided yet
- Support points: 需要继续补充 / Not decided yet
- Useful sentence frame: Not only..., but also...

My opinion
- 中文逻辑: ${summary.myOpinion}
- English position sentence: 需要继续补充 / Not decided yet
- Concession pattern: While it is true that..., I would argue that...

Paragraph plan
1. Introduction: ${summary.paragraphPlan}
2. Body 1: 需要继续补充 / Not decided yet
3. Body 2: 需要继续补充 / Not decided yet
4. Conclusion: 需要继续补充 / Not decided yet

Reusable language for this essay
- This is not to suggest that...
- Not only..., but also...
- By contrast,...
- Not to mention...
- A more balanced view is that...`,
    };
  }

  async coachWritingFramework(params: {
    task: 'task2';
    question: string;
    notes: string;
  }): Promise<WritingFrameworkCoachFeedback> {
    await new Promise(r => setTimeout(r, 450));
    const notes = params.notes.trim();
    const firstLine = firstNonEmptyLine(notes, '');
    const focus = firstLine ? shorten(firstLine, 120) : 'your position';
    const lower = notes.toLowerCase();
    const isDiscussBoth = /discuss both|both views|two views|both opinions/i.test(params.question);
    const isAdvantageQuestion = /advantages and disadvantages|benefits and drawbacks|outweigh/i.test(params.question);
    const hasCause = /(why|reason|because|cause|lead to|result from|原因|导致|为什么|发生|造成)/i.test(lower);
    const hasSolution = /(solution|solve|measure|address|tackle|can be done|policy|government|school|family|解决|措施|办法|应该|可以|需要)/i.test(lower);
    const isTwoPartProblemSolution = /(why|happen|happening|cause|reason).*(what can be done|solution|solve|measure)|为什么.*(解决|措施|怎么办)/i.test(params.question);
    const checklist = {
      taskTypeAnswered: notes.length > 40,
      clearPosition: /i think|my opinion|position|agree|disagree|partly|我认为|立场|同意|不同意/.test(lower),
      bothViewsCovered: isTwoPartProblemSolution
        ? hasCause && hasSolution
        : isDiscussBoth || isAdvantageQuestion
          ? /view a|view b|both|opposing|advantage|disadvantage|drawback|另一方|双方|反方|正方|优点|缺点/.test(lower)
          : true,
      supportExists: /example|for example|support|because|原因|例子|案例/.test(lower),
      paragraphPlanClear: /body|paragraph|para|introduction|conclusion|主体|段落|开头|结尾/.test(lower),
    };
    const passed = Object.values(checklist).filter(Boolean).length;
    const readiness: WritingFrameworkReadiness = passed >= 5
      ? 'ready_to_write'
      : passed >= 3
        ? 'almost_ready'
        : 'not_ready';
    const asksIfCovered = /我指出来了吗|指出来了吗|我说到了吗|did i mention|have i covered/i.test(notes);
    const mainGaps = [
      !checklist.clearPosition ? '先明确最终立场：完全同意、不同意，还是部分同意。' : '',
      !checklist.bothViewsCovered && isTwoPartProblemSolution ? '这道题需要同时回答原因和解决措施；不要按双方观点来组织。' : '',
      !checklist.bothViewsCovered && isDiscussBoth ? '如果题目要求讨论双方，请补上另一方观点以及你的取舍。' : '',
      !checklist.bothViewsCovered && isAdvantageQuestion ? '请同时覆盖优点和缺点，再给出你的判断。' : '',
      !checklist.supportExists ? '补一个来自你自己经验或常识的例子，不要只写抽象理由。' : '',
      !checklist.paragraphPlanClear ? '把两个主体段分别要写什么说清楚。' : '',
    ].filter(Boolean);
    const nextQuestions = readiness === 'not_ready'
      ? [
          `本地 mock coach：你现在的重点像是“${focus}”。你的最终立场是哪一边？`,
          '两个主体段各自证明什么？',
          '你准备使用哪个例子或事实来支撑最强理由？',
        ]
      : [];
    const finalFixes = readiness === 'almost_ready'
      ? ['再补清楚一个例子和段落顺序，然后生成 Framework Summary。']
      : [];
    const readySummary = readiness === 'ready_to_write'
      ? '本地 mock 判断：立场、双方覆盖、支撑和段落计划已经够用，可以生成总结或直接开始写。'
      : '';
    const directCoverageAnswer = isTwoPartProblemSolution
      ? '你指出了原因的一部分，但还没有完成这道题要求：这类题通常要同时回答 Why is this happening? 和 What can be done? 现在还需要补清楚解决方案和段落安排。'
      : '你已经指出了一部分想法，但还需要补清楚立场、支撑例子和段落结构，才能生成稳定的 framework summary。';
    const message = asksIfCovered
      ? directCoverageAnswer
      : readiness === 'ready_to_write'
        ? readySummary
        : readiness === 'almost_ready'
          ? '本地 mock coach：框架接近可写，只需要补上最后的小缺口。'
          : '本地 mock coach：现在还不够写完整作文，先回答下面几个关键问题。';

    return {
      mode: 'mock',
      module: 'writing',
      task: 'task2',
      question: params.question,
      sourceNotes: params.notes,
      readiness,
      checklist,
      mainGaps,
      nextQuestions,
      finalFixes,
      readySummary,
      message,
      comments: [message, ...mainGaps, ...nextQuestions, ...finalFixes].slice(0, 4),
    };
  }
}
