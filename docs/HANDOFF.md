# Handoff Instructions

## Context
This project was prototyped in Google AI Studio. It is designed to be continued by a developer or as a local-first IELTS training project.

## Development Rules
1. **Schema Integrity**: When updating AI logic, update `src/lib/ai/schemas.ts` first.
2. **Documentation First**: Before implementing a major feature, update `ROADMAP.md` and `DECISION_LOG.md`.
3. **Keep it Local**: Do not add a cloud database unless explicitly requested. Prefer local JSON/Markdown.
4. **Design Consistency**: Use the `PaperCard` and `SerifButton` components to maintain the warm academic notebook aesthetic.
5. **No Flattery**: AI prompts, when implemented, should stay calm, professional, and strict.

## Next Steps for Developer
1. Keep Mock Provider as the default provider while API readiness scaffolding matures.
2. Implement optional real provider paths only after provider safety and debug diagnostics are stable.
3. Use `/knowledge/ielts` as rubric and behavior guidance; do not add RAG until it is explicitly scoped.
4. Add full-stack or filesystem layers only if local browser storage is no longer enough.
5. Use the Writing Task 2 wide workspace direction as the reference for future Writing modules. Adjust Speaking separately; do not blindly widen Speaking to match Writing.
6. Future backlog item: **Question bank count + browse/random/select entry points**. Add low-noise counts and random/browse entry points from question data first; keep the full browse/select modal or panel as a separate UI task.
