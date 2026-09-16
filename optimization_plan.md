# ⚡ KẾ HOẠCH TỐI ƯU HÓA HỆ THỐNG & CHIẾN LƯỢC GIỮ CHÂN YOUTUBE 2024
## (Speckit Technical Optimization Plan: Architecture, Loading & Retention Rate)

> **Tài liệu:** `optimization_plan.md`  
> **Dự án:** `AI Trend News Bot v3`  
> **Mục tiêu chính:** 
> 1. Triệt tiêu hoàn toàn hiện tượng nghẽn luồng Node.js, treo/đóng băng UI và hàng đợi tạo video.
> 2. Đón đầu thuật toán YouTube Shorts 2024 nhằm bứt phá tỷ lệ giữ chân người xem (Retention Rate > 85%, Engaged Views 0–3s > 80%).

---

## PHẦN 1: ĐÁNH GIÁ HIỆN TRẠNG & NGUYÊN NHÂN GỐC RỄ (ROOT CAUSE ANALYSIS)

### 1. Hiện tượng nghẽn luồng Node.js & UI Loading / Freeze
Dựa trên phân tích mã nguồn thực tế và hành vi chạy thực tế của hệ thống trên máy tính CPU **AMD Ryzen 5 3550H (4 Cores / 8 Threads)**:

* **Nguyên nhân 1: Đói chu kỳ CPU (CPU Starvation do Chromium Remotion chiếm 100%)**
  * Khi Remotion render với 2–3 worker Chromium song song, CPU đạt ngưỡng tải 95–100%.
  * Node.js vốn hoạt động trên kiến trúc Single-Threaded Event Loop. Khi hệ điều hành Windows ưu tiên phân bổ thời gian CPU cho các tiến trình render đồ họa nặng, Main Event Loop của `dashboard.js` bị đói chu kỳ xử lý, dẫn đến việc các HTTP request từ giao diện (`/api/run-status`, `/api/queue`) bị xếp hàng chờ phản hồi hàng chục giây, tạo cảm giác giao diện "bị đóng băng".
* **Nguyên nhân 2: Lạm dụng `spawnSync` và Blocking I/O trong Pipeline con**
  * Trong `auto_pipeline.js`, lệnh render Remotion đang sử dụng `spawnSync` (chặn đồng bộ luồng). Khi tiến trình con bị treo hoặc render chậm, không có tín hiệu non-blocking I/O truyền về tiến trình cha, khiến việc hủy tiến trình hoặc theo dõi nhịp tim (Heartbeat) bị trễ.
* **Nguyên nhân 3: Quá tải Payload Polling (`/api/run-status`)**
  * Giao diện Dashboard thực hiện `setInterval` mỗi 1.5 giây gửi request lên `/api/run-status`.
  * API này trả về: Toàn bộ mảng hàng đợi 98 bài + 500 dòng nhật ký log + metadata đầy đủ. Kích thước payload lên đến gần **100 KB JSON** được encode/decode liên tục mỗi 1.5s, gây nghẽn RAM và nghẽn CPU của cả máy chủ lẫn trình duyệt người dùng.
* **Nguyên nhân 4: Watchdog ngắt nhầm khi render bài dài**
  * Watchdog trước đây đặt ngưỡng cứng 15 phút. Với các video dài 1700+ khung hình (mất 18–22 phút trên Ryzen 5), tiến trình bị ngắt ép ở khung hình 1018, file MP4 chưa hoàn tất nhưng hàng đợi lại ghi nhận xong, dẫn đến việc danh sách xuất bản không tăng thêm video.
* **Nguyên nhân 5: Điểm tiềm năng (Priority Score) bị kẹt ở mức 8.0**
  * Thuật toán trước đây chưa phân tích trọng số đa tầng (Trend velocity, độ nóng từ khóa, tính cấp bách, kênh phân phối), dẫn đến phần lớn các bài trong hàng đợi đều nhận điểm đồng loạt 8.0.

---

