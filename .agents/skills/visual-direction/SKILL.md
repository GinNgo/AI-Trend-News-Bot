---
name: visual-direction
description: Context-aware asset assignment, infographic selection, and visual hierarchy.
---

# Visual Direction Skill

## Purpose
Selects and crafts the most informative, visually compelling medium for each sentence. Eliminates generic, irrelevant, or repetitive stock imagery.

## Visual Medium Decision Matrix
- **Raw Numerical Metric / Percentage** -> `LayoutAnimatedCounter` or `LayoutProgressRing`.
- **Comparative Data (Before/After, Competitors)** -> `LayoutComparison` or `LayoutBarChart`.
- **Official Statement / Testimony** -> `LayoutQuote` with verified author name and portrait/badge.
- **Physical Event / Crime / Accident** -> Scraped photo evidence, newspaper headline screenshot, or B-roll map.
- **Abstract Concepts / Tech / AI** -> Kinetic typography with dynamic glowing HUD background.

## Asset Quality Rules
1. **Authenticity**: Never show generic smiling stock models for grave news events.
2. **Resolution & Crop**: Ensure primary focal points remain within the central 1080x1300 area (away from TikTok right-side buttons).
3. **Fallback Policy**: If no relevant image exists for a scene, switch to an animated infographic layout rather than repeating an image from an earlier scene.
