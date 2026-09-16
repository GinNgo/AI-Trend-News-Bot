const fs = require('fs');
const path = require('path');
const fetch = typeof globalThis.fetch === 'function' ? globalThis.fetch : (...args) => import('node-fetch').then(({default: f}) => f(...args));

/**
 * Kiểm tra và tự động chuyển đổi User Token thành Page Token vĩnh viễn
 */
async function inspectAndResolvePageToken(inputToken, targetPageId = null) {
  const token = (inputToken || '').trim();
  if (!token) {
    return { ok: false, error: 'Chưa nhập Access Token' };
  }

  try {
    // 1. Kiểm tra tính hợp lệ cơ bản
    const meRes = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${token}`);
    const meData = await meRes.json();
    if (meData.error) {
      const msg = meData.error.message || '';
      const isExpired = (meData.error.error_subcode === 463 || msg.includes('Session has expired') || msg.includes('expired'));
      return { 
        ok: false, 
        error: msg, 
        subcode: meData.error.error_subcode,
        isExpired: isExpired,
        message: isExpired 
          ? 'Token Facebook đã hết hạn! Vui lòng lấy Token mới từ Graph API Explorer theo hướng dẫn bên dưới.'
          : `Lỗi Meta Graph API: ${msg}`
      };
    }

    // 2. Kiểm tra xem token này đã là Page Token chưa
    const pageCheckRes = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name,category&access_token=${token}`);
    const pageCheck = await pageCheckRes.json();
    if (pageCheck.category) {
      return {
        ok: true,
        type: 'PAGE_TOKEN',
        pageId: pageCheck.id,
        pageName: pageCheck.name,
        category: pageCheck.category,
        token: token,
        isPermanent: true,
        message: `✅ Token hợp lệ! Đây là PAGE ACCESS TOKEN VĨNH VIỄN của trang "${pageCheck.name}" (ID: ${pageCheck.id}).`
      };
    }

    // 3. Nếu là User Token, truy vấn danh sách Page sở hữu (/me/accounts) để lấy Page Token vĩnh viễn
    const accountsRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${token}`);
    const accountsData = await accountsRes.json();
    if (accountsData.data && accountsData.data.length > 0) {
      let matchedPage = null;
      if (targetPageId) {
        matchedPage = accountsData.data.find(p => p.id === String(targetPageId));
      }
      if (!matchedPage) {
        matchedPage = accountsData.data[0];
      }

      if (matchedPage && matchedPage.access_token) {
        return {
          ok: true,
          type: 'USER_TOKEN_CONVERTED_TO_PAGE_TOKEN',
          pageId: matchedPage.id,
          pageName: matchedPage.name,
          category: matchedPage.category,
          token: matchedPage.access_token,
          isPermanent: true,
          originalUser: meData.name,
          message: `🎉 Đã tự động chuyển đổi thành PAGE ACCESS TOKEN VĨNH VIỄN cho trang "${matchedPage.name}" (ID: ${matchedPage.id})!`
        };
      }
    }

    return {
      ok: true,
      type: 'USER_TOKEN',
      userId: meData.id,
      userName: meData.name,
      token: token,
      isPermanent: false,
      message: `Token hợp lệ của tài khoản cá nhân "${meData.name}". Khuyến nghị chọn Page trong Graph API Explorer để lấy Token vĩnh viễn!`
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Tự động phát hiện Cloudflare Tunnel URL đang hoạt động
 */
function getPublicTunnelUrl() {
  const confPath = path.join(process.cwd(), 'config.json');
  if (fs.existsSync(confPath)) {
    try {
      const conf = JSON.parse(fs.readFileSync(confPath, 'utf-8'));
      if (conf.PUBLIC_URL) return conf.PUBLIC_URL.replace(/\/$/, '');
    } catch(e) {}
  }
  const pm2LogPath = path.join(process.env.USERPROFILE || 'C:/Users/ngovo', '.pm2', 'logs', 'cloudflare-tunnel-error-1.log');
  if (fs.existsSync(pm2LogPath)) {
    try {
      const content = fs.readFileSync(pm2LogPath, 'utf-8');
      const matches = [...content.matchAll(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g)];
      if (matches.length > 0) {
        return matches[matches.length - 1][0];
      }
    } catch(e) {}
  }
  return 'http://localhost:4000';
}

module.exports = {
  inspectAndResolvePageToken,
  getPublicTunnelUrl
};