### 2. Thách thức Giữ chân người xem (YouTube Shorts 2024 Retention Algorithm)
Theo hướng dẫn và phân tích thuật toán phân phối YouTube Shorts 2024:

* **Tử huyệt 0–3 giây đầu (Swipe-Away Rate > 70%):**
  * Hiện tại video đang có đoạn `BrandedIntro` hoặc mở đầu bằng hoạt ảnh chạy chữ logo/thương hiệu dài tới 3 giây (90 frames). Người xem trên YouTube Shorts chỉ quyết định có xem tiếp hay không trong vòng **1.2 đến 2 giây đầu**. Mọi video có "intro bumper" đều bị khán giả quẹt qua ngay lập tức.
* **Khung hình nghèo nàn thị giác (Thiếu B-roll thực tế):**
  * Bộ cào tin (`browser.js`) cào được rất nhiều ảnh báo chí sắc nét (`crawled_img_1.jpg`, `crawled_img_2.jpg`), nhưng hiện tại `Scene.tsx` chỉ dùng các ảnh này để làm mờ ở hậu cảnh (Blurred Backdrop 45px), còn phần nhìn chính vẫn là các khối chữ khô cứng. Thiếu khung hình B-roll thực tế khiến video tin tức giảm độ chân thực và người xem nhanh chán.
* **Thiếu nhịp chuyển động vi mô (Micro-Visual Pacing):**
  * Mắt người xem Shorts cần một kích thích thị giác mới sau mỗi **2.5 – 3.5 giây** (zoom in, pan nhẹ, đổi góc, highlight từ vựng phụ đề hoặc hiệu ứng pop card). Hiện tại một số cảnh kéo dài 8–10 giây chỉ có chữ đứng yên.

---

## PHẦN 2: KẾ HOẠCH HÀNH ĐỘNG CHI TIẾT (SPECKIT IMPLEMENTATION PLAN)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       KIẾN TRÚC TỐI ƯU HÓA TOÀN DIỆN                        │
├──────────────────────────────────────┬──────────────────────────────────────┤
│    TRỤ CỘT 1: HỆ THỐNG & NODE.JS     │   TRỤ CỘT 2: THUẬT TOÁN YOUTUBE 2024 │
│ ───────────────────────────────────  │  ─────────────────────────────────── │
│ 1. Hạ ưu tiên CPU Remotion xuống     │ 1. Zero-Bumper Hook: Vào thẳng tin   │
│    BelowNormal (Không đơ Main Loop)  │    khẩn cấp ở Khung hình 0 (0-1s).   │
│ 2. Chuyển render sang Async Stream   │ 2. Dynamic B-roll Card: Hiển thị     │
│    với Pipe Stdout non-blocking.     │    ảnh báo chí Ken Burns 1.08x.      │
│ 3. Tối ưu Polling Payload: Delta Log │ 3. Kinetic Word-by-Word Subtitles:   │
│    + Giảm 99% kích thước /api/run    │    Từ đang đọc phóng to neon vàng.   │
│ 4. Chấm điểm tiềm năng đa biến động  │ 4. SFX Impact + Audio Ducking nhịp   │
│    (Dynamic Scoring 7.5 - 9.8).      │    nhàng theo từng cảnh chuyển tiếp. │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

---

### GIAI ĐOẠN 1: GIẢI PHÓNG NGHẼN LUỒNG NODE.JS & TỐI ƯU LOADING

#### 1.1. Điều tiết mức ưu tiên CPU cho tiến trình Chromium (CPU Process Throttling)
* **Vấn đề:** Chromium render chiếm hết 100% tài nguyên CPU của hệ thống, bóp nghẹt Event Loop của Node.js.
* **Giải pháp kỹ thuật:**
  * Ngay khi spawn tiến trình con Chromium/Remotion trên Windows, tự động set CPU Priority Class thành `BELOW_NORMAL_PRIORITY_CLASS` (lệnh PowerShell `(Get-Process -Id $pid).PriorityClass = 'BelowNormal'`).
  * **Hiệu quả:** Node.js và Web Server (`dashboard.js`) luôn được hệ điều hành ưu tiên xử lý trước, loại bỏ hoàn toàn hiện tượng UI lag, đơ hay không nhận lệnh click. Thời gian render chỉ chênh lệch < 3%, nhưng máy tính và giao diện luôn mượt mà 100%.

