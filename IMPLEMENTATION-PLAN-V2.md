# IMPLEMENTATION-PLAN-V2.md

## 1. Current architecture thực tế
Hệ thống hiện tại là một sự chắp vá giữa hai kiến trúc. Nó vẫn giữ nguyên flow cũ khởi chạy từ `trend_bot.js`, qua `auto_pipeline.js` bằng lệnh `execSync`, và phụ thuộc nhiều vào việc hard-code thời lượng video ngắn. Tuy nhiên, đã có các thành phần tiên tiến của kiến trúc mới được thêm vào, nhưng chưa được móc nối hoàn chỉnh để thay thế hoàn toàn đường đi của kiến trúc cũ.

## 2. Legacy architecture
- **`trend_bot.js`**: File orchestrator cũ. Sử dụng module RSS riêng biệt để gom bài, đánh giá "trend" bằng một cú gọi Gemini đơn giản, lưu trữ lịch sử qua file `trend_history.json` cục bộ, và kích hoạt pipeline cũ.
- **`auto_pipeline.js`**: Từng chịu trách nhiệm toàn bộ quá trình scraper (dùng HTTP thuần + Cheerio), gọi Gemini để tạo kịch bản (1-shot JSON prompt), gọi `edge-tts` qua CMD để sinh audio và map với Remotion frames. Hiện tại, nó đã được sửa lại để gọi hàm từ kiến trúc mới nhưng cấu trúc chạy từ trên xuống dưới dạng script vẫn còn.
- **Frontend Video (Remotion)**: Trong `src/Root.tsx`, nhiều templates như `SportsNews`, `BusinessNews` vẫn đang hard-code thời lượng bằng `durationInFrames`. Templates động duy nhất là `DynamicNews`.

## 3. New architecture
- **Collector (`src/collector/`)**: Hệ thống Adapter mạnh mẽ (RSS, ArXiv, WebArticle) tích hợp rate-limiting, caching, timeout và error handling.
- **Deep Scraper (`src/scraper/`)**: Sử dụng Puppeteer và Readability để đọc các trang SPA.
- **AI Researcher (`src/ai/`)**: Pipeline phân tầng bao gồm Trích xuất Claims -> Fact-check Evidence -> Phân tích Impact -> Đóng gói StoryPackage. Ràng buộc chuẩn chỉnh bằng Zod schemas.
- **Video Engine (`src/engine/`)**: Tách biệt logic lấy `durationSec` của từng scene, cache file audio, và tính toán số frame theo Audio thay vì fix cứng.
- **Scheduler (`src/scheduler/`)**: Quản lý hàng đợi (Queue), các Job state rõ ràng, tích hợp AI QC và có cơ chế chờ phê duyệt trước khi Publish.

## 4. Dependency graph
- `scheduler/pipeline.js` -> `collector/index.js` -> `scraper/browser.js`
- `scheduler/pipeline.js` -> `ai/researcher.js` -> `ai/schemas.js`
- `scheduler/pipeline.js` -> `engine/video_engine.js` -> `public/` (Audio/Images) -> Remotion (`src/DynamicNews`)
- `scheduler/pipeline.js` -> `scheduler/qc.js`
- **Legacy Path**: `trend_bot.js` -> `auto_pipeline.js` -> (New modules) -> Remotion.

## 5. Current pipeline
Hiện tại có sự nhập nhằng. Khi chạy `test_factory.js`, pipeline chạy chuẩn theo kiến trúc mới (Collector -> Researcher -> VideoEngine -> QC). Nhưng ở môi trường production thực tế, `trend_bot.js` vẫn đang chạy và kích hoạt `auto_pipeline.js`. `auto_pipeline.js` gọi `scraper` và `researcher` nhưng không thông qua hàng đợi `scheduler`.

