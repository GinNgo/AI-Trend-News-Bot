---
name: tts-voice-direction
description: Voice synthesis pacing, modulation, and natural language speech normalization.
---

# TTS Voice Direction Skill

## Purpose
Directs Edge-TTS voice generation to produce high-energy, articulate, and conversational speech that sounds natural rather than robotic.

## The 8 Short-Form Voice Personas Matrix
| Persona Key | Name | Vietnamese Voice & Mod | English Voice & Mod |
| :--- | :--- | :--- | :--- |
| `NEWS_ANCHOR` | Thời Sự - Chính Luận | `vi-VN-NamMinhNeural` (Rate: +10%, Pitch: +0Hz) | `en-US-ChristopherNeural` (Rate: +8%, Pitch: +0Hz) |
| `MYSTERY` | Bí Ẩn - Rùng Rợn - Kỳ Bí | `vi-VN-NamMinhNeural` (Rate: +0%, Pitch: -8Hz) | `en-US-ChristopherNeural` (Rate: +0%, Pitch: -6Hz) |
| `BREAKING_ALERT`| Cảnh Báo Khẩn Cấp - Giật Gân | `vi-VN-NamMinhNeural` (Rate: +15%, Pitch: +2Hz) | `en-US-GuyNeural` (Rate: +12%, Pitch: +2Hz) |
| `TECH_HYPE` | Năng Động - GenZ - Công Nghệ | `vi-VN-HoaiMyNeural` (Rate: +14%, Pitch: +4Hz) | `en-US-EmmaNeural` (Rate: +10%, Pitch: +2Hz) |
| `FINANCE_EXPERT`| Chuyên Gia Kinh Tế - Tài Chính | `vi-VN-NamMinhNeural` (Rate: +8%, Pitch: -2Hz) | `en-US-ChristopherNeural` (Rate: +8%, Pitch: -2Hz) |
| `STORYTELLING` | Tâm Tình - Kể Chuyện Podcast | `vi-VN-NamMinhNeural` (Rate: +4%, Pitch: -4Hz) | `en-US-AndrewNeural` (Rate: +4%, Pitch: -2Hz) |
| `SATIRICAL_MEME`| Châm Biếm - Hài Hước - Meme | `vi-VN-HoaiMyNeural` (Rate: +10%, Pitch: +2Hz) | `en-US-BrianNeural` (Rate: +8%, Pitch: +2Hz) |
| `CINEMATIC_DOC` | Phóng Sự Tài Liệu Điện Ảnh | `vi-VN-NamMinhNeural` (Rate: +5%, Pitch: -6Hz) | `en-US-ChristopherNeural` (Rate: +5%, Pitch: -4Hz) |

## Dual-Voice Dialogue Architecture
- **Hook Scene 1**: Anchored by Host Voice to establish authority and high curiosity.
- **Evidence / Breakdown Scenes (Scenes 2 to N-1)**: Handed over to Reporter Voice (`vi-VN-HoaiMyNeural` or designated speaker) for fast-paced, multi-perspective delivery.
- **Endless Retention Loop Scene N**: Returning to Host Voice to seal the punchline and loop smoothly back to Scene 1.

## Speech Normalization Rules
1. **Percentages**: `45%` -> `45 phần trăm` (VI) or `45 percent` (EN).
2. **Acronyms**: Space out letter acronyms (`U S B`, `A I`, `N A S A`) when pronunciation misfires.
3. **Hook Pacing**: First sentence is voiced with +12% to +15% speed to hook the audience immediately, settling into the persona-specific pace for detailed breakdowns.
