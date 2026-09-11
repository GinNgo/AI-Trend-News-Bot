# ✅ Danh sách Nhiệm vụ (Tasks) — AI Trend News Bot v3

> Phân chia từ `plan.md`. Mỗi task độc lập, nhỏ gọn, có thể thực thi tuần tự.

---

## 🔴 P0: Feature R1 — Auto Language Detection

### Phase R1-A: Foundation
- [x] **R1-T1**: Tạo `SOURCE_METADATA` map trong `src/ai/language_classifier.js` với `region` + `defaultLang` cho 7+ nguồn RSS
- [x] **R1-T2**: Tạo `src/ai/language_classifier.js` — AI agent phân loại ngôn ngữ video
  - Input: sourceMetadata, facts, rawText
  - Output: `{ language, confidence, reasoning }`
  - Gemini prompt với 5 rules phân loại
- [x] **R1-T3**: Cập nhật `config.json` — thêm `LANGUAGE: "auto"` mode, giữ backward compat với `vi`/`en`

### Phase R1-B: Pipeline Integration
- [x] **R1-T4**: Tích hợp `classifyLanguage()` vào `auto_pipeline.js` — sau `extractFacts`, trước `generateScript`
- [ ] **R1-T5**: Tích hợp `classifyLanguage()` vào `src/application/video_factory_pipeline.js` (V2 pipeline)
- [x] **R1-T6**: Cập nhật `src/engine/video_engine.js` — TTS voice auto-switch theo `VOICE_MAP`
  - `vi` → `vi-VN-HoaiMyNeural` (rate +5%)
  - `en` → `en-US-ChristopherNeural` (rate +0%)

### Phase R1-C: Video UI Localization
- [x] **R1-T7**: Cập nhật `src/DynamicNews/Scene.tsx` — thêm LABELS map (vi/en) cho tag text
  - VI: "TIN NÓNG", "CẬP NHẬT", "BẰNG CHỨNG", "PHÁT BIỂU", "CHỈ SỐ"
  - EN: "BREAKING", "UPDATE", "EVIDENCE", "QUOTE", "STATS"
  - Truyền `language` prop vào DynamicScene
- [x] **R1-T8**: Cập nhật `src/DynamicNews/Outro.tsx` — CTA text theo ngôn ngữ
- [x] **R1-T9**: Cập nhật `src/DynamicNews/NewsTicker.tsx` — verify đã support `language` prop

### Phase R1-D: Publishing
- [x] **R1-T10**: Cập nhật `auto_pipeline.js` — YouTube metadata localized (title suffix, hashtags)
- [ ] **R1-T11**: Cập nhật `src/publishing/` providers — truyền language metadata

### Phase R1-E: Testing
- [ ] **R1-T12**: Tạo `test_language_classifier.js` — 10+ test cases cover:
  - TechCrunch article → EN
  - VnExpress local news → VI
  - VnExpress IPO quốc tế → EN
  - Google News VN khoa học → EN
  - Tuổi Trẻ đời sống → VI

---

## 🔴 P0: Feature R2 — Animated Data Visualization

### Phase R2-A: Type System
- [x] **R2-T1**: Mở rộng `src/DynamicNews/types.ts` — thêm 5 layout types mới + data interfaces
  - `ChartDataPoint { label, value, color? }`
  - `ComparisonItem { before, after }`
  - Thêm fields: `chartData`, `progressValue`, `counterTarget`, `counterPrefix`, `counterSuffix`, `comparisonData`

### Phase R2-B: Chart Components (mỗi component 1 task)
- [x] **R2-T2**: Tạo `src/DynamicNews/charts/AnimatedCounter.tsx`
  - Số chạy từ 0 → target dùng `interpolate()`
  - Auto-format: 1000000 → "1M" hoặc "1 triệu"
  - Prefix/suffix support ("$", "%", "triệu")
  - Glow effect + particle burst khi chạm target
- [x] **R2-T3**: Tạo `src/DynamicNews/charts/AnimatedBarChart.tsx`
  - Horizontal bars mọc từ 0 → value
  - Staggered spring animation (bar 1 → bar 2 → ...)
  - Labels + values animate cùng bar
  - Tối đa 5 bars, responsive sizing
