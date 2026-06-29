# Speaking Feedback Quality Loop

_Created: 2026-06-15_

## Scope

This loop is only for Speaking feedback page stability, correction coverage, annotation stability, and teacher-quality feedback.

Current in-scope surfaces:

- original-answer correction stability;
- anchored annotations and evidence coverage;
- cleaner / next speakable answer quality;
- Part 1 / Part 2 / Part 3 correction priorities;
- provider parse/schema stability;
- hard-safety judge and teacher-quality judge outcomes.

Current out-of-scope quality evaluation:

- `MATERIAL DEVELOPMENT`;
- `PART 2 STORY TRAINER`;
- `PART 3 - LANGUAGE BANK`;
- `TOPIC-BOUND LANGUAGE`;
- Progress profile, speaking profile, saved expressions, text-selection collection;
- Writing Profile and writing-feedback quality.

Out-of-scope sections may still be checked for stability: present, not blank, not malformed, and not causing provider/schema/rendering failures. Their teaching quality will be improved after the current correction/annotation loop is stable.

## Loop Contract

Each loop run should create reusable evidence, not just spend tokens.

1. Replay
   - Use real history replay input when available.
   - Re-analyze with the current provider.
   - Keep samples mixed across Part 1, Part 2, and Part 3 unless investigating one part.

2. Judge
   - Run hard-safety checks first.
   - Run teacher-quality judge when evaluating correction quality, coverage, or feedback usefulness.
   - Treat examples as regression evidence, not content to hardcode.

3. Diagnose
   - Classify failure layer before editing:
     - provider request;
     - parsing/schema;
     - safety normalization;
     - evidence ledger / anchoring;
     - rendering;
     - prompt/content quality;
     - judge harness.

4. Fix
   - Fix shared runtime, prompt, safety, ledger, or rendering logic.
   - Do not patch a single topic, exact answer, or phrase.
   - Preserve user history and local data.

5. Record
   - Append a compact loop note with command, samples, failures, fix, and next decision.
   - Keep the note short enough for the next chat to resume without old-message archaeology.

## Commands

Dry run:

```bash
npm run replay:feedback-reanalysis -- --input "<history-replay.json>" --limit 6 --part all --includePackets false
```

Real provider replay:

```bash
npm run replay:feedback-reanalysis -- --input "<history-replay.json>" --limit 6 --part all --execute true --provider deepseek --includePackets false
```

Replay plus teacher judge:

```bash
npm run replay:feedback-reanalysis -- --input "<history-replay.json>" --limit 3 --part all --execute true --provider deepseek --judgeProvider deepseek --includePackets false
```

Default report:

```text
local_practice_data/feedback_judge/reanalysis-latest.json
```

## Acceptance Signals

A loop run is acceptable when:

- `providerFailures` is `0`;
- `worse` is `0` for the sampled run, or each worse case has a clear diagnosed layer;
- hard-safety has no `must_fix` findings except known accepted limitations;
- teacher judge passes the sampled correction-quality cases;
- any remaining teacher `nextFix` items are product-quality improvements, not broken feedback flow.

Manual user replay is useful only after the automated loop is clean enough to avoid wasting user attention. Ask the user for spot checks, not bulk screenshot triage.

## Loop Runs

### 2026-06-15 - Re-analysis Harness Stabilization

Input:

- `D:/chrome download/ielts-scholar-feedback-history-replay-2026-06-14T17-06-52-477Z.json`

Observed failures:

- Gemini in Node returned `fetch failed`; DeepSeek replay path worked.
- Part 1 topic-thread re-analysis did not run the learning-assets pass, causing false missing-material findings.
- Part 3 discussion feedback with per-question target answers was marked `parse_or_schema` because root `upgradedAnswer` was empty.
- Evidence ledger failed to anchor display-required repairs when provider wording included `Q1:` / `Q3:` prefixes.
- Hard judge treated high-band stability guidance as missing target output.
- Teacher judge score scale was ambiguous.

Fixes made:

- Added `replay:feedback-reanalysis` workflow with current-provider re-analysis, hard-safety comparison, optional DeepSeek teacher judge, and report output.
- Added Part 1 learning-assets pass to re-analysis so replay is closer to the product flow.
- Allowed Part 3 discussion thread feedback to rely on per-question target answers instead of root `upgradedAnswer`.
- Added evidence-ledger question-prefix stripping before anchor fallback.
- Counted high-band stability guidance as valid visible target guidance in the hard judge.
- Clarified teacher judge scoring as 0-100 and normalized accidental 0-10 scores.

Validation:

- `npm run lint` passed.
- `npm run build` passed with existing Vite chunk/dynamic-import warnings.
- DeepSeek 6-sample replay: `improved=2`, `same=4`, `worse=0`, `providerFailures=0`.
- DeepSeek teacher judge 2-sample replay: `teacherJudgePasses=2`, `teacherJudgeFailures=0`, `teacherJudgeErrors=0`.

Next loop focus:

- Expand teacher-judge replay across Part 1 / Part 2 / Part 3.
- Keep current scope on correction coverage and feedback quality.
- Do not yet optimize `MATERIAL DEVELOPMENT`, `PART 2 STORY TRAINER`, or `PART 3 LANGUAGE BANK` content quality beyond stability.

### 2026-06-15 - Answer-Level Speaking Diagnosis Pass

Input:

- User spot-check evidence from Part 1 hobbies, legacy Part 1 daily routine, Part 2 family album, and Part 3 books/libraries/reading answers.
- `D:/chrome download/ielts-scholar-feedback-history-replay-2026-06-14T17-06-52-477Z.json`

Observed failures:

- Feedback still read too much like a local phrase annotation system when the real issue was answer scope, sentence control, comparison logic, or Part 2 story organization.
- Part 1 single-question history could still open in the legacy one-answer renderer, making it look inconsistent with current 3-4 question topic threads.
- Legacy Part 1 single-answer material/expression cards used a different visual format from topic-thread material cards.

Fixes made:

- Strengthened Speaking prompts so providers must lead with answer-level diagnosis: Part 1 direct answer + reason/detail control, Part 2 cue-card/story route, and Part 3 question-frame diagnosis before local phrase repair.
- Added answer-level reminder blocks under original answers in Part 1 thread, legacy Part 1 single, Part 2 transcript, and Part 3 per-question cards.
- Normalized legacy Part 1 single material/expression card formatting and added a small note that old single-question records are distinct from fresh topic-thread practice.

Validation:

- `npm run lint` passed.
- `npm run build` passed with existing Vite chunk/dynamic-import and large-chunk warnings.
- `npm run verify:part1-runtime-fixtures` passed: 68 passes, 0 failures.
- `npm run verify:feedback-judge` hard-safety passed with no `must_fix`; teacher cases remained skipped in that command.
- DeepSeek Part 3 one-sample replay passed: `sampled=1`, `executed=1`, `same=1`, `worse=0`, `providerFailures=0`.
- DeepSeek 3-sample replay with teacher judge timed out before writing a new report; orphan replay processes were stopped.

Next loop focus:

- Re-run a smaller teacher-judge pass after provider latency is acceptable.
- Spot-check whether the new answer-level blocks make Part 1 short-answer development, Part 2 story route, and Part 3 scope/control visible before phrase annotations.

### 2026-06-15 - Part 2 Score And Route Gating

Input:

- User spot-check evidence from the Part 2 family-album retest.

Observed failures:

- The headline estimate could display `5.5-6.0` while all visible language criteria were `5.0`, making the scoring panel internally inconsistent.
- The new Part 2 `Answer route` area could render generic language advice such as grammar, tense, articles, naturalness, and word choice, even when there was no concrete cue-card or story-route gap to show.

Fixes made:

- Normalized Speaking score display in the safety layer so, without a quality cap or provider fatal issue, the headline estimate cannot sit above the strongest visible criterion or below the weakest visible criterion.
- Dropped a provider range when its lower bound is higher than every visible criterion score.
- Applied the same score consistency rule to the score-only Speaking path.
- Gated Part 2 route rows so they only render concrete route/cue-card gaps such as opening, sequence, missing coverage, what it contains, how long it was kept, who kept it, or why it matters.
- Excluded generic `current_or_future_influence` suggestions and suggested-confirm story modules from the Part 2 route display.

