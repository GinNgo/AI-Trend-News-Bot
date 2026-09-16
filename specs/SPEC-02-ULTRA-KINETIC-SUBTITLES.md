# SPEC-02: ULTRA-KINETIC TYPOGRAPHY (SUBTITLES)
**Mã đặc tả:** SPEC-02
**Áp dụng:** `src/DynamicNews/Subtitles.tsx`, `auto_pipeline.js`
**Mục tiêu:** Tối ưu hóa điểm nhìn mắt người xem (Eye-Tracking), tạo cảm giác nhịp điệu nhanh và hấp dẫn, không che khuất hình ảnh.

---

## 1. Bối cảnh & Vấn đề
- Kiểu phụ đề cũ gom cụm 6-10 từ hiển thị trong một khung đen mờ (`backdrop blur box`) đặt ở gần đáy màn hình.
- **Hạn chế:**
  - Khung đen chiếm diện tích lớn, che mất chi tiết của hình ảnh/video hiện trường bên dưới.
  - Cụm từ dài khiến mắt người xem phải đảo qua lại để đọc như đọc sách, gây mỏi mắt và làm mất nhịp cảm xúc.
  - Không tạo ra sự bùng nổ năng lượng thị giác (visual punch).

---

## 2. Tiêu chuẩn Phụ đề Viral (Alex Hormozi & MrBeast Style)

### 2.1. Kích thước hiển thị (Micro-Chunking)
- Mỗi lần hiển thị chỉ từ **1 đến tối đa 3 từ** (Word-by-Word hoặc Micro-Phrases).
- Từ đang phát âm (`activeWord`) được phóng to đột ngột (Scale Punch 1.15x - 1.25x) bằng Remotion Spring.

### 2.2. Vị trí & Không gian an toàn (Safe Zone Alignment)
- Vị trí hiển thị: **Căn giữa ngang**, cách mép trên **62% - 68% chiều cao màn hình** (ngay dưới tầm nhìn trọng tâm của mắt người xem, phía trên khu vực News Ticker và mô tả của YouTube Shorts).
- **Loại bỏ hộp nền đen tù túng:** Thay thế bằng kỹ thuật viền chữ siêu nét:
  - `text-shadow`: Đa tầng đổ bóng đen (`0 4px 16px rgba(0,0,0,0.95), 0 0 24px rgba(0,0,0,0.8)`).
  - `WebkitTextStroke`: 2px - 3px viền đen tương phản cao (`-webkit-text-stroke: 2.5px #000`).

### 2.3. Quy tắc Đổi màu Từ khóa Nổi bật (Dynamic Keyword Coloring)
- Từ bình thường: Màu trắng sáng `#FFFFFF` hoặc ngà bạc `#F8FAFC`.
- Từ đang đọc (`activeWord`):
  - Mặc định: Vàng Neon chói lọi `#FACC15` kèm hiệu ứng phát sáng `box-shadow` / `drop-shadow`.
  - Nếu từ chứa số liệu, phần trăm, tiền tệ: Đổi sang Xanh Cyan `#38BDF8` hoặc Xanh Neon `#22C55E`.
  - Nếu từ mang sắc thái cảnh báo, nguy hiểm, phá sản: Đổi sang Đỏ Cam `#EF4444`.

### 2.4. Động lực học (Spring Animation Specs)
```typescript
const wordSpring = spring({
  frame: currentFrame - word.startFrame,
  fps: 30,
  config: { damping: 14, stiffness: 240, mass: 0.4 }
});
// Scale từ 0.85 -> 1.18 -> 1.0 (hiệu ứng nảy tức thì)
```
