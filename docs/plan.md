# 🏗️ Kế hoạch Kỹ thuật (Technical Plan) — AI Trend News Bot v3

> Dựa trên đặc tả `spec.md`, kế hoạch này mô tả CHI TIẾT cách triển khai 2 tính năng P0 và các cải thiện P1.

---

## Kiến trúc Tổng thể (sau cải thiện)

```
┌─────────────────────────────────────────────────────────────────┐
│                        RSS FEEDS (7 sources)                     │
│  HN │ TechCrunch │ TheVerge │ VentureBeat │ GNewsVN │ VNE │ TT  │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│  COLLECTOR                                                         │
│  ┌──────────────┐  ┌─────────────────────────┐                    │
│  │ RSS Adapter   │  │ Source Metadata           │                  │
│  │               │→ │ { origin, region, lang }  │                  │
│  └──────────────┘  └─────────────────────────┘                    │
└───────────────────────────┬───────────────────────────────────────┘
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│  🆕 LANGUAGE CLASSIFIER (AI Agent)                                │
│  Input:  source metadata + article content + facts                 │
│  Output: { language: "en"|"vi", confidence, reasoning }           │
│  Rules:  International impact → EN / Domestic impact → VI          │
└───────────────────────────┬───────────────────────────────────────┘
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│  AI PIPELINE                                                       │
│  Stage 1: extractFacts(rawText, language)                          │
│  Stage 2: generateScript(facts, images, language)                  │
│  🆕 Stage 2.5: classifyDataViz(facts) → chart types               │
└───────────────────────────┬───────────────────────────────────────┘
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│  TTS ENGINE                                                        │
│  Auto-select voice:                                                │
│    vi → vi-VN-HoaiMyNeural │ en → en-US-ChristopherNeural         │
│  Language propagated from classifier                               │
└───────────────────────────┬───────────────────────────────────────┘
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│  REMOTION RENDER                                                   │
│  DynamicNews composition                                           │
│  🆕 New layout types: "animated_counter" | "bar_chart" |           │
│     "progress_ring" | "line_chart" | "comparison"                  │
│  🆕 Language-aware UI (ticker, outro, captions)                    │
└───────────────────────────┬───────────────────────────────────────┘
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│  PUBLISHER (multi-platform)                                        │
│  🆕 Language-aware metadata (title, description, tags, lang code) │
└───────────────────────────────────────────────────────────────────┘
```

---

## Feature R1: Auto Language Detection (VI/EN)

### R1.1 — Source Metadata Enrichment

**File:** `src/collector/adapters/rss.js` (MODIFY)

Thêm metadata `region` và `defaultLanguage` cho mỗi RSS source:

```javascript
const SOURCE_METADATA = {
  'news.ycombinator.com':    { region: 'international', defaultLang: 'en', name: 'Hacker News' },
  'techcrunch.com':          { region: 'international', defaultLang: 'en', name: 'TechCrunch' },
  'theverge.com':            { region: 'international', defaultLang: 'en', name: 'The Verge' },
  'venturebeat.com':         { region: 'international', defaultLang: 'en', name: 'VentureBeat' },
  'news.google.com':         { region: 'vietnam',       defaultLang: 'vi', name: 'Google News VN' },
  'vnexpress.net':           { region: 'vietnam',       defaultLang: 'vi', name: 'VnExpress' },
  'tuoitre.vn':              { region: 'vietnam',       defaultLang: 'vi', name: 'Tuổi Trẻ' },
};
```

### R1.2 — Language Classifier AI Agent

**File:** `src/ai/language_classifier.js` (NEW)

Tạo AI agent mới chuyên phân loại ngôn ngữ video:

```javascript
/**
 * Phân loại ngôn ngữ video dựa trên:
 * 1. Nguồn tin (international vs vietnam)
 * 2. Nội dung bài báo (impact scope)
 * 3. Facts đã extract
 *
 * Return: { language: "en" | "vi", confidence: 0-1, reasoning: string }
 */
async function classifyLanguage(genAI, { sourceMetadata, facts, rawText }) { ... }
```