## 6. Target pipeline
`SOURCES` → `NORMALIZED ARTICLES` → `DEDUP` → `EVENT CLUSTER` → `RESEARCH PACKAGE` → `CLAIMS` → `EVIDENCE` → `FACT CHECK` → `IMPACT ANALYSIS` → `TREND SCORE` → `STORY PACKAGE` → `STORY VARIANT` (Cho từng mốc thời gian) → `STORYBOARD` → `ASSETS` → `TTS` → `VIDEO` → `FINAL FACT CHECK` → `QC` → `APPROVAL` → `PUBLISH`

## 7. Module ownership
- **Thu thập dữ liệu**: `src/collector` (adapters + scraper).
- **Phân tích nội dung & Sự thật**: `src/ai/researcher.js`.
- **Kịch bản & Phân rã độ dài**: `src/ai/story_engine.js` (Cần tạo để tách khái niệm Story Package và Story Variant).
- **Sản xuất Media**: `src/engine/video_engine.js`.
- **Render Video**: Remotion (`src/DynamicNews`).
- **Luồng điều khiển & Quality**: `src/scheduler/`.

## 8. Data contracts
- Dữ liệu đi qua hệ thống cần tuân thủ nghiêm ngặt chuẩn của Zod (đã quy định ở `schemas.js`):
  - `NormalizedArticle`
  - `EventCluster`
  - `Claim` / `Evidence`
  - `Impact`
  - `RetentionPlan`
  - `StoryPackage` (Gốc)
  - `StoryVariant` (Bản phái sinh theo độ dài).

## 9. Migration strategy
Thay vì xóa bỏ hoàn toàn ngay lập tức, ta sẽ chuyển hướng luồng từ `trend_bot.js` sang dùng `scheduler/pipeline.js` làm lõi. Các API YouTube Publish từ legacy sẽ được đóng gói lại thành module Publishing.

## 10. Files to keep
- `src/collector/**`
- `src/scraper/**`
- `src/engine/video_engine.js`
- `src/ai/schemas.js`
- `src/scheduler/queue.js`, `qc.js`, `pipeline.js`
- `package.json`
- Các bài test hiện tại (`test_collector.js`, `test_factory.js`, `test_researcher.js`).

## 11. Files to refactor
- `src/ai/researcher.js`: Tách logic sinh `StoryPackage` chung ra, nhường việc sinh script cho một `StoryEngine` xử lý Multi-duration.
- `src/DynamicNews/index.tsx`: Chỉnh sửa để đón nhận cấu trúc dữ liệu Multi-duration mới (cắt bỏ hoàn toàn khái niệm thời lượng cố định).
- `src/Root.tsx`: Dọn dẹp các composition cũ bị fix frame, hướng luồng về 1 Dynamic composition.

## 12. Files to deprecate
- `trend_bot.js` (Sau khi đã dời logic check lịch sử và gọi API lên Scheduler).
- `auto_pipeline.js` (Thay thế hoàn toàn bằng `pipeline.js`).
- `src/ai/agents.js` (Code cũ của Phase 1, đã bị `researcher.js` thay thế).
- Lịch sử lưu tạm ở `trend_history.json` (Dời vào DB / Queue lưu trữ).

## 13. Files to create
- `src/ai/story_engine.js`: Tạo Story Variants từ Story Package.
- `src/ai/trend_analyzer.js`: Chuyển logic từ `trend_bot.js` sang đây.
- `src/engine/asset_manager.js`: Quản lý tải ảnh, cache TTS chuyên sâu.
- `src/publisher/youtube.js`: Quản lý việc đẩy video đã Approve lên YT.
- `src/database/db.js`: Khởi tạo SQLite thay thế file json thô sơ.

## 14. Schema changes
Cần bổ sung vào `schemas.js`:
- `StoryVariantSchema`: Chứa script chi tiết phù hợp với một DurationSec cụ thể (ví dụ: 15s, 60s, 300s).
- Ràng buộc Scene phải thuộc về một `StoryVariant` thay vì bám thẳng vào `StoryPackage`.

## 15. Collector changes
Nâng cấp `src/collector/index.js` để tích hợp Semantic Deduplication (So sánh ý nghĩa bằng Embedding thay vì chuỗi Text) và Gom nhóm sự kiện (Event Clustering) từ các adapter khác nhau.

