# Known Limitations (V1)

1. **AI Feedback**: V1 defaults to a Mock AI provider for prototyping. Real API keys are required for actual feedback.
2. **Optional Gemini Provider**: Gemini can be enabled for local development with `VITE_AI_PROVIDER=gemini` and `VITE_GEMINI_API_KEY=...`. Because Vite exposes `VITE_*` variables to browser/client code, this is suitable only for local/personal prototype use. No production key management, server-side proxy, or UI provider toggle exists yet.
3. **Transcription**: Relies on browser Web Speech API. Works reliably in Chrome and Edge. Safari and AI Studio preview environments may be unreliable. Users should verify Chrome is using the correct microphone device.
4. **no-speech Recovery**: Speaking Practice auto-restarts recognition on `no-speech` errors (up to 2 retries). This covers brief silence, but if the wrong microphone device is selected in Chrome, recognition will not work regardless.
5. **Storage**: Data is stored in `localStorage`. Clearing browser data will lose session history.
6. **Pronunciation**: No formal pronunciation score is provided as transcript-based analysis is insufficient for IELTS prosody marking.
7. **Real-time Feedback**: Intentional exclusion of real-time correction in Speaking to preserve user fluency.
8. **Export**: Obsidian export is via manual download of `.md` files.
