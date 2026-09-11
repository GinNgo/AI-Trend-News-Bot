const { JobRepository } = require('../storage/repositories/JobRepository.js');
const { recordError } = require('../utils/error_recorder.js');
const { VideoFactoryPipeline } = require('../application/video_factory_pipeline.js');
const logger = require('../collector/utils/logger.js');
const os = require('os');

const workerId = `${os.hostname()}-${process.pid}`;

class DurableWorker {
  constructor(pollIntervalMs = 5000) {
    this.jobRepo = new JobRepository();
    this.pipeline = new VideoFactoryPipeline();
    this.pollIntervalMs = pollIntervalMs;
    this.isRunning = false;
  }

  async start() {
    this.isRunning = true;
    logger.info(`[Worker] Started Durable Worker ${workerId}. Polling every ${this.pollIntervalMs}ms`);

    // Crash recovery: find jobs stuck in PROCESSING and unlock them
    this.recoverStuckJobs();

    while (this.isRunning) {
      try {
        await this.poll();
      } catch (err) {
        logger.error(`[Worker] Polling error: ${err.message}`);
      }
      await new Promise(res => setTimeout(res, this.pollIntervalMs));
    }
  }

  stop() {
    this.isRunning = false;
    logger.info(`[Worker] Stopping worker...`);
  }

  recoverStuckJobs() {
    const db = this.jobRepo.db;
    const stuckJobs = db.prepare(`
      SELECT jobId FROM jobs
      WHERE status = 'PROCESSING'
      AND lockedAt < datetime('now', '-30 minutes')
    `).all();

    for (const row of stuckJobs) {
      logger.info(`[Worker] Recovering stuck job ${row.jobId}...`);
      this.jobRepo.unlockJob(row.jobId, 'RETRYING', 'STUCK', 'Job was stuck in processing state');
    }
  }

  async poll() {
    const jobs = this.jobRepo.findPendingJobs(5); // Fetch up to 5 jobs
    if (jobs.length === 0) return;

    for (const job of jobs) {
      if (!this.isRunning) break;

      const locked = this.jobRepo.lockJob(job.jobId, workerId);
      if (locked) {
        await this.processJob(job);
      }
    }
  }

  async processJob(job) {
    logger.info(`[Worker] Processing Job ${job.jobId} at stage ${job.stage}`);
    try {
      this.jobRepo.addJobEvent(job.jobId, job.stage, 'PROCESSING', `Worker ${workerId} started processing`);

      const nextStage = await this.pipeline.executeStage(job.jobId, job.stage, job.payload);

      if (nextStage) {
        logger.info(`[Worker] Job ${job.jobId} moved to stage ${nextStage}`);
        this.jobRepo.updateJob(job.jobId, {
          stage: nextStage,
          lockedBy: null,
          lockedAt: null,
          status: 'PENDING',
          payload: job.payload
        });
        this.jobRepo.addJobEvent(job.jobId, nextStage, 'PENDING', `Transitioned to ${nextStage}`);
      } else {
        logger.info(`[Worker] Job ${job.jobId} finished successfully`);
        this.jobRepo.updateJob(job.jobId, {
          lockedBy: null,
          lockedAt: null,
          status: 'COMPLETED',
          payload: job.payload,
          finishedAt: new Date().toISOString()
        });
        this.jobRepo.addJobEvent(job.jobId, job.stage, 'COMPLETED', `Job finished`);
      }
    } catch (err) {
      logger.error(`[Worker] Error processing job ${job.jobId}: ${err.message}`);
          recordError(`Worker Stage: ${job.stage}`, err);

      // Determine if retryable (most are, unless auth/config errors)
      const isRetryable = !err.message.includes('Auth') && !err.message.includes('fatal');

      this.jobRepo.failJob(job.jobId, 'ERR_STAGE', err.message, isRetryable);
    }
  }
}

module.exports = { DurableWorker };

if (require.main === module) {
  const worker = new DurableWorker();
  worker.start();

  process.on('SIGINT', () => {
    worker.stop();
    process.exit(0);
  });
}
