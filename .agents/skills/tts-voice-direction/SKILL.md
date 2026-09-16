---
name: tts-voice-direction
description: Voice synthesis pacing, modulation, and natural language speech normalization.
---

# TTS Voice Direction Skill

## Purpose
Directs Edge-TTS voice generation to produce high-energy, articulate, and conversational speech that sounds natural rather than robotic.

## Voice Configuration Matrix
- **Vietnamese Domestic**: `vi-VN-NamMinhNeural` (Rate: +10% to +12%, Pitch: +0Hz).
- **Vietnamese Tech/Story**: `vi-VN-HoaiMyNeural` (Rate: +10%, Pitch: +0Hz).
- **English International**: `en-US-ChristopherNeural` (Rate: +8%, Pitch: +0Hz).

## Speech Normalization Rules
1. **Percentages**: `45%` -> `45 phần trăm` (VI) or `45 percent` (EN).
2. **Acronyms**: Space out letter acronyms (`U S B`, `A I`, `N A S A`) when pronunciation misfires.
3. **Hook Pacing**: First sentence is voiced with +12% speed to hook the audience immediately, settling into +8% for technical explanations.
