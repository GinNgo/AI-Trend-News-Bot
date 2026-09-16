import { CaptionSegment } from './Subtitles';

// ============================================
// Chart Data Types
// ============================================

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ComparisonItem {
  before: { label: string; value: string };
  after: { label: string; value: string };
}

// ============================================
// Scene Types
// ============================================

export interface DynamicSceneItem {
  id: number;
  tag: string;
  headline: string;
  keyTakeaways: string[];
  layoutType?:
    | 'intro' | 'list' | 'stat' | 'quote' | 'spotlight' | 'image'
    | 'animated_counter' | 'bar_chart' | 'progress_ring' | 'line_chart' | 'comparison';
  statNumber?: string;
  statLabel?: string;
  quoteText?: string;
  quoteAuthor?: string;
  voiceover?: string;
  imageFile?: string;
  audioFile: string;
  audioFrames: number;
  globalStart: number;
  seqDuration: number;
  color?: string;
  takeawayStarts?: number[];
  language?: 'vi' | 'en';
  captions?: CaptionSegment[];

  // Data Visualization fields
  chartData?: ChartDataPoint[];
  progressValue?: number;
  progressLabel?: string;
  counterTarget?: number;
  counterPrefix?: string;
  counterSuffix?: string;
  comparisonData?: ComparisonItem;
}

export interface DynamicOutroData {
  title?: string;
  subtitle?: string;
  audioFile: string;
  audioFrames: number;
  globalStart: number;
  seqDuration: number;
}

export interface DynamicNewsData {
  title: string;
  themeColor?: string;
  bgStyle?: 'hud' | 'particles' | 'grid' | 'minimal';
  totalDurationInFrames: number;
  scenes: DynamicSceneItem[];
  language?: 'vi' | 'en';
  channelId?: string;
  bgmFile?: string;
  bgmVolume?: number;
  outro?: DynamicOutroData;
  [key: string]: unknown;
}

// Hàm làm sạch và gán nhãn chuyên nghiệp, triệt tiêu hoàn toàn chữ "CẢNH 1", "CẢNH 2", "SCENE 1"
export const resolveSceneTag = (tag: string | undefined, defaultTag: string, language: string = 'vi'): string => {
  const clean = (tag || '').trim();
  if (!clean || /^(cảnh|scene)\s*\d*$/i.test(clean)) {
    return defaultTag;
  }
  return clean.toUpperCase();
};

