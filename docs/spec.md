# 📋 Đặc tả Yêu cầu (Specification) — AI Trend News Bot v3

## Tổng quan Hiện trạng

AI Trend News Bot là hệ thống **tự động thu thập tin tức trending → tạo video Shorts → đăng đa nền tảng**. Dự án đã có:
- ✅ Thu thập RSS từ 7 nguồn (HN, TechCrunch, The Verge, VentureBeat, Google News VN, VnExpress, Tuổi Trẻ)
- ✅ AI phân tích & lên kịch bản (Gemini)
- ✅ TTS bằng Edge TTS (Tiếng Việt + Tiếng Anh)
- ✅ Render video Remotion với 5 layout types (list, stat, quote, image, spotlight)
- ✅ Đăng YouTube Shorts, Facebook Reels
- ✅ Dashboard quản lý
- ✅ SQLite job queue với state machine
- ⚠️ Instagram Reels (chưa hoạt động — cần public URL)
- ⚠️ TikTok (stub)

---

## 📌 YÊU CẦU MỚI TỪ USER

### Yêu cầu 1: Tự động Phát hiện Ngôn ngữ Video (VI/EN) theo Phạm vi Ảnh hưởng

**What:** Hệ thống phải tự động quyết định video sẽ bằng Tiếng Anh hay Tiếng Việt dựa trên **phạm vi ảnh hưởng** của bài báo.

**Rules:**
| Điều kiện | Ngôn ngữ Video |
|---|---|
| Tin từ nguồn quốc tế (HN, TechCrunch, The Verge, VentureBeat) | 🇬🇧 English |
| Tin từ nguồn Việt Nam (VnExpress, Tuổi Trẻ, Google News VN) nhưng ảnh hưởng quốc tế | 🇬🇧 English |
| Tin từ nguồn VN và ảnh hưởng trong nước | 🇻🇳 Tiếng Việt |
| Tin khoa học/công nghệ toàn cầu | 🇬🇧 English |
| Tin đời sống, xã hội, giao thông VN | 🇻🇳 Tiếng Việt |

**Why:** Để tối ưu reach — tin quốc tế dùng English để tiếp cận audience toàn cầu, tin nội địa dùng Tiếng Việt để gần gũi với viewer VN.

**Ảnh hưởng:**
- AI prompts phải thay đổi ngôn ngữ output
- TTS voice phải auto-switch: `vi-VN-HoaiMyNeural` ↔ `en-US-ChristopherNeural`
- YouTube metadata (title, description, tags) phải đúng ngôn ngữ
- Subtitle/caption trong video cũng phải đúng ngôn ngữ
- News Ticker text phải đúng ngôn ngữ
- Outro CTA phải đúng ngôn ngữ

### Yêu cầu 2: Animation cho Thống kê & Khoa học (Animated Data Visualization)

**What:** Khi bài báo là dạng **khoa học**, **báo cáo thống kê**, hoặc có **dữ liệu số liệu quan trọng**, video phải có animation minh họa dữ liệu để bắt mắt hơn.

**Các loại animated visualizations mong muốn:**
1. **Animated Counter** — Số chạy từ 0 lên giá trị thực (ví dụ: "$2.5B" chạy từ 0)
2. **Animated Bar Chart** — Thanh bar mọc lên dần (so sánh các giá trị)
3. **Animated Progress Ring** — Vòng tròn % tiến trình quay lấp đầy
4. **Animated Line Chart** — Đường xu hướng vẽ dần (trend over time)
5. **Animated Comparison** — So sánh before/after, số liệu đối lập

**Rules:**
| Loại nội dung | Animation |
|---|---|
| Có 2+ số liệu so sánh | Bar Chart hoặc Comparison |
| Có % hoặc tỷ lệ | Progress Ring |
| Có xu hướng theo thời gian | Line Chart |
| Có 1 con số nổi bật | Animated Counter (hiện tại đã có statPulse nhưng chưa "chạy") |
| Tin thường (không có data) | Giữ nguyên layouts hiện tại |

**Why:** Video với data visualization animation bắt mắt hơn nhiều so với chỉ hiển thị text. Đặc biệt với tin khoa học/thống kê, visualization giúp viewer hiểu nhanh và ấn tượng hơn.

---

## 🔍 ĐÁNH GIÁ CÁC VẤN ĐỀ CẦN CẢI THIỆN

### Nhóm A: Vấn đề Kiến trúc (Critical)

#### A1. Dual Architecture — Legacy vs V2
- **Vấn đề**: 2 pipeline chạy song song (`auto_pipeline.js` legacy + `VideoFactoryPipeline` V2). Dashboard gọi legacy cho `/api/run` nhưng V2 cho `/api/jobs`. Gây nhầm lẫn và bug.
- **Đề xuất**: Thống nhất tất cả vào V2 pipeline. Legacy pipeline chỉ giữ lại làm fallback ngắn hạn.

#### A2. Python Dependencies cho Audio Duration
- **Vấn đề**: Gọi `python -c` để đọc duration MP3 bằng `mutagen`. Nếu Python/mutagen chưa cài → crash.
- **Đề xuất**: Thay bằng pure Node.js solution (ví dụ: `music-metadata` hoặc `mp3-duration` npm package).

