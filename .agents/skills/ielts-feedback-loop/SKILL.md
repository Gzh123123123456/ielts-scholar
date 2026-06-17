---
name: ielts-feedback-loop
description: Run the IELTS Scholar Speaking feedback-quality loop for replaying real history, judging feedback stability, diagnosing failures, fixing shared feedback logic, and recording loop notes. Use when the user says continue feedback loop, re-run feedback replay, stabilize Speaking feedback quality, check correction coverage, or asks Codex to self-test IELTS Speaking feedback instead of relying on screenshots.
---

# IELTS Feedback Loop

Use this skill for Speaking feedback page stability and correction quality loops. Do not use it for Progress profile, Writing Profile, storage rescue, deletion, backup migration, or broad feature work.

## Scope

In scope: original-answer correction coverage, anchored annotation stability, cleaner answer / next speakable version quality, Part 1 / Part 2 / Part 3 correction priorities, provider parse/schema stability, and hard-safety / teacher-quality judge results.

Out of scope for current quality judgment: `MATERIAL DEVELOPMENT`, `PART 2 STORY TRAINER`, `PART 3 - LANGUAGE BANK`, `TOPIC-BOUND LANGUAGE`, profile, collection, or writing quality features.

These out-of-scope surfaces may be checked only for stability: present, not blank, not malformed, and not breaking parsing/rendering.

## Required Reference

Before running a loop, read `docs/SPEAKING_FEEDBACK_QUALITY_LOOP.md` and the Speaking feedback map in `docs/CODEBASE_MAP.md`.

Use current source and runtime evidence over old chat memory.

## Loop

1. Replay
   - Use a real exported history replay JSON if available.
   - Start with mixed Part 1 / 2 / 3 samples.
   - Keep sample counts modest before expanding.

2. Judge
   - Run hard-safety judge.
   - Run teacher judge when evaluating teaching quality.
   - Treat user examples as regression evidence, not hardcoded content.

3. Diagnose
   - Classify each failure before editing: provider request, parsing/schema, safety normalization, evidence ledger / anchoring, rendering, prompt/content quality, or judge harness.

4. Fix
   - Fix shared provider, safety, ledger, rendering, or prompt logic.
   - Do not patch one exact topic, phrase, transcript, or sample.
   - Preserve local data and history.

5. Record
   - Append a concise loop note to `docs/SPEAKING_FEEDBACK_QUALITY_LOOP.md`.
   - Include command, sample scope, failures, fix, validation, and next loop focus.

## Commands

Dry run:

```bash
npm run replay:feedback-reanalysis -- --input "<history-replay.json>" --limit 6 --part all --includePackets false
```

Real replay:

```bash
npm run replay:feedback-reanalysis -- --input "<history-replay.json>" --limit 6 --part all --execute true --provider deepseek --includePackets false
```

Teacher-quality replay:

```bash
npm run replay:feedback-reanalysis -- --input "<history-replay.json>" --limit 3 --part all --execute true --provider deepseek --judgeProvider deepseek --includePackets false
```

## Stop Conditions

Stop and report when the next step requires user visual judgment, provider/API calls would become large or costly, a fix would broaden into out-of-scope feedback sections, storage/migration/deletion/Git operations become relevant, or the loop finds a product-level decision rather than an implementation defect.

## Final Report

Report samples run, hard-safety result, teacher-judge result if run, files changed, loop note updated, exact next action, and whether user spot-check is needed.