**Prompt logic cho AI:**
```
Bạn là chuyên gia phân loại ngôn ngữ cho video tin tức.
Dựa vào thông tin sau, hãy quyết định video nên bằng TIẾNG ANH hay TIẾNG VIỆT.

RULES:
1. Nguồn quốc tế (TechCrunch, HN, TheVerge, VentureBeat) → mặc định ENGLISH
2. Nguồn VN nhưng tin ảnh hưởng quốc tế (IPO, AI breakthrough, global market) → ENGLISH
3. Nguồn VN + tin nội địa (giao thông, đời sống, chính sách VN) → VIETNAMESE
4. Tin khoa học/nghiên cứu published bằng English → ENGLISH
5. Tin thể thao VN, giải trí VN → VIETNAMESE

Nguồn: {source}
Tóm tắt: {facts.summary}
Thể loại: {facts.category}
Ảnh hưởng: {facts.impact}

Trả về JSON: { "language": "en" | "vi", "confidence": 0.0-1.0, "reasoning": "..." }
```

### R1.3 — Pipeline Integration

**File:** `auto_pipeline.js` (MODIFY) + `src/application/video_factory_pipeline.js` (MODIFY)

Sau bước `extractFacts`, thêm bước `classifyLanguage`:

```
extractFacts(rawText, 'vi') // extract facts trước (default vi)
  → classifyLanguage(sourceMetadata, facts)
  → generateScript(facts, images, detectedLanguage)  // pass detected language
  → TTS với voice phù hợp
```

### R1.4 — TTS Voice Auto-Switch

**File:** `src/engine/video_engine.js` (MODIFY)

Sửa TTS logic để auto-select voice theo language:

```javascript
const VOICE_MAP = {
  vi: { voice: 'vi-VN-HoaiMyNeural', rate: '+5%', pitch: '+0Hz' },
  en: { voice: 'en-US-ChristopherNeural', rate: '+0%', pitch: '+0Hz' },
};
```

### R1.5 — Video UI Language Awareness

**File:** `src/DynamicNews/NewsTicker.tsx` (MODIFY)

NewsTicker đã nhận `language` prop → cần đảm bảo text labels adapt:
- VI: "TIN NÓNG", "CẬP NHẬT", "BẰNG CHỨNG", "CHỈ SỐ"
- EN: "BREAKING", "UPDATE", "EVIDENCE", "STATS"

**File:** `src/DynamicNews/Scene.tsx` (MODIFY)

Thêm `language` prop cho DynamicScene, thay đổi labels:

```typescript
interface DynamicSceneItem {
  // ... existing fields
  language?: 'vi' | 'en';  // đã có nhưng chưa sử dụng tại Scene
}

// Mapping labels
const LABELS = {
  vi: { breaking: '🔥 TIN NÓNG', update: '📊 CẬP NHẬT', evidence: '📸 BẰNG CHỨNG', quote: '💬 PHÁT BIỂU', stats: '✨ CHỈ SỐ' },
  en: { breaking: '🔥 BREAKING', update: '📊 UPDATE', evidence: '📸 EVIDENCE', quote: '💬 QUOTE', stats: '✨ STATS' },
};
```

**File:** `src/DynamicNews/Outro.tsx` (MODIFY)

Outro CTA thay đổi theo ngôn ngữ:
- VI: "Theo dõi để cập nhật tin mới nhất!"
- EN: "Subscribe for the latest updates!"

### R1.6 — YouTube Metadata Language

**File:** `upload_youtube.js` (MODIFY)

Truyền `language` vào YouTube API metadata:
- `defaultLanguage`: `vi` hoặc `en`
- `defaultAudioLanguage`: `vi` hoặc `en`
- Title/Description/Tags generate bằng ngôn ngữ tương ứng

### R1.7 — Config Update

**File:** `config.json` (MODIFY)

Thay `LANGUAGE: "vi"` → `LANGUAGE: "auto"` (mặc định). Cho phép override thành `vi` hoặc `en` cố định.