#### A3. Scattered TTS Scripts
- **Vấn đề**: 4 Python TTS scripts rải rác (`generateTts.py`, `generateTechTts.py`, `generateTrafficTts.py`, `generate_tech_audio.py`), không thống nhất với `VideoEngine`.
- **Đề xuất**: Consolidate tất cả TTS logic vào `src/engine/` (Node.js). Xóa Python TTS scripts.

### Nhóm B: Vấn đề Tính năng (High Priority)

#### B1. Subtitle/Caption chưa tích hợp
- **Vấn đề**: Edge TTS có thể output VTT subtitles nhưng không được sử dụng. `makeCaptions.py` tồn tại nhưng không kết nối vào pipeline.
- **Đề xuất**: Tích hợp word-level captions từ Edge TTS VTT output → render captions đồng bộ với audio trong Remotion.

#### B2. Semantic Deduplication thiếu
- **Vấn đề**: Chỉ dedup bằng exact title/URL match. Tin cùng sự kiện từ nhiều nguồn sẽ tạo duplicate videos.
- **Đề xuất**: Sử dụng Gemini embedding hoặc simple cosine similarity để nhóm tin cùng sự kiện.

#### B3. Thumbnail Generation thiếu
- **Vấn đề**: YouTube Shorts không có custom thumbnail → giảm CTR.
- **Đề xuất**: Auto-generate thumbnail từ frame đầu tiên hoặc render một frame riêng với title + image nổi bật.

### Nhóm C: Vấn đề Vận hành (Medium Priority)

#### C1. Secrets trong Repo
- **Vấn đề**: `config.json` chứa Meta access token, `client_secret.json` và `tokens.json` nằm trong repo root, không được gitignore.
- **Đề xuất**: Chuyển secrets sang `.env`, thêm vào `.gitignore`.

#### C2. No Proper Tests
- **Vấn đề**: Chỉ có integration test scripts thủ công, không có test suite tự động.
- **Đề xuất**: Thêm unit tests cho critical paths (AI parsing, TTS, language detection).

#### C3. `db_jobs.json` Legacy (7.2MB)
- **Vấn đề**: File JSON cũ vẫn tồn tại dù đã có SQLite.
- **Đề xuất**: Migrate data nếu cần → xóa file.

#### C4. Model Router với model names không hợp lệ
- **Vấn đề**: Một số model name có thể không tồn tại → waste time trên 404 errors.
- **Đề xuất**: Audit và cập nhật danh sách models.

#### C5. Single Worker
- **Vấn đề**: Chỉ 1 `DurableWorker` xử lý jobs. Không scale khi có nhiều tin cùng lúc.
- **Đề xuất**: Cho phép configurable worker count (2-3 workers song song).

### Nhóm D: Vấn đề UX/Visual (Nice-to-have)

#### D1. Background Music đơn điệu
- **Vấn đề**: Chỉ có 1 file `bgm.mp3` cho tất cả video.
- **Đề xuất**: Thư viện BGM theo category (tech/business/sports/breaking) hoặc theo mood.

#### D2. Thiếu Intro Animation
- **Vấn đề**: Video nhảy thẳng vào nội dung, không có branded intro.
- **Đề xuất**: Thêm 2-3s branded intro animation (logo + channel name + sound effect).

#### D3. Analytics Module chưa có
- **Vấn đề**: V2 plan đề cập analytics nhưng chưa build.
- **Đề xuất**: Dashboard hiển thị: videos created/day, views, engagement, cost per video.

---

## 📊 Ma trận Ưu tiên

| # | Tính năng | Impact | Effort | Priority |
|---|---|---|---|---|
| **R1** | Auto Language Detection (VI/EN) | 🔴 High | 🟡 Medium | **P0** |
| **R2** | Animated Data Visualization | 🔴 High | 🔴 High | **P0** |
| A1 | Unify Pipeline (Legacy→V2) | 🟡 Medium | 🔴 High | P1 |
| A2 | Replace Python audio duration | 🟡 Medium | 🟢 Low | P1 |
| A3 | Consolidate TTS scripts | 🟡 Medium | 🟡 Medium | P1 |
| B1 | Subtitle/Caption integration | 🔴 High | 🟡 Medium | P1 |
| B2 | Semantic Dedup | 🟡 Medium | 🟡 Medium | P2 |
| B3 | Thumbnail Generation | 🟡 Medium | 🟢 Low | P2 |
| C1 | Secrets cleanup | 🟢 Low | 🟢 Low | P1 |
| C2 | Unit tests | 🟡 Medium | 🟡 Medium | P2 |
| C3 | Remove db_jobs.json | 🟢 Low | 🟢 Low | P3 |
| C4 | Audit model router | 🟢 Low | 🟢 Low | P2 |
| C5 | Multi-worker | 🟡 Medium | 🟡 Medium | P2 |
| D1 | BGM library | 🟢 Low | 🟡 Medium | P3 |
| D2 | Branded Intro | 🟡 Medium | 🟢 Low | P2 |
| D3 | Analytics Dashboard | 🟡 Medium | 🔴 High | P3 |
