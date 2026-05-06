# Roadmap

## V1.1: API-Assisted Framework Consolidation + Session Notes
- Add **Generate Framework Summary** / **Extract Final Framework** in Writing Task 2 Phase 1.
- Use real AI provider (post-connection phase) to summarize Coach Discussion into structured framework fields:
  - Position
  - View A
  - View B
  - My opinion
  - Paragraph plan
  - Possible example
- Keep **user editability mandatory** before moving from Phase 1 to Phase 2.
- Add **Finish Session / Export Session Note** flow:
  - aggregate multiple speaking attempts and writing attempts/questions in one study session
  - summarize repeated errors, improvement trends, best upgraded answers, reusable expressions, and review cards

## V2: The Mock Exam Update
- Implementation of `SpeakingMock.tsx` and `WritingTask2Mock.tsx`.
- Strict timers and sequential question flow.
- Real API providers (Gemini/OpenAI) with error handling.

## V3: Data & Visualization
- Task 1 Academic charts with user interaction.
- Task 1 General Training letter prompts.
- Audio recording storage (MediaRecorder) and simple playback.

## V4: Knowledge & RAG
- PDF RAG for personal IELTS materials.
- Local filesystem access (via File System Access API or local Node server).
- Advanced pronunciation scoring integration.

## Writing Feedback Evolution (Post-V1)
- Keep current ordering in Writing Phase 3: My Framework and My Essay before feedback.
- Add sentence-level correction mapping in a future iteration.
- Consider inline annotation in later versions (not in V1).
