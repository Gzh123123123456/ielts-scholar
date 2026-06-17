import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { GeminiProvider } from '../src/lib/ai/providers/geminiProvider.ts';
import { DeepSeekProvider } from '../src/lib/ai/providers/deepseekProvider.ts';
import { MockProvider } from '../src/lib/ai/providers/mockProvider.ts';
import type { AIProvider, SpeakingAnalysisRequest } from '../src/lib/ai/providers/base.ts';
import { safeAnalyzePart1LearningAssets, safeAnalyzeSpeaking } from '../src/lib/ai/safety.ts';
import type {
  Part1LearningAssetsResult,
  ProviderDiagnostic,
  SpeakingFeedback,
  SpeakingMaterialBankItem,
  SpeakingThreadAnswer,
} from '../src/lib/ai/schemas.ts';
import {
  buildFeedbackHistoryReplayReport,
  extractPracticeRecordsFromBackupPayload,
  type FeedbackHistoryReplayCase,
  type FeedbackHistoryReplayModule,
} from '../src/lib/feedbackHistoryReplay.ts';
import {
  buildSpeakingFeedbackJudgePacket,
  buildTeacherJudgePrompt,
  runHardSafetyFeedbackJudge,
  type FeedbackJudgePacket,
  type HardSafetyJudgeResult,
} from '../src/lib/feedbackJudgeHarness.ts';

type ReanalysisProviderName = 'mock' | 'gemini' | 'deepseek';
type ReanalysisJudgeProviderName = 'none' | 'deepseek';

interface ExternalTeacherJudgeResult {
  pass: boolean;
  score: number;
  findings?: string[];
  mustFix?: string[];
  shouldFix?: string[];
  rationaleZh?: string;
  [key: string]: unknown;
}

interface ReanalysisInputCase {
  record: FeedbackHistoryReplayCase['record'];
  oldHardSafety: HardSafetyJudgeResult;
  oldPacket: FeedbackJudgePacket;
}

interface ReanalysisCaseReport {
  record: FeedbackHistoryReplayCase['record'];
  request: SpeakingAnalysisRequest;
  oldHardSafety: HardSafetyJudgeResult;
  newHardSafety?: HardSafetyJudgeResult;
  comparison?: {
    oldWeightedFindings: number;
    newWeightedFindings: number;
    verdict: 'improved' | 'same' | 'worse';
  };
  providerDiagnostic?: {
    providerName: string;
    modelName?: string;
    fallbackUsed: boolean;
    failureKind?: string;
    parseError?: string;
    validationErrors: string[];
    normalizedFields?: string[];
    timestamp: string;
  };
  auxiliaryDiagnostics?: {
    operation: string;
    providerName: string;
    failureKind?: string;
    validationErrors: string[];
    normalizedFields?: string[];
    timestamp: string;
  }[];
  teacherJudge?: ExternalTeacherJudgeResult;
  teacherJudgeError?: string;
  newPacket?: FeedbackJudgePacket;
  newTeacherJudgePrompt?: string;
}

const outputDir = path.join(process.cwd(), 'local_practice_data', 'feedback_judge');
const defaultOutputPath = path.join(outputDir, 'reanalysis-latest.json');

const loadLocalEnvFile = async (filePath: string) => {
  try {
    const raw = await readFile(filePath, 'utf8');
    raw.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const equalsIndex = trimmed.indexOf('=');
      if (equalsIndex <= 0) return;
      const key = trimmed.slice(0, equalsIndex).trim();
      if (!key || process.env[key]) return;
      let value = trimmed.slice(equalsIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    });
  } catch {
    // Optional local env file. Keep CLI usable without it.
  }
};

const loadLocalEnv = async () => {
  await loadLocalEnvFile(path.join(process.cwd(), '.env.local'));
  await loadLocalEnvFile(path.join(process.cwd(), '.env'));
};

const compact = (value = '') => value.replace(/\s+/g, ' ').trim();

