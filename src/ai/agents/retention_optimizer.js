/**
 * Retention Optimizer Agent (V3)
 * Location: src/ai/agents/retention_optimizer.js
 * 
 * Analyzes and optimizes short-form video pacing to maximize retention.
 * Evaluates: HOOK, VISUAL CHANGE RATE, INFORMATION DENSITY, PATTERN INTERRUPTS,
 * PAYOFF, and ENDLESS LOOP.
 */

class RetentionOptimizer {
  constructor(options = {}) {
    this.targetWpsMin = options.targetWpsMin || 2.0;
    this.targetWpsMax = options.targetWpsMax || 3.3;
    this.maxStaticDurationSec = options.maxStaticDurationSec || 3.2;
    this.idealChangeIntervalSec = options.idealChangeIntervalSec || 2.2;
    this.logFn = options.logFn || console.log;
  }

  /**
   * Evaluate retention potential of a Video Plan.
   * Returns a score (0-100), metrics, and actionable recommendations.
   */
  evaluateRetention(videoPlan = {}, script = {}) {
    this.logFn('\n⚡ [RetentionOptimizer] Bắt đầu chấm điểm Chỉ số Giữ Chân (Retention Score)...');
    const issues = [];
    const recommendations = [];
    let score = 100;

    const scenes = videoPlan.scenes || [];
    if (scenes.length === 0) {
      return { score: 0, passed: false, issues: ['No scenes in plan'], recommendations: [] };
    }

    // 1. Evaluate Hook (First 2.5s)
    const firstScene = scenes[0];
    const firstShot = (firstScene.shots && firstScene.shots[0]) || null;
    if (firstShot) {
      if (firstShot.durationSec > 2.5) {
        score -= 10;
        issues.push(`Cú máy Hook đầu tiên quá dài (${firstShot.durationSec}s > 2.5s)`);
        recommendations.push('Rút ngắn cú máy Hook xuống <= 2.0s để tránh Swipe-Away');
      }
      // Check for forbidden slow intro words
      const hookText = (firstShot.voiceSegment || firstShot.text || '').toLowerCase();
      const bannedIntros = ['xin chào', 'chào mừng', 'hello', 'hey guys', 'welcome back', 'hôm nay chúng ta'];
      if (bannedIntros.some(b => hookText.includes(b))) {
        score -= 25;
        issues.push('Hook chứa lời chào hoặc mở đầu dông dài làm tụt tương tác');
        recommendations.push('Loại bỏ hoàn toàn lời chào, nhảy thẳng vào xung đột/thực thể cụ thể');
      }
    }

    // 2. Evaluate Visual Change Rate
    let totalShots = 0;
    let longestShot = 0;
    let longShotsCount = 0;

    scenes.forEach(sc => {
      (sc.shots || []).forEach(sh => {
        totalShots++;
        const d = sh.durationSec || 0;
        if (d > longestShot) longestShot = d;
        if (d > this.maxStaticDurationSec) {
          longShotsCount++;
          issues.push(`Cú máy ${sh.shotId} tĩnh quá lâu (${d}s)`);
        }
      });
    });

    if (longShotsCount > 0) {
      score -= Math.min(30, longShotsCount * 8);
      recommendations.push(`Tự động chia nhỏ ${longShotsCount} cú máy tĩnh quá ${this.maxStaticDurationSec}s`);
    }

    // 3. Evaluate Endless Loop Ending
    const lastScene = scenes[scenes.length - 1];
    const lastShot = (lastScene.shots && lastScene.shots[lastScene.shots.length - 1]) || null;
    if (lastShot) {
      const endingText = (lastShot.voiceSegment || lastShot.text || '').toLowerCase();
      const bannedExits = ['cảm ơn các bạn', 'hẹn gặp lại', 'thanks for watching', 'subscribe for more', 'nhớ like và sub'];
      if (bannedExits.some(b => endingText.includes(b))) {
        score -= 15;
        issues.push('Đoạn kết chứa câu chào tạm biệt (Exit Sign) làm tụt Retention');
        recommendations.push('Bỏ câu chào tạm biệt, nối câu kết vào câu mở đầu (Endless Loop)');
      }
    }

    // 4. Calculate Final Retention Metrics
    const targetDurationSec = videoPlan.targetDurationSec || 48;
    const avgVisualChangeSec = totalShots > 0 ? parseFloat((targetDurationSec / totalShots).toFixed(2)) : targetDurationSec;

    const metrics = {
      totalScenes: scenes.length,
      totalShots,
      avgVisualChangeSec,
      longestShotSec: longestShot,
      hookPacingSec: firstShot ? firstShot.durationSec : 0,
      loopOptimized: !issues.some(i => i.includes('Exit Sign'))
    };

    const finalScore = Math.max(0, Math.min(100, score));
    const passed = (finalScore >= 75 && longShotsCount === 0);

    this.logFn(`  📊 [RetentionOptimizer] Điểm Giữ Chân: ${finalScore}/100 (${passed ? 'ĐẠT' : 'CẦN TỐI ƯU'})`);
    return {
      score: finalScore,
      passed,
      metrics,
      issues,
      recommendations
    };
  }

  /**
   * Automatically optimize a plan to eliminate long static shots and exit signs.
   */
  optimizePlan(videoPlan = {}) {
    this.logFn('[RetentionOptimizer] Đang tự động tối ưu hóa Video Plan...');
    const optimizedPlan = JSON.parse(JSON.stringify(videoPlan));

    if (!Array.isArray(optimizedPlan.scenes)) return optimizedPlan;

    optimizedPlan.scenes.forEach(scene => {
      const newShots = [];
      (scene.shots || []).forEach(shot => {
        if (shot.durationSec > this.maxStaticDurationSec) {
          // Split into 2 sub-shots
          const halfDur = parseFloat((shot.durationSec / 2).toFixed(1));
          newShots.push({
            ...shot,
            shotId: `${shot.shotId}a`,
            durationSec: halfDur,
            purpose: 'HOOK_PUNCH',
            camera: 'zoom_punch'
          });
          newShots.push({
            ...shot,
            shotId: `${shot.shotId}b`,
            durationSec: halfDur,
            purpose: 'DETAIL_EXPANSION',
            camera: 'ken_burns',
            visual: shot.asset ? 'broll_photo' : 'headline_impact'
          });
        } else {
          newShots.push(shot);
        }
      });
      scene.shots = newShots;
    });

    return optimizedPlan;
  }
}

module.exports = { RetentionOptimizer };
