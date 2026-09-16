/**
 * Platform Render Profiles (V3)
 * Location: src/design/render_profiles.js
 * 
 * Reusable layout, safe-area, and rendering profiles for vertical platforms:
 * YouTube Shorts, TikTok, Instagram Reels, and Facebook Reels.
 */

const RENDER_PROFILES = {
  youtubeShorts: {
    name: 'YouTube Shorts',
    platform: 'youtube',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    fps: 30,
    durationConstraints: {
      minSec: 35,
      targetSec: 48,
      maxSec: 58
    },
    safeArea: {
      topPadding: 160,
      bottomPadding: 280,
      rightPadding: 110,
      leftPadding: 60
    },
    captionStyle: {
      fontSize: 52,
      maxWordsPerSegment: 3,
      highlightColor: '#f59e0b',
      positionY: 1420
    },
    renderSettings: {
      concurrency: 2,
      crf: 19,
      pixelFormat: 'yuv420p',
      audioBitrate: '192k'
    }
  },

  tiktok: {
    name: 'TikTok',
    platform: 'tiktok',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    fps: 30,
    durationConstraints: {
      minSec: 25,
      targetSec: 45,
      maxSec: 58
    },
    safeArea: {
      topPadding: 180,
      bottomPadding: 340, // Larger bottom clearance for TikTok captions/music title
      rightPadding: 130,  // Clearance for like/comment/share icons
      leftPadding: 60
    },
    captionStyle: {
      fontSize: 48,
      maxWordsPerSegment: 3,
      highlightColor: '#00f2fe',
      positionY: 1380
    },
    renderSettings: {
      concurrency: 2,
      crf: 20,
      pixelFormat: 'yuv420p',
      audioBitrate: '192k'
    }
  },

  instagramReels: {
    name: 'Instagram Reels',
    platform: 'instagram',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    fps: 30,
    durationConstraints: {
      minSec: 20,
      targetSec: 45,
      maxSec: 58
    },
    safeArea: {
      topPadding: 170,
      bottomPadding: 320,
      rightPadding: 120,
      leftPadding: 60
    },
    captionStyle: {
      fontSize: 50,
      maxWordsPerSegment: 3,
      highlightColor: '#ec4899',
      positionY: 1400
    },
    renderSettings: {
      concurrency: 2,
      crf: 19,
      pixelFormat: 'yuv420p',
      audioBitrate: '192k'
    }
  },

  facebookReels: {
    name: 'Facebook Reels',
    platform: 'facebook',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    fps: 30,
    durationConstraints: {
      minSec: 25,
      targetSec: 48,
      maxSec: 58
    },
    safeArea: {
      topPadding: 160,
      bottomPadding: 300,
      rightPadding: 120,
      leftPadding: 60
    },
    captionStyle: {
      fontSize: 50,
      maxWordsPerSegment: 3,
      highlightColor: '#3b82f6',
      positionY: 1410
    },
    renderSettings: {
      concurrency: 2,
      crf: 19,
      pixelFormat: 'yuv420p',
      audioBitrate: '192k'
    }
  }
};

function getRenderProfile(platform = 'youtubeShorts') {
  return RENDER_PROFILES[platform] || RENDER_PROFILES.youtubeShorts;
}

module.exports = {
  RENDER_PROFILES,
  getRenderProfile
};