const countWords = (value = '') => compact(value).split(/\s+/).filter(Boolean).length;

const parseBoolean = (value: string | boolean | undefined, fallback: boolean) => {
  if (typeof value === 'boolean') return value;
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'y'].includes(value.trim().toLowerCase());
};

const parseModules = (value: string | undefined): FeedbackHistoryReplayModule[] => {
  if (!value || value.trim().toLowerCase() === 'speaking') return ['speaking'];
  if (value.trim().toLowerCase() === 'all') return ['speaking', 'writing', 'writing_task1'];
  return value
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter((item): item is FeedbackHistoryReplayModule =>
      item === 'speaking' || item === 'writing' || item === 'writing_task1',
    );
};

const parseParts = (value: string | undefined): Array<1 | 2 | 3> => {
  if (!value || value.trim().toLowerCase() === 'all') return [1, 2, 3];
  const parts = value
    .split(',')
    .map(item => Number(item.trim()))
    .filter((item): item is 1 | 2 | 3 => item === 1 || item === 2 || item === 3);
  return parts.length ? parts : [1, 2, 3];
};

const weightedFindings = (result: HardSafetyJudgeResult) =>
  result.findings.reduce((sum, finding) => {
    if (finding.severity === 'must_fix') return sum + 3;
    if (finding.severity === 'should_fix') return sum + 1;
    return sum;
  }, 0);

const verdictFromWeights = (oldWeight: number, newWeight: number): ReanalysisCaseReport['comparison']['verdict'] => {
  if (newWeight < oldWeight) return 'improved';
  if (newWeight > oldWeight) return 'worse';
  return 'same';
};

const isReplayReport = (value: any) =>
  value && typeof value === 'object' && Array.isArray(value.cases) && value.cases.some((item: any) => item?.packet?.kind === 'speaking');

const inputCasesFromReplayReport = (payload: any): ReanalysisInputCase[] =>
  (payload.cases || [])
    .filter((item: any) => item?.packet?.kind === 'speaking' && item?.record?.module === 'speaking')
    .map((item: any): ReanalysisInputCase => ({
      record: item.record,
      oldHardSafety: item.hardSafety,
      oldPacket: item.packet,
    }));

const inputCasesFromBackup = (
  payload: unknown,
  options: {
    limit: number;
    modules: FeedbackHistoryReplayModule[];
    speakingParts: Array<1 | 2 | 3>;
  },
): ReanalysisInputCase[] => {
  const { records, source } = extractPracticeRecordsFromBackupPayload(payload);
  const report = buildFeedbackHistoryReplayReport(records, {
    limit: options.limit,
    modules: options.modules,
    speakingParts: options.speakingParts,
    includePackets: true,
    includeTeacherJudgePrompts: false,
  }, source);
  return report.cases
    .filter(item => item.packet?.kind === 'speaking')
    .map((item): ReanalysisInputCase => ({
      record: item.record,
      oldHardSafety: item.hardSafety,
      oldPacket: item.packet as FeedbackJudgePacket,
    }));
};

const requestFromPacket = (packet: FeedbackJudgePacket): SpeakingAnalysisRequest => {
  if (packet.kind !== 'speaking' || !packet.source.part) {
    throw new Error(`Packet ${packet.id} is not a Speaking packet.`);
  }

  const part = packet.source.part;
  const threadAnswers: SpeakingThreadAnswer[] | undefined = packet.source.threadAnswers?.map((answer, index) => ({
    questionId: answer.questionId || `q${index + 1}`,
    question: answer.question,
    answer: answer.answer,
  }));
  const sessionKind = threadAnswers?.length
    ? part === 1
      ? 'part1_topic_thread'
      : part === 3
        ? 'part3_discussion_thread'
        : 'single_question'
    : 'single_question';

  return {
    part,
    sessionKind,
    topic: typeof (packet.feedbackDigest as any)?.topic === 'string' ? (packet.feedbackDigest as any).topic : undefined,
    threadId: sessionKind !== 'single_question' ? packet.id.replace(/^history-/, '') : undefined,
    threadAnswers: sessionKind !== 'single_question' ? threadAnswers : undefined,
    question: packet.source.question,
    transcript: packet.source.transcriptOrEssay,
  };
};

