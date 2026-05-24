# V1 Scope

> Historical reference only. Do not use this as current source of truth. For current work, read `HANDOFF_NEXT_CHAT`, `CURRENT_STATE`, `PROJECT_BACKLOG`, `ROADMAP`, `PRODUCT_DESIGN_PRINCIPLES`, `AGENT_WORKFLOW`, and `CODEBASE_MAP`.

## Implemented
- **Navigation**: Home, Speaking Entry, Writing Entry, Progress, Debug.
- **Speaking Practice**:
  - Web Speech API transcription.
  - Transcript editing after "Done".
  - Structured JSON analysis (Mock Provider).
  - Obsidian Markdown export.
- **Writing Task 2 Practice**:
  - Phase 1: Framework discussion (chat-like mock).
  - Phase 2: Full essay editor with word count.
  - Phase 3: Structured JSON feedback and model answer.
  - Obsidian Markdown export.
- **Progress Tracking**: Band history line chart.
- **Debug Panel**: State inspection and JSON export.
- **Design System**: Warm paper theme.

## Deferred (Future Versions)
- Real Gemini/DeepSeek API calls (isolated in providers).
- Speaking Mock Exam mode (strict timers).
- Writing Task 1 (Charts/Letters).
- Audio playback/waveform.
- Sentence-level writing coach (real-time).
- Pronunciation band scoring (requires advanced STT/Prosody analysis).
