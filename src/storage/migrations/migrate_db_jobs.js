const fs = require('fs');
const path = require('path');
const { JobRepository } = require('../repositories/JobRepository.js');

const DB_JOBS_FILE = path.join(process.cwd(), 'db_jobs.json');

function migrateOldJobs() {
  if (!fs.existsSync(DB_JOBS_FILE)) {
    console.log('No db_jobs.json found to migrate.');
    return;
  }

  const raw = fs.readFileSync(DB_JOBS_FILE, 'utf-8');
  let oldJobs = {};
  try {
    oldJobs = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse db_jobs.json:', err);
    return;
  }

  const jobRepo = new JobRepository();

  let count = 0;
  for (const [id, oldJob] of Object.entries(oldJobs)) {
    // Check if job already exists
    const existing = jobRepo.getJob(id);
    if (!existing) {
      jobRepo.createJob({
        jobId: id,
        stage: oldJob.state || 'RESEARCHING',
        status: 'PENDING',
        payload: {
          sourceUrl: oldJob.sourceUrl,
          artifacts: oldJob.artifacts,
          error: oldJob.error
        },
        maxAttempts: oldJob.maxRetries || 3
      });
      count++;
    }
  }

  console.log(`Migrated ${count} jobs from db_jobs.json to SQLite.`);
}

module.exports = { migrateOldJobs };

if (require.main === module) {
  migrateOldJobs();
}
