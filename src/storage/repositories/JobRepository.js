const { getDb } = require('../db.js');

class JobRepository {
  constructor() {
    this.db = getDb();
  }

  createJob(job) {
    const stmt = this.db.prepare(`
      INSERT INTO jobs (
        jobId, idempotencyKey, eventId, storyId, stage, status, priority, maxAttempts, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      job.jobId,
      job.idempotencyKey || null,
      job.eventId || null,
      job.storyId || null,
      job.stage,
      job.status || 'PENDING',
      job.priority || 0,
      job.maxAttempts || 3,
      job.payload ? JSON.stringify(job.payload) : null
    );

    return this.getJob(job.jobId);
  }

  getJob(jobId) {
    const row = this.db.prepare('SELECT * FROM jobs WHERE jobId = ?').get(jobId);
    if (row && row.payload) {
      row.payload = JSON.parse(row.payload);
    }
    return row;
  }

  updateJob(jobId, updates) {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'payload') {
        fields.push(`${key} = ?`);
        values.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    fields.push('updatedAt = CURRENT_TIMESTAMP');

    if (fields.length === 1) return this.getJob(jobId);

    values.push(jobId);

    const stmt = this.db.prepare(`
      UPDATE jobs SET ${fields.join(', ')} WHERE jobId = ?
    `);

    stmt.run(...values);
    return this.getJob(jobId);
  }

  findPendingJobs(limit = 10) {
    const rows = this.db.prepare(`
      SELECT * FROM jobs
      WHERE status IN ('PENDING', 'RETRYING')
      AND (scheduledAt IS NULL OR scheduledAt <= CURRENT_TIMESTAMP)
      AND (lockedAt IS NULL OR lockedAt < datetime('now', '-10 minutes'))
      ORDER BY priority DESC, scheduledAt ASC, createdAt ASC
      LIMIT ?
    `).all(limit);

    return rows.map(row => {
      if (row.payload) row.payload = JSON.parse(row.payload);
      return row;
    });
  }

  lockJob(jobId, workerId) {
    const result = this.db.prepare(`
      UPDATE jobs
      SET lockedBy = ?, lockedAt = CURRENT_TIMESTAMP, status = 'PROCESSING'
      WHERE jobId = ? AND (status IN ('PENDING', 'RETRYING') OR (lockedAt < datetime('now', '-10 minutes')))
    `).run(workerId, jobId);

    return result.changes > 0;
  }

  unlockJob(jobId, status = 'PENDING', errorCode = null, errorMessage = null) {
    this.db.prepare(`
      UPDATE jobs
      SET lockedBy = NULL, lockedAt = NULL, status = ?, errorCode = ?, errorMessage = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE jobId = ?
    `).run(status, errorCode, errorMessage, jobId);
  }

  failJob(jobId, errorCode, errorMessage, incrementAttempt = true) {
    const job = this.getJob(jobId);
    if (!job) return;

    const newAttempts = incrementAttempt ? job.attempts + 1 : job.attempts;
    const newStatus = newAttempts >= job.maxAttempts ? 'DLQ' : 'RETRYING';

    // Calculate exponential backoff for retry
    let nextScheduledAt = null;
    if (newStatus === 'RETRYING') {
      const backoffSeconds = Math.pow(2, newAttempts) * 15; // 30s, 60s, 120s...
      nextScheduledAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();
    }

    this.db.prepare(`
      UPDATE jobs
      SET
        lockedBy = NULL,
        lockedAt = NULL,
        status = ?,
        attempts = ?,
        errorCode = ?,
        errorMessage = ?,
        scheduledAt = COALESCE(?, scheduledAt),
        updatedAt = CURRENT_TIMESTAMP
      WHERE jobId = ?
    `).run(newStatus, newAttempts, errorCode, errorMessage, nextScheduledAt, jobId);

    this.addJobEvent(jobId, job.stage, newStatus, errorMessage);
  }

  addJobEvent(jobId, stage, status, message = null) {
    this.db.prepare(`
      INSERT INTO job_events (jobId, stage, status, message)
      VALUES (?, ?, ?, ?)
    `).run(jobId, stage, status, message);
  }
}

module.exports = { JobRepository };
