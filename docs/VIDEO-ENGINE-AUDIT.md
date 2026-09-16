# AI Trend News Bot — Video Engine Audit (Phase 0)

## Executive Summary
This document provides an exhaustive, ground-truth technical audit of the video production engine in **AI Trend News Bot** as of September 2026. It identifies the operational pipeline, composition architecture, visual generation mechanics, asset lifecycle, quality control gaps, and architectural bottlenecks, establishing the baseline for the V3 Video Engine upgrade.

---

## 1. Current Video Generation Flow

The end-to-end video production pipeline is currently driven by `auto_pipeline.js` and `trend_bot.js` as follows:

```
[RSS / Topic Source]
        │
        ▼
[trend_bot.js] ────────► Filters viral topics & balances daily channel quotas (Domestic VN / Tech / Global EN)
        │
        ▼
[auto_pipeline.js]
  ├── Stage 1: Web Scraper (Cheerio HTTP/HTTPS fetch, extracts body text, og:image, and inline images)
  ├── Stage 2A: Fact Extraction (`extractFacts` via Gemini: summary, keyFacts, quotes, impact)
  ├── Stage 2.5: Language Detection & Classification (`detectLanguage`, auto re-extract if EN)
  ├── Stage 2B: Script Generation (`generateScript` via Gemini: 5-7 scenes, viral hook, endless retention loop)
  ├── Stage 2.6: Data Viz Classification (`classifyDataViz`: bar_chart, progress_ring, comparison, counter)
  ├── Stage 3: Channel Routing & Voice Config (`ChannelRouter`: resolves voice, pitch, rate per channel/language)
  ├── Stage 4: Audio Synthesis & Caption Alignment (Edge-TTS via `edge-tts` CLI -> MP3 + VTT caption generation)
  │      └── Audio duration measured via Python script or `music-metadata`
  ├── Stage 5: Frame Assembly & Payload Construction (`src/dynamic_news.json` with frame-calculated sequences)
  ├── Stage 6: Remotion Rendering (`npx remotion render DynamicNews` -> MP4, 1080x1920 @ 30fps)
  ├── Stage 7: Integrity Check & File Verification (validates output file existence & non-zero size)
  └── Stage 8: Publishing Engine (`src/publishing/publisher.js` schedules to YouTube / TikTok / Facebook)
```

---

## 2. Current Video Templates & Compositions

### 2.1 Remotion Compositions in `src/Root.tsx`
The project defines multiple compositions, but currently only **`DynamicNews`** is actively used for automated production:
- **`DynamicNews`** (Active): Vertical 1080x1920 @ 30 FPS, dynamic duration calculated via `calculateMetadata()` from `src/dynamic_news.json`.
- **Legacy Compositions** (`SportsNews`, `BusinessNews`, `TrafficNews`, `TechNews`, `HelloWorld`): Hard-coded frame counts (800-1800 frames), not dynamic, preserved for backward compatibility.
- **`ShortsThumbnail`**: Generates static 1080x1920 cover images.

### 2.2 Scene Layout Types in `src/DynamicNews/Scene.tsx`
The `DynamicNews` composition switches layout dynamically per scene based on `s.layoutType`:
1. **`LayoutIntro`**: First scene hook layout with category badge, punchy title scale (1.05x -> 1.0x), and optional news photo card or audio visualizer bars.
2. **`LayoutImage`**: Full-bleed or framed B-roll image layout with caption badge and headline.
3. **`LayoutList`**: Headline + animated bullet cards (key takeaways popping in sequentially).
4. **`LayoutStat`**: Big number typography with label and takeaway notes.
5. **`LayoutQuote`**: Blockquote styling with quotation marks, author attribution, and source badge.
6. **Data Viz Layouts** (`src/DynamicNews/charts/`):
   - `LayoutAnimatedCounter`: Numerical increment animation for raw quantities.
   - `LayoutBarChart`: Animated comparison bars with percentage/value tooltips.
   - `LayoutProgressRing`: Radial SVG progress circle for percentage completion or adoption metrics.
   - `LayoutLineChart`: Trendline visualization.
   - `LayoutComparison`: 2-column or 2-row side-by-side comparison layout.

---

## 3. Current Scene & Visual Generation

### 3.1 Prompting & Scene Breakdown
- The scriptwriter prompt in `src/ai/agents.js` (`generateScript`) forces Gemini to generate 5 to 7 monolithic scenes directly from extracted facts.
- Target duration is 45–55 seconds (~1350–1650 frames).
- Each scene represents a monolithic narration block (18–26 words), taking roughly 6 to 10 seconds of audio.
- Gemini returns `headline`, `voiceover`, `layoutType`, `tag`, and `keyTakeaways` in a single JSON payload.

### 3.2 Visual Asset Selection & Distribution
- **Source**: Scraped directly from the target news article via Cheerio (`og:image` + `<img>` tags).
- **Asset Pool**: Articles typically yield only 1 to 3 usable images.
- **Distribution Logic (SPEC-05)**:
  - If 1 image: Assigned only to Scene 1 (Hook) or Scene 2 (Evidence). Remaining scenes fall back to data-viz, list, or quote layouts with blurred CSS backgrounds.
  - If multiple images: Distributed alternately across scenes (`floor(i / 2) % images.length`).
  - No AI-generated images or targeted stock B-roll are retrieved when article images are scarce.

