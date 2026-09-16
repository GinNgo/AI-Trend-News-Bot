# Remotion & Video Agent Skill Audit (Phase 1)

## Executive Summary
This document audits the official Remotion skills repository (`remotion-dev/skills`) and the Remotion Agent Skills Suite (`phamthanhnghia/remotion-agent-skills`) against the real-world operational constraints of **AI Trend News Bot**. 

Rather than blindly importing external generic skill suites, each skill is evaluated for:
- **Relevance**: Direct applicability to automated vertical (9:16) news explainers.
- **Performance Impact**: Render overhead, memory footprint, and concurrency safety on local Windows hosts.
- **Adoption Decision**: ADOPT, ADAPT, or REJECT.

---

## 1. Audit of Remotion Official Skills (`remotion-dev/skills`)

| Skill Name | Purpose | Evaluation & Project Fit | Decision |
| :--- | :--- | :--- | :--- |
| **remotion-best-practices** | Architectural guidelines, React purity, frame-driven math | **Critical.** Enforces pure deterministic rendering (`useCurrentFrame()`), avoids React state inside render loops, and uses `interpolate()` with explicit clamp. Must be adopted across all V3 components. | **ADOPT** |
| **remotion-captions** | Word-level timing, VTT/SRT ingestion, subtitles | **Critical.** Directly aligns with our Edge-TTS VTT subtitle engine. Outlines safe areas (avoiding bottom 300px where TikTok/Reels captions and usernames sit) and typography scaling. | **ADOPT** |
| **remotion-render** | CLI rendering, concurrency, memory allocation | **Critical.** Guides optimal CLI flags (`--concurrency`, `--gl=angle` fallback for Windows, `--timeout`). Essential for automated background render stability. | **ADOPT** |
| **remotion-multimedia** | Audio mixing, video B-roll, asset resolution | **High.** Provides patterns for `<Audio>` sequences, dynamic volume ducking, and `staticFile()` handling. Highly relevant for multi-track audio + SFX. | **ADAPT** |
| **remotion-markup** | SVG animations, lower-thirds, shape morphing | **High.** Useful for badges, breaking-news tickers, and geometric HUD backgrounds. | **ADAPT** |
| **remotion-docs** | API reference & lookup | **Medium.** Useful reference context for LLM agents during code generation, but static reference only. | **ADOPT (Reference)** |
| **remotion-create** | Scaffolding new compositions | **Low.** The project already has an established component tree (`src/Root.tsx`, `src/DynamicNews/`). Creating new templates is handled natively. | **REJECT** |
| **remotion-studio** | Interactive browser previewing | **None in Production.** In automated headless operation (PM2 / background tasks), Remotion Studio is not used. Only developer debugging. | **REJECT** |

---

## 2. Audit of Remotion Agent Skills Suite (`phamthanhnghia/remotion-agent-skills`)

| Skill / Domain | Targeted Feature | Evaluation for Short-Form News | Decision |
| :--- | :--- | :--- | :--- |
| **Motion Graphics** | B-roll transitions, kinetic typography, spring physics | High value for 1.5-2.5s shot changes. Needs spring damping tuning to avoid jarring vibrations. | **ADOPT** |
| **Explainers** | Information hierarchy, diagram animations | High value for tech & financial explainers. Uses cards, arrows, and step-by-step reveals. | **ADOPT** |
| **Captions & Safe Area** | TikTok/Shorts vertical overlays | High value. Prevents subtitle text clipping behind social UI controls (Like, Comment, Share buttons on the right, bio on bottom). | **ADOPT** |
| **Timing & Pacing** | Speech-to-visual synchronization | Critical. Replaces static 10s scenes with dynamic cuts on clause/word boundaries. | **ADOPT** |
| **Visual Composition** | Rule of thirds, focal anchors, 2.5D parallax | High value. Enhances single-photo scenes with depth separation (foreground text + blurred panning background). | **ADOPT** |
| **Transitions** | Directional wipe, zoom blur, fade | Moderate. We must avoid disorienting 3D tumbling or vertical swipes (which mimic user scroll). Keep to horizontal slides, subtle zooms, and quick cross-fades. | **ADAPT** |
| **Data Visualization** | Bar charts, line graphs, progress counters | High value. Already partially prototyped in `src/DynamicNews/charts/`. Needs tighter integration with AI fact extraction. | **ADOPT** |

---

## 3. Key Synthesis: What AI Trend News Bot V3 Needs

From this audit, we distill the exact requirements for our project-specific skills in **Phase 2** (`.agents/skills/`):

1. **Deterministic Pacing (Shot-Based)**: 
   - Never tie duration to arbitrary guesses; calculate frames strictly from `audioDuration * FPS`.
   - Break monolithic scenes into 1.5s - 3s sub-shots.
2. **Safe-Area Compliance for 9:16**:
   - Width: 1080px, Height: 1920px.
   - Top safe margin: 160px (status bar / header).
   - Bottom safe margin: 320px (engagement buttons, audio title, profile handle).
   - Right safe margin: 120px (action icons: like, comment, share).
   - Content zone: Center 840px x 1440px.
3. **Audio-First Synchronization**:
   - Visual changes must be triggered by narration milestones (e.g. at the exact frame where a key number or entity is spoken).
4. **Resilient Degradation**:
   - If an asset or chart fails to calculate, fall back gracefully to a solid kinetic typography layout rather than failing the render.

---

## 4. Plan for Project Skills Creation (Phase 2)
The 7 project-specific skills will be created in `.agents/skills/`:
1. `video-storyboard`: Narrative arc, emotional beats, and retention pacing.
2. `video-director`: Shot-by-shot visual purpose, camera movement, and audio sync.
3. `visual-direction`: Context-specific visual asset selection (Real photo vs Chart vs Kinetic text).
4. `shorts-retention`: Zero-bumper hook, pattern interrupts, and endless loop mechanics.
5. `remotion-video`: Remotion 4.x best practices, performance optimization, and frame math.
6. `video-qa`: Post-render verification (safe area, duration, frozen frames, audio levels).
7. `tts-voice-direction`: Voice pacing, speed modulation, and pronunciation normalization.
