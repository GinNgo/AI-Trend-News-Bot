require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { EvidenceResearcher } = require('../ai/researcher.js');
const { FinalVerifier } = require('../ai/agents/final_verifier.js');
const { AIQualityControl } = require('../scheduler/qc.js');
const { VideoEngine } = require('../engine/video_engine.js');
const { ClaimRepository } = require('../storage/repositories/ClaimRepository.js');
const { EventRepository } = require('../storage/repositories/EventRepository.js');
const { scrapeArticleDeep } = require('../scraper/browser.js');
const { classifyLanguage, getSourceMetadata } = require('../ai/language_classifier.js');
const { classifyDataViz } = require('../ai/data_viz_classifier.js');
const logger = require('../collector/utils/logger.js');

class VideoFactoryPipeline {
  constructor() {
    this.claimRepo = new ClaimRepository();
    this.eventRepo = new EventRepository();
    this.researcher = new EvidenceResearcher(process.env.GEMINI_API_KEY);
    this.verifier = new FinalVerifier(process.env.GEMINI_API_KEY);
    this.qc = new AIQualityControl();
    this.engine = new VideoEngine({
      TTS_VOICE: process.env.TTS_VOICE || 'vi-VN-HoaiMyNeural',
      TTS_RATE: process.env.TTS_RATE || '+5%',
      TTS_PITCH: process.env.TTS_PITCH || '+0Hz'
    });
  }

