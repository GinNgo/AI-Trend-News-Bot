/**
 * Visual Director Agent (V3)
 * Location: src/ai/agents/visual_director.js
 * 
 * Determines the optimal visual medium for each spoken narration segment.
 * "What visual best communicates this sentence?"
 * Chooses between: official screenshot, chart, map, UI animation, timeline,
 * kinetic typography, comparison, B-roll photo, or data visualization.
 */

class VisualDirector {
  constructor(options = {}) {
    this.logFn = options.logFn || console.log;
  }

  /**
   * Determine the most effective visual for a specific narration sentence or clause.
   */
  determineVisualForSegment(segmentText = '', context = {}) {
    const text = segmentText.toLowerCase();
    const availableImages = context.availableImages || [];

    // 1. Numerical data, statistics, percentages
    if (/\b(\d+([.,]\d+)?\s*(%|phần trăm|percent|tỷ|triệu|billion|million|usd|đô|vnd))\b/i.test(text)) {
      if (text.includes('%') || text.includes('phần trăm') || text.includes('percent')) {
        return {
          visualType: 'data_visualization',
          subType: 'progress_ring',
          rationale: 'Tỷ lệ phần trăm được trực quan hóa tốt nhất bằng Vòng tiến trình tròn (Progress Ring)',
          assetSource: 'generated_svg'
        };
      }
      return {
        visualType: 'data_visualization',
        subType: 'animated_counter',
        rationale: 'Số liệu lớn được truyền tải trực quan bằng Bộ đếm số nhảy động (Animated Counter)',
        assetSource: 'generated_counter'
      };
    }

    // 2. Comparison between entities or time periods
    if (/\b(so với|thay vì|tăng trưởng|giảm sút|ngược lại|compared to|versus|vs|increase|decrease)\b/i.test(text)) {
      return {
        visualType: 'comparison',
        subType: 'comparison_split',
        rationale: 'Nội dung so sánh trực quan hóa bằng Layout chia đôi tương phản (Comparison Split)',
        assetSource: 'layout_split'
      };
    }

    // 3. Official quote or statement
    if (/\b(cho biết|tuyên bố|khẳng định|nhận định|phát biểu|stated|declared|said|commented)\b/i.test(text)) {
      return {
        visualType: 'quote',
        subType: 'quote_focus',
        rationale: 'Trích dẫn chính thức được tôn vinh bằng Thẻ trích dẫn trang trọng (Quote Card)',
        assetSource: 'layout_quote'
      };
    }

    // 4. Geographical location, borders, maps
    if (/\b(biên giới|quốc gia|thành phố|khu vực|tỉnh|hà nội|tp\.hcm|bãi phóng|bờ biển|tuyến đường|highway|border|city|country)\b/i.test(text)) {
      return {
        visualType: 'map_overview',
        subType: 'interactive_map',
        rationale: 'Yếu tố địa lý được minh họa tốt nhất bằng Bản đồ bối cảnh (Context Map)',
        assetSource: 'map_layer'
      };
    }

    // 5. Official photo or screenshot evidence
    if (availableImages.length > 0 && (context.shotIndex === 1 || context.shotIndex === 2)) {
      return {
        visualType: 'official_screenshot',
        subType: 'broll_photo',
        rationale: 'Bằng chứng thực tế từ hiện trường hoặc tài liệu báo chí gốc',
        assetSource: availableImages[0]
      };
    }

    // 6. Default: High-energy Kinetic Typography
    return {
      visualType: 'kinetic_typography',
      subType: 'headline_impact',
      rationale: 'Thông điệp cốt lõi được nhấn mạnh bằng Chữ động tương phản cao (Kinetic Typography)',
      assetSource: 'typography_canvas'
    };
  }

  /**
   * Enhance an existing Video Plan with fine-grained visual direction.
   */
  enhanceVideoPlan(videoPlan = {}, availableImages = []) {
    this.logFn('\n🎨 [VisualDirector] Đang gán Đạo diễn hình ảnh chi tiết cho từng Cú máy...');
    const enhanced = JSON.parse(JSON.stringify(videoPlan));

    let imgIdx = 0;
    (enhanced.scenes || []).forEach(scene => {
      (scene.shots || []).forEach((shot, sIdx) => {
        const decision = this.determineVisualForSegment(shot.voiceSegment || shot.text, {
          availableImages,
          shotIndex: sIdx + 1,
          sceneIndex: scene.sceneId
        });

        shot.visualType = decision.visualType;
        shot.visualSubType = decision.subType;
        shot.visualRationale = decision.rationale;

        if (decision.visualType === 'official_screenshot' && availableImages.length > 0) {
          shot.asset = availableImages[imgIdx % availableImages.length];
          imgIdx++;
        }
      });
    });

    this.logFn('  ✅ [VisualDirector] Hoàn tất gán Visual Direction cho toàn bộ kịch bản!');
    return enhanced;
  }
}

module.exports = { VisualDirector };