- [x] **R2-T4**: Tạo `src/DynamicNews/charts/ProgressRing.tsx`
  - SVG circle + `stroke-dasharray`/`stroke-dashoffset` animation
  - Counter % ở center
  - Gradient color trên arc
  - Glow trail effect
- [x] **R2-T5**: Tạo `src/DynamicNews/charts/AnimatedLineChart.tsx`
  - SVG path draw animation
  - Data points pop-in khi line đi qua
  - Area fill gradient bên dưới
  - Simple axis labels
- [x] **R2-T6**: Tạo `src/DynamicNews/charts/ComparisonLayout.tsx`
  - Split-screen before/after
  - Slide-in animation từ 2 bên
  - "VS" indicator ở giữa với pulse
  - Color coding (red/green)
- [x] **R2-T7**: Tạo `src/DynamicNews/charts/index.ts` — barrel export

### Phase R2-C: Integration
- [x] **R2-T8**: Cập nhật `src/DynamicNews/Scene.tsx` — routing 5 layout types mới vào chart components
- [x] **R2-T9**: Tạo `src/ai/data_viz_classifier.js` — AI agent phân loại scene nào cần chart
  - Input: scenes[] + facts
  - Output: scenes[] with enhanced layoutType + chartData
  - Rules: 2+ số liệu → bar_chart, % → progress_ring, trend → line_chart, etc.
- [x] **R2-T10**: Tích hợp `classifyDataViz()` vào pipeline — sau `generateScript`, trước TTS

### Phase R2-D: Design Tokens
- [x] **R2-T11**: Cập nhật `src/design/tokens.ts` — thêm chart color palette
  - `colors.chart: ['#6366F1', '#38BDF8', '#22D3EE', '#34D399', '#FBBF24']`
  - `animation.chart: { counterDuration: 45, barDelay: 10, ringDuration: 60 }`

### Phase R2-E: Testing
- [ ] **R2-T12**: Tạo test props JSON cho mỗi chart type → render preview trong Remotion Studio
- [ ] **R2-T13**: Test full pipeline với bài có số liệu thống kê → verify chart auto-detection

---

## 🟡 P1: Improvements

### P1-A: Technical Debt
- [ ] **P1-T1**: Thêm `music-metadata` npm dependency + thay thế Python `mutagen` calls trong `video_engine.js`
- [ ] **P1-T2**: Cập nhật `.gitignore` — thêm `config.json`, `client_secret*.json`, `tokens.json`, `db_jobs.json`
- [ ] **P1-T3**: Cập nhật `config.example.json` với placeholder values cho tất cả secrets
- [ ] **P1-T4**: Xóa `db_jobs.json` (7.2MB) — confirm không cần migrate data trước

### P1-B: Consolidation
- [ ] **P1-T5**: Consolidate 4 Python TTS scripts → unified Node.js TTS trong `src/engine/`
  - Xóa: `generateTts.py`, `generateTechTts.py`, `generateTrafficTts.py`, `generate_tech_audio.py`
  - Tất cả TTS qua `video_engine.js`

---

## 🟢 P2: Future (chưa plan chi tiết)

- [ ] **P2-T1**: Subtitle/Caption tích hợp từ Edge TTS VTT output
- [ ] **P2-T2**: Semantic deduplication cho tin cùng sự kiện
- [ ] **P2-T3**: Auto-generate YouTube thumbnail
- [ ] **P2-T4**: Branded intro animation (2-3s)
- [ ] **P2-T5**: Audit model router — xóa model names không hợp lệ
- [ ] **P2-T6**: Multi-worker support (configurable 2-3 workers)

---

## 📊 Tổng kết

| Priority | Tasks | Estimated Complexity |
|---|---|---|
| P0 — R1 (Language) | 12 tasks | Medium |
| P0 — R2 (Data Viz) | 13 tasks | High |
| P1 — Improvements | 5 tasks | Low-Medium |
| P2 — Future | 6 tasks | Medium-High |
| **Total** | **36 tasks** | — |

> **Thứ tự thực thi đề xuất**: R1 (Foundation → Pipeline → UI → Publish → Test) → R2 (Types → Components → Integration → Test) → P1 → P2
