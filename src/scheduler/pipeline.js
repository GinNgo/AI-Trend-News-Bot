const { JobQueue, JOB_STATES } = require('./queue');
const { AIQualityControl } = require('./qc');
const collectorManager = require('../collector');
const { EvidenceResearcher } = require('../ai/researcher');
const { VideoEngine } = require('../engine/video_engine');
const logger = require('../collector/utils/logger');
const fs = require('fs');
const path = require('path');

class VideoFactoryPipeline {
  constructor() {
    this.queue = new JobQueue();
    const configPath = path.join(__dirname, '../../config.json');
    this.config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    this.researcher = new EvidenceResearcher(this.config.GEMINI_API_KEY);
    this.engine = new VideoEngine(this.config);
    this.qc = new AIQualityControl(this.config.GEMINI_API_KEY);
  }

  async runJob(sourceUrl) {
    const job = this.queue.createJob(sourceUrl);

    try {
      // 1. COLLECT
      this.queue.updateState(job.jobId, JOB_STATES.COLLECTING);
      const article = await collectorManager.collectArticle(sourceUrl);
      if (!article) {
        throw new Error('Không thể thu thập dữ liệu từ URL (hoặc bị trùng lặp).');
      }

      // 2. RESEARCH & STORY
      this.queue.updateState(job.jobId, JOB_STATES.RESEARCHING, { article });
      // Giả lập đưa vào dạng array như pipeline yêu cầu
      const storyPackage = await this.researcher.runPipeline([article]);

      // 3. VIDEO ENGINE (STORYBOARDING & ASSET_FETCHING & RENDERING)
      this.queue.updateState(job.jobId, JOB_STATES.RENDERING, { storyPackage });
      const outputPath = path.join(__dirname, `../../out/job_${job.jobId}.mp4`);

      // Khởi chạy render
      await this.engine.render(storyPackage, outputPath);

      // 4. QC (AI FACT-CHECK & QUALITY CONTROL)
      this.queue.updateState(job.jobId, JOB_STATES.QC, { videoPath: outputPath });
      const qcResult = await this.qc.runQC(storyPackage);

      if (!qcResult.passed) {
        throw new Error(`QC Failed: ${qcResult.fatalErrors.join(', ')}`);
      }

      // 5. APPROVAL (Human in the loop)
      this.queue.updateState(job.jobId, JOB_STATES.APPROVAL, { qcResult });
      logger.info(`[FACTORY] Job ${job.jobId} đang chờ phê duyệt từ con người!`);

      return job;

    } catch (error) {
      logger.error(`[FACTORY] Lỗi nghiêm trọng tại Job ${job.jobId}: ${error.message}`);

      // Retry logic
      const currentJob = this.queue.getJob(job.jobId);
      if (currentJob.retries < currentJob.maxRetries) {
        currentJob.retries += 1;
        logger.info(`[FACTORY] Thử lại Job ${job.jobId} (Lần ${currentJob.retries})`);
        this.queue.saveJobs();
        return await this.runJob(sourceUrl); // Simple recursion for retry
      } else {
        this.queue.updateState(job.jobId, JOB_STATES.FAILED, {}, error);
        return currentJob;
      }
    }
  }

  // Khởi chạy chế độ Production Scheduler khi đã pass mọi test
  startScheduler() {
    logger.info('[FACTORY] Đã khởi động Production Scheduler.');
    // Có thể gắn cron/setInterval ở đây để tự động lấy từ RSS
  }
}

module.exports = { VideoFactoryPipeline };