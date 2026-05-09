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
   - Task 2 Phase 3 does not yet include inline essay annotations, click-to-locate behavior, underlines, overlays, or popover cards. The current repair stops at grouped feedback cards, correction numbers, global warnings, compact vocabulary upgrades, and personalized excerpt support.
   - Personalized Task 2 model excerpts are only labeled personalized for new feedback that explicitly uses the learner essay/framework context. Old saved `modelAnswer` text remains readable but is not automatically treated as personalized.
5. **Transcription**: Relies on browser Web Speech API. Works reliably in Chrome and Edge. Safari and AI Studio preview environments may be unreliable. Users should verify Chrome is using the correct microphone device.
6. **no-speech Recovery**: Speaking Practice auto-restarts recognition on `no-speech` errors (up to 2 retries). This covers brief silence, but if the wrong microphone device is selected in Chrome, recognition will not work regardless.
7. **Storage**: Data is stored in `localStorage`. Active attempts, practice records, provider usage estimates, and router cooldown state are recoverable in the same browser, but clearing browser data will lose history. No IndexedDB/database migration exists yet.
8. **Pronunciation**: No formal pronunciation score is provided as transcript-based analysis is insufficient for IELTS prosody marking.
9. **Real-time Feedback**: Intentional exclusion of real-time correction in Speaking to preserve user fluency.
10. **Export**: Obsidian export is via manual download of `.md` files.
11. **Future Providers**: OpenAI-compatible/OpenRouter configuration UI is a future hidden direction and is not implemented.
