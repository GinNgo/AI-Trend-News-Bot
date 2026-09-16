const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Script tích hợp mẫu để đồng bộ các URL từ Google Sheets (dưới dạng file CSV xuất ra hoặc API)
// Để dùng API trực tiếp, bạn cần cài đặt: npm install googleapis
// Ở đây làm mẫu đọc từ 1 danh sách định dạng dòng URL (có thể là file tải về từ Bảng tính)

const QUEUE_FILE = path.join(__dirname, '..', 'data', 'sheets_queue.txt');

function processSheetsQueue() {
  if (!fs.existsSync(QUEUE_FILE)) {
    console.log("ℹ️ Chưa có file hàng đợi từ Bảng tính (sheets_queue.txt). Vui lòng tạo file này và dán các URL vào, mỗi URL một dòng.");
    return;
  }

  const content = fs.readFileSync(QUEUE_FILE, 'utf-8');
  const urls = content.split('\n').map(line => line.trim()).filter(line => line && line.startsWith('http'));

  if (urls.length === 0) {
    console.log("ℹ️ Không có URL hợp lệ nào trong danh sách.");
    return;
  }

  console.log(`📋 Đã tìm thấy ${urls.length} link từ kế hoạch Bảng tính. Bắt đầu xử lý tự động...`);

  const successfulUrls = [];
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`\n======================================================`);
    console.log(`🚀 [${i+1}/${urls.length}] Bắt đầu xử lý URL: ${url}`);
    console.log(`======================================================\n`);
    
    try {
      // Gọi auto_pipeline.js
      const scriptPath = path.join(__dirname, '..', 'auto_pipeline.js');
      execSync(`node "${scriptPath}" "${url}"`, { stdio: 'inherit' });
      successfulUrls.push(url);
    } catch (error) {
      console.error(`❌ Xử lý URL thất bại: ${url}`);
      console.error(error.message);
    }
  }

  // Xóa các link đã xử lý xong ra khỏi file để tránh trùng lặp
  const remainingUrls = urls.filter(u => !successfulUrls.includes(u));
  fs.writeFileSync(QUEUE_FILE, remainingUrls.join('\n'), 'utf-8');
  console.log(`\n✅ Quá trình đồng bộ bảng tính hoàn tất! Đã xử lý ${successfulUrls.length} link.`);
}

processSheetsQueue();
