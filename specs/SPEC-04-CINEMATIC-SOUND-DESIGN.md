# SPEC-04: CINEMATIC SOUND DESIGN & AUDIO LAYERING
**Mã đặc tả:** SPEC-04
**Áp dụng:** `src/DynamicNews/index.tsx`, `src/engine/video_engine.js`, `auto_pipeline.js`
**Mục tiêu:** Tạo không gian âm thanh đa chiều, cuốn hút, kích thích phản xạ thính giác người nghe.

---

## 1. Cấu trúc Âm thanh 3 Lớp (3-Tier Sound Hierarchy)

| Tầng âm thanh | Nguồn âm | Mức âm lượng (Gain/Volume) | Vai trò |
| :--- | :--- | :--- | :--- |
| **Tier 1: Voiceover (Lời thoại)** | Edge-TTS (Christopher / Nam Minh) | 1.0 – 1.1 (Normalize, không clipping) | Giọng đọc rõ ràng, dồn dập, tốc độ `+5%` đến `+8%` không có khoảng lặng chết. |
| **Tier 2: Ambient BGM (Nhạc nền)** | `public/bgm.mp3` | 0.08 – 0.12 (Ducked) | Nhịp điệu ngầm giữ nhịp tim người xem, không đè giọng đọc. |
| **Tier 3: Cinematic Foley & SFX** | Thư viện `public/sfx/` | 0.35 – 0.55 | Đánh thức não bộ tại các điểm giao cắt thị giác. |

---

## 2. Danh mục SFX & Kích hoạt Keyframe

### 2.1. Frame 0 Impact / Sub-Boom
- **Thời điểm:** Ngay frame 0 đến frame 18 của video.
- **Tác dụng:** Cú hích âm thanh giật mình đầu tiên kết hợp với Hook hình ảnh để chặn ngón tay người dùng trước khi kịp vuốt qua.
- **Asset:** `public/sfx/whoosh.wav` (hoặc chập âm whoosh + sub punch).

### 2.2. Scene Transition Whoosh
- **Thời điểm:** Xuất hiện trước khi chuyển sang cảnh mới 8 frames, kéo dài 16 frames.
- **Âm lượng:** 0.38.

### 2.3. Keyword Pops & Takeaway Cards
- **Thời điểm:** Khi từng thẻ luận điểm (`takeaways`) hoặc từ khóa bùng nổ hiển thị.
- **Asset:** `public/sfx/pop.wav`, volume 0.42.

### 2.4. Stat / Evidence Ding
- **Thời điểm:** Khi bộ đếm số (`statNumber` / `counterTarget`) bắt đầu nhảy số.
- **Asset:** `public/sfx/ding.wav`, volume 0.48.

---

## 3. Tinh chỉnh Tốc độ Đọc TTS (Voiceover Pacing)
- **Kênh tiếng Anh (Curious Globe):** `--rate="+8%"` hoặc `+10%`. Giọng đọc Christopher khi tăng tốc nhẹ sẽ tạo cảm giác sắc sảo, tự tin, mang phong cách documentary của Netflix/Vox.
- **Kênh tiếng Việt (Thời Sự & Kai Viet Tech):** `--rate="+5%"`. Đọc lưu loát, dứt khoát, loại bỏ độ trễ nghỉ hơi giữa các câu.
