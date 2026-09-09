import React from 'react';
import { AbsoluteFill, useVideoConfig, interpolate, useCurrentFrame, Audio, staticFile, Sequence } from 'remotion';
import { TransitionSeries, springTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';

import { GenericScene, SceneData } from './GenericScene';
import { Outro } from './Outro';

const scene1Data: SceneData = {
  tag: 'SỰ KIỆN NỔI BẬT',
  headline: 'Khai Mạc Triển Lãm Quốc Tế HI-TECH VIETNAM 2026',
  keyTakeaways: [
    'Diễn ra từ ngày 09 - 11/09/2026 tại Trung tâm Triển lãm Việt Nam.',
    'Quy tụ hàng trăm doanh nghiệp công nghệ trong nước và quốc tế.',
    'Tập trung vào AI, bán dẫn, IoT và công nghệ đô thị thông minh.',
  ],
};

const scene2Data: SceneData = {
  tag: 'CHÍNH SÁCH QUỐC GIA',
  headline: 'Chiến Lược AI Mới: Chuyển Đổi Toàn Diện',
  keyTakeaways: [
    'Chuyển từ nghiên cứu thử nghiệm sang phổ cập toàn diện bằng AI.',
    'Tập trung ứng dụng vào dịch vụ công, y tế, giáo dục và doanh nghiệp.',
    'Xây dựng hạ tầng tính toán lớn và làm chủ mô hình tiếng Việt.',
  ],
};

const scene3Data: SceneData = {
  tag: 'HÀNH ĐỘNG 100 NGÀY',
  headline: 'Tăng Tốc Xử Lý Các Điểm Nghẽn Chuyển Đổi Số',
  keyTakeaways: [
    'Kế hoạch 100 ngày tháo gỡ điểm nghẽn dữ liệu hệ thống chính trị.',
    'Đảm bảo an toàn thông tin và kết nối liên thông dữ liệu dân cư.',
    'Tạo hành lang pháp lý thông thoáng và bảo mật dữ liệu cho dân.',
  ],
};

const scene4Data: SceneData = {
  tag: 'MAKE IN VIET NAM',
  headline: 'Giải Thưởng AI Make in Viet Nam 2026',
  keyTakeaways: [
    'Vinh danh nền tảng số và AI do kỹ sư Việt Nam làm chủ.',
    'Thúc đẩy giải pháp giải quyết các bài toán thực tiễn xã hội.',
    'Hỗ trợ tối đa kết nối thương mại hóa và đầu tư hạ tầng số.',
  ],
};

export const TechNewsComp: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Background slow rotation gradient
  const bgAngle = interpolate(frame, [0, 1807], [120, 240], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${bgAngle}deg, #020617, #0f172a, #1e1b4b)`,
        width,
        height,
      }}
    >
      {/* Background Music slightly louder because voice might be less shouting */}
      <Audio src={staticFile('bgm.mp3')} volume={0.15} />

      {/* Voiceover Audios with exact frame-accurate start offsets for +5% slow TTS */}
      {/* Scene 1: audio 446 frames */}
      <Sequence from={0}>
        <Audio src={staticFile('tech_1.mp3')} volume={1.3} />
      </Sequence>

      {/* Scene 2: audio 326 frames */}
      <Sequence from={466}>
        <Audio src={staticFile('tech_2.mp3')} volume={1.3} />
      </Sequence>

      {/* Scene 3: audio 307 frames */}
      <Sequence from={812}>
        <Audio src={staticFile('tech_3.mp3')} volume={1.3} />
      </Sequence>

      {/* Scene 4: audio 300 frames */}
      <Sequence from={1139}>
        <Audio src={staticFile('tech_4.mp3')} volume={1.3} />
      </Sequence>

      {/* Scene 5 (Outro): audio 328 frames */}
      <Sequence from={1459}>
        <Audio src={staticFile('tech_5.mp3')} volume={1.3} />
      </Sequence>

      {/* Decorative High-Tech Background Watermark */}
      <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: 0.03, pointerEvents: 'none' }}>
        <div style={{ fontSize: '400px', fontWeight: '900', color: '#38bdf8', letterSpacing: '10px' }}>
          VIETNAM AI
        </div>
      </AbsoluteFill>

      {/* Transition Series syncing all 5 scenes perfectly */}
      <TransitionSeries>
        {/* Scene 1 */}
        <TransitionSeries.Sequence durationInFrames={486}>
          <GenericScene
            data={scene1Data}
            color="#38bdf8"
            takeawayStarts={[100, 200, 310]}
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: 'from-right' })}
          timing={springTiming({ config: { damping: 12, stiffness: 100 }, durationInFrames: 20 })}
        />

        {/* Scene 2 */}
        <TransitionSeries.Sequence durationInFrames={366}>
          <GenericScene
            data={scene2Data}
            color="#a855f7"
            takeawayStarts={[80, 160, 220]}
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 12, stiffness: 80 }, durationInFrames: 20 })}
        />

        {/* Scene 3 */}
        <TransitionSeries.Sequence durationInFrames={347}>
          <GenericScene
            data={scene3Data}
            color="#eab308"
            takeawayStarts={[70, 150, 210]}
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: 'from-bottom' })}
          timing={springTiming({ config: { damping: 12, stiffness: 100 }, durationInFrames: 20 })}
        />

        {/* Scene 4 */}
        <TransitionSeries.Sequence durationInFrames={340}>
          <GenericScene
            data={scene4Data}
            color="#22c55e"
            takeawayStarts={[70, 150, 200]}
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: 'from-top' })}
          timing={springTiming({ config: { damping: 12, stiffness: 100 }, durationInFrames: 20 })}
        />

        {/* Scene 5: Outro */}
        <TransitionSeries.Sequence durationInFrames={348}>
          <Outro />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* No redundant Captions components to keep the screen clear! */}
    </AbsoluteFill>
  );
};
