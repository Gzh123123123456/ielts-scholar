# Known Limitations (V1)

1. **AI Feedback**: V1 defaults to a Mock AI provider for prototyping. Real API keys are required for actual feedback.
2. **Transcription**: Relies on browser Web Speech API. Works reliably in Chrome and Edge. Safari and AI Studio preview environments may be unreliable. Users should verify Chrome is using the correct microphone device.
3. **no-speech Recovery**: Speaking Practice auto-restarts recognition on `no-speech` errors (up to 2 retries). This covers brief silence, but if the wrong microphone device is selected in Chrome, recognition will not work regardless.
4. **Storage**: Data is stored in `localStorage`. Clearing browser data will lose session history.
5. **Pronunciation**: No formal pronunciation score is provided as transcript-based analysis is insufficient for IELTS prosody marking.
6. **Real-time Feedback**: Intentional exclusion of real-time correction in Speaking to preserve user fluency.
7. **Export**: Obsidian export is via manual download of `.md` files.
