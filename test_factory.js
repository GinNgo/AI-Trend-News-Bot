const { VideoFactoryPipeline } = require('./src/scheduler/pipeline');
const logger = require('./src/collector/utils/logger');
const cache = require('./src/collector/utils/cache');

async function testFactory() {
  console.log('--- KHỞI ĐỘNG BÀI TEST AI NEWS VIDEO FACTORY ---');
  const factory = new VideoFactoryPipeline();

  // Test URL - Sử dụng một URL thực tế để test toàn bộ pipeline
  const testUrl = 'https://tuoitre.vn/bao-yeagi-tai-nhat-ban-20250110080645607.htm';

  // Xóa cache cũ để đảm bảo job chạy
  cache.del(`url_${testUrl}`);

  try {
    console.log(`\n▶️ TEST: Bơm 1 Job vào Factory Scheduler (${testUrl})`);
    const job = await factory.runJob(testUrl);

    console.log('\n--- BÁO CÁO KẾT QUẢ JOB ---');
    console.log(`Job ID: ${job.jobId}`);
    console.log(`Trạng thái cuối: ${job.state}`);
    console.log(`Số lần Retry: ${job.retries}`);

    if (job.state === 'APPROVAL') {
      console.log(`✅ THÀNH CÔNG! Job đang chờ duyệt (APPROVAL).`);
      console.log(`Kết quả QC:`, job.artifacts.qcResult);
      console.log(`Đường dẫn Video:`, job.artifacts.videoPath);

      console.log('\n--- MÔ PHỎNG APPROVAL ---');
      console.log(`▶️ Người dùng duyệt Job...`);
      factory.queue.updateState(job.jobId, 'PUBLISHED');
      console.log(`✅ Đã duyệt & Publish thành công! Trạng thái: PUBLISHED`);
    } else {
      console.log(`❌ THẤT BẠI! Lỗi:`, job.error);
    }
  } catch (error) {
    console.error(`\n❌ CRASH PIPELINE:`, error.message);
  }
}

testFactory();