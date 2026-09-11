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
    | 'list' | 'stat' | 'quote' | 'spotlight' | 'image'
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
  outro?: DynamicOutroData;
  [key: string]: unknown;
}
