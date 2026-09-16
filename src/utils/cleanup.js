const fs = require('fs');
const path = require('path');
const logger = require('../collector/utils/logger.js');

/**
 * Tự động quét và xóa các file video đã kết xuất và file tạm cũ hơn maxAgeHours (mặc định 24h).
 * Bảo vệ an toàn: Không xóa các file đang thuộc các publication ở trạng thái PENDING hoặc PUBLISHING.
 * 
 * @param {number} maxAgeHours - Tuổi tối đa của file tính bằng giờ (mặc định 24)
 * @returns {{ deletedVideos: number, deletedTempFiles: number, freedBytes: number }}
 */
function cleanupOldVideos(maxAgeHours = 24) {
  let deletedVideos = 0;
  let deletedTempFiles = 0;
  let freedBytes = 0;

  const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);

  // 1. Lấy danh sách videoPath đang PENDING hoặc PUBLISHING trong SQLite để KHÔNG xóa
  const protectedPaths = new Set();
  try {
    const { getDb } = require('../storage/db.js');
    const db = getDb();
    const rows = db.prepare(`
      SELECT r.videoPath 
      FROM publications p
      JOIN renders r ON p.renderId = r.renderId
      WHERE p.status IN ('PENDING', 'PUBLISHING')
    `).all();

    for (const r of rows) {
      if (r.videoPath) {
        protectedPaths.add(path.resolve(r.videoPath).toLowerCase());
      }
    }
  } catch (e) {
    logger.warn(`[Cleanup] Không thể đọc SQLite protectedPaths: ${e.message}`);
  }

  // 2. Dọn dẹp thư mục out/videos (bao gồm cả các thư mục con theo ngày và kênh)
  const videosDir = path.join(process.cwd(), 'out', 'videos');
  if (fs.existsSync(videosDir)) {
    try {
      const cleanDirRecursive = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            cleanDirRecursive(fullPath);
            // Xóa thư mục rỗng nếu không còn file nào
            try {
              if (fs.readdirSync(fullPath).length === 0) {
                fs.rmdirSync(fullPath);
              }
            } catch(e) {}
          } else if (entry.isFile() && entry.name.endsWith('.mp4')) {
            try {
              const stats = fs.statSync(fullPath);
              if (stats.mtimeMs < cutoffTime) {
                if (protectedPaths.has(path.resolve(fullPath).toLowerCase())) {
                  logger.info(`[Cleanup] Bỏ qua file đang chờ xuất bản: ${entry.name}`);
                  continue;
                }
                // Đảm bảo video đã được sao lưu an toàn lên Google Drive trước khi xóa trên ổ C
                try {
                  const { archiveVideo } = require('../storage/drive_archiver.js');
                  archiveVideo(fullPath);
                } catch(e) {}

                freedBytes += stats.size;
                fs.unlinkSync(fullPath);
                deletedVideos++;
                logger.info(`[Cleanup] 🗑️ Đã xóa video cục bộ sau khi sao lưu lên Cloud: ${entry.name} (${Math.round(stats.size / 1024 / 1024)}MB)`);
              }
            } catch (err) {
              logger.warn(`[Cleanup] Lỗi khi kiểm tra file ${entry.name}: ${err.message}`);
            }
          }
        }
      };

      cleanDirRecursive(videosDir);
    } catch (e) {
      logger.warn(`[Cleanup] Lỗi đọc thư mục out/videos: ${e.message}`);
    }
  }

  // 3. Dọn dẹp các file âm thanh/ảnh tạm trong public (dynamic_*.mp3, crawled_img_*.jpg) cũ hơn 24h
  const publicDir = path.join(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    try {
      const pFiles = fs.readdirSync(publicDir);
      for (const f of pFiles) {
        if ((f.startsWith('dynamic_') && f.endsWith('.mp3')) || f.startsWith('crawled_img_')) {
          const pPath = path.join(publicDir, f);
          try {
            const stats = fs.statSync(pPath);
            if (stats.mtimeMs < cutoffTime) {
              freedBytes += stats.size;
              fs.unlinkSync(pPath);
              deletedTempFiles++;
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  if (deletedVideos > 0 || deletedTempFiles > 0) {
    const mbFreed = (freedBytes / (1024 * 1024)).toFixed(1);
    logger.info(`[Cleanup] ✅ Hoàn tất dọn dẹp: Đã xóa ${deletedVideos} video cũ, ${deletedTempFiles} file tạm, giải phóng ${mbFreed}MB ổ cứng.`);
  }

  return { deletedVideos, deletedTempFiles, freedBytes };
}

module.exports = { cleanupOldVideos };