Validation:

- `npm run lint` passed.
- `npm run build` passed with existing Vite chunk/dynamic-import and large-chunk warnings.
- `npm run verify:feedback-judge` hard-safety passed with no `must_fix`; teacher cases remained skipped in that command.
- `npm run verify:part1-runtime-fixtures` passed: 68 passes, 0 failures.
- Targeted mock safety probe converted `headline=5.5`, `range=5.5-6.0`, and visible criteria `5.0/5.0/5.0` into `headline=5.0` with no visible range.

Next loop focus:

- Re-test a real provider Part 2 answer where the provider genuinely gives `FC=5.5`, `LR=5.5`, `GRA=5.0`; expected display is headline `5.5` or a justified adjacent range that matches the visible criteria.
- Keep answer-level blocks conditional: render them for real task-route issues, not as an empty slot the provider must fill.

### 2026-06-15 - Annotation Coverage And Part 3 Diagnosis Split

Input:

- User spot-check evidence from Part 2 family-album retest, Part 1 re-analysis failure, and Part 3 books/libraries/reading retest.

Observed failures:

- Part 2 annotations still missed high-impact semantic/span repairs such as `taking photos for me`, `flashlight`, incomplete transition spans, and incomplete `when ... watching photos` clause spans.
- Part 3 annotations still missed high-impact semantic repairs such as book-category noun phrases, adaptation direction, library facility/service wording, reading-environment wording, access structure, technology/science noun choice, and device-use ending structure.
- Part 3 Thinking Diagnosis repeated transcript annotations and next speakable answers through `Language repair` / `Try this line`, creating functional overlap instead of teaching a transferable thinking pattern.
- Part 1 result-page re-analysis failure showed a generic English message and saved/rebuilt thread records from stale `lockedThreadAnswers` state instead of the current re-analysis answers.

Fixes made:

- Strengthened the shared spoken-transcript contract: semantic precision beats easy grammar spotting, and `sourceQuote` must cover the smallest complete replaceable span.
- Strengthened Part 2 native feedback selection for photo-subject prepositions, camera flash wording, full transition spans, and full clause repairs.
- Strengthened Part 3 feedback selection so target-answer repairs for high-impact local phrases must also appear in anchored `fatalErrors` or `naturalnessHints` when exact learner wording exists.
- Changed Part 3 Thinking Diagnosis display to `Question task` / `Repair theme` / `Reusable pattern`, removed local `Try this line` derivation, and moved the three-card summary to a `md:grid-cols-3` horizontal layout.
- Updated result-page thread record building so Part 1 / Part 3 re-analysis saves the current submitted answers, and made Part 1 re-analysis failure messages show provider/integrity/certification context instead of a generic English fallback.
- Added feedback-judge coverage regression lanes and two calibration cases for family-album Part 2 spans and books/libraries/reading Part 3 semantic repairs.

Validation:

- `npm run lint` passed.
- `npm run build` passed with existing Vite chunk/dynamic-import and large-chunk warnings.
- `npm run verify:feedback-judge` passed hard-safety; new regression cases were caught as `should_fix`: family album `4`, books/reading `12`.
- `npm run verify:part1-runtime-fixtures` passed: 68 passes, 0 failures.

Next loop focus:

- Run a small real-provider Part 2 and Part 3 replay to confirm the prompt changes improve actual annotation coverage, not only judge detection.
- If provider output still misses these lanes, consider a non-learner-facing safety audit field for missing anchored coverage rather than local UI backfilling.

### 2026-06-15 - Part 1 Clean Retry Recovery

Input:

- User reported that Part 1 result-page re-analysis could still fail when the provider omitted one `cleanRetryAnswers` item.
- User challenged the loop direction: stop relying on an ever-heavier prompt contract; use a more robust AI app pattern.

Observed failures:

- A missing or malformed Part 1 clean retry answer was treated as an integrity failure, so the result page could preserve the old result instead of showing the newly analyzed feedback.
- This made backtesting inefficient because one omitted clean answer blocked the entire topic-thread result, even when the rest of the provider output was usable.

