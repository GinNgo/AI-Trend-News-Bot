const { getDb } = require('../src/storage/db.js');
const { Publisher } = require('../src/publishing/publisher.js');

const db = getDb();
const publisher = new Publisher();

// Lấy toàn bộ các bài PENDING hiện tại
const pendingPubs = db.prepare(`
  SELECT publicationId, title, scheduledAt, language 
  FROM publications 
  WHERE status = 'PENDING' 
  ORDER BY datetime(scheduledAt) ASC
`).all();

console.log(`🔍 Tìm thấy ${pendingPubs.length} video đang chờ trong hàng đợi PENDING.`);

if (pendingPubs.length === 0) {
  console.log("✅ Không có video nào cần sắp xếp lại.");
  process.exit(0);
}

// Tạm thời xóa các scheduledAt cũ để calculateNextPeakSlot tính toán lại từ đầu
db.prepare("UPDATE publications SET scheduledAt = NULL WHERE status = 'PENDING'").run();

const updateStmt = db.prepare("UPDATE publications SET scheduledAt = ? WHERE publicationId = ?");

console.log("\n📅 ĐANG PHÂN BỔ LẠI TOÀN BỘ VIDEO VÀO CÁC KHUNG GIỜ VÀNG (CHỐNG SPAM):");

for (let i = 0; i < pendingPubs.length; i++) {
  const pub = pendingPubs[i];
  const lang = pub.language || 'vi';
  
  // Tính slot vàng tiếp theo (đảm bảo giãn cách tối thiểu 2 giờ, tối đa 3-4 video/ngày)
  const newSlot = publisher.calculateNextPeakSlot(false, lang);
  updateStmt.run(newSlot, pub.publicationId);
  
  const d = new Date(newSlot);
  const vnTime = d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  console.log(`  [${i + 1}/${pendingPubs.length}] ${vnTime} => ${pub.title.substring(0, 50)}...`);
}

console.log("\n✅ ĐÃ TÁI CẤU TRÚC LỊCH ĐĂNG TOÀN BỘ VIDEO THÀNH CÔNG! KÊNH HOÀN TOÀN AN TOÀN.");
process.exit(0);
