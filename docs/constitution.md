# 🏛️ Constitution — AI Trend News Bot

> Các nguyên tắc cốt lõi làm kim chỉ nam cho toàn bộ quá trình phát triển.

## 1. Nguyên tắc Kiến trúc

- **Local-First**: Mọi thứ chạy trên máy local, không phụ thuộc cloud server.
- **Event-First (V2)**: Dự án đang chuyển từ article-first → event-first architecture. Mọi tính năng mới PHẢI tuân thủ event-first.
- **Pipeline Stage Machine**: Mỗi job đi qua các stage rõ ràng: `COLLECTING → RESEARCHING → STORY_PLANNING → FINAL_FACT_CHECK → RENDERING → QC → APPROVAL → PUBLISHING`.
- **DynamicNews là composition chính**: Chỉ sử dụng và phát triển `DynamicNews` composition. Các template cũ (SportsNews, BusinessNews, TrafficNews, TechNews) giữ nguyên nhưng không phát triển thêm.

## 2. Nguyên tắc Mã Nguồn

- **TypeScript cho frontend/Remotion**: Tất cả video components phải viết bằng TypeScript.
- **JavaScript cho backend/pipeline**: Pipeline scripts dùng Node.js (CommonJS).
- **Zod cho validation**: Schema validation bắt buộc dùng Zod.
- **Design Tokens**: Mọi giá trị UI (color, font, spacing, animation) PHẢI lấy từ `src/design/tokens.ts`. KHÔNG hard-code magic numbers.

## 3. Nguyên tắc Nội dung & Ngôn ngữ

- **Tự động phát hiện ngôn ngữ**: Hệ thống PHẢI tự động xác định ngôn ngữ video (Tiếng Việt hoặc Tiếng Anh) dựa trên nguồn tin và phạm vi ảnh hưởng.
- **Fact-Based**: KHÔNG bịa đặt số liệu. Mọi thông tin trong video phải có nguồn gốc từ bài báo gốc.
- **AI Quality Control**: Mỗi video phải qua AI QC trước khi publish.

## 4. Nguyên tắc Video

- **Vertical-first**: Định dạng 1080×1920 (9:16) cho Shorts/Reels.
- **Dynamic duration**: Thời lượng video tính tự động từ audio, KHÔNG hard-code frame count.
- **Animation luôn chuyển động**: Video phải có chuyển động liên tục (float, pulse, progress bar, visualizer).

## 5. Nguyên tắc Testing & QA

- **AI QC Gate**: Video tự động phải qua bước Quality Control trước khi publish.
- **Human Approval Gate**: Trừ khi `AUTO_APPROVE=true`, mọi video cần người duyệt.
- **Cost Tracking**: Theo dõi chi phí AI API cho mỗi video.

## 6. Nguyên tắc Bảo mật

- **KHÔNG commit secrets**: API keys, tokens, client_secret phải nằm trong `.gitignore`.
- **SSRF Protection**: URL validator bắt buộc cho mọi scraping request.
