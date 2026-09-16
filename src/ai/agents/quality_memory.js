/**
 * Video Quality Memory (V3)
 * Location: src/ai/agents/quality_memory.js
 * 
 * Records render manifests, QA results, and applied fixes into
 * data/video_quality/ to build institutional knowledge and prevent
 * recurring defects.
 */

const fs = require('fs');
const path = require('path');

class QualityMemory {
  constructor(options = {}) {
    this.storageDir = options.storageDir || path.join(__dirname, '../../../data/video_quality');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  saveRecord({ videoId, channelId, videoPlan, qaResult, fixesApplied = [] }) {
    const filename = `qa_${videoId || Date.now()}.json`;
    const recordPath = path.join(this.storageDir, filename);

    const record = {
      timestamp: new Date().toISOString(),
      videoId,
      channelId,
      qaScore: qaResult.score || 0,
      qaStatus: qaResult.status || 'UNKNOWN',
      issues: qaResult.issues || [],
      fixesApplied,
      metrics: qaResult.metrics || {}
    };

    fs.writeFileSync(recordPath, JSON.stringify(record, null, 2), 'utf-8');
    return recordPath;
  }

  getRecentAverages(limit = 10) {
    if (!fs.existsSync(this.storageDir)) return { avgScore: 100, totalRecords: 0 };
    const files = fs.readdirSync(this.storageDir).filter(f => f.endsWith('.json')).slice(-limit);
    if (files.length === 0) return { avgScore: 100, totalRecords: 0 };

    let sum = 0;
    files.forEach(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(this.storageDir, f), 'utf-8'));
        sum += (data.qaScore || 0);
      } catch (e) {}
    });

    return {
      avgScore: Math.round(sum / files.length),
      totalRecords: files.length
    };
  }
}

module.exports = { QualityMemory };
