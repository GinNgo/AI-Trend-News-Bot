# SPEC-01: HOOK ENGINE & ENDLESS LOOP STORYTELLING
**Mã đặc tả:** SPEC-01
**Áp dụng:** `src/ai/agents.js`, `src/ai/researcher.js`, `auto_pipeline.js`
**Mục tiêu:** Giảm Swipe-Away Rate xuống <25% và đẩy Average Percentage Viewed (AVD) lên >100%.

---

## 1. Bối cảnh & Vấn đề
- **Vấn đề 1:** Khán giả lướt qua video trong 1.5 - 3 giây đầu nếu câu mở đầu quá dài dòng, chứa lời chào ("Xin chào các bạn...", "Hôm nay chúng ta sẽ tìm hiểu..."), hoặc mang tính tường thuật báo đài truyền thống.
- **Vấn đề 2:** Đoạn kết thúc truyền thống có lời chào tạm biệt ("Cảm ơn các bạn đã theo dõi, nhớ like và subscribe...") hoạt động như một **"Exit Sign" (Biển báo lối thoát)**, báo hiệu video đã hết và thúc đẩy người dùng vuốt sang video khác ngay lập tức, khiến đường cong retention rớt thẳng đứng ở 5 giây cuối.

---

## 2. Ma trận Hook Đỉnh cao (The 5-Archetype Hook Matrix)
Mỗi video ngắn tạo ra PHẢI bắt đầu bằng một trong 5 cấu trúc Hook tâm lý sau (thực hiện ngay trong câu voiceover đầu tiên của Cảnh 1, độ dài 12 - 20 từ):

| Archetype | Bản chất tâm lý | Mẫu tiếng Việt (Kênh 1 & 2) | Mẫu tiếng Anh (Kênh 3 - Curious Globe) |
| :--- | :--- | :--- | :--- |
| **1. Contrarian / Myth-Bust** | Phản trực giác, bẻ gãy niềm tin cũ | "Dừng ngay việc [X] nếu bạn không muốn [Hậu quả tệ hại]..." / "Hầu hết mọi người đều nghĩ [A], nhưng sự thật là [B]..." | "Stop believing [Common Myth], because the reality is far more terrifying..." / "Everything you've been told about [Topic] is completely backwards." |
| **2. High-Stakes Urgency** | Tính cấp bách, sự kiện chấn động đang xảy ra | "Một quyết định chưa từng có tiền lệ vừa được ban hành..." / "Số tiền [X tỷ đồng] đã bốc hơi chỉ sau một đêm vì..." | "A massive breakthrough just occurred that changes [Industry] forever..." / "Millions of dollars vanished overnight, and here is why." |
| **3. Curiosity Gap** | Tiết lộ một nửa, giấu phần cốt lõi | "Lý do thực sự đằng sau [Vụ việc bí ẩn] đen tối hơn bạn tưởng rất nhiều..." | "The real reason why [Event] occurred is something nobody is talking about..." |
| **4. Visual / Data Shock** | Đập ngay con số gây kinh ngạc vào mắt | "Hơn 90% người dùng không hề biết con số này..." / "[X triệu USD] chỉ để mua lại một thứ vô hình?" | "Over 90% of scientists were stunned when this single number was revealed..." |
| **5. In Media Res** | Lao thẳng vào điểm nóng cao trào nhất | "Khoảnh khắc mà [Nhân vật/Hệ thống] sụp đổ hoàn toàn đã bắt đầu như thế này..." | "The exact moment the entire operation collapsed started with a single mistake..." |

---

## 3. Cơ chế Endless Retention Loop (Vòng lặp vô tận)
Để đẩy tỷ lệ giữ chân khán giả vượt mốc **100%** (thuật toán YouTube Shorts cực kỳ ưa chuộng):

1. **Cấm tuyệt đối Outro truyền thống:**
   - Không xuất hiện cảnh cảm ơn, không tạm biệt, không xin like/subscribe ở các video Shorts (<60s).
2. **Kỹ thuật Cầu nối Vòng lặp (The Loop Bridge):**
   - Câu thoại cuối cùng của cảnh kết thúc được thiết kế ngữ pháp để bổ nghĩa hoặc dẫn nhập trực tiếp vào câu đầu tiên của Cảnh 1.
   - **Ví dụ Tiếng Việt:**
     - *Câu cuối (Cảnh kết):* "...Và toàn bộ bí mật chấn động này chỉ bắt đầu từ..."
     - *Câu đầu (Cảnh 1):* "...Một quyết định bí mật vào rạng sáng hôm qua!"
     - Người xem nghe xong câu cuối sẽ tự động kết nối thành một dòng tư duy khép kín và vô tình xem lại thêm 3-5 giây của vòng lặp tiếp theo.
   - **Ví dụ Tiếng Anh:**
     - *Last Sentence:* "...Which brings us all the way back to why..."
     - *First Sentence:* "...Archaeologists just discovered a 3,000-year-old weapon made of alien metal!"

---

## 4. Quy chuẩn Kịch bản (Scripting Standard)
- **Độ dài mỗi cảnh:** 6 đến 9 giây (tương đương 18 - 28 từ/cảnh).
- **Tổng số cảnh cho video Shorts 45 - 55s:** 5 đến 7 cảnh.
- **Mật độ thông tin:** Mỗi 2 giây phải có 1 thông tin/tình tiết/con số mới, không kéo dài câu chữ bằng các tính từ sáo rỗng.
