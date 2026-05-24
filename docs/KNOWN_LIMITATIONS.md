# Known Limitations

_Last updated: 2026-05-24_

## Active Limitations

1. **Local provider keys are not production-safe.** Vite exposes `VITE_*` variables to browser/client code. Gemini and auto/DeepSeek modes are suitable only for personal local prototype use. No production server-side proxy, account system, encrypted key storage, or SaaS provider policy exists yet.
2. **Audio transcription can fail or fall back.** Speaking has audio-backed transcription, but reliability is not complete. Browser Web Speech and manual transcript editing remain important fallbacks.
3. **Browser Web Speech is limited.** Microphone selection, browser behavior, pauses, and recognition quality can still affect transcript quality.
4. **No formal pronunciation score exists.** Speaking estimates are transcript-based single-question training estimates and must not imply IELTS pronunciation scoring.
5. **Persistence is localStorage only.** Practice records, active attempts, provider diagnostics, and local usage state can be lost if browser data is cleared. No IndexedDB/database migration exists yet.
6. **Speaking targets are pedagogical, not official guarantees.** Normal Speaking target answers are practice resources with `BAND 7 TARGET ANSWER`, `BAND 7+ TARGET ANSWER`, or `STANDARD ANSWER` headings according to the current simplified policy.
7. **Writing audits remain separate.** Writing Task 2 target/score/feedback consistency needs a future audit. Writing Task 1 calibration remains future work and requires real samples.
8. **No production SaaS architecture exists.** Auth, server storage, admin bank publishing, provider key management, and production deployment decisions are later work.
9. **Export is attempt-level.** Session-level consolidated note export remains future work.
10. **PDF active-bank import is future work.** The active mainland bank exists in code, but folder import, extraction reports, and review/publish workflow are not implemented.
