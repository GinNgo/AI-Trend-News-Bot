const fs = require('fs');
const path = require('path');
const fetch = typeof globalThis.fetch === 'function' ? globalThis.fetch : (...args) => import('node-fetch').then(({default: f}) => f(...args));
const { PlatformAdapter } = require('../adapters/platform_adapter.js');
const logger = require('../../collector/utils/logger.js');

class MetaProvider extends PlatformAdapter {
  constructor(platformName = 'facebook') {
    super(platformName);
    this.platform = platformName; // 'facebook' hoặc 'instagram'
  }

  getConfig() {
    const configPath = path.join(process.cwd(), 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      } catch (e) {}
    }
    return {};
  }

  async authenticate() {
    const conf = this.getConfig();
    return !!(conf.META_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN);
  }

  async validateAccount() {
    return true;
  }

  async validateMedia(mediaPath) {
    return fs.existsSync(mediaPath);
  }

  async publish(publicationRecord) {
    const conf = this.getConfig();
    const token = conf.META_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
    const pageId = conf.META_PAGE_ID || process.env.META_PAGE_ID;
    const igId = conf.IG_ACCOUNT_ID || process.env.IG_ACCOUNT_ID;
    
    if (!token) {
      throw new Error(`[MetaProvider] Thiếu META_ACCESS_TOKEN`);
    }

    const mediaPath = publicationRecord.mediaPath;
    if (!fs.existsSync(mediaPath)) {
      throw new Error(`[MetaProvider] File không tồn tại: ${mediaPath}`);
    }

    const fileSize = fs.statSync(mediaPath).size;
    const description = publicationRecord.title + "\n\n" + (publicationRecord.description || "") + "\n#tinTuc #xuhuong #shorts";

    logger.info(`[MetaProvider - ${this.platform}] Bắt đầu xuất bản API thật: ${publicationRecord.title}`);

    try {
      if (this.platform === 'facebook') {
        if (!pageId) throw new Error("Thiếu META_PAGE_ID");
        
        // BƯỚC 1: Khởi tạo phiên Upload (Start Phase)
        logger.info(`[Facebook Reels] Bước 1: Khởi tạo upload session...`);
        const startRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/video_reels?upload_phase=start&access_token=${token}`, { method: 'POST' });
        const startData = await startRes.json();
        if (startData.error) throw new Error(startData.error.message);
        
        const videoId = startData.video_id;
        const uploadUrl = startData.upload_url;

        // BƯỚC 2: Truyền file nhị phân (Upload Phase)
        logger.info(`[Facebook Reels] Bước 2: Đang truyền file (${Math.round(fileSize/1024/1024)}MB)...`);
        const fileBuffer = fs.readFileSync(mediaPath);
        const uploadRes = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `OAuth ${token}`,
            'offset': '0',
            'file_size': fileSize.toString()
          },
          body: fileBuffer
        });
        const uploadData = await uploadRes.json();
        if (uploadData.error) throw new Error(uploadData.error.message);

        // BƯỚC 3: Hoàn tất và Đăng (Finish Phase)
        logger.info(`[Facebook Reels] Bước 3: Hoàn tất publish...`);
        const finishRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/video_reels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            upload_phase: 'finish',
            access_token: token,
            video_id: videoId,
            video_state: 'PUBLISHED',
            description: description
          })
        });
        const finishData = await finishRes.json();
        if (finishData.error) throw new Error(finishData.error.message);

        logger.info(`[Facebook Reels] Thành công! Video ID: ${videoId}`);
        return {
          platformVideoId: videoId,
          url: `https://facebook.com/reel/${videoId}`
        };

      } else if (this.platform === 'instagram') {
        if (!igId) throw new Error("Thiếu IG_ACCOUNT_ID");
        
        const { getPublicTunnelUrl } = require('./meta_token_helper.js');
        const publicBaseUrl = getPublicTunnelUrl();

        if (!publicBaseUrl || publicBaseUrl.includes('localhost') || publicBaseUrl.includes('127.0.0.1')) {
          logger.warn(`[Instagram Reels] API Instagram bắt buộc video_url phải là link Public (Không nhận localhost).`);
          throw new Error("Instagram Graph API không hỗ trợ upload file trực tiếp từ Localhost. Hệ thống cần Cloudflare Tunnel hoặc Public URL đang chạy.");
        }

        // Tạo public URL cho file video dựa trên Cloudflare Tunnel
        const normalizedPath = mediaPath.replace(/\\/g, '/');
        const outIdx = normalizedPath.indexOf('/out/');
        const relativeOut = outIdx !== -1 ? normalizedPath.substring(outIdx) : `/out/${path.basename(mediaPath)}`;
        const publicVideoUrl = `${publicBaseUrl}${relativeOut}`;

        logger.info(`[Instagram Reels] Bước 1: Khởi tạo media container với Public URL: ${publicVideoUrl}`);
        const igCreateRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/media?media_type=REELS&video_url=${encodeURIComponent(publicVideoUrl)}&caption=${encodeURIComponent(description)}&access_token=${token}`, { method: 'POST' });
        const igCreateData = await igCreateRes.json();
        if (igCreateData.error) throw new Error(`[Instagram Container] ${igCreateData.error.message}`);
        const creationId = igCreateData.id;

        // Chờ Instagram xử lý video (polling status)
        logger.info(`[Instagram Reels] Bước 2: Chờ Meta xử lý video (Creation ID: ${creationId})...`);
        let isReady = false;
        let attempts = 0;
        while (!isReady && attempts < 30) {
          attempts++;
          await new Promise(r => setTimeout(r, 4000));
          const statusRes = await fetch(`https://graph.facebook.com/v19.0/${creationId}?fields=status_code&access_token=${token}`);
          const statusData = await statusRes.json();
          if (statusData.status_code === 'FINISHED') {
            isReady = true;
          } else if (statusData.status_code === 'ERROR') {
            throw new Error(`Instagram xử lý video thất bại (Status: ERROR)`);
          }
        }

        if (!isReady) throw new Error('Timeout chờ Instagram xử lý video (vượt quá 2 phút)');

        logger.info(`[Instagram Reels] Bước 3: Đăng video chính thức...`);
        const igPublishRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/media_publish?creation_id=${creationId}&access_token=${token}`, { method: 'POST' });
        const igPublishData = await igPublishRes.json();
        if (igPublishData.error) throw new Error(`[Instagram Publish] ${igPublishData.error.message}`);

        logger.info(`[Instagram Reels] Thành công! Media ID: ${igPublishData.id}`);
        return {
          platformVideoId: igPublishData.id,
          url: `https://www.instagram.com/reel/${igPublishData.id}`
        };
      }
    } catch (error) {
      logger.error(`[MetaProvider] Lỗi xuất bản ${this.platform}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Đăng bài viết kèm Ảnh lên Facebook Fanpage tức thì (Tầng 1: ~1-2 giây)
   */
  async publishPhotoPost(photoPath, message) {
    const conf = this.getConfig();
    const token = conf.META_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
    const pageId = conf.META_PAGE_ID || process.env.META_PAGE_ID;
    if (!token || !pageId) throw new Error("Thiếu META_ACCESS_TOKEN hoặc META_PAGE_ID trong cấu hình");

    logger.info(`[Facebook Page] Bắt đầu đăng bài ảnh tức thì lên Fanpage ${pageId}...`);

    const formData = new FormData();
    formData.append('access_token', token);
    formData.append('caption', message);

    if (photoPath && fs.existsSync(photoPath)) {
      const fileBuffer = fs.readFileSync(photoPath);
      const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
      formData.append('source', blob, path.basename(photoPath));
    }

    const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.error) throw new Error(`[Facebook Graph API] ${data.error.message}`);

    const postId = data.post_id || data.id;
    logger.info(`[Facebook Page] ✅ Đăng bài ảnh thành công! Post ID: ${postId}`);
    return {
      postId,
      url: `https://facebook.com/${postId}`
    };
  }

  /**
   * Đăng bài viết thuần Text lên Facebook Fanpage (khi không có ảnh)
   */
  async publishFeedPost(message) {
    const conf = this.getConfig();
    const token = conf.META_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
    const pageId = conf.META_PAGE_ID || process.env.META_PAGE_ID;
    if (!token || !pageId) throw new Error("Thiếu META_ACCESS_TOKEN hoặc META_PAGE_ID trong cấu hình");

    logger.info(`[Facebook Page] Bắt đầu đăng bài text lên Fanpage ${pageId}...`);

    const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        message,
        access_token: token
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(`[Facebook Graph API] ${data.error.message}`);

    logger.info(`[Facebook Page] ✅ Đăng bài text thành công! Post ID: ${data.id}`);
    return {
      postId: data.id,
      url: `https://facebook.com/${data.id}`
    };
  }
}

module.exports = { MetaProvider };