  async executeStage(jobId, stage, payload) {
    logger.info(`[Pipeline] Bắt đầu thực thi Stage ${stage} cho Job ${jobId}`);

    switch (stage) {
      case 'COLLECTING': {
        // Collect raw article content
        const url = payload.sourceUrl;
        if (!url) throw new Error('Missing sourceUrl in payload');

        const publicDir = path.join(__dirname, '../../public');
        const scraped = await scrapeArticleDeep(url, publicDir);

        // Store source metadata for language classification
        const sourceMeta = getSourceMetadata(url);
        payload.sourceMeta = sourceMeta || { region: 'unknown', defaultLang: 'vi', name: 'Unknown' };

        payload.article = {
          sourceId: `web-${Date.now()}`,
          sourceName: sourceMeta ? sourceMeta.name : 'Web',
          url: url,
          title: scraped.title,
          content: scraped.fullText,
          author: scraped.author,
          publishedAt: new Date().toISOString()
        };

        return 'RESEARCHING';
      }

      case 'RESEARCHING': {
        const article = payload.article || (payload.artifacts && payload.artifacts.article);
        if (!article) throw new Error('Missing article in payload');
        payload.article = article;

        // Extract claims & event
        const extracted = await this.researcher.extractClaims([article]);
        payload.event = extracted.event;
        payload.claims = extracted.claims;

        // Fact-check claims
        const factChecked = await this.researcher.factCheckClaims(extracted);
        payload.verifiedClaims = factChecked.verifiedClaims || [];
        payload.unverifiedClaims = factChecked.unverifiedClaims || [];

        // Persist event and claims to DB
        this.eventRepo.createEvent({
          eventId: extracted.event.eventId || `EV-${Date.now()}`,
          canonicalTopic: extracted.event.topic,
          entities: extracted.event.entities,
          importance: 0.8
        });

        for (const claim of extracted.claims) {
          this.claimRepo.createClaim({
            claimId: claim.id || `CLM-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            eventId: extracted.event.eventId || `EV-${Date.now()}`,
            statement: claim.statement,
            status: claim.status,
            evidence: claim.evidence
          });
        }

        return 'STORY_PLANNING';
      }

      case 'STORY_PLANNING': {
        // Auto Language Detection (NEW)
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        let detectedLanguage = 'vi';
        try {
          const langResult = await classifyLanguage(genAI, {
            sourceUrl: payload.sourceUrl || '',
            facts: {
              summary: payload.event?.topic || '',
              category: payload.event?.entities?.join(', ') || '',
              impact: '',
              keyFacts: (payload.verifiedClaims || []).map(c => c.statement),
            },
          });
          detectedLanguage = langResult.language;
          payload.detectedLanguage = detectedLanguage;
          logger.info(`[Pipeline] 🌐 Ngôn ngữ video: ${detectedLanguage === 'en' ? '🇬🇧 EN' : '🇻🇳 VI'} (${(langResult.confidence * 100).toFixed(0)}%)`);
        } catch (err) {
          logger.warn(`[Pipeline] Language detection failed, defaulting to vi: ${err.message}`);
          payload.detectedLanguage = 'vi';
        }

        const impactData = await this.researcher.analyzeImpact(payload.event, payload.verifiedClaims);
        payload.impact = impactData;

        const storyPackage = await this.researcher.planStory({
          event: payload.event,
          verifiedClaims: payload.verifiedClaims,
          unverifiedClaims: payload.unverifiedClaims
        }, impactData);

        storyPackage.storyId = storyPackage.storyId || `ST-${Date.now()}`;
        storyPackage.language = detectedLanguage;
        payload.storyPackage = storyPackage;

        // Data Visualization Classification (NEW)
        if (storyPackage.scenes && storyPackage.scenes.length > 0) {
          try {
            const facts = {
              keyFacts: (payload.verifiedClaims || []).map(c => c.statement),
              impact: impactData?.summary || '',
            };
            storyPackage.scenes = await classifyDataViz(genAI, storyPackage.scenes, facts);
            logger.info(`[Pipeline] 📊 Data viz classification hoàn tất.`);
          } catch (err) {
            logger.warn(`[Pipeline] Data viz classification failed: ${err.message}`);
          }
        }

        return 'FINAL_FACT_CHECK';
      }

      case 'FINAL_FACT_CHECK': {
        const storyPackage = payload.storyPackage;
        const timeline = [{ timestamp: new Date().toISOString(), description: 'Event published' }];

        const factCheckResult = await this.verifier.verify(storyPackage, payload.verifiedClaims, timeline);
        payload.finalFactCheck = factCheckResult;

        if (factCheckResult.status === 'FAIL') {
          throw new Error(`Final fact check failed: ${factCheckResult.reason}`);
        }

        return 'RENDERING';
      }

      case 'RENDERING': {
        const storyPackage = payload.storyPackage;
        const outDir = path.join(__dirname, '../../out');
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }

        const outputPath = path.join(outDir, `${storyPackage.storyId || 'video'}.mp4`);
        await this.engine.render(storyPackage, outputPath);

        payload.renderPath = outputPath;
        return 'QC';
      }

      case 'QC': {
        const storyPackage = payload.storyPackage;
        const qcResult = await this.qc.evaluate(storyPackage);
        payload.qc = qcResult;

        if (!qcResult.passed) {
          throw new Error(`QC failed: ${qcResult.fatalErrors.join(', ')}`);
        }

        return 'APPROVAL';
      }

      case 'APPROVAL': {
        // In local automated flow or dry-run, we automatically pass approval
        // Otherwise human approves via dashboard
        if (process.env.AUTO_APPROVE === 'true' || process.env.DRY_RUN === 'true') {
          return 'PUBLISHING';
        }

        // Wait for manual approval via dashboard
        logger.info(`[Pipeline] Job ${jobId} đang chờ người dùng phê duyệt (APPROVAL)`);
        return null; // Stays in APPROVAL stage until human acts
      }

      case 'PUBLISHING': {
        logger.info(`[Pipeline] Chuẩn bị xuất bản Job ${jobId}...`);
        if (process.env.DRY_RUN === 'true') {
          logger.info(`[Pipeline] DRY_RUN = true. Bỏ qua bước upload thực tế.`);
          return null; // Finished
        }

        // Delegate to publication providers
        return null;
      }

      default:
        throw new Error(`Stage không hợp lệ: ${stage}`);
    }
  }
}

module.exports = { VideoFactoryPipeline };
