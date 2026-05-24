# Known Limitations (V1)

1. **AI Feedback**: V1 defaults to a Mock AI provider for prototyping. Real API keys are required for actual feedback.
2. **Optional Gemini / Auto Provider Modes**: Gemini can be enabled with `VITE_AI_PROVIDER=gemini`; personal local routing can be enabled with `VITE_AI_PROVIDER=auto`. Because Vite exposes `VITE_*` variables to browser/client code, this is suitable only for local/personal prototype use. No production key management, server-side proxy, browser key input, or UI provider toggle exists yet.
   - `VITE_AI_PROVIDER=gemini` is Gemini-only; DeepSeek auto fallback is inactive.
   - `VITE_AI_PROVIDER=auto` is required for automatic DeepSeek fallback/intermediate routing.
   - Vite env changes require restarting the local dev server.
3. **Quota Estimates**: Gemini official remaining quota cannot be read reliably from this browser app. API Status shows local estimates only: requests today, current-minute requests, estimated current-minute input tokens, and cooldown.
4. **DeepSeek Fallback**: DeepSeek V4 Flash is used as the cheap fallback. DeepSeek V4 Pro is used for Task 2 high-quality fallback only before `2026-05-31T15:59:00Z`, unless `VITE_DEEPSEEK_ALLOW_PRO_AFTER_DISCOUNT=true`. Balance check is best-effort only and currently shown as unavailable if it cannot be read safely.
   - Task 2 framework coach and framework extraction use DeepSeek V4 Flash in auto mode when configured.
   - If DeepSeek is missing, those intermediate steps fall back to local mock handling and are labeled as mock.
   - Framework Coach readiness is a local/provider-assisted planning aid, not an IELTS official scoring signal.
   - Framework Summary is grounded in learner notes and coach discussion; if the learner has not decided something, the summary should mark it as missing rather than fill in a polished model plan.
   - Logic-to-correction links are provider-supplied when available and locally inferred only when the match is safe; otherwise the issue is shown as paragraph-level revision.
   - Task 2 Phase 3 annotated essay overlay baseline is implemented. Remaining work should be polish/consolidation only unless explicitly scoped.
   - Personalized Task 2 model excerpts are only labeled personalized for new feedback that explicitly uses the learner essay/framework context. Old saved `modelAnswer` text remains readable but is not automatically treated as personalized.
5. **Transcription**: Browser Web Speech remains available as the fast fallback, but Speaking now also supports audio-backed verbatim transcription v1 with MediaRecorder and an explicit provider transcription button.
   - Audio transcription is not grammar correction. It should preserve learner mistakes, false starts, repetitions, incomplete grammar, contractions, word forms, and uncertainty.
   - The final transcript used for AI analysis remains visible and editable by the learner.
   - Speaking shows one main transcript box for analysis; browser and audio transcripts are secondary collapsed details, not separate competing editors.
   - When Gemini audio transcription is available, the app automatically tries it after recording stops. A successful real audio transcript can become the draft final transcript unless the learner has already manually edited the transcript.
   - Context/keyword hints are sent to audio transcription to improve likely ASR ambiguity, but they are not grammar correction and must not polish or rewrite learner speech.
   - The current hint policy is generic/current-prompt only: Speaking part, question, cue-card text/bullets, topic/tags, compact IELTS phrase hints, and rough browser transcript as a weak hint. There is no personal glossary, user-specific vocabulary memory, or permanent custom dictionary.
   - Audio blobs are kept in memory for the current attempt only and are not stored in localStorage practice records.
   - Gemini can perform real audio transcription when local Gemini mode or auto mode has a usable Gemini key/quota. DeepSeek does not support audio input in this app and must not be presented as an audio transcription provider.
   - Mock provider may return a clearly labeled mock transcript for development UI flow only, but that mock transcript must not be used as real analysis input.
   - Better ASR quality still depends on provider success; if Gemini is unavailable or fails, the browser transcript and manual editing remain the fallback.
   - Accepted closeout state: audio-backed transcription exists, but reliability is not complete. `speaking_audio_transcription` can still fail or fall back and needs a separate future task before it should be treated as solved.
   - Production/SaaS transcription provider policy, persistent audio storage, and pronunciation scoring remain future work.
6. **no-speech Recovery**: Speaking Practice auto-restarts recognition on `no-speech` errors (up to 2 retries). This covers brief silence, but if the wrong microphone device is selected in Chrome, recognition will not work regardless.
   - Web Speech auto-resume is a regression-sensitive area: browser pause/auto-end should resume while recording is active, while Stop and Retry should stop or clear cleanly.
7. **Storage**: Data is stored in `localStorage`. Active attempts, practice records, provider usage estimates, and router cooldown state are recoverable in the same browser, but clearing browser data will lose history. No IndexedDB/database migration exists yet.
8. **Pronunciation**: No formal pronunciation score is provided as transcript-based analysis is insufficient for IELTS prosody marking. Speaking estimates exclude pronunciation and must not imply that pronunciation is dragging the score down.
9. **Speaking Target Answers**: Speaking target answers are learner practice resources, not AI-certified score guarantees.
   - Normal Speaking analysis shows a generated `upgradedAnswer` whenever generation succeeds.
   - The normal learner flow does not run target certification or Band 8 double-confirmation before displaying the answer.
   - Learner UI must not show VERIFIED / NOT VERIFIED target status, target-certification unavailable text, or raw provider method errors in the target-answer area.
   - Current answer display is either an estimated single-question band or an adjacent half-band range from the ordinary Speaking analysis pass; it is not produced by repeated self-certification.
   - Valid adjacent half-band ranges should render in the learner UI when returned by normal analysis; otherwise a single estimated band remains correct.
   - If the current lower bound is below Band 7.0, the heading is `BAND 7 TARGET ANSWER`; if the current lower bound is Band 7.0 or above and not high-band-stable, it is `BAND 7+ TARGET ANSWER`.
   - `STANDARD ANSWER` remains reserved for the existing high-band-stable situation.
   - Normal Speaking provider responses are structured feedback only. Provider-generated `obsidianMarkdown`, Band 8+/certification/self-score target fields, and `riskNoteZh` are not part of ordinary `speaking_analysis`; export markdown is generated locally after parsing.
   - Low/mid-band Speaking feedback should remain layered rather than sparse: MUST FIX, HIGH-IMPACT PHRASE FIXES, and PERSONAL MATERIAL & IDEA EXPANSION are expected when the transcript provides enough stable material.
   - Normal successful generated targets should report neutral `generated_target` diagnostics, not certification-style `needs_repair` / `target_failed_or_borderline` wording.
10. **Task 1 Calibration**: Writing Task 1 shares the target-state vocabulary, but it does not yet have the independent target validation loop used by Speaking and Writing Task 2. Generated Task 1 target reports should not be described as independently validated.
11. **Plugin / Translation Protection**: Plugin/notranslate behavior is considered solved for now. Future work should not reopen it unless a direct regression appears; answer text, target text, examples, and expressions should remain selectable/copyable.
12. **Real-time Feedback**: Intentional exclusion of real-time correction in Speaking to preserve user fluency.
13. **Export**: Obsidian export is via manual download of `.md` files.
14. **Future Providers**: OpenAI-compatible/OpenRouter configuration UI is a future hidden direction and is not implemented.