const isInsufficientSpeakingSample = (request: SpeakingAnalysisRequest) => {
  const words = countWords(request.transcript);
  if (request.part === 1) return words <= 8;
  if (request.part === 2) return words < 60;
  return words < 35;
};

const providerFromEnv = (providerName: ReanalysisProviderName): { provider: AIProvider; modelName: string } => {
  if (providerName === 'mock') {
    return { provider: new MockProvider(), modelName: 'mock' };
  }
  if (providerName === 'gemini') {
    const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Gemini re-analysis needs VITE_GEMINI_API_KEY or GEMINI_API_KEY.');
    const modelName = process.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
    return { provider: new GeminiProvider(apiKey, modelName), modelName };
  }
  const apiKey = process.env.VITE_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DeepSeek re-analysis needs VITE_DEEPSEEK_API_KEY or DEEPSEEK_API_KEY.');
  const modelName = process.env.VITE_DEEPSEEK_FLASH_MODEL || 'deepseek-v4-flash';
  const baseUrl = process.env.VITE_DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
  return { provider: new DeepSeekProvider(apiKey, modelName, baseUrl), modelName };
};

const parseTeacherJudgeJson = (value: string): ExternalTeacherJudgeResult => {
  const trimmed = value.trim();
  const parsed = JSON.parse(trimmed) as ExternalTeacherJudgeResult;
  if (typeof parsed.pass !== 'boolean') throw new Error('Teacher judge JSON missing boolean pass.');
  if (typeof parsed.score !== 'number') throw new Error('Teacher judge JSON missing numeric score.');
  if (parsed.score >= 0 && parsed.score <= 10) {
    parsed.score = parsed.score * 10;
    parsed.scoreScaleNormalized = '0-10_to_0-100';
  }
  return parsed;
};

const runDeepSeekTeacherJudge = async (packet: FeedbackJudgePacket): Promise<ExternalTeacherJudgeResult> => {
  const apiKey = process.env.VITE_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DeepSeek teacher judge needs VITE_DEEPSEEK_API_KEY or DEEPSEEK_API_KEY.');
  const modelName = process.env.FEEDBACK_JUDGE_DEEPSEEK_MODEL || process.env.VITE_DEEPSEEK_FLASH_MODEL || 'deepseek-v4-flash';
  const baseUrl = (process.env.VITE_DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: packet.teacherJudgeInstructions },
        { role: 'user', content: JSON.stringify(packet, null, 2) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    }),
  });
  if (!response.ok) {
    throw new Error(`DeepSeek teacher judge request failed: ${response.status} ${await response.text()}`);
  }
  const payload = await response.json() as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek teacher judge response did not include message content.');
  return parseTeacherJudgeJson(content);
};

const maybeRunTeacherJudge = async (
  providerName: ReanalysisJudgeProviderName,
  packet: FeedbackJudgePacket,
): Promise<ExternalTeacherJudgeResult | undefined> => {
  if (providerName === 'none') return undefined;
  if (providerName === 'deepseek') return runDeepSeekTeacherJudge(packet);
  throw new Error(`Unsupported judge provider: ${providerName}`);
};