## 16. Research changes
`src/ai/researcher.js` sẽ dừng lại ở mức tổng hợp Fact, Impact và cung cấp một `ResearchPackage` thô, không sinh luôn kịch bản voiceover. Đảm bảo triệt tiêu hoàn toàn Hallucination.

## 17. Fact-check changes
Ràng buộc mạnh: Nếu một `Claim` status là `UNVERIFIED`, hệ thống sẽ chặn không cho đưa claim đó xuống Story Engine.

## 18. Story engine changes
Khởi tạo `Story Engine`: Nhận `ResearchPackage`, tạo ra một `StoryPackage` (bộ khung xương cốt truyện), và từ đó phái sinh ra nhiều `StoryVariant` khác nhau (Ví dụ: 1 bản 30s cho Shorts, 1 bản 3 phút cho YouTube truyền thống).

## 19. Video engine changes
`VideoEngine` sẽ nhận một `StoryVariant` cụ thể. Nó sẽ tính toán duration dựa trên độ dài audio sinh ra từ Voiceover, ghép các scene dựa trên `durationSec` đã định nghĩa sẵn. Hỗ trợ Render một phần (Ví dụ chỉ đổi giọng của cảnh 2 mà không render lại TTS toàn bài).

## 20. Scheduler changes
Mở rộng `JOB_STATES` để bao phủ từ lúc thu thập, đánh giá trend, tới lúc sinh ra đa dạng video variants, chờ duyệt, và publish. `pipeline.js` sẽ chạy cronjob.

## 21. Storage changes
Chuyển `db_jobs.json` và `trend_history.json` sang SQLite để đảm bảo ACID khi pipeline mở rộng và chạy song song nhiều tiến trình.

## 22. Testing strategy
- Giữ nguyên các test hiện tại.
- Bổ sung Unit Tests cho `StoryEngine` (kiểm tra tính đa dạng độ dài).
- Bổ sung Integration Test cho toàn chuỗi Pipeline với SQLite.

## 23. Rollback strategy
Vẫn duy trì file `auto_pipeline.js` trong thư mục cũ cho tới khi Phase 12 (Publishing) hoàn tất và chạy mượt mà trên môi trường thật 1 tuần. Sau đó mới gỡ bỏ.

## 24. Phase-by-phase implementation
* **PHASE 1:** Hợp nhất AI pipeline. Xóa bỏ ranh giới rối rắm giữa `auto_pipeline` và `researcher`.
* **PHASE 2:** Chuẩn hóa ResearchPackage / StoryPackage bằng Zod.
* **PHASE 3:** Nâng cấp source collector + event clustering.
* **PHASE 4:** Nâng cấp claim/evidence/fact-check (Chặn các claim Unverified).
* **PHASE 5:** Tích hợp Trend + impact analysis (Từ `trend_bot` sang `trend_analyzer`).
* **PHASE 6:** Multi-duration Story Engine (Sản xuất nhiều Script lengths từ 1 Fact).
* **PHASE 7:** Long-form Storyboard (Sắp xếp layout cho video dài).
* **PHASE 8:** Asset engine (Tách biệt TTS và Image Fetching khỏi luồng chính).
* **PHASE 9:** Video Engine long-form (Chunking render cho video dài).
* **PHASE 10:** Final Fact Check + QC (Tự động review video xuất ra).
* **PHASE 11:** Scheduler + production pipeline (Áp dụng SQLite, Cronjob).
* **PHASE 12:** Publishing + analytics feedback (Đăng YouTube, lắng nghe comment).

---

### BÁO CÁO TỔNG QUAN

