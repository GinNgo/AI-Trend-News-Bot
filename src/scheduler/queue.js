const { v4: uuidv4 } = require('uuid');
const logger = require('../collector/utils/logger');
const fs = require('fs');
const path = require('path');

const JOB_STATES = {
  PENDING: 'PENDING',
  COLLECTING: 'COLLECTING',
  RESEARCHING: 'RESEARCHING',
  SCRIPTING: 'SCRIPTING',
  STORYBOARDING: 'STORYBOARDING',
  ASSET_FETCHING: 'ASSET_FETCHING',
  VOICE_GENERATING: 'VOICE_GENERATING',
  RENDERING: 'RENDERING',
  FACT_CHECK: 'FACT_CHECK',
  QC: 'QC',
  APPROVAL: 'APPROVAL',
  PUBLISHED: 'PUBLISHED',
  FAILED: 'FAILED'
};

const DB_PATH = path.join(__dirname, '../../db_jobs.json');

class JobQueue {
  constructor() {
    this.jobs = new Map();
    this.loadJobs();
  }

  loadJobs() {
    if (fs.existsSync(DB_PATH)) {
      try {
        const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
        Object.keys(data).forEach(k => this.jobs.set(k, data[k]));
      } catch (e) {
        logger.error('Lỗi khi load DB Jobs', { error: e.message });
      }
    }
  }

  saveJobs() {
    const data = {};
    this.jobs.forEach((v, k) => data[k] = v);
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  }

  createJob(sourceUrl) {
    const jobId = uuidv4();
    const job = {
      jobId,
      sourceUrl,
      state: JOB_STATES.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retries: 0,
      maxRetries: 3,
      error: null,
      artifacts: {}
    };
    this.jobs.set(jobId, job);
    this.saveJobs();
    logger.info(`[JobQueue] Đã tạo Job mới: ${jobId} cho URL: ${sourceUrl}`);
    return job;
  }

  updateState(jobId, newState, artifacts = {}, error = null) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} không tồn tại`);

    job.state = newState;
    job.updatedAt = new Date().toISOString();
    if (error) job.error = error.message;
    job.artifacts = { ...job.artifacts, ...artifacts };

    this.jobs.set(jobId, job);
    this.saveJobs();
    logger.info(`[JobQueue] Job ${jobId} chuyển sang trạng thái: ${newState}`);
    return job;
  }

  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  getPendingApprovalJobs() {
    const results = [];
    this.jobs.forEach(job => {
      if (job.state === JOB_STATES.APPROVAL) results.push(job);
    });
    return results;
  }
}

module.exports = { JobQueue, JOB_STATES };