const mergePart1LearningAssets = (
  feedback: SpeakingFeedback,
  assets: Part1LearningAssetsResult,
): SpeakingFeedback => {
  if (feedback.sessionKind !== 'part1_topic_thread' || !feedback.threadFeedback) return feedback;
  const materialBank = feedback.threadFeedback.materialBank || {
    myUsableMaterial: [] as SpeakingMaterialBankItem[],
    reusableSpokenLanguage: [] as SpeakingMaterialBankItem[],
  };

  return {
    ...feedback,
    threadFeedback: {
      ...feedback.threadFeedback,
      developmentStatus: assets.developmentTargets.length ? 'needed' : 'sufficient',
      developmentTargets: assets.developmentTargets,
      materialBank: {
        ...materialBank,
        myUsableMaterial: assets.materialBank.myUsableMaterial || [],
        reusableSpokenLanguage: assets.materialBank.reusableSpokenLanguage || [],
      },
    },
  };
};

const diagnosticSummary = (diagnostic: ProviderDiagnostic) => ({
  operation: diagnostic.operation,
  providerName: diagnostic.providerName,
  failureKind: diagnostic.failureKind,
  validationErrors: diagnostic.validationErrors,
  normalizedFields: diagnostic.normalizedFields,
  timestamp: diagnostic.timestamp,
});

const runPart1LearningAssetsPass = async (
  provider: AIProvider,
  providerName: ReanalysisProviderName,
  feedback: SpeakingFeedback,
  request: SpeakingAnalysisRequest,
): Promise<{ feedback: SpeakingFeedback; diagnostics: ProviderDiagnostic[] }> => {
  if (request.sessionKind !== 'part1_topic_thread' || !request.threadAnswers?.length || !feedback.threadFeedback) {
    return { feedback, diagnostics: [] };
  }
  if (!provider.generatePart1LearningAssets) {
    return { feedback, diagnostics: [] };
  }

  const learningRun = await safeAnalyzePart1LearningAssets(provider, providerName, {
    topic: request.topic || feedback.topic || 'Part 1 Topic',
    threadId: request.threadId || feedback.threadId || 'part1_topic_thread',
    threadAnswers: request.threadAnswers,
    cleanRetryAnswers: feedback.threadFeedback.cleanRetryAnswers || [],
    annotations: feedback.threadFeedback.annotations || [],
    attempt: 1,
  });

  if (learningRun.diagnostic.failureKind) {
    return { feedback, diagnostics: [learningRun.diagnostic] };
  }

  return {
    feedback: mergePart1LearningAssets(feedback, learningRun.feedback),
    diagnostics: [learningRun.diagnostic],
  };
};

const feedbackForPacket = (
  feedback: SpeakingFeedback,
  request: SpeakingAnalysisRequest,
): SpeakingFeedback => ({
  ...feedback,
  part: request.part as 1 | 2 | 3,
  sessionKind: request.sessionKind,
  topic: request.topic || feedback.topic,
  threadId: request.threadId || feedback.threadId,
  threadAnswers: request.threadAnswers || feedback.threadAnswers,
  question: feedback.question || request.question,
  transcript: feedback.transcript || request.transcript,
});

