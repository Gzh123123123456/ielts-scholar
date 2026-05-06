# IELTS Scholar: Local-First Training Agent

Welcome to your serious IELTS output training assistant. This application is designed to help Chinese native speakers transform their Speaking and Writing into Band 7+ assets.

## 🚀 Getting Started

1. **Browse**: Use the Home page to choose between **Speaking** or **Writing** modules.
2. **Practice**: 
   - In **Speaking**, listen to the prompt, record your answer, and review the transcript.
   - In **Writing**, discuss your essay structure in the **Framework Phase** before drafting your full response.
3. **Analyze**: Click "Analyze" to see a detailed report. 
   - *Note: V1 uses a **Mock AI** for the prototype. It shows you what the report will look like without requiring a paid API key.*
4. **Export**: Download your results as an **Obsidian-ready Markdown note** to keep your learning permanent.

## 🛠 For Developers / Claude Code users

If you are continuing this project locally:

1. **AI Setup**: Configure your `GEMINI_API_KEY` in `.env`.
2. **Switch Provider**: Update `src/lib/ai/index.ts` to use `GeminiProvider` instead of `MockProvider`.
3. **Docs**: Read the documentation in `/docs` for product memory, design philosophy, and future roadmap.
4. **Data**: Session data is currently in `localStorage`. You may want to implement a local JSON file storage for a true local-first experience.

## ⚠️ Known V1 Limitations

- **Browser Support**: Use **Chrome** or **Edge** for the best speech-to-text experience.
- **Mock Mode**: Feedback is currently simulated for prototype purposes.
- **Microphone**: Ensure you click "Allow" when the browser asks for microphone access.

## 📖 Product Documentation

- `docs/PRODUCT_SPEC.md`: Full product vision.
- `docs/AI_BEHAVIOR_RULES.md`: How the AI should act (Strict & Calm).
- `docs/CLAUDE_HANDOFF.md`: Instructions for future Claude Code development.
- `docs/ROADMAP.md`: Planned features for V2 and beyond.