---

## Feature R2: Animated Data Visualization Components

### R2.1 — Data Visualization Type System

**File:** `src/DynamicNews/types.ts` (MODIFY)

Mở rộng `layoutType` với các data viz types mới:

```typescript
export interface DynamicSceneItem {
  // ... existing fields
  layoutType?: 'list' | 'stat' | 'quote' | 'spotlight' | 'image'
    | 'animated_counter' | 'bar_chart' | 'progress_ring' | 'line_chart' | 'comparison';

  // New fields for data visualization
  chartData?: ChartDataPoint[];     // Data cho bar/line charts
  progressValue?: number;           // 0-100 cho progress ring
  progressLabel?: string;           // Label cho progress ring
  comparisonData?: ComparisonItem;  // Data cho comparison layout
  counterTarget?: number;           // Target number cho animated counter
  counterPrefix?: string;           // "$", "€", etc.
  counterSuffix?: string;           // "%", "M", "B", "triệu", etc.
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ComparisonItem {
  before: { label: string; value: string; };
  after: { label: string; value: string; };
}
```

### R2.2 — AI Data Viz Classifier

**File:** `src/ai/data_viz_classifier.js` (NEW)

Sau khi `generateScript`, thêm bước phân loại xem scene nào cần data viz:

```javascript
/**
 * Phân tích script đã generate, xác định scene nào có thể
 * benefit từ data visualization animation.
 *
 * Input: scenes[] từ generateScript output
 * Output: scenes[] with enhanced layoutType + chartData
 */
async function classifyDataViz(genAI, scenes, facts) { ... }
```

**Prompt:**
```
Dựa vào dữ liệu scenes dưới đây, hãy xác định scene nào phù hợp với data visualization animation.

RULES:
- Nếu scene có 2+ số liệu SO SÁNH → layoutType: "bar_chart", cung cấp chartData
- Nếu scene có % hoặc tỷ lệ → layoutType: "progress_ring", cung cấp progressValue
- Nếu scene có xu hướng theo thời gian → layoutType: "line_chart", cung cấp chartData
- Nếu scene có 1 con số nổi bật (doanh thu, người dùng, etc) → layoutType: "animated_counter"
- Nếu scene có before/after → layoutType: "comparison"
- Nếu scene KHÔNG có data rõ ràng → giữ nguyên layoutType gốc

CHỈ thay đổi layoutType khi data thực sự phù hợp. KHÔNG ép buộc.
```

### R2.3 — Animated Counter Component

**File:** `src/DynamicNews/charts/AnimatedCounter.tsx` (NEW)

```typescript
// Số chạy từ 0 → target value, với easing
// Hiệu ứng: Glowing number, pulse khi đạt target, particles burst
// Sử dụng: interpolate(frame, [start, end], [0, target])
```

Features:
- Number format tự động (1,000,000 → "1M" hoặc "1 triệu" theo language)
- Prefix/suffix support ("$2.5B", "45%", "1.2 triệu người")
- Glow effect khi counter chạy xong
- Mini particles burst khi đạt target

### R2.4 — Animated Bar Chart Component

**File:** `src/DynamicNews/charts/AnimatedBarChart.tsx` (NEW)

```typescript
// Horizontal/Vertical bars mọc từ 0 → value
// Staggered animation: bar 1 trước, bar 2 sau, ...
// Label hiện sau khi bar mọc xong
// Color coding theo theme hoặc custom
```

Features:
- Tối đa 5 bars (giới hạn để readable trên mobile)
- Spring animation cho mỗi bar
- Value labels animate cùng bar
- Responsive sizing dựa trên số lượng bars

### R2.5 — Animated Progress Ring Component

**File:** `src/DynamicNews/charts/ProgressRing.tsx` (NEW)

```typescript
// SVG circle với stroke-dasharray animation
// Số % chạy ở giữa ring
// Glow trail effect
```

Features:
- Smooth arc animation từ 0% → target%
- Color gradient trên arc
- Center text với animated counter
- Label bên dưới