#### 1.2. Chuyển đổi Remotion Render từ `spawnSync` sang Asynchronous Non-Blocking Stream
* **Vấn đề:** `spawnSync` trong `auto_pipeline.js` đóng băng hoàn toàn tiến trình chạy.
* **Giải pháp kỹ thuật:**
  * Thay thế bằng `spawn` bất đồng bộ trả về Promise kết hợp stream `stdout`/`stderr` thời gian thực.
  * Tích hợp cơ chế phát hiện tiến độ render dựa trên parse chuỗi `"Rendered X/Y, time remaining: ..."`. Cập nhật Heartbeat liên tục. Nếu sau 8 phút không tăng thêm khung hình nào mới kích hoạt tự phục hồi (Self-Healing).

#### 1.3. Cắt giảm 99% dung lượng Polling Dashboard (`/api/run-status`)
* **Vấn đề:** Gửi toàn bộ 98 video hàng đợi và 500 dòng log mỗi 1.5s làm nghẽn CPU và mạng.
* **Giải pháp kỹ thuật:**
  * Tách riêng API:
    * `/api/run-status`: Chỉ trả về trạng thái chạy (`active`, `step`, `currentTitle`, `progressPercent`) và các dòng nhật ký mới (`newLogs` dựa trên tham số `since`). Dung lượng giảm từ **100 KB xuống còn < 1 KB**.
    * `/api/queue`: Endpoint riêng, chỉ được tải lại khi có sự kiện thay đổi hàng đợi (bấm chọn bài, đổi thứ tự, hoặc khi xong 1 video).
  * Áp dụng In-Memory Caching cho hàng đợi, chỉ ghi đĩa (`video_render_queue.json`) với cơ chế debounce 500ms thay vì đọc ghi đồng bộ liên tục.

#### 1.4. Thuật toán Chấm điểm Tiềm năng Đa biến (Dynamic Multi-Factor Priority Scoring)
* **Vấn đề:** Các video trong hàng đợi đều bị gán điểm đồng loạt 8.0.
* **Giải pháp kỹ thuật:**
  * Thiết lập công thức chấm điểm đa tiêu chí tự động:
    $$\text{Score} = \text{Base (7.5)} + \Delta_{\text{Hot}} + \Delta_{\text{Tech}} + \Delta_{\text{Recency}} + \Delta_{\text{Authority}}$$
    * $\Delta_{\text{Hot}}$ (+0.0 đến +1.2): Dựa trên tần suất xuất hiện từ khóa nóng (`Cảnh báo`, `Khẩn cấp`, `Đột phá`, `Lừa đảo`, `Kỷ lục`, `Nóng`).
    * $\Delta_{\text{Tech}}$ (+0.0 đến +1.0): Ưu tiên cho các tin công nghệ / AI / Đổi mới sáng tạo để cân bằng cho kênh Kai Viet.
    * $\Delta_{\text{Recency}}$ (+0.0 đến +0.5): Tin phát hành trong vòng 2–4 giờ qua nhận điểm thưởng tối đa.
  * Điểm số thực tế sẽ trải đều từ **7.8 đến 9.8**, hiển thị màu sắc trực quan (Đỏ > 9.5: Cực nóng, Xanh lá 9.0–9.4: Ưu tiên cao, Vàng 8.0–8.9: Tiêu chuẩn).

---

### GIAI ĐOẠN 2: TỐI ƯU HÓA TỶ LỆ GIỮ CHÂN (YOUTUBE SHORTS 2024 RETENTION)

