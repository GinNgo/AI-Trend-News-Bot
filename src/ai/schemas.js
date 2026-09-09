const { z } = require('zod');

// Schema for an Evidence piece
const EvidenceSchema = z.object({
  sourceId: z.string(),
  url: z.string().url().optional(),
  quote: z.string(),
  context: z.string().optional()
});

// Schema for a Claim extracted from text
const ClaimSchema = z.object({
  id: z.string(),
  statement: z.string(),
  status: z.enum(['VERIFIED', 'UNVERIFIED', 'CONTRADICTED']),
  evidence: z.array(EvidenceSchema).default([])
});

// Schema for an Event Cluster
const EventSchema = z.object({
  eventId: z.string(),
  topic: z.string(),
  description: z.string(),
  timeframe: z.string(),
  entities: z.array(z.string())
});

// Schema for Impact Analysis
const ImpactSchema = z.object({
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  affectedGroups: z.array(z.string()),
  shortTermEffects: z.string(),
  longTermImplications: z.string()
});

// Retention Plan Schema
const RetentionPlanSchema = z.object({
  hookStrategy: z.string(),
  pacingSeconds: z.number(), // Mật độ nhịp độ (vd: 15s có 1 sự kiện mới)
  visualStrategy: z.string(),
  vietnamAngleIncluded: z.boolean()
});

// Schema for a Video Scene
const SceneSchema = z.object({
  id: z.number(),
  narrativeArc: z.enum([
    'HOOK',
    'CONTEXT',
    'EVENT',
    'EVIDENCE',
    'WHY_IT_MATTERS',
    'SURPRISING_IMPLICATION',
    'IMPACT',
    'VIETNAM_ANGLE',
    'FUTURE',
    'CONCLUSION'
  ]),
  layoutType: z.enum(['list', 'stat', 'quote', 'image', 'chart']),
  headline: z.string(),
  keyTakeaways: z.array(z.string()).optional(),
  statNumber: z.string().optional(),
  statLabel: z.string().optional(),
  quoteText: z.string().optional(),
  quoteAuthor: z.string().optional(),
  imageFile: z.string().optional(),
  voiceover: z.string(),
  durationSec: z.number().min(3).max(60) // Gemini trả về giây
});

// Schema for the Final Story Package
const StorySchema = z.object({
  title: z.string(),
  themeColor: z.string(),
  bgStyle: z.string(),
  targetDurationSec: z.number(),
  storyAngle: z.string(),
  retentionPlan: RetentionPlanSchema,
  event: EventSchema,
  verifiedClaims: z.array(ClaimSchema),
  unverifiedClaims: z.array(ClaimSchema),
  impact: ImpactSchema,
  scenes: z.array(SceneSchema)
});

module.exports = {
  EvidenceSchema,
  ClaimSchema,
  EventSchema,
  ImpactSchema,
  RetentionPlanSchema,
  SceneSchema,
  StorySchema
};