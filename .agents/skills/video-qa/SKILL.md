---
name: video-qa
description: Automated pre-publish and post-render quality assurance and defect detection.
---

# Video QA Skill

## Purpose
Executes rigorous quality inspection on rendered videos and manifests before publishing to social channels.

## Automated Verification Checks
1. **Duration Compliance**: 35s <= totalDuration <= 58s.
2. **Safe Area Compliance**: No critical text outside 160px top, 320px bottom, 120px right.
3. **Static Frame Threshold**: No shot may remain unchanged for > 3.5 seconds.
4. **Audio Integrity**: Voiceover tracks must exist, have size > 500 bytes, and contain non-zero audio levels.
5. **Asset Repetition**: The exact same image URL/file must not be displayed consecutively across adjacent scenes unless intentionally zooming into detail.

## QA Result Structure
```json
{
  "status": "PASS",
  "score": 94,
  "issues": [],
  "metrics": {
    "durationSec": 48.2,
    "maxStaticDurationSec": 2.4,
    "visualChangeCount": 16
  }
}
```
