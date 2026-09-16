const fs = require('fs');
const path = require('path');
const logger = require('../collector/utils/logger.js');

const DEFAULT_DRIVE_DIR = 'G:\\My Drive\\AI_News_Bot_Videos';

function getDriveConfig() {
  const configPath = path.join(process.cwd(), 'config.json');
  let conf = {};
  if (fs.existsSync(configPath)) {
    try { conf = JSON.parse(fs.readFileSync(configPath, 'utf-8')); } catch(e) {}
  }
  const enabled = conf.ENABLE_GOOGLE_DRIVE_ARCHIVE !== false;
  const drivePath = conf.GOOGLE_DRIVE_PATH || DEFAULT_DRIVE_DIR;
  return { enabled, drivePath };
}

function isDriveAvailable() {
  const { enabled, drivePath } = getDriveConfig();
  if (!enabled) return false;
  try {
    const parent = path.dirname(drivePath);
    return fs.existsSync(parent) || fs.existsSync(drivePath);
  } catch(e) {
    return false;
  }
}

function ensureDriveDir() {
  const { drivePath } = getDriveConfig();
  if (!fs.existsSync(drivePath)) {
    try {
      fs.mkdirSync(drivePath, { recursive: true });
    } catch(e) {
      logger.warn(`[DriveArchiver] Không thể tạo thư mục ${drivePath}: ${e.message}`);
      return false;
    }
  }
  return true;
}

function archiveVideo(sourceFilePath, customSubPath = null) {
  if (!isDriveAvailable()) return null;
  if (!ensureDriveDir()) return null;

  try {
    const { drivePath } = getDriveConfig();
    let destPath;

    if (customSubPath) {
      destPath = path.join(drivePath, customSubPath);
    } else {
      // Tự động kiểm tra nếu sourceFilePath nằm trong out/videos/[subfolder]
      const videosBaseDir = path.resolve(process.cwd(), 'out', 'videos');
      const resolvedSrc = path.resolve(sourceFilePath);
      if (resolvedSrc.startsWith(videosBaseDir)) {
        const relativePart = path.relative(videosBaseDir, resolvedSrc);
        destPath = path.join(drivePath, relativePart);
      } else {
        destPath = path.join(drivePath, path.basename(sourceFilePath));
      }
    }

    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    if (!fs.existsSync(destPath) || fs.statSync(destPath).size !== fs.statSync(sourceFilePath).size) {
      fs.copyFileSync(sourceFilePath, destPath);
      logger.info(`[DriveArchiver] ☁️ Đã sao lưu video lên Google Drive: ${destPath}`);
    }
    return destPath;
  } catch(e) {
    logger.warn(`[DriveArchiver] Lỗi sao lưu sang Google Drive: ${e.message}`);
    return null;
  }
}

function getAllMp4Files(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const fullPath = path.join(dir, item);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results = results.concat(getAllMp4Files(fullPath));
      } else if (item.endsWith('.mp4')) {
        results.push(fullPath);
      }
    } catch(e) {}
  }
  return results;
}

function syncAllVideos() {
  if (!isDriveAvailable()) return { synced: 0, total: 0 };
  const videosDir = path.join(process.cwd(), 'out', 'videos');
  if (!fs.existsSync(videosDir)) return { synced: 0, total: 0 };

  const allFiles = getAllMp4Files(videosDir);
  let synced = 0;
  for (const src of allFiles) {
    if (archiveVideo(src)) {
      synced++;
    }
  }
  return { synced, total: allFiles.length };
}

module.exports = {
  getDriveConfig,
  isDriveAvailable,
  archiveVideo,
  syncAllVideos
};