#### 2.1. Triệt tiêu Intro Bumper – Chuyển sang Hook Khẩn Cấp Khung Hình 0 (Zero-Bumper Hook)
* **Vấn đề:** Intro logo 3 giây khiến khán giả lướt qua (Swipe Away) ngay từ giây đầu tiên.
* **Giải pháp kỹ thuật:**
  * **Frame 0 (0.0 giây):**
    * Bỏ hoàn toàn màn hình intro thương hiệu toàn phần. Thay vào đó, logo và tên kênh chuyển thành **Huy hiệu Watermark góc trên** (Brand Badge/Bug) kích thước nhỏ gọn, chạy xuyên suốt video.
    * Tiêu đề giật tít Hook xuất hiện ngay tại Khung hình 0 với hiệu ứng **Punch Zoom (Scale 1.25 -> 1.0)** trong 10 khung hình.
    * Badge trạng thái nhấp nháy đỏ neon: `🔴 TIN NÓNG KHẨN CẤP` hoặc `⚡ CẢNH BÁO MỚI NHẤT`.
    * Âm thanh hiệu ứng tác động (`sfx/whoosh.wav` + `sfx/pop.wav`) vang lên tại Frame 1 cùng giọng đọc TTS bắt đầu ngay, không có 1 mili-giây khoảng lặng.

#### 2.2. Hệ thống B-roll Nâng cao (Dynamic Floating Media Card)
* **Vấn đề:** Ảnh cào được bị làm mờ chìm vào nền, người xem chỉ thấy chữ chạy gây cảm giác đơn điệu.
* **Giải pháp kỹ thuật:**
  * Tại `src/DynamicNews/Scene.tsx`: Khi cảnh có `imageFile` (ảnh cào từ báo chí):
    1. **Tầng nền:** Ảnh phóng to làm mờ 35px tạo không gian màu đồng điệu.
    2. **Tầng chính (Foreground B-roll Card):** Hiển thị bức ảnh gốc sắc nét 100% trong khung bo tròn 24px, đặt ở nửa trên khung hình (Safe Zone 9:16).
    3. **Hiệu ứng Ken Burns mượt mà:** Ảnh từ từ phóng to nhẹ từ `1.0` lên `1.07` và di chuyển pan nhẹ tạo cảm giác phim tài liệu chuyên nghiệp.
    4. **Nhãn chứng thực:** Đặt thẻ nhãn nhỏ góc ảnh: `📷 Hình ảnh thực tế` hoặc tên nguồn báo (`VnExpress`, `Tuổi Trẻ`, `Reuters`).

#### 2.3. Phụ đề Động Kiểu Karaoke (Kinetic Word-by-Word Caption Highlight)
* **Vấn đề:** Phụ đề tĩnh theo từng câu dài khiến mắt người xem không tập trung.
* **Giải pháp kỹ thuật:**
  * Tận dụng file `.vtt` từ Edge-TTS đã có mốc thời gian chi tiết theo từng từ.
  * Mỗi từ khi được phát âm sẽ bừng sáng với màu Vàng Neon (`#facc15`) hoặc Cyan (`#38bdf8`), phóng to nhẹ `1.15x` kèm bóng đổ bảo vệ (`text-shadow: 0 4px 15px rgba(0,0,0,0.9)`).
  * Giới hạn mỗi dòng chỉ từ **3 đến 5 từ** và tự động cuộn nhịp nhàng, đặt ở tọa độ an toàn (Y: 65% - 72%) không bị che bởi giao diện Shorts.

#### 2.4. Trực Quan Hóa Dữ Liệu Tự Động (Data Visualization Micro-Scenes)
* **Vấn đề:** Các con số thống kê (tiền bạc, tỷ lệ %, số nạn nhân, mốc thời gian) nếu chỉ đọc bằng lời sẽ khó tiếp thu.
* **Giải pháp kỹ thuật:**
  * Bộ phân loại `classifyDataViz` tự động kích hoạt:
    * Biểu đồ cột động (`bar_chart`) cho so sánh tăng trưởng.
    * Vòng tròn tiến trình (`progress_ring`) cho số liệu phần trăm.
    * Bộ đếm số tăng dần (`animated_counter`) nảy số từ 0 đến giá trị thực kèm tiếng gõ số (`ding.wav`).