### R2.6 — Animated Line Chart Component

**File:** `src/DynamicNews/charts/AnimatedLineChart.tsx` (NEW)

```typescript
// SVG path draw animation (stroke-dashoffset)
// Dots xuất hiện khi line đi qua
// Area fill gradient phía dưới line
```

Features:
- Line vẽ dần từ trái → phải
- Data points pop-in khi line tới
- Optional area fill gradient
- Axis labels (simplified cho mobile)

### R2.7 — Comparison Layout Component

**File:** `src/DynamicNews/charts/ComparisonLayout.tsx` (NEW)

```typescript
// Split-screen before/after
// Animated slide-in từ 2 bên
// Arrow or versus indicator ở giữa
```

Features:
- Left panel (before/old) slide-in từ trái
- Right panel (after/new) slide-in từ phải
- "VS" or "→" indicator ở giữa với pulse
- Color coding (red = bad, green = good)

### R2.8 — Chart Index & Scene Integration

**File:** `src/DynamicNews/charts/index.ts` (NEW)

Export tất cả chart components.

**File:** `src/DynamicNews/Scene.tsx` (MODIFY)

Thêm routing cho các layout types mới:

```typescript
if (data.layoutType === 'animated_counter') LayoutComponent = LayoutAnimatedCounter;
if (data.layoutType === 'bar_chart') LayoutComponent = LayoutBarChart;
if (data.layoutType === 'progress_ring') LayoutComponent = LayoutProgressRing;
if (data.layoutType === 'line_chart') LayoutComponent = LayoutLineChart;
if (data.layoutType === 'comparison') LayoutComponent = LayoutComparison;
```

---

## Improvements P1: Quick Wins

### P1.1 — Replace Python Audio Duration

**File:** `package.json` (MODIFY) — thêm `music-metadata` dependency
**File:** `src/engine/video_engine.js` (MODIFY)

Thay:
```javascript
const { execSync } = require('child_process');
const duration = execSync(`python -c "from mutagen.mp3 import MP3; print(MP3('${file}').info.length)"`);
```

Bằng:
```javascript
const mm = require('music-metadata');
const metadata = await mm.parseFile(file);
const duration = metadata.format.duration;
```

### P1.2 — Secrets Cleanup

- **File:** `.gitignore` (MODIFY) — thêm `config.json`, `client_secret*.json`, `tokens.json`
- **File:** `config.example.json` (MODIFY) — update với placeholder values
- Di chuyển secrets sang `.env`

### P1.3 — Remove Legacy db_jobs.json

- **File:** `db_jobs.json` (DELETE) — sau khi confirm không có data cần migrate
- **File:** `.gitignore` (MODIFY) — thêm `db_jobs.json`

---

## Cấu trúc File/Thư mục sau Cải thiện

```
src/
├── ai/
│   ├── agents.js                    # (existing)
│   ├── language_classifier.js       # 🆕 R1.2
│   ├── data_viz_classifier.js       # 🆕 R2.2
│   ├── model_router.js              # (existing)
│   ├── researcher.js                # (existing)
│   └── schemas.js                   # (existing)
├── DynamicNews/
│   ├── index.tsx                    # (existing)
│   ├── Scene.tsx                    # (modify) R1.5, R2.8
│   ├── Background.tsx               # (existing)
│   ├── NewsTicker.tsx               # (modify) R1.5
│   ├── Outro.tsx                    # (modify) R1.5
│   ├── types.ts                     # (modify) R2.1
│   └── charts/                      # 🆕 R2.3-R2.7
│       ├── index.ts
│       ├── AnimatedCounter.tsx
│       ├── AnimatedBarChart.tsx
│       ├── ProgressRing.tsx
│       ├── AnimatedLineChart.tsx
│       └── ComparisonLayout.tsx
├── design/
│   ├── tokens.ts                    # (existing, may add chart colors)
│   └── components/                  # (existing)
├── engine/
│   └── video_engine.js              # (modify) R1.4, P1.1
├── collector/
│   └── adapters/rss.js              # (modify) R1.1
└── ...

docs/
├── constitution.md                  # 🆕 SDD Phase 1
├── spec.md                          # 🆕 SDD Phase 2
├── plan.md                          # 🆕 SDD Phase 3 (this file)
└── tasks.md                         # 🆕 SDD Phase 4
```