External pattern check:

- Current AI app guidance points toward structured outputs, validation, repair/retry, and partial recovery instead of one giant prompt contract.
- Applied product-level takeaway: provider output is unreliable input. The runtime should normalize, complete, expose diagnostics, then let certification/evals judge quality.

Fixes made:

- Added Part 1 clean retry completion in the shared safety normalization layer.
- Provider-supplied clean retry answers are kept when valid; missing answers are filled from grounded annotations, then from a reusable prior certified retry answer when safe, and finally from preserved learner wording so the report can continue to certification instead of blocking.
- Clean retry parsing problems are recorded as provider warnings in diagnostics instead of becoming hard schema failures when completion can recover the set.
- Added diagnostic fields such as `part1CleanRetryFilled:Q2,Q4` and `part1CleanRetryFallbackSources:Q2:annotation,Q4:annotation`.
- Added a regression fixture where the provider deliberately returns only Q1/Q3 clean retry answers for a four-question Part 1 thread; the verifier now requires Q2/Q4 recovery.

Validation:

- `npm run lint` passed.
- `npm run build` passed with existing Vite chunk/dynamic-import and large-chunk warnings.
- `npm run verify:feedback-judge` passed; the new clean-retry recovery regression passed before the judge cases ran.
- `npm run verify:part1-runtime-fixtures` passed: 68 passes, 0 failures.

Next loop focus:

- Extend the same recovery posture to other provider-owned answer blocks: complete or degrade gracefully, then certify or judge quality separately.
- Consider a longer-term migration from JSON-mode prompt contracts toward strict schema outputs where the selected provider supports them.

### 2026-06-17 - Real Replay Teacher Judge And Judge-Packet Repair

Input:

- `D:/chrome download/ielts-scholar-feedback-history-replay-2026-06-14T17-06-52-477Z.json`

Observed failures:

- DeepSeek 3-sample replay initially had teacher passes but one false provider failure from an incomplete optional `reusableExample`.
- Gemini 3-sample replay failed at provider connection/schema recovery with `fetch failed` for all samples; no usable content-quality judgment was possible from that run.
- After the reusable-example fix, DeepSeek 3-sample replay produced `providerFailures=0`, but one Part 1 teacher judge failed because the judge packet omitted visible Part 1 `developmentTargets`, causing a false claim that direct-answer + reason/detail coaching was missing.

Fixes made:

- Dropped incomplete optional Speaking `reusableExample` objects to `null` during safety normalization and recorded `reusableExampleDroppedIncomplete`.
- Added a verifier regression so incomplete optional `reusableExample` no longer creates validation errors or `parse_or_schema`.
- Expanded the feedback judge packet and visible-text scan to include Part 1 `developmentTargets`, `nextRetryPlan`, and material/expression details, and counted development targets as learning assets.

Validation:

- `npm run verify:feedback-judge` passed.
- `npm run lint` passed.
- DeepSeek Part 1 targeted replay: `sampled=1`, `executed=1`, `improved=1`, `worse=0`, `providerFailures=0`, `teacher=pass:95`.

Next loop focus:

- Run a fresh mixed DeepSeek 3-sample teacher replay when provider latency is acceptable.
- Diagnose Gemini `fetch failed` separately as a provider/connectivity issue before treating Gemini output as feedback-quality evidence.

### 2026-06-17 - Three-Part Real Replay Audit Loop

Input:

- `D:/chrome download/ielts-scholar-feedback-history-replay-2026-06-14T17-06-52-477Z.json`

Commands:

- `npm run replay:feedback-reanalysis -- --input "D:\chrome download\ielts-scholar-feedback-history-replay-2026-06-14T17-06-52-477Z.json" --limit 3 --part 1 --execute true --provider deepseek --judgeProvider deepseek --includePackets true --output "local_practice_data\feedback_judge\audit-part1-deepseek-after-loop-r2.json"`
- `npm run replay:feedback-reanalysis -- --input "D:\chrome download\ielts-scholar-feedback-history-replay-2026-06-14T17-06-52-477Z.json" --limit 3 --part 2 --execute true --provider deepseek --judgeProvider deepseek --includePackets true --output "local_practice_data\feedback_judge\audit-part2-deepseek-after-loop-r2.json"`
- `npm run replay:feedback-reanalysis -- --input "D:\chrome download\ielts-scholar-feedback-history-replay-2026-06-14T17-06-52-477Z.json" --limit 3 --part 3 --execute true --provider deepseek --judgeProvider deepseek --includePackets true --output "local_practice_data\feedback_judge\audit-part3-deepseek-after-loop-r6.json"`
- `npm run replay:feedback-reanalysis -- --input "D:\chrome download\ielts-scholar-feedback-history-replay-2026-06-14T17-06-52-477Z.json" --limit 1 --part 3 --execute true --provider gemini --judgeProvider deepseek --includePackets false --output "local_practice_data\feedback_judge\audit-gemini-smoke-after-loop.json"`

Observed failures:

- Part 1 needed better recovery/display for optional developed answers and clean retry answers that should integrate a missing descriptive detail rather than only repeat the learner's original answer.
- Part 2 provider output could place important repairs only in generic arrays, leaving the Part 2 annotation surface underfilled.
- Part 3 had two audit issues: strong answers with no local errors could produce an empty evidence ledger when a generated target answer existed, and exact-lane hard judge rules could overreport after teacher-pass outputs already had rich anchored priority evidence.
- Gemini still failed before content judging with `parseError: fetch failed`; the report then judged the local fallback template, so it is provider-connectivity evidence rather than Gemini feedback-quality evidence.

Fixes made:

- Normalized incomplete optional Speaking naturalness hints and reusable examples as recoverable provider issues instead of full parse failures.
- Recovered missing Speaking headline bands from valid visible criteria averages.
- Preserved Part 1 optional developed answers in safety normalization, the Part 1 display model, UI rendering, Markdown export, and judge packets.
- Scrubbed unsupported exact Part 1 target specifics, and integrated provider-supplied descriptive examples into underresponsive Part 1 clean retry answers.
- Backfilled Part 2 generic repairs into Part 2 annotations when the generic repair is anchored and the dedicated annotation surface is empty.
- Added Part 3 thinking-diagnosis evidence, high-band stability evidence, strong Part 3 generated-target ledger anchoring, and a teacher-pass-aware hard-judge calibration for rich Part 3 discussion packets.
- Strengthened Gemini prompts for unsupported Part 1 specifics, richer Part 1 naturalness feedback, Part 2 annotation mirroring, and Part 3 reasoning-refinement detail.

Validation:

- DeepSeek Part 1: `sampled=3`, `executed=3`, `improved=2`, `same=1`, `worse=0`, `providerFailures=0`, teacher passes `95`, `92`, `78`.
- DeepSeek Part 2: `sampled=3`, `executed=3`, `improved=1`, `same=2`, `worse=0`, `providerFailures=0`, teacher passes `85`, `92`, `92`.
- DeepSeek Part 3 r6: `sampled=3`, `executed=3`, `improved=0`, `same=3`, `worse=0`, `providerFailures=0`, teacher passes `92`, `92`, `93`.
- Gemini smoke: `sampled=1`, `executed=1`, `providerFailures=1`, `failureKind=parse_or_schema`, `parseError=fetch failed`; content quality remains unverified for Gemini.
- `npm run verify:feedback-judge` passed, with intentional undercovered fixtures still reporting expected `should_fix` counts.
- `npm run lint` passed.
- `npm run build` passed with existing Vite chunk/dynamic-import and large-chunk warnings.

Next loop focus:

- Treat DeepSeek as the currently validated Speaking replay provider for this loop.
- Diagnose Gemini transport/config separately before using Gemini teacher or content output as product-quality evidence.
- Expand the next replay only after provider latency/cost is acceptable, because the current 3x3 DeepSeek teacher loop already covers Part 1, Part 2, and Part 3 real-history samples.

### 2026-06-18 - Gemini Transport Diagnosis And Clean Fallback

Input:

- `D:/chrome download/ielts-scholar-feedback-history-replay-2026-06-14T17-06-52-477Z.json`

