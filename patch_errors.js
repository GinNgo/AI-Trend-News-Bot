const fs = require('fs');

// Patch Worker
let worker = fs.readFileSync('src/scheduler/worker.js', 'utf8');
if (!worker.includes('recordError')) {
  worker = worker.replace(
    "const { JobRepository } = require('../storage/repositories/JobRepository.js');",
    "const { JobRepository } = require('../storage/repositories/JobRepository.js');\nconst { recordError } = require('../utils/error_recorder.js');"
  );
  worker = worker.replace(
    "logger.error(`[Worker] Error processing job ${job.jobId}: ${err.message}`);",
    "logger.error(`[Worker] Error processing job ${job.jobId}: ${err.message}`);\n          recordError(`Worker Stage: ${job.stage}`, err);"
  );
  fs.writeFileSync('src/scheduler/worker.js', worker, 'utf8');
}

// Patch Pipeline
let pipeline = fs.readFileSync('auto_pipeline.js', 'utf8');
if (!pipeline.includes('recordError')) {
  pipeline = "const { recordError } = require('./src/utils/error_recorder.js');\n" + pipeline;
  pipeline = pipeline.replace(
    "console.error(\"❌ Lỗi khi cào dữ liệu:\", e.message);\n      process.exit(1);",
    "console.error(\"❌ Lỗi khi cào dữ liệu:\", e.message);\n      recordError('Crawler Phase', e);\n      process.exit(1);"
  );
  pipeline = pipeline.replace(
    "console.error(\"❌ AI không thể trích xuất sự kiện:\", err.message);\n    process.exit(1);",
    "console.error(\"❌ AI không thể trích xuất sự kiện:\", err.message);\n    recordError('AI Researcher Phase', err);\n    process.exit(1);"
  );
  pipeline = pipeline.replace(
    "console.error(\"❌ AI không thể tạo kịch bản:\", err.message);\n    process.exit(1);",
    "console.error(\"❌ AI không thể tạo kịch bản:\", err.message);\n    recordError('AI Scripting Phase', err);\n    process.exit(1);"
  );
  pipeline = pipeline.replace(
    "console.log(`⚠️ Lỗi hệ thống Publisher: ${err.message}. (Sử dụng lệnh upload thủ công nếu cần)`);",
    "console.log(`⚠️ Lỗi hệ thống Publisher: ${err.message}.`);\n    recordError('Publisher Phase', err);"
  );
  pipeline = pipeline.replace(
    "main().catch(console.error);",
    "main().catch(err => {\n  console.error(err);\n  recordError('Global Catch', err);\n});"
  );
  fs.writeFileSync('auto_pipeline.js', pipeline, 'utf8');
}
console.log("Patched errors");