---

## 4. Current Motion, Animation & Camera System

### 4.1 Camera & Scale Transitions
- **Attention Reset Punch-Zoom (SPEC-03)**: A continuous mathematical sine wave pulse (`frame % 66` ~ 2.2s cycle, scale 1.0 to 1.032) is applied to the entire scene container to prevent complete stillness.
- **Micro-pan**: Subtle horizontal drift (`Math.sin(frame * 0.04) * 4px`).
- **Ken Burns on Images**: Linear interpolation from 1.0x to 1.15x over the scene duration.
- **Limitations**: There are no true 2.5D multi-plane parallax effects, dynamic camera tracking, speed ramping, or focal zooms.

### 4.2 Transitions Between Scenes
- Configured in `src/DynamicNews/index.tsx` using `@remotion/transitions`.
- Alternates between horizontal slide (`slide({ direction: "from-right" })`) and cross-fade (`fade()`).
- Timing alternates between `springTiming` (15 frames) and `linearTiming` (12 frames).

---

## 5. Current TTS Timing & Subtitle System

### 5.1 Voice Generation (Edge-TTS)
- Voice synthesis is handled via command-line invocation of Microsoft Edge-TTS:
  - Vietnamese: `vi-VN-NamMinhNeural` or `vi-VN-HoaiMyNeural` (rate: +10% to +12%).
  - English: `en-US-ChristopherNeural` (rate: +8%).
- Each scene is generated as an independent MP3 file (`dynamic_1.mp3`, `dynamic_2.mp3`, etc.).
- Audio duration is measured via Python script or `music-metadata`, then translated to exact frame counts: `Math.round(durSec * 30)`.
- A safety guard-rail clamps each scene duration between 3s and 14s.

### 5.2 Subtitle Karaoke Engine
- Edge-TTS outputs standard WebVTT subtitles containing word-level timestamps.
- `auto_pipeline.js` parses the VTT into `CaptionSegment` and `CaptionWord` arrays.
- `src/DynamicNews/Subtitles.tsx` highlights words in real-time as frames progress, with bounce animation on the currently spoken word.
- Positioned in bottom safe area with backdrop blur.

---

## 6. Current Quality Control (QC) & Recovery

### 6.1 Process-Level Recovery
- **Audio Fallback**: If an audio file is missing or corrupted (< 500 bytes), `auto_pipeline.js` automatically generates a silent MP3 fallback to prevent Remotion crash.
- **Image Fallback**: If an image is missing, the layout falls back to abstract animated grid patterns.
- **Render Timeout**: Configured with child process timeouts and retries.

### 6.2 QC Gaps
- There is **no AI or computer vision QA agent**.
- There is no automated detection of:
  - Subtitle text overflow or clipping.
  - Video freezes or static frames lasting > 4s.
  - Narration desynchronization with visual intent.
  - Repetitive visuals across consecutive scenes.
  - Safe-area violations on TikTok / Reels UI overlays.

---

## 7. Current System Weaknesses

| Area | Current Behavior | Bottleneck / Risk |
| :--- | :--- | :--- |
| **Pacing / Shots** | 1 scene = 1 static visual for 6-10s | Causes viewer drop-off after 2.5s; lacks multi-shot pacing |
| **Visual Variety** | Relies entirely on 1-3 scraped images | Scenes 3-6 frequently lack relevant visual assets |
| **Camera Work** | Repetitive 2.2s pulse-zoom sine wave | Feels synthetic and mechanical, lacks cinematic intent |
| **Director Intelligence** | Scriptwriter outputs visual layout directly | Gemini chooses layouts based on text rather than visual storytelling |
| **Quality Verification** | Binary pass/fail based on file creation | Visual flaws and layout overflows escape into production |
| **Repair Capability** | None (crashes or renders flawed video) | Cannot automatically split a static scene or re-position subtitles |

---

## 8. Recommended Improvements for V3 Architecture

1. **Implement Video Director Agent (`src/ai/agents/video_director.js`)**:
   - Decouple story writing from visual direction.
   - Director converts narration into an emotional arc with designated visual anchors and retention hooks.
2. **Implement Shot Planner Agent (`src/ai/agents/shot_planner.js`)**:
   - Divide every 6-10s scene into 2-4 explicit shots (each 1.5-3.0s).
   - Ensure visual changes occur on key semantic words or beats.
3. **Zero-Downtime Feature Flag**:
   - Wrap all new V3 modules behind `VIDEO_ENGINE=v2`.
   - Ensure the existing `VIDEO_ENGINE=v1` continues running uninterrupted for daily channel publishing.
4. **Post-Render Automated Video QA (`src/ai/agents/video_qa.js`)**:
   - Measurable rule-based score (0-100) evaluating static duration, subtitle bounds, asset presence, and audio sync.
5. **Auto-Repair Loop**:
   - When QA detects issues (e.g. static scene > 4.5s), automatically break the scene into sub-shots and re-render before publishing.
