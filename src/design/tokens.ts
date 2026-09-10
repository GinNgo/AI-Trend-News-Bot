export const tokens = {
  colors: {
    background: '#0F172A', // Slate 900
    primary: '#6366F1', // Indigo 500 (Tech/AI vibe)
    accent: '#38BDF8', // Sky 400
    text: {
      headline: '#F8FAFC', // Slate 50
      body: '#E2E8F0', // Slate 200
      muted: '#94A3B8', // Slate 400
    },
    overlay: {
      scrim: 'linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.5) 40%, rgba(15, 23, 42, 0) 100%)',
    }
  },
  typography: {
    fontFamily: {
      sans: '"Be Vietnam Pro", "Roboto", "Inter", sans-serif',
      display: '"Be Vietnam Pro", "Roboto", "Inter", sans-serif',
    },
    size: {
      title: '72px',
      headline: '56px',
      body: '40px',
      caption: '32px',
    },
    weight: {
      bold: 800,
      semibold: 600,
      regular: 400,
    },
    lineHeight: {
      tight: 1.1,
      normal: 1.4,
    }
  },
  layout: {
    safeArea: {
      top: '12%', // Chừa chỗ cho UI phía trên (tài khoản, following)
      bottom: '22%', // Chừa chỗ cho Caption, Tên kênh, Thanh thời gian
      horizontal: '8%', // Tránh lẹm viền và nút tương tác bên phải
    },
    radius: '24px', // Bo góc tiêu chuẩn cho các thẻ card
  },
  animation: {
    spring: {
      stiff: { damping: 14, stiffness: 150, mass: 0.8 },
      smooth: { damping: 18, stiffness: 110, mass: 1 },
    },
    duration: {
      short: 12,
      medium: 20,
      long: 45,
    }
  }
};