const runOneReanalysis = async (
  item: ReanalysisInputCase,
  options: {
    execute: boolean;
    providerName: ReanalysisProviderName;
    judgeProviderName: ReanalysisJudgeProviderName;
    includePackets: boolean;
    includeTeacherJudgePrompts: boolean;
  },
): Promise<ReanalysisCaseReport> => {
  const request = requestFromPacket(item.oldPacket);
  request.topic = request.topic || item.record.topic;
  request.threadId = request.threadId || (request.sessionKind !== 'single_question' ? item.record.id : undefined);
  if (!options.execute) {
    return {
      record: item.record,
      request,
      oldHardSafety: item.oldHardSafety,
    };
  }

  const { provider, modelName } = providerFromEnv(options.providerName);
  const result = await safeAnalyzeSpeaking(provider, options.providerName, request);
  const coreFeedback = feedbackForPacket(result.feedback, request);
  const learningAssetsRun = await runPart1LearningAssetsPass(provider, options.providerName, coreFeedback, request);
  const newFeedback = feedbackForPacket(learningAssetsRun.feedback, request);
  const newPacket = buildSpeakingFeedbackJudgePacket({
    id: `reanalysis-${item.record.id}`,
    title: `Re-analysis: ${item.record.title}`,
    feedback: newFeedback,
    threadAnswers: request.threadAnswers,
  });
  const newHardSafety = runHardSafetyFeedbackJudge(newPacket);
  const oldWeight = weightedFindings(item.oldHardSafety);
  const newWeight = weightedFindings(newHardSafety);
  let teacherJudge: ExternalTeacherJudgeResult | undefined;
  let teacherJudgeError: string | undefined;
  try {
    teacherJudge = await maybeRunTeacherJudge(options.judgeProviderName, newPacket);
  } catch (error) {
    teacherJudgeError = error instanceof Error ? error.message : String(error);
  }

  return {
    record: item.record,
    request,
    oldHardSafety: item.oldHardSafety,
    newHardSafety,
    comparison: {
      oldWeightedFindings: oldWeight,
      newWeightedFindings: newWeight,
      verdict: verdictFromWeights(oldWeight, newWeight),
    },
    teacherJudge,
    teacherJudgeError,
    providerDiagnostic: {
      providerName: options.providerName,
      modelName,
      fallbackUsed: result.diagnostic.fallbackUsed || learningAssetsRun.diagnostics.some(item => item.fallbackUsed),
      failureKind: result.diagnostic.failureKind || learningAssetsRun.diagnostics.find(item => item.failureKind)?.failureKind,
      parseError: result.diagnostic.parseError,
      validationErrors: [
        ...result.diagnostic.validationErrors,
        ...learningAssetsRun.diagnostics.flatMap(item =>
          item.validationErrors.map(error => `${item.operation}:${error}`),
        ),
      ],
      normalizedFields: [
        ...(result.diagnostic.normalizedFields || []),
        ...learningAssetsRun.diagnostics.flatMap(item => [
          `${item.operation}:provider:${item.providerName}`,
          ...(item.failureKind ? [`${item.operation}:failure:${item.failureKind}`] : []),
          ...(item.normalizedFields || []).map(field => `${item.operation}:${field}`),
        ]),
      ],
      timestamp: learningAssetsRun.diagnostics.at(-1)?.timestamp || result.diagnostic.timestamp,
    },
    auxiliaryDiagnostics: learningAssetsRun.diagnostics.map(diagnosticSummary),
    newPacket: options.includePackets ? newPacket : undefined,
    newTeacherJudgePrompt: options.includeTeacherJudgePrompts ? buildTeacherJudgePrompt(newPacket) : undefined,
  };
};

