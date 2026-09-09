# AI Trend News Bot - Implementation Plan

## 1. Current Architecture
Monolithic script architecture (`trend_bot.js` calls `auto_pipeline.js` via `execSync`). No state management; database is a local JSON file.

## 2. Current Data Flow
RSS -> `trend_bot` (Gemini filter) -> URL -> `auto_pipeline` (Cheerio scraper) -> Gemini (JSON script) -> Edge-TTS (MP3) -> Python (audio duration) -> Remotion (MP4) -> YouTube API.

## 3. Current Scraper Flow
Uses basic `http/https` fetch -> Cheerio parses `<body>` and `og:image`. Removes junk tags, hard limits the output to 9000 characters.

## 4. Current Gemini Flow
One-shot prompting. Requests entire JSON schema (layout, visual, text, voiceover) in a single API call. Uses a fallback list of models containing several non-existent ones (gemini-3.7-flash, etc.).

## 5. Current Video Flow
Uses `TransitionSeries` with array map. `DynamicNews` works dynamically but other news templates have hard-coded frame durations.

## 6. Current Problems
- Content extraction frequently fails or is inaccurate on modern SPAs.
- AI hallucinates facts due to lack of deep grounding.
- Topic duplication (same event covered multiple times).
- High code coupling, poor error handling.
- Video length is hard-capped (~1 min).

## 7. Root Causes
- Scraper doesn't render JS.
- Deduplication relies on exact string matching instead of semantic embedding.
- Prompt is too greedy (demands visuals + script + facts in one step).
- Configurations and frame counts are hard-coded everywhere.

## 8. Proposed Architecture
**Modular Pipeline**: `RSS Engine` -> `Topic Clustering (Semantic)` -> `Deep Scraper (Puppeteer/Playwright)` -> `Multi-stage LLM (Outline -> Script -> Visuals)` -> `Asset Generator (TTS/Image)` -> `Remotion Engine`.

## 9. Files To Modify
- `trend_bot.js`: Change deduplication logic to semantic matching.
- `auto_pipeline.js`: Split into separate modules (Scraping, AI, Asset).
- `src/Root.tsx`: Remove hard-coded `durationInFrames`, use dynamic calculation.
- `src/DynamicNews/index.tsx`: Optimize render tree.
- `config.json`: Standardize model configurations.

## 10. Files To Create
- `src/scraper/browser.js`: Headless Browser integration (Puppeteer).
- `src/ai/prompts.js`: Separate prompt management.
- `src/ai/agents.js`: Orchestrator for 2-stage AI pipeline.
- `src/utils/dedup.js`: Semantic deduplication logic.
- `src/remotion/chunker.js`: Support for long-form video rendering.

## 11. Database Changes
Move `trend_history.json` to local SQLite to support semantic queries for deduplication.

## 12. API Changes
Integrate Search API (Tavily/Google Custom Search) for LLM cross-checking when data is missing.

## 13. Configuration Changes
Remove fake fallback models. Update to use `gemini-1.5-pro` (research), `gemini-1.5-flash` (extraction), and `gemini-2.5-flash`.

## 14. Testing Strategy
- Unit tests for audio duration logic.
- Mock Gemini API for JSON parser tests.
- Test scraper on SPA targets.

## 15. Migration Strategy
Run `auto_pipeline_v2.js` or modularize safely alongside existing code to maintain backward compatibility during migration.

## 16. Implementation Phases
- **Phase 1 (Scraper & AI Grounding):** Upgrade scraper to use Puppeteer, split LLM prompt into 2 steps (Research -> Script).
- **Phase 2 (Topic Deduplication):** Consolidate RSS events to prevent duplicate videos.
- **Phase 3 (Long-form Video Architecture):** Fix Remotion config, remove hard-coded frames, support chunked rendering.
- **Phase 4 (Stability & Cleanup):** Modularize codebase, add error handling, integrate SQLite.