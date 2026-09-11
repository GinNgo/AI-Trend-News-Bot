const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
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
        
        // Instagram Graph API YÊU CẦU video phải có URL công khai (Public URL).
        // Vì tool chạy ở localhost, ta sẽ dùng local tunnel (ngrok) HOẶC yêu cầu up host.
        // Để linh hoạt, ta giả lập trả về lỗi giải thích rõ ràng nếu chạy trên máy cá nhân không có public IP.
        logger.warn(`[Instagram Reels] API Instagram bắt buộc video_url phải là link Public (Không nhận localhost).`);
        
        // Đoạn code dưới là logic CHUẨN nếu có Public URL
        /*
        const igCreateRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/media?media_type=REELS&video_url=${PUBLIC_URL}&caption=${encodeURIComponent(description)}&access_token=${token}`, { method: 'POST' });
        const igCreateData = await igCreateRes.json();
        const creationId = igCreateData.id;
        
        // Chờ Meta xử lý video (thường mất 30s - 1 phút)
        // ... code loop check status ...
        
        const igPublishRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/media_publish?creation_id=${creationId}&access_token=${token}`, { method: 'POST' });
        */
        
        throw new Error("Instagram Graph API không hỗ trợ upload file trực tiếp từ Localhost. Bạn phải cấu hình Public URL cho thư mục /out (ví dụ dùng Ngrok).");
      }
    } catch (error) {
      logger.error(`[MetaProvider] Lỗi xuất bản ${this.platform}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = { MetaProvider };