Observed failures:

- Minimal Node `fetch('https://generativelanguage.googleapis.com')` timed out with `UND_ERR_CONNECT_TIMEOUT`.
- PowerShell `Test-NetConnection generativelanguage.googleapis.com -Port 443` also failed.
- `.env.local` has a Gemini key and model, but no proxy or Gemini-compatible base URL override.
- The old replay script judged the local fallback feedback after Gemini failed, so teacher judge was reviewing fallback text rather than real Gemini output.
- Router `readEnv()` assumed `import.meta.env` always exists, which is false in Node/tsx diagnostic scripts.

Fixes made:

- Added optional Gemini provider config for `VITE_GEMINI_BASE_URL`, `GEMINI_BASE_URL`, `GEMINI_NEXT_GEN_API_BASE_URL`, `VITE_GEMINI_TIMEOUT_MS`, `GEMINI_TIMEOUT_MS`, and optional API version.
- Classified `fetch failed`, connect timeout, aborted timeout, and common network errors as `provider_unavailable` instead of `parse_or_schema`.
- Let router Gemini retry/fallback treat `provider_unavailable` as a DeepSeek fallback trigger.
- Made router `readEnv()` safe in both Vite/browser and Node/tsx contexts.
- Changed replay re-analysis so provider failures skip teacher judge instead of judging normalized fallback output.
- Added `.env.example` notes for optional Gemini base URL and timeout.

Validation:

- Gemini replay smoke: `sampled=1`, `executed=0`, `providerFailures=1`, `failure=provider_unavailable`, `teacher=skipped`.
- Product router smoke with `VITE_AI_PROVIDER=gemini` and short Gemini timeout fell back to DeepSeek: route provider `deepseek`, model `deepseek-v4-flash`, score returned.
- `npm run lint` passed.
- `npm run verify:feedback-judge` passed.
- `npm run build` passed with existing Vite chunk/dynamic-import and large-chunk warnings.

Current Gemini status:

- The app now handles Gemini failure cleanly and does not pollute content-quality review with fallback output.
- Real Gemini content quality is still unverified on this machine until the network can reach a Gemini-compatible endpoint or a valid proxy/base URL is configured.

### 2026-06-18 - Gemini Node Proxy Fix And Real Provider Replay

Input:

- `D:/chrome download/ielts-scholar-feedback-history-replay-2026-06-14T17-06-52-477Z.json`

Observed failures:

- The project Gemini key was present and valid: `models` API returned HTTP 200 when called through `curl.exe`.
- `curl.exe` was not a clean direct-network comparison: verbose output showed it used local proxy `127.0.0.1:7890`.
- Node/@google/genai did not automatically use that system proxy, so SDK calls still failed with `UND_ERR_CONNECT_TIMEOUT` / `fetch failed`.
- After setting `HTTPS_PROXY=http://127.0.0.1:7890`, `HTTP_PROXY=http://127.0.0.1:7890`, and `NODE_USE_ENV_PROXY=1` before starting Node, Gemini SDK calls could reach the API.
- First Gemini Part 1 replay then exposed a real provider-shape issue: incomplete optional `optionalPolish` and annotation layer objects missing `better`.

Fixes made:

- Documented the Node proxy requirement in `.env.example`.
- Normalized incomplete Part 1 optional polish phrase items and incomplete Part 1 annotation layers by dropping the incomplete item/layer and recording diagnostics, instead of failing the whole report.

Validation:

- Gemini Part 1 replay with Node proxy: `sampled=1`, `executed=1`, `improved=1`, `worse=0`, `providerFailures=0`, teacher `pass:92`.
- Gemini Part 2 replay with Node proxy: `sampled=1`, `executed=1`, `improved=1`, `worse=0`, `providerFailures=0`, teacher `pass:92`.
- Gemini Part 3 replay with Node proxy: `sampled=1`, `executed=1`, `same=1`, `worse=0`, `providerFailures=0`, teacher `pass:88`.

Current Gemini status:

- Gemini is usable for CLI replay when Node is started with the local proxy environment variables.
- The key is not currently the blocker; direct Node networking without proxy is the blocker.
