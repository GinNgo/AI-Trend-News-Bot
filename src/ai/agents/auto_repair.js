/**
 * Auto Repair Agent (V3)
 * Location: src/ai/agents/auto_repair.js
 * 
 * Ingests a failed Video QA report and automatically fixes the root causes
 * (e.g. splitting static scenes into multi-shots, re-assigning duplicate assets,
 * or re-timing pacing) before triggering re-render.
 */

class AutoRepair {
  constructor(options = {}) {
    this.logFn = options.logFn || console.log;
  }

  /**
   * Apply automatic repairs based on QA report.
   * @param {Object} params
   * @param {Object} params.videoPlan
   * @param {Object} params.qaResult
   * @param {Array} params.availableImages
   * @returns {Object} { repairedPlan, fixesApplied: [] }
   */
  repair({ videoPlan = {}, qaResult = {}, availableImages = [] }) {
    this.logFn('\n🔧 [AutoRepair] Bắt đầu tự động chẩn đoán và sửa lỗi kịch bản...');
    const repairedPlan = JSON.parse(JSON.stringify(videoPlan));
    const fixesApplied = [];

    const issues = qaResult.issues || [];
    const suggestedFixes = qaResult.suggestedFixes || [];

    // Fix 1: Split static shots
    const hasStaticIssues = suggestedFixes.some(f => f.type === 'split_static_shots');
    if (hasStaticIssues && Array.isArray(repairedPlan.scenes)) {
      repairedPlan.scenes.forEach(sc => {
        const newShots = [];
        (sc.shots || []).forEach(sh => {
          if (sh.durationSec > 3.2) {
            const half = parseFloat((sh.durationSec / 2).toFixed(1));
            newShots.push({
              ...sh,
              shotId: `${sh.shotId}a`,
              durationSec: half,
              cameraMotion: 'zoom_punch',
              purpose: 'REPAIRED_PUNCH'
            });
            newShots.push({
              ...sh,
              shotId: `${sh.shotId}b`,
              durationSec: half,
              cameraMotion: 'ken_burns_pan',
              visualType: sh.visualAsset ? 'broll_photo' : 'headline_impact',
              purpose: 'REPAIRED_FLOW'
            });
            fixesApplied.push(`Đã chia nhỏ cú máy ${sh.shotId} (${sh.durationSec}s) thành 2 cú máy ${half}s`);
          } else {
            newShots.push(sh);
          }
        });
        sc.shots = newShots;
      });
    }

    // Fix 2: Disperse repeated assets
    const hasRepetition = suggestedFixes.some(f => f.type === 'alternate_visual');
    if (hasRepetition && Array.isArray(repairedPlan.scenes)) {
      let seenAssets = new Set();
      repairedPlan.scenes.forEach(sc => {
        (sc.shots || []).forEach(sh => {
          if (sh.visualAsset && seenAssets.has(sh.visualAsset)) {
            // Convert to data viz or headline
            sh.visualAsset = '';
            sh.visualType = 'animated_counter';
            sh.cameraMotion = 'parallax_slide';
            fixesApplied.push(`Cú máy ${sh.shotId} đổi từ ảnh trùng sang biểu đồ số liệu động`);
          } else if (sh.visualAsset) {
            seenAssets.add(sh.visualAsset);
          }
        });
      });
    }

    this.logFn(`  ✅ [AutoRepair] Đã thực hiện ${fixesApplied.length} chỉnh sửa tự động!`);
    return {
      repairedPlan,
      fixesApplied
    };
  }
}

module.exports = { AutoRepair };
