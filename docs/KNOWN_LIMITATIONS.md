# Known Limitations

_Last updated: 2026-05-29_

## Active Limitations

1. **Local provider keys are not production-safe.** Vite exposes `VITE_*` variables to browser/client code. Gemini and auto/DeepSeek modes are suitable only for personal local prototype use. No production server-side proxy, account system, encrypted key storage, or SaaS provider policy exists yet.
2. **Audio transcription can fail or fall back.** Speaking has audio-backed transcription, but reliability is not complete. Browser Web Speech and manual transcript editing remain important fallbacks. Low-signal audio is now gated as an adoptable candidate, but the newest behavior still needs post-reinstall browser validation.
3. **Browser Web Speech is limited.** Microphone selection, browser behavior, pauses, and recognition quality can still affect transcript quality.
4. **No formal pronunciation score exists.** Speaking estimates are transcript-based single-question training estimates and must not imply IELTS pronunciation scoring.
5. **Persistence was localStorage-only; IndexedDB transition is in progress.** A P0 storage quota incident (2026-05-28/29) forced emergency IndexedDB / PracticeRepository migration. Current state: 134 canonical practice records and 172 legacy sessions recovered into IndexedDB. (a) History migration-summary display fixed 2026-05-29 — now shows current IndexedDB inventory alongside initial migration result; (b) exact cause of `ielts_sessions` becoming unavailable/empty before automatic archive migration is not confirmed; (c) IndexedDB is browser-origin local storage and does not itself provide cross-browser/device sync; (d) final complete IndexedDB-inclusive backup confirmed exported by user 2026-05-29; (e) exact cause of localStorage becoming 0 MB without manual release remains unproven after code audit — no automatic clearing code path found in source. See `docs/P0_STORAGE_INDEXEDDB_INCIDENT_20260528_20260529.md`.
6. **Speaking targets are pedagogical, not official guarantees.** Normal Speaking target answers are practice resources with `BAND 7 TARGET ANSWER`, `BAND 7+ TARGET ANSWER`, or `STANDARD ANSWER` headings according to the current simplified policy.
7. **Writing audits remain separate.** Writing Task 2 target/score/feedback consistency needs a future audit. Writing Task 1 calibration remains future work and requires real samples.
8. **No production SaaS architecture exists.** Auth, server storage, admin bank publishing, provider key management, and production deployment decisions are later work.
9. **Export is attempt-level.** Session-level consolidated note export remains future work.
10. **PDF active-bank import is future work.** The active mainland bank exists in code, but folder import, extraction reports, and review/publish workflow are not implemented.
11. **Part 1 checkpoint acceptance is pending.** Topic-thread practice, annotated answers, cleaner retry answers, thread-level patterns, Material Bank, Next Retry Plan, exact-thread retry, fair selection, and export cleanup are implemented, but the newest runtime/export behavior still needs manual browser validation after reinstall.
