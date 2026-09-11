# ✅ Danh sách Nhiệm vụ (Tasks) — AI Trend News Bot v3

> Phân chia từ `plan.md`. **36/36 tasks hoàn tất. ✅ ALL DONE!**

---

## 🔴 P0: Feature R1 — Auto Language Detection ✅ HOÀN TẤT

### Phase R1-A: Foundation
- [x] **R1-T1**: Tạo `SOURCE_METADATA` map trong `src/ai/language_classifier.js`
- [x] **R1-T2**: Tạo `src/ai/language_classifier.js` — AI agent phân loại ngôn ngữ video
- [x] **R1-T3**: Cập nhật `config.json` — `LANGUAGE: "auto"` mode

### Phase R1-B: Pipeline Integration
- [x] **R1-T4**: Tích hợp `classifyLanguage()` vào `auto_pipeline.js`
- [x] **R1-T5**: Tích hợp `classifyLanguage()` vào `video_factory_pipeline.js` (V2 pipeline)
- [x] **R1-T6**: TTS voice auto-switch: `vi-VN-HoaiMyNeural` ↔ `en-US-ChristopherNeural`

### Phase R1-C: Video UI Localization
- [x] **R1-T7**: Localize tag labels trong `Scene.tsx` (VI/EN)
- [x] **R1-T8**: Localize CTA text trong `Outro.tsx`
- [x] **R1-T9**: Verify `NewsTicker.tsx` — đã support `language` prop

### Phase R1-D: Publishing
- [x] **R1-T10**: Localize YouTube metadata trong `auto_pipeline.js`
- [x] **R1-T11**: Truyền language qua `publisher.js` + `upload_youtube.js`

### Phase R1-E: Testing
- [x] **R1-T12**: `test_language_classifier.js` — 9/9 passed ✅

---

## 🔴 P0: Feature R2 — Animated Data Visualization ✅ HOÀN TẤT

### Phase R2-A–D
- [x] **R2-T1–T11**: Types, 5 chart components, AI classifier, Scene routing, design tokens
- [x] **R2-T12**: `test_data_viz.json` for Remotion Studio preview
- [x] **R2-T13**: TypeScript 0 errors ✅

---

## 🟡 P1: Improvements ✅ HOÀN TẤT

- [x] **P1-T1**: Replace Python `mutagen` → npm `music-metadata`
- [x] **P1-T2**: `.gitignore` — added `db_jobs.json`
- [x] **P1-T3**: `config.example.json` — all fields with placeholders
- [x] **P1-T4**: Deleted `db_jobs.json` (7.2MB)
- [x] **P1-T5**: Archived 6 Python scripts → `legacy_scripts/`

---

## 🟢 P2: Future Features ✅ HOÀN TẤT

- [x] **P2-T1**: Subtitle/Caption — `Subtitles.tsx` with word-level highlighting, integrated into `DynamicNewsComp`
- [x] **P2-T2**: Semantic Deduplication — `src/ai/semantic_dedup.js` using AI grouping
- [x] **P2-T3**: Auto-generate YouTube Thumbnail — `Thumbnail.tsx` (1280×720 composition)
- [x] **P2-T4**: Branded Intro Animation — `BrandedIntro.tsx` (3s punchy intro)
- [x] **P2-T5**: Audit Model Router — removed 3 invalid models, added `CLASSIFY` task type
- [x] **P2-T6**: Multi-worker support — `WorkerPool` class, `WORKER_COUNT` env var

---

## 📊 Tổng kết

| Priority | Tasks | Status |
|---|---|---|
| P0 — R1 (Language) | 12/12 | ✅ Done |
| P0 — R2 (Data Viz) | 13/13 | ✅ Done |
| P1 — Improvements | 5/5 | ✅ Done |
| P2 — Future | 6/6 | ✅ Done |
| **Total** | **36/36** | **✅ 100%** |