---

### GIAI ĐOẠN 3: ĐỒNG BỘ ĐĂNG BÀI & CƠ CHẾ BẢO VỆ DỮ LIỆU

#### 3.1. Đảm bảo 100% Video Render xong được lưu vào Hàng Đợi Hẹn Giờ Vàng
* Khi render xong, kiểm tra dung lượng file video (`> 2MB`).
* Tự động đăng ký bản ghi vào bảng `publications` của SQLite (`bot.db`) với đầy đủ metadata: Tiêu đề, Mô tả, Tags chuẩn SEO, Kênh phân phối, và Thumbnail 9:16 đi kèm.

#### 3.2. Chế độ Đăng Nhanh Đa Tầng (Multi-Tier Publishing)
* **Tầng 1 (Tức thì ~1 giây):** Khi bấm duyệt tin trên Dashboard, có nút tùy chọn "⚡ Đăng ngay bài ảnh Fanpage Facebook" để chiếm sóng thông tin ngay lập tức.
* **Tầng 2 (Video Reels & Shorts ~15 phút sau):** Khi video render xong, hệ thống tự động đưa vào lịch phát sóng khung giờ vàng hoặc xuất bản trực tiếp.

---

## BẢNG SO SÁNH TRƯỚC VÀ SAU KHI TỐI ƯU

| Chỉ số / Tính năng | Trước khi tối ưu | Sau khi tối ưu (Kế hoạch này) |
| :--- | :--- | :--- |
| **Tải CPU Node.js khi Render** | Bị chiếm 100% CPU, UI đơ lag | Chromium chạy `BelowNormal`, UI mượt 100% |
| **Kích thước Polling `/api/run`** | ~100 KB / 1.5 giây | < 1 KB / 1.5 giây (Giảm 99%) |
| **Độ trễ phản hồi UI** | 2000ms – 5000ms khi bấm nút | < 15ms (Optimistic UI Update) |
| **Tỷ lệ giữ chân 3s đầu Shorts** | Thấp (~30-40%) do intro logo 3s | Cao (> 80%) nhờ Zero-Bumper Hook giật tít |
| **Trải nghiệm hình ảnh B-roll** | Chỉ có nền mờ + chữ chạy | Ảnh báo chí sắc nét Ken Burns + nhãn nguồn |
| **Phụ đề (Captions)** | Hiện từng câu dài, dễ lướt qua | Karaoke nảy từng từ (Word-by-word Neon) |
| **Điểm tiềm năng tin tức** | Đồng loạt 8.0 | Đa biến động 7.8 – 9.8 theo độ nóng thực tế |

---

## KẾ HOẠCH TRIỂN KHAI THEO THỨ TỰ (ROLLOUT STEPS)

1. **Bước 1 (Không ảnh hưởng video đang chạy):**
   * Triển khai bộ phân loại điểm tiềm năng đa biến `evaluateQueueItemScore()` vào `dashboard.js`.
   * Tinh chỉnh cấu trúc dữ liệu nhẹ cho `/api/run-status` và caching bộ nhớ cho hàng đợi.
2. **Bước 2 (Chờ video hiện tại hoàn tất):**
   * Cập nhật `Scene.tsx`: Bổ sung `LayoutMediaKenBurns` cho ảnh B-roll thực tế sắc nét.
   * Cập nhật `BrandedIntro.tsx` / `Root.tsx`: Loại bỏ intro bumper 3 giây, đưa tiêu đề hook và badge tin khẩn cấp lên khung hình 0.
   * Tối ưu `Subtitles.tsx`: Bật hiệu ứng word-by-word pop-in phát sáng cho phụ đề.
3. **Bước 3 (Khởi chạy & Kiểm thử):**
   * Khởi động lại service bằng PM2 (`npx pm2 restart ai-trend-news-bot`).
   * Xác minh video kế tiếp có Hook 0s tức thì, hiển thị ảnh B-roll sắc nét và tiến trình chạy êm ái, giao diện phản hồi tức thì.