const main = async () => {
  await loadLocalEnv();

  const { values } = parseArgs({
    options: {
      input: { type: 'string', short: 'i' },
      output: { type: 'string', short: 'o' },
      limit: { type: 'string', short: 'l' },
      module: { type: 'string', short: 'm' },
      part: { type: 'string', short: 'p' },
      provider: { type: 'string' },
      judgeProvider: { type: 'string' },
      execute: { type: 'string' },
      includePackets: { type: 'string' },
      includeTeacherPrompts: { type: 'string' },
    },
  });

  if (!values.input) {
    throw new Error('Missing --input. Use a feedback replay JSON or complete backup JSON.');
  }

  const inputPath = path.resolve(String(values.input));
  const payload = JSON.parse(await readFile(inputPath, 'utf8'));
  const limit = Math.max(1, Math.floor(values.limit ? Number(values.limit) : 3));
  const modules = parseModules(values.module);
  const speakingParts = parseParts(values.part);
  const providerName = String(values.provider || process.env.FEEDBACK_REANALYSIS_PROVIDER || 'mock').toLowerCase() as ReanalysisProviderName;
  if (!['mock', 'gemini', 'deepseek'].includes(providerName)) {
    throw new Error(`Unsupported provider: ${providerName}. Use mock, gemini, or deepseek.`);
  }
  const judgeProviderName = String(values.judgeProvider || process.env.FEEDBACK_REANALYSIS_JUDGE_PROVIDER || 'none').toLowerCase() as ReanalysisJudgeProviderName;
  if (!['none', 'deepseek'].includes(judgeProviderName)) {
    throw new Error(`Unsupported judge provider: ${judgeProviderName}. Use none or deepseek.`);
  }
  const execute = parseBoolean(values.execute, false);
  const includePackets = parseBoolean(values.includePackets, true);
  const includeTeacherJudgePrompts = parseBoolean(values.includeTeacherPrompts, false);

  const inputCases = (isReplayReport(payload)
    ? inputCasesFromReplayReport(payload)
    : inputCasesFromBackup(payload, { limit, modules, speakingParts }))
    .filter(item => modules.includes('speaking'))
    .filter(item => !speakingParts.length || speakingParts.includes(item.record.part || 1))
    .slice(0, limit);

  const cases: ReanalysisCaseReport[] = [];
  for (const item of inputCases) {
    cases.push(await runOneReanalysis(item, {
      execute,
      providerName,
      judgeProviderName,
      includePackets,
      includeTeacherJudgePrompts,
    }));
  }

  const comparisons = cases.map(item => item.comparison).filter(Boolean) as NonNullable<ReanalysisCaseReport['comparison']>[];
  const report = {
    generatedAt: new Date().toISOString(),
    inputPath,
    execute,
    provider: execute ? providerName : 'dry_run',
    options: {
      limit,
      modules,
      speakingParts,
      includePackets,
      includeTeacherJudgePrompts,
      judgeProviderName,
    },
    totals: {
      sampledRecords: cases.length,
      executedRecords: cases.filter(item => item.newHardSafety).length,
      improved: comparisons.filter(item => item.verdict === 'improved').length,
      same: comparisons.filter(item => item.verdict === 'same').length,
      worse: comparisons.filter(item => item.verdict === 'worse').length,
      providerFailures: cases.filter(item => item.providerDiagnostic?.failureKind).length,
      teacherJudgePasses: cases.filter(item => item.teacherJudge?.pass === true).length,
      teacherJudgeFailures: cases.filter(item => item.teacherJudge?.pass === false).length,
      teacherJudgeErrors: cases.filter(item => item.teacherJudgeError).length,
    },
    cases,
  };

  const outputPath = path.resolve(String(values.output || defaultOutputPath));
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Feedback re-analysis report written to ${outputPath}`);
  console.log(`Input: ${inputPath}`);
  console.log(`Mode: ${execute ? `execute provider=${providerName}` : 'dry-run only'} judge=${judgeProviderName}`);
  console.log(`Records: sampled=${report.totals.sampledRecords} executed=${report.totals.executedRecords} improved=${report.totals.improved} same=${report.totals.same} worse=${report.totals.worse} providerFailures=${report.totals.providerFailures}`);
  cases.forEach((item, index) => {
    const oldWeight = weightedFindings(item.oldHardSafety);
    const newWeight = item.newHardSafety ? weightedFindings(item.newHardSafety) : '-';
    const failure = item.providerDiagnostic?.failureKind ? ` failure=${item.providerDiagnostic.failureKind}` : '';
    const teacher = item.teacherJudge
      ? ` teacher=${item.teacherJudge.pass ? 'pass' : 'fail'}:${item.teacherJudge.score}`
      : item.teacherJudgeError
        ? ' teacher=error'
        : '';
    console.log(`${index + 1}. ${item.record.id} | ${item.record.title} | old=${oldWeight} new=${newWeight} ${item.comparison?.verdict || 'planned'}${failure}${teacher}`);
  });

  if (!execute) {
    console.log('Dry-run complete. Add --execute true --provider gemini|deepseek|mock to actually re-analyze. Add --judgeProvider deepseek to run teacher-quality judging.');
  }
};

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
