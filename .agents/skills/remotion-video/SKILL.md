---
name: remotion-video
description: Remotion 4.x best practices, performance tuning, and dynamic vertical composition.
---

# Remotion Video Skill

## Purpose
Guidelines for implementing deterministic, crash-resilient Remotion compositions for 1080x1920 short-form video rendering.

## Remotion Principles
1. **Purity**: Render output must be a pure function of `frame`, `fps`, and `props`. No `Math.random()` or uncontrolled state.
2. **Dynamic Duration**: Always compute duration dynamically using `calculateMetadata()` reading from `dynamic_news.json`.
3. **Multi-Track Audio Ducking**:
   - Voiceover at 1.15 volume.
   - BGM ducks dynamically: `0.08` when voice is active, `0.20` during scene transitions.
4. **Transition Safety**:
   - Never bleed transparent backgrounds between scenes (always keep opaque backdrop layer).
   - Clamp all `interpolate()` functions with `extrapolateRight: 'clamp'`.
