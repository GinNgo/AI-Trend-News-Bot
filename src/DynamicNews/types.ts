export interface DynamicSceneItem {
  id: number;
  tag: string;
  headline: string;
  keyTakeaways: string[];
  layoutType?: 'list' | 'stat' | 'quote' | 'spotlight' | 'image';
  statNumber?: string;
  statLabel?: string;
  quoteText?: string;
  quoteAuthor?: string;
  imageFile?: string;
  audioFile: string;
  audioFrames: number;
  globalStart: number;
  seqDuration: number;
  color?: string;
  takeawayStarts?: number[];
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
  outro?: DynamicOutroData;
}
