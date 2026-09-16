---
name: video-director
description: Directs visual choreography, camera movements, shot pacing, and audio-visual alignment.
---

# Video Director Skill

## Purpose
The Video Director translates narrative beats into a granular **Video Plan**. The Director answers: *"What must the viewer see, feel, and focus on during every second of narration?"*

## Directorial Principles
1. **Never Leave a Frame Static > 2.5 Seconds**: Human attention decays sharply after 2.5s without visual modification.
2. **Shot Division**: Divide every 6-10s scene into 2-4 distinct shots (e.g. 1.8s Hook Text -> 2.5s B-roll Context -> 2.0s Key Stat Reveal).
3. **Visual Punch on Keyword**: Camera zooms or card pops must synchronize with the stressed word in the voiceover.
4. **Camera Movement Archetypes**:
   - `zoom_punch`: Quick 1.05x to 1.0x scale punch on hook or startling fact.
   - `ken_burns_pan`: Slow 1.0x to 1.15x drift across wide news imagery.
   - `parallax_slide`: Foreground text slides in opposite direction to background.
   - `snap_focus`: Quick cut to close-up data or author quote.

## Video Plan Specification
```json
{
  "sceneId": 1,
  "shots": [
    {
      "shotId": "1.1",
      "durationSec": 1.8,
      "purpose": "HOOK_PUNCH",
      "camera": "zoom_punch",
      "visualFocus": "HEADLINE_BADGE",
      "onScreenText": "RECORD CRASH",
      "audioSyncTrigger": "first_word"
    }
  ]
}
```
