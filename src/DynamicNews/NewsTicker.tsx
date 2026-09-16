import React from 'react';
import { useCurrentFrame } from 'remotion';

export interface NewsTickerProps {
  title: string;
  themeColor: string;
  language?: string;
  headlines?: string[];
  category?: string;
  tickerTag?: string;
  tickerColor?: string;
}

export function resolveTickerStyle(title: string, category?: string, explicitTag?: string, explicitColor?: string, isEn = false) {
  if (explicitTag) {
    return {
      tag: explicitTag.toUpperCase(),
      color: explicitColor || '#0284c7',
      icon: '🔹',
      prefix: isEn ? 'SPECIAL REPORT' : 'BẢN TIN TIÊU ĐIỂM'
    };
  }

  const cat = (category || '').toLowerCase().trim();
  const textToCheck = `${cat} ${title}`.toLowerCase();

  // 1. Khẩn cấp / Tai nạn / Cháy nổ / Tội phạm / Điều tra nóng / Thiên tai (ƯU TIÊN CAO NHẤT)
  if (
    cat.includes('tội phạm') ||
    cat.includes('tai nạn') ||
    cat.includes('khẩn') ||
    textToCheck.match(/khẩn|nóng|tai nạn|cháy|tử vong|thiệt mạng|thương tâm|lùi xe|va chạm|tội phạm|phá án|bắt giữ|triệt phá|sập|cứu hộ|cứu nạn|đột kích|truy nã|hỏa hoạn|động đất|bão|lũ lụt|ngập|án mạng|cướp|giết|bạo lực|đuối nước|mất tích|breaking|urgent|crime|accident|crash|emergency|danger/i)
  ) {
    return {
      tag: isEn ? 'BREAKING' : 'TIN NÓNG',
      color: '#ef4444', // Red
      icon: '🚨',
      prefix: isEn ? 'BREAKING NEWS' : 'BẢN TIN ĐẶC BIỆT'
    };
  }

  // 2. Kinh tế / Tài chính / Thuế / Bất động sản / Doanh nghiệp / Thị trường / Giá vàng
  if (
    cat.includes('kinh tế') ||
    cat.includes('tài chính') ||
    textToCheck.match(/kinh tế|tài chính|thuế|doanh nghiệp|chứng khoán|đầu tư|thị trường|bất động sản|ngân hàng|lãi suất|giá vàng|xăng dầu|tỷ giá|usd|finance|economy/i)
  ) {
    return {
      tag: isEn ? 'FINANCE' : 'KINH TẾ',
      color: '#059669', // Emerald Green
      icon: '📈',
      prefix: isEn ? 'MARKET INSIGHT' : 'BẢN TIN KINH TẾ & TÀI CHÍNH'
    };
  }

  // 3. Thể thao / Bóng đá
  if (
    cat.includes('thể thao') ||
    textToCheck.match(/thể thao|bóng đá|c1|v-league|world cup|vô địch|ronaldo|messi|chelsea|mu|sport|bàn thắng|hlv|huấn luyện viên|fifa/i)
  ) {
    return {
      tag: isEn ? 'SPORTS' : 'THỂ THAO',
      color: '#ea580c', // Deep Orange
      icon: '⚽',
      prefix: isEn ? 'SPORTS HIGHLIGHT' : 'BẢN TIN THỂ THAO'
    };
  }

  // 4. Công nghệ / Trí tuệ nhân tạo / Phần mềm / Thiết bị (Kiểm tra từ khóa kỹ, CHỐNG NHẦM với từ 'ai' tiếng Việt)
  const hasTechKeyword = textToCheck.match(/công nghệ|trí tuệ nhân tạo|chuyển đổi số|bán dẫn|chip|vi mạch|robot|chatgpt|openai|gemini|claude|deepseek|sora|copilot|nvidia|meta|google|apple|iphone|ipad|macbook|samsung|smartphone|software|phần mềm|tech|software|máy tính|khoa học|game/i);
  const hasValidAiTerm = /(?:^|[\s,.:;!?])AI(?:[\s,.:;!?]|$)/i.test(title) && !textToCheck.match(/tai nạn|lại|hai|phải|tài xế|ngày mai|cái|bài/i);

  if (cat.includes('công nghệ') || cat.includes('tech') || hasTechKeyword || hasValidAiTerm) {
    return {
      tag: isEn ? 'TECH BRIEF' : 'CÔNG NGHỆ',
      color: '#0284c7', // Sky Blue
      icon: '⚡',
      prefix: isEn ? 'TECH BRIEFING' : 'ĐIỂM TIN CÔNG NGHỆ'
    };
  }

  // 5. Giáo dục / Đời sống / Y tế / Xã hội / Chính sách
  if (
    cat.includes('giáo dục') ||
    cat.includes('đời sống') ||
    cat.includes('y tế') ||
    cat.includes('xã hội') ||
    textToCheck.match(/giáo dục|học sinh|đại học|y tế|sức khỏe|bệnh viện|bác sĩ|pháp luật|luật|nghị định|chính sách|đời sống|xã hội|văn hóa/i)
  ) {
    return {
      tag: isEn ? 'SPOTLIGHT' : 'ĐỜI SỐNG',
      color: '#8b5cf6', // Violet
      icon: '🔍',
      prefix: isEn ? 'FEATURE STORY' : 'BẢN TIN ĐỜI SỐNG & XÃ HỘI'
    };
  }

  // Mặc định: Thời sự
  return {
    tag: isEn ? 'UPDATE' : 'THỜI SỰ',
    color: '#2563eb', // Royal Blue
    icon: '📰',
    prefix: isEn ? 'DAILY NEWS' : 'BẢN TIN THỜI SỰ'
  };
}

