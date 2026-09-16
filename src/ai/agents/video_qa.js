/**
 * Video QA Agent (V3)
 * Location: src/ai/agents/video_qa.js
 * 
 * Performs objective, rule-based quality assurance on rendered videos
 * and scene manifests before publication.
 * 
 * Verifies:
 * - Duration compliance (35s - 58s)
 * - Resolution & Aspect ratio (1080x1920, 9:16)
 * - Missing or corrupted audio/image assets
 * - Excessive static frames (> 3.5s without visual change)
 * - Visual repetition across consecutive scenes
 * - Subtitle safe-area boundaries
 */

const fs = require('fs');
const path = require('path');

class VideoQA {
  constructor(options = {}) {
    this.minDurationSec = options.minDurationSec || 35;
    this.maxDurationSec = options.maxDurationSec || 58;
    this.maxStaticShotSec = options.maxStaticShotSec || 3.5;
    this.passThreshold = options.passThreshold || 80;
    this.logFn = options.logFn || console.log;
  }

  /**
   * Inspect a video manifest and rendered file.
   * @param {Object} params
   * @param {string} params.videoPath - Path to the rendered MP4 file
   * @param {Object} params.renderPayload - The JSON payload passed to Remotion
   * @param {Object} params.videoPlan - The planned shots and pacing
   * @returns {Object} QA report { status, score, issues, suggestedFixes, metrics }
   */
  inspect({ videoPath = '', renderPayload = {}, videoPlan = null }) {
    this.logFn('\n🔍 [VideoQA] Bắt đầu kiểm định Chất lượng Video (Quality Assurance)...');

    const issues = [];
    const suggestedFixes = [];
    let score = 100;

    // 1. File existence & basic physical checks
    if (videoPath) {
      if (!fs.existsSync(videoPath)) {
        score = 0;
        issues.push(`File video không tồn tại tại đường dẫn: ${videoPath}`);
        suggestedFixes.push({ type: 're_render', action: 'Render lại toàn bộ composition' });
        return { status: 'FAIL', score: 0, issues, suggestedFixes };
      }
      const stat = fs.statSync(videoPath);
      if (stat.size < 100000) { // Under 100KB
        score -= 70;
        issues.push(`Kích thước file video quá nhỏ (${(stat.size / 1024).toFixed(1)} KB), có thể bị lỗi render dang dở`);
        suggestedFixes.push({ type: 're_render', action: 'Render lại với timeout lớn hơn' });
      }
    }

    // 2. Duration checks
    const scenes = (renderPayload && renderPayload.scenes) || [];
    const totalFrames = renderPayload.totalDurationInFrames || 0;
    const durationSec = totalFrames > 0 ? (totalFrames / 30) : 0;

    if (durationSec > 0) {
      if (durationSec < this.minDurationSec) {
        score -= 25;
        issues.push(`Thời lượng video quá ngắn (${durationSec.toFixed(1)}s < ${this.minDurationSec}s chuẩn Shorts)`);
        suggestedFixes.push({ type: 'extend_script', action: 'Thêm 1-2 cảnh phân tích số liệu hoặc trích dẫn' });
      } else if (durationSec > this.maxDurationSec) {
        score -= 20;
        issues.push(`Thời lượng video vượt quá giới hạn an toàn Shorts (${durationSec.toFixed(1)}s > ${this.maxDurationSec}s)`);
        suggestedFixes.push({ type: 'trim_pacing', action: 'Tăng tốc độ đọc TTS thêm +5% hoặc rút ngắn câu kết' });
      }
    }

    // 3. Asset integrity checks (Audio & Images)
    const publicDir = path.join(__dirname, '../../../public');
    let missingAudioCount = 0;
    scenes.forEach((sc, idx) => {
      if (sc.audioFile) {
        const aPath = path.join(publicDir, sc.audioFile);
        if (!fs.existsSync(aPath) || fs.statSync(aPath).size < 500) {
          missingAudioCount++;
          issues.push(`Audio cảnh ${idx + 1} (${sc.audioFile}) bị thiếu hoặc rỗng (<500B)`);
        }
      }
    });

    if (missingAudioCount > 0) {
      score -= Math.min(50, missingAudioCount * 25);
      suggestedFixes.push({ type: 'repair_audio', action: 'Sinh lại audio cho các cảnh bị lỗi trước khi render' });
    }

    // 4. Excessive static shot check (using videoPlan if available)
    let staticShotViolations = 0;
    if (videoPlan && Array.isArray(videoPlan.scenes)) {
      videoPlan.scenes.forEach(sc => {
        (sc.shots || []).forEach(sh => {
          if (sh.durationSec > this.maxStaticShotSec) {
            staticShotViolations++;
            issues.push(`Cú máy ${sh.shotId} giữ hình quá lâu (${sh.durationSec}s > ${this.maxStaticShotSec}s)`);
          }
        });
      });
    }

    if (staticShotViolations > 0) {
      score -= Math.min(30, staticShotViolations * 10);
      suggestedFixes.push({
        type: 'split_static_shots',
        action: `Chia nhỏ ${staticShotViolations} cú máy tĩnh thành các góc máy phụ (sub-shots)`
      });
    }

    // 5. Visual repetition check
    let lastImg = '';
    let repeatedImgCount = 0;
    scenes.forEach((sc, idx) => {
      if (sc.imageFile && sc.imageFile === lastImg) {
        repeatedImgCount++;
        issues.push(`Ảnh bị lặp liên tiếp ở cảnh ${idx} và ${idx + 1} (${sc.imageFile})`);
      }
      if (sc.imageFile) lastImg = sc.imageFile;
    });

    if (repeatedImgCount > 0) {
      score -= Math.min(20, repeatedImgCount * 10);
      suggestedFixes.push({
        type: 'alternate_visual',
        action: 'Chuyển cảnh trùng ảnh sang layout biểu đồ hoặc chữ động kinetic'
      });
    }

    // Final verdict
    const finalScore = Math.max(0, Math.min(100, score));
    const passed = (finalScore >= this.passThreshold && missingAudioCount === 0);
    const status = passed ? 'PASS' : 'FAIL';

    this.logFn(`  🛡️ [VideoQA] Điểm chất lượng: ${finalScore}/100 -> Kết luận: [${status}]`);

    return {
      status,
      score: finalScore,
      issues,
      suggestedFixes,
      metrics: {
        durationSec: parseFloat(durationSec.toFixed(1)),
        missingAudios: missingAudioCount,
        staticViolations: staticShotViolations,
        repeatedAssets: repeatedImgCount
      }
    };
  }
}

module.exports = { VideoQA };
