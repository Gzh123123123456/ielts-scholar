import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { parseArgs } from 'node:util';
import {
  buildFeedbackHistoryReplayReport,
  extractPracticeRecordsFromBackupPayload,
  FeedbackHistoryReplayModule,
} from '../src/lib/feedbackHistoryReplay.ts';

const outputDir = path.join(process.cwd(), 'local_practice_data', 'feedback_judge');
const defaultOutputPath = path.join(outputDir, 'history-replay-latest.json');

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

const findBackupCandidates = async (dir: string) => {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const candidates = await Promise.all(entries
      .filter(entry => entry.isFile() && /^ielts-scholar.*backup.*\.json$/i.test(entry.name))
      .map(async entry => {
        const fullPath = path.join(dir, entry.name);
        const info = await stat(fullPath);
        return { path: fullPath, mtimeMs: info.mtimeMs };
      }));
    return candidates;
  } catch {
    return [];
  }
};

const findLatestBackup = async () => {
  const dirs = [
    path.join(process.cwd(), 'local_practice_data', 'backups'),
    process.cwd(),
    path.join(os.homedir(), 'Downloads'),
    path.join(os.homedir(), 'Desktop'),
  ];
  const candidates = (await Promise.all(dirs.map(findBackupCandidates))).flat();
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.path;
};

const loadJson = async (filePath: string) => {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
};

const main = async () => {
  const { values } = parseArgs({
    options: {
      input: { type: 'string', short: 'i' },
      output: { type: 'string', short: 'o' },
      limit: { type: 'string', short: 'l' },
      module: { type: 'string', short: 'm' },
      part: { type: 'string', short: 'p' },
      includePackets: { type: 'string' },
      includeTeacherPrompts: { type: 'string' },
    },
  });

  const inputPath = values.input || await findLatestBackup();
  if (!inputPath) {
    throw new Error(
      'No IELTS Scholar backup JSON found. Export a complete backup from Storage & Backup, then run: npm run replay:feedback-history -- --input "path/to/ielts-scholar-full-backup.json"',
    );
  }

  const payload = await loadJson(path.resolve(String(inputPath)));
  const { records, source } = extractPracticeRecordsFromBackupPayload(payload);
  const report = buildFeedbackHistoryReplayReport(records, {
    limit: values.limit ? Number(values.limit) : undefined,
    modules: parseModules(values.module),
    speakingParts: parseParts(values.part),
    includePackets: parseBoolean(values.includePackets, true),
    includeTeacherJudgePrompts: parseBoolean(values.includeTeacherPrompts, false),
  }, source);

  const outputPath = path.resolve(String(values.output || defaultOutputPath));
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify({
    inputPath: path.resolve(String(inputPath)),
    ...report,
  }, null, 2), 'utf8');

  console.log(`Feedback history replay report written to ${outputPath}`);
  console.log(`Input: ${path.resolve(String(inputPath))}`);
  console.log(`Records: sanitized=${report.source.sanitizedRecords} candidates=${report.totals.candidateRecords} sampled=${report.totals.sampledRecords}`);
  console.log(`Findings: must=${report.totals.mustFixFindings} should=${report.totals.shouldFixFindings} teacher_needed=${report.totals.teacherJudgeNeeded}`);
  report.cases.forEach(item => {
    const must = item.hardSafety.findings.filter(finding => finding.severity === 'must_fix').length;
    const should = item.hardSafety.findings.filter(finding => finding.severity === 'should_fix').length;
    const teacherNeeded = item.hardSafety.findings.filter(finding => finding.severity === 'needs_teacher_judge').length;
    console.log(`${item.record.id}: ${item.record.title} must=${must} should=${should} teacher_needed=${teacherNeeded}`);
  });
};

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