---

## Data Flow — Ví dụ End-to-End

### Ví dụ 1: Tin TechCrunch "OpenAI raises $10B"

```
1. RSS: TechCrunch → source: international, defaultLang: en
2. Scrape: Full article content
3. extractFacts → { summary, category: "Công nghệ", impact: "global AI market" }
4. 🆕 classifyLanguage → { language: "en", confidence: 0.95 }
5. generateScript(facts, imgs, "en") → English voiceover script
6. 🆕 classifyDataViz → scene[1].layoutType = "animated_counter" ($10B),
                         scene[3].layoutType = "bar_chart" (funding comparison)
7. TTS: en-US-ChristopherNeural → English audio
8. Render: DynamicNews with animated counter + bar chart scenes
9. Publish YouTube: lang="en", English title/desc/tags
```

### Ví dụ 2: Tin VnExpress "Cấm xe máy nội đô Hà Nội"

```
1. RSS: VnExpress → source: vietnam, defaultLang: vi
2. Scrape: Full article content
3. extractFacts → { summary, category: "Đời sống", impact: "ảnh hưởng 5 triệu dân" }
4. 🆕 classifyLanguage → { language: "vi", confidence: 0.99 }
5. generateScript(facts, imgs, "vi") → Vietnamese voiceover
6. 🆕 classifyDataViz → scene[2].layoutType = "progress_ring" (70% xe máy)
7. TTS: vi-VN-HoaiMyNeural → Vietnamese audio
8. Render: DynamicNews with progress ring scene
9. Publish YouTube: lang="vi", Vietnamese title/desc/tags
```

### Ví dụ 3: Tin VnExpress "VinFast IPO trên NASDAQ"

```
1. RSS: VnExpress → source: vietnam, defaultLang: vi
2. Scrape: Full article content
3. extractFacts → { category: "Kinh tế", impact: "IPO quốc tế, vốn hóa $23B" }
4. 🆕 classifyLanguage → { language: "en", confidence: 0.82, reasoning: "IPO on NASDAQ = international impact" }
5. generateScript(facts, imgs, "en") → English voiceover
6. 🆕 classifyDataViz → scene[1]: "animated_counter" ($23B), scene[3]: "comparison"
7. TTS: en-US-ChristopherNeural
8. Render with counter + comparison
9. Publish YouTube: lang="en"
```

---

## Thư viện/Dependencies Mới

| Package | Purpose | Type |
|---|---|---|
| `music-metadata` | Thay thế Python mutagen cho audio duration | npm (production) |
| Không cần thêm gì cho charts | Remotion đã có `interpolate`, `spring`, SVG support | — |
| Không cần thêm gì cho language detection | Dùng Gemini API hiện có | — |

> **Lưu ý**: Các chart components sẽ được build thuần bằng React + SVG + Remotion animation primitives. KHÔNG cần chart library bên ngoài (D3, Recharts, etc.) vì Remotion đã cung cấp đầy đủ `interpolate`, `spring`, `useCurrentFrame`.

---

## Verification Plan

### Automated Tests
- `node test_language_classifier.js` — Test language detection với 10+ scenarios
- `npx remotion render DynamicNews --props='...' out/test_charts.mp4` — Visual verification charts render đúng
- Remotion Studio preview tất cả chart components

### Manual Verification
- Chạy full pipeline với 1 bài tiếng Anh (TechCrunch) → verify toàn bộ output EN
- Chạy full pipeline với 1 bài tiếng Việt (VnExpress) → verify toàn bộ output VI
- Chạy full pipeline với 1 bài VN impact quốc tế → verify AI chọn EN
- Preview mỗi chart type trong Remotion Studio
- Kiểm tra YouTube metadata đúng ngôn ngữ
