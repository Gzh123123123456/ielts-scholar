# IELTS Scholar Product Memory

> Historical reference only. Do not use this as current source of truth. For current work, read `HANDOFF_NEXT_CHAT`, `CURRENT_STATE`, `PROJECT_BACKLOG`, `ROADMAP`, `PRODUCT_DESIGN_PRINCIPLES`, `AGENT_WORKFLOW`, and `CODEBASE_MAP`.

## Vision
A serious, academic IELTS output training agent tailored for Chinese native speakers. Local-first, privacy-conscious, and focused on transforming user output into high-band assets.

## Core Modules
1. **Speaking**: Focus on naturalness and fluency. No real-time correction to avoid stuttering/habit-formation.
2. **Writing**: Focus on logical coherence (Phase 1 Framework) and academic precision (Phase 2 Essay).

## Key Philosophies
- **No Flattery**: Concise, strict, and useful feedback.
- **Local-First**: Data stays in browser storage (V1) or local files (Later).
- **Academic Vibe**: Elegant old-paper design to reduce digital fatigue and promote serious study.
- **Schema-Based AI**: All feedback is structured JSON for UI rendering.

## Architecture
- **React + TypeScript**: Clean and exportable.
- **AI Providers**: Mock (V1), Gemini (Bridge ready), OpenAI-Compatible (Future DeepSeek).
- **Obsidian Integration**: Standardized Markdown output for permanent knowledge retention.
