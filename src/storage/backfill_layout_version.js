const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getDb } = require('./db.js');

function backfillLayoutVersion() {
  const db = getDb();
  const dir = path.join(process.cwd(), 'out', 'videos');
  const driveDir = 'G:\\My Drive\\AI_News_Bot_Videos';
  
  const renders = db.prepare('SELECT renderId, videoPath FROM renders').all();
  console.log(`Bắt đầu backfill cho ${renders.length} bản ghi renders...`);

  const updateRenderStmt = db.prepare(`
    UPDATE renders 
    SET layoutVersion = ?, layoutTypes = ?, sceneCount = ?, durationSeconds = ?
    WHERE renderId = ?
  `);

  const updatePubStmt = db.prepare(`
    UPDATE publications
    SET layoutVersion = ?, layoutTypes = ?, sceneCount = ?, durationSeconds = ?
    WHERE renderId = ?
  `);

  const updateSnapStmt = db.prepare(`
    UPDATE video_snapshots
    SET layoutVersion = ?, sceneCount = ?, durationSeconds = ?
    WHERE publicationId IN (SELECT publicationId FROM publications WHERE renderId = ?)
  `);

  let updatedCount = 0;

  for (const r of renders) {
    let vidPath = r.videoPath;
    if (!fs.existsSync(vidPath)) {
      const localFile = path.join(dir, `${r.renderId}.mp4`);
      const driveFile = path.join(driveDir, `${r.renderId}.mp4`);
      if (fs.existsSync(localFile)) {
        vidPath = localFile;
      } else if (fs.existsSync(driveFile)) {
        vidPath = driveFile;
      }
    }

    let dur = 0;
    if (fs.existsSync(vidPath)) {
      try {
        const out = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${vidPath}"`).toString().trim();
        dur = parseFloat(out);
      } catch (e) {}
    }

    let version = 'v1.0-short-3s';
    let sceneCount = 3;
    let layoutTypes = JSON.stringify(['intro', 'list', 'outro']);

    // Video >= 42s hoặc có cấu trúc dài là v2.0-narrative-5-7s
    if (dur >= 42) {
      version = 'v2.0-narrative-5-7s';
      sceneCount = Math.min(7, Math.max(5, Math.round(dur / 8)));
      layoutTypes = JSON.stringify(['intro', 'stat', 'quote', 'bar_chart', 'image', 'outro']);
    } else if (dur > 0 && dur < 42) {
      version = 'v1.0-short-3s';
      sceneCount = 3;
      layoutTypes = JSON.stringify(['intro', 'list', 'outro']);
    }

    const durVal = dur > 0 ? Number(dur.toFixed(1)) : null;
    updateRenderStmt.run(version, layoutTypes, sceneCount, durVal, r.renderId);
    updatePubStmt.run(version, layoutTypes, sceneCount, durVal, r.renderId);
    updateSnapStmt.run(version, sceneCount, durVal, r.renderId);
    updatedCount++;
  }

  console.log(`✅ Đã backfill thành công ${updatedCount} renders (bao gồm Drive backup) và các publications liên quan!`);
}

backfillLayoutVersion();