export const NewsTicker: React.FC<NewsTickerProps> = ({
  title,
  themeColor,
  language = 'vi',
  headlines = [],
  category,
  tickerTag,
  tickerColor,
}) => {
  const frame = useCurrentFrame();

  // Speed of scrolling text
  const speed = 4; // pixels per frame
  const isEn = language === 'en';

  const tickerStyle = resolveTickerStyle(title, category, tickerTag, tickerColor, isEn);

  const headlinesText = headlines.length > 0
    ? headlines.map(h => h.toUpperCase()).join(' • ')
    : isEn ? '24/7 GLOBAL UPDATE' : 'CẬP NHẬT LIÊN TỤC 24/7';

  const tickerText = `${tickerStyle.icon} ${tickerStyle.prefix} • ${title.toUpperCase()} • ${headlinesText} • ${isEn ? 'LIKE & SUBSCRIBE' : 'BẤM LIKE & THEO DÕI ĐỂ KHÔNG BỎ LỠ'} • `;

  // Ticker bar animation
  const offset = -(frame * speed);

  // Lặp chuỗi đủ nhiều để chạy suốt video
  const repeatedText = Array(30).fill(tickerText).join(' ');

  return (
    <div
      style={{
        position: 'absolute',
        top: '6%',
        left: 0,
        width: '100%',
        height: '70px',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderBottom: `2px solid ${themeColor || tickerStyle.color}`,
        borderTop: `2px solid ${themeColor || tickerStyle.color}`,
        boxShadow: `0 10px 30px rgba(0,0,0,0.5)`,
        display: 'flex',
        alignItems: 'center',
        zIndex: 90,
        overflow: 'hidden',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Badge bên trái: Màu sắc và Nhãn thay đổi linh hoạt theo thể loại */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          backgroundColor: tickerStyle.color,
          color: '#ffffff',
          fontWeight: 900,
          fontSize: '25px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 26px',
          zIndex: 100,
          boxShadow: '10px 0 20px rgba(0,0,0,0.5)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          whiteSpace: 'nowrap',
        }}
      >
        <div
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            backgroundColor: '#fff',
            marginRight: '12px',
            opacity: frame % 30 < 15 ? 1 : 0.3, // nhấp nháy đèn live
          }}
        />
        <span>{tickerStyle.tag}</span>
      </div>

      {/* Dòng chữ chạy qua lại (News Crawl / Marquee) */}
      <div
        style={{
          display: 'flex',
          whiteSpace: 'nowrap',
          transform: `translateX(${offset}px)`,
          gap: '50px',
          marginLeft: '260px',
          fontSize: '28px',
          fontWeight: 700,
          color: '#f8fafc',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}
      >
        <span>{repeatedText}</span>
      </div>
    </div>
  );
};