**10 vấn đề quan trọng nhất:**
1. Kiến trúc hiện tại bị phân mảnh: Môi trường thật vẫn gọi `trend_bot.js` & `auto_pipeline.js`, bỏ qua toàn bộ Scheduler/Queue xịn vừa xây.
2. Deduplication đang dùng hash text thô, sẽ sinh video trùng lặp nếu tiêu đề bài báo bị đổi vài chữ.
3. Thiếu Event Clustering: Nếu 3 báo nói về 1 sự kiện, hệ thống sẽ cố tạo 3 video thay vì 1.
4. `src/Root.tsx` chứa nhiều template hard-code frames, dễ gây lỗi tràn/cụt video.
5. Chưa lưu trữ DB thực thụ, các file JSON rất dễ bị hỏng do ghi đè đồng thời.
6. Module sinh Audio đang bị nhét chung vào VideoEngine/Pipeline, khó test riêng lẻ.
7. Chưa có cơ chế sinh ra Multi-duration, prompt của AI hiện tại vẫn đang phải chọn 1 duration duy nhất.
8. Các API call đến LLM thiếu cơ chế backoff thực sự mạnh mẽ (hiện mới làm vòng lặp giản đơn).
9. Mảng quản lý ảnh tĩnh/stock footage còn sơ sài.
10. Thiếu sự kết nối giữa QC và Approval (QC xong nhưng không có giao diện/bot chat cho người duyệt).

**10 thành phần tốt nhất đang có:**
1. Zod Schemas (`src/ai/schemas.js`) rành mạch, chuẩn hóa.
2. Deep Scraper bằng Puppeteer vượt qua rào cản SPA.
3. Thuật toán "Evidence Mapping" đảm bảo chặn thông tin bịa đặt.
4. Phân tách rõ ràng giữa Claims và Impact.
5. Adapter Architecture trong Collector cho phép dễ dàng thêm nguồn (RSS, Web, ArXiv).
6. State Machine của JobQueue (`src/scheduler/queue.js`).
7. Cơ chế Fallback/Retry Models tự động.
8. Cache Engine ở lớp thu thập giúp giảm tải mạng.
9. Logic bóc tách Audio frames tự động bằng Python trong JS.
10. Remotion setup cơ sở với `DynamicNews` cho phép UI linh hoạt.

**Phần nào nên giữ nguyên:**
- Các Zod Schema hiện tại.
- Lớp Adapter của Collector.
- Trình Deep Scraper (Puppeteer).
- Cơ chế Queue và State cơ bản của Scheduler.

**Phần nào nên refactor:**
- Tách phần sinh kịch bản ra khỏi `researcher.js` thành `story_engine.js`.
- Bỏ phần gọi cmd `edge-tts` thành một class/service độc lập.
- Clean up `src/Root.tsx` để xóa các component rác.

**Phần nào nên xóa:**
- Xóa `src/ai/agents.js` (Duplicate chức năng).
- Xóa `auto_pipeline.js` (Sau khi chuyển hoàn toàn sang Pipeline V2).
- Xóa `trend_bot.js` (Sau khi module Trend Analyzer hoàn tất).

**Kiến trúc mục tiêu:**
Event-driven pipeline với SQLite làm trung tâm lưu trạng thái, Zod để định chuẩn giao tiếp giữa các node (Collector -> Researcher -> StoryEngine -> AssetEngine -> VideoEngine -> QC -> Publisher).

**Phase 1 nên bắt đầu ở file nào:**
Bắt đầu bằng việc **xóa file `src/ai/agents.js`** và chỉnh sửa **`src/scheduler/pipeline.js`** để thay thế điểm vào của hệ thống từ `trend_bot.js` sang một `main.js` gọi trực tiếp vào Pipeline V2.

**Các test hiện tại cần giữ:**
- `test_collector.js`
- `test_researcher.js`
- `test_factory.js`

**Các test cần bổ sung:**
- `test_story_variants.js` (Kiểm tra xem AI có sinh đúng các kịch bản dài/ngắn không).
- `test_event_clustering.js` (Kiểm tra thuật toán chống trùng lặp sự kiện).
- `test_video_duration.js` (Kiểm tra hàm nội suy Audio Frames có tính tổng độ dài chuẩn không).