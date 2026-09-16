---
name: video-storyboard
description: Storyboard generation and emotional beat planning for high-retention vertical short-form news videos.
---

# Video Storyboard Skill

## Purpose
This skill governs how raw facts and verified news stories are transformed into a structured, beat-by-beat storyboard for YouTube Shorts, TikTok, and Instagram Reels (9:16 vertical format).

## Narrative Arc (The 4-Beat Formula)
Every short-form storyboard must follow this exact emotional progression:
1. **Hook (0 - 2.5s)**: High-curiosity gap or concrete entity conflict. Never greet or ease into the topic.
2. **Stakes & Context (2.5 - 12s)**: Establish what happened, who is affected, and why it matters now.
3. **Evidence & Escalation (12 - 40s)**: High-density delivery of facts, numbers, quotes, or developments. Every 2-3 seconds introduces a new angle.
4. **Climax & Endless Loop (40 - 55s)**: Resolves the core question, then phrases the final sentence to grammatically or thematically connect back into the hook for rewatching.

## Storyboard Item Schema
```json
{
  "beatNumber": 1,
  "timeRange": "0.0s - 2.2s",
  "narrativePurpose": "HOOK_INTERRUPT",
  "emotion": "URGENCY",
  "keyInformation": "Samsung gives guaranteed 6-figure jobs to undergrads",
  "visualIntent": "Split headline punch with high-contrast text and breaking badge"
}
```
