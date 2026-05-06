# Claude Code Handoff Instructions

## Context
This project was prototyped in Google AI Studio. It is designed to be continued by a developer or as a local project using Claude Code.

## Development Rules
1. **Schema Integrity**: When updating AI logic, you MUST update `src/lib/ai/schemas.ts` first.
2. **Documentation First**: Before implementing a major feature, update `ROADMAP.md` and `DECISION_LOG.md`.
3. **Keep it Local**: Do not add a cloud database unless explicitly requested. Prefer local JSON/Markdown.
4. **Design Consistency**: Always use the `PaperCard` and `SerifButton` components to maintain the aesthetic.
5. **No Flattery**: Ensure the AI prompts (when implemented) strictly follow the "no flattery" rule. Use calm, professional, and strict language.

## Next Steps for Developer
1. Implement the real Gemini API provider in `src/lib/ai/providers/geminiProvider.ts`.
2. Populate `/knowledge/ielts` with high-quality redacted IELTS materials for RAG.
3. Add full-stack Express layer if filesystem access is needed.
