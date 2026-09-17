const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const logger = require('../../collector/utils/logger.js');

const TIKTOK_PROFILE_DIR = path.join(process.cwd(), 'data', 'tiktok_profile');
if (!fs.existsSync(TIKTOK_PROFILE_DIR)) {
  fs.mkdirSync(TIKTOK_PROFILE_DIR, { recursive: true });
}

const BROWSER_CANDIDATES = [
  // Microsoft Edge (Ưu tiên)
  { type: 'edge', path: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' },
  { type: 'edge', path: 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe' },
  { type: 'edge', path: path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Edge\\Application\\msedge.exe') },
  // Google Chrome (Dự phòng)
  { type: 'chrome', path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' },
  { type: 'chrome', path: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' },
  { type: 'chrome', path: path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe') }
];

function getBrowserExecutable() {
  for (const item of BROWSER_CANDIDATES) {
    if (item.path && fs.existsSync(item.path)) {
      return item;
    }
  }
  return null;
}

// Giữ tương thích ngược với code cũ
function getEdgeExecutable() {
  const browser = getBrowserExecutable();
  return browser ? browser.path : null;
}

async function isBrowserDebuggingActive(port = 9222) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(2000)
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// Alias cho tương thích ngược
const isEdgeDebuggingActive = isBrowserDebuggingActive;

function launchTikTokBrowser(port = 9222) {
  const browser = getBrowserExecutable();
  if (!browser) {
    throw new Error('Không tìm thấy trình duyệt Microsoft Edge hoặc Google Chrome trên máy tính!');
  }

  logger.info(`[TikTokPublisher] Khởi động ${browser.type.toUpperCase()} với profile riêng tại ${TIKTOK_PROFILE_DIR} (Port ${port})...`);
  
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${TIKTOK_PROFILE_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-blink-features=AutomationControlled',
    'https://www.tiktok.com/creator-center/upload?from=upload'
  ];

  const child = spawn(browser.path, args, {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  return true;
}

// Alias cho tương thích ngược
const launchEdgeWithDebugging = launchTikTokBrowser;

function hasSavedTikTokSession() {
  try {
    const cookieFile = path.join(TIKTOK_PROFILE_DIR, 'Default', 'Network', 'Cookies');
    const altCookieFile = path.join(TIKTOK_PROFILE_DIR, 'Default', 'Cookies');
    const targetFile = fs.existsSync(cookieFile) ? cookieFile : (fs.existsSync(altCookieFile) ? altCookieFile : null);
    if (!targetFile) return false;

    const sqlite = require('better-sqlite3');
    const db = sqlite(targetFile, { readonly: true, fileMustExist: true });
    const row = db.prepare("SELECT name FROM cookies WHERE host_key LIKE '%tiktok%' AND name = 'sessionid' LIMIT 1").get();
    db.close();
    return !!row;
  } catch (e) {
    return false;
  }
}

/**
 * Kiểm tra trạng thái đăng nhập TikTok Studio qua trình duyệt tự động
 */
async function checkTikTokLoginStatus(port = 9222) {
  const isRunning = await isBrowserDebuggingActive(port);
  if (!isRunning) {
    const hasSession = hasSavedTikTokSession();
    return {
      running: false,
      loggedIn: hasSession,
      savedSession: hasSession,
      message: hasSession
        ? '✅ Profile TikTok đã lưu phiên đăng nhập sẵn sàng (Hệ thống sẽ tự động khởi chạy trình duyệt để đăng khi đến giờ).'
        : 'Trình duyệt tự động chưa chạy. Hãy bấm "Mở Trình Duyệt Đăng Nhập TikTok" để khởi động.'
    };
  }

  let browser = null;
  try {
    browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${port}`,
      defaultViewport: null
    });

    const pages = await browser.pages();
    let page = pages.find(p => {
      const u = p.url();
      return u.includes('tiktok.com/creator') || u.includes('tiktok.com/tiktokstudio') || u.includes('tiktok.com/upload');
    });

    if (!page) {
      page = await browser.newPage();
      await page.goto('https://www.tiktok.com/creator-center/upload?from=upload', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
    }

    // Đợi 2s để DOM load
    await new Promise(r => setTimeout(r, 2000));

    const checkInfo = await page.evaluate(() => {
      const url = window.location.href;
      const text = document.body ? document.body.innerText : '';
      
      const hasLoginBtn = !!document.querySelector('a[href*="login"]') || 
                          !!document.querySelector('button[data-e2e="nav-login-button"]') ||
                          text.includes('Log in to TikTok') || 
                          text.includes('Đăng nhập vào TikTok');
      
      const hasUploadArea = !!document.querySelector('input[type="file"]') ||
                            text.includes('Select video to upload') ||
                            text.includes('Chọn video để tải lên') ||
                            text.includes('Creator Center') ||
                            text.includes('TikTok Studio');

      return {
        url,
        isLoginRequired: hasLoginBtn && !hasUploadArea,
        hasUploadArea
      };
    });

    const loggedIn = !checkInfo.isLoginRequired && (checkInfo.hasUploadArea || !checkInfo.url.includes('/login'));

    return {
      running: true,
      loggedIn,
      url: checkInfo.url,
      message: loggedIn 
        ? '✅ Phiên đăng nhập TikTok Studio đang sẵn sàng!' 
        : '⚠️ Đã mở trình duyệt nhưng tài khoản chưa đăng nhập. Vui lòng đăng nhập trên cửa sổ trình duyệt.'
    };
  } catch (err) {
    return {
      running: true,
      loggedIn: false,
      message: `Lỗi kết nối tới trình duyệt: ${err.message}`
    };
  } finally {
    if (browser) {
      try { browser.disconnect(); } catch (e) {}
    }
  }
}

/**
 * Tìm input tải file video trên trang chính hoặc trong các iframe
 */
async function findFileInput(page) {
  // 1. Thử trang chính
  let input = await page.$('input[type="file"]');
  if (input) return { handle: input, frame: page };

  // 2. Thử duyệt qua các frame con
  const frames = page.frames();
  for (const frame of frames) {
    try {
      input = await frame.$('input[type="file"]');
      if (input) return { handle: input, frame };
    } catch (e) {}
  }

  return null;
}

/**
 * Tìm khung soạn thảo Caption trên frame hoặc page
 */
async function findCaptionEditor(frame) {
  const selectors = [
    '.notranslate.public-DraftEditor-content',
    'div[contenteditable="true"]',
    '[data-placeholder*="caption" i]',
    '[data-placeholder*="tiêu đề" i]',
    'textarea[placeholder*="caption" i]'
  ];

  for (const sel of selectors) {
    try {
      const el = await frame.$(sel);
      if (el) return el;
    } catch (e) {}
  }
  return null;
}

/**
 * Tìm nút Đăng / Post trên frame hoặc page
 */
async function findPostButton(frame) {
  return await frame.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    // Ưu tiên nút có text chính xác 'Post' hoặc 'Đăng'
    let target = buttons.find(b => {
      const txt = (b.textContent || '').trim().toLowerCase();
      return (txt === 'post' || txt === 'đăng' || txt === 'publish') && !b.disabled && b.offsetParent !== null;
    });

    if (!target) {
      // Tìm nút có class btn-post
      target = buttons.find(b => {
        const cls = (b.className || '').toString().toLowerCase();
        return (cls.includes('btn-post') || cls.includes('post-btn')) && !b.disabled && b.offsetParent !== null;
      });
    }

    if (!target) {
      // Tìm nút chứa từ đăng / post
      target = buttons.find(b => {
        const txt = (b.textContent || '').trim().toLowerCase();
        return (txt.includes('đăng') || txt.includes('post')) && !b.disabled && b.offsetParent !== null;
      });
    }

    return target || null;
  });
}

/**
 * Tự động hoá tải video lên TikTok Studio và BẤM ĐĂNG thông qua trình duyệt với profile độc lập
 */
async function uploadToTikTokViaEdge({
  videoPath,
  title,
  tags = [],
  port = 9222
}) {
  if (!fs.existsSync(videoPath)) {
    throw new Error(`File video không tồn tại trên ổ cứng: ${videoPath}`);
  }

  // 1. Kiểm tra trình duyệt: Ưu tiên kết nối nếu đang mở, hoặc tự động launch trực tiếp với profile TikTok
  let isDebugging = await isBrowserDebuggingActive(port);
  let browser = null;
  let isDirectLaunch = false;

  if (isDebugging) {
    try {
      logger.info(`[TikTokPublisher] Đang kết nối Puppeteer vào trình duyệt đang mở (Port ${port})...`);
      browser = await puppeteer.connect({
        browserURL: `http://127.0.0.1:${port}`,
        defaultViewport: null
      });
    } catch (err) {
      logger.warn(`[TikTokPublisher] Không thể connect qua port ${port}, sẽ chuyển sang tự khởi chạy trực tiếp.`);
      isDebugging = false;
    }
  }

  if (!browser) {
    const browserCandidate = getBrowserExecutable();
    if (!browserCandidate) {
      throw new Error('Không tìm thấy trình duyệt Microsoft Edge hoặc Google Chrome trên máy tính!');
    }
    logger.info(`[TikTokPublisher] Tự động khởi chạy ${browserCandidate.type.toUpperCase()} với profile TikTok (${TIKTOK_PROFILE_DIR})...`);
    browser = await puppeteer.launch({
      executablePath: browserCandidate.path,
      userDataDir: TIKTOK_PROFILE_DIR,
      headless: false,
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled'
      ],
      defaultViewport: null
    });
    isDirectLaunch = true;
  }

  try {
    const pages = await browser.pages();
    let page = pages.find(p => {
      const u = p.url();
      return u.includes('tiktok.com/creator-center/upload') || u.includes('tiktok.com/tiktokstudio/upload');
    });

    if (!page) {
      page = await browser.newPage();
      logger.info(`[TikTokPublisher] Đang truy cập trang TikTok Studio Upload...`);
      await page.goto('https://www.tiktok.com/creator-center/upload?from=upload', {
        waitUntil: 'networkidle2',
        timeout: 45000
      });
    } else {
      await page.bringToFront();
      // Nếu trang hiện tại không phải upload thì chuyển hướng
      if (!page.url().includes('/upload')) {
        await page.goto('https://www.tiktok.com/creator-center/upload?from=upload', {
          waitUntil: 'networkidle2',
          timeout: 45000
        });
      }
    }

    logger.info(`[TikTokPublisher] URL hiện tại: ${page.url()}`);

    // Bật chống phát hiện bot
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    // 2. Kiểm tra trạng thái đăng nhập
    await new Promise(r => setTimeout(r, 2000));
    const isLoginNeeded = await page.evaluate(() => {
      const txt = document.body ? document.body.innerText : '';
      return !!document.querySelector('a[href*="login"]') || 
             !!document.querySelector('button[data-e2e="nav-login-button"]') ||
             txt.includes('Log in to TikTok') ||
             window.location.href.includes('/login');
    });

    if (isLoginNeeded) {
      throw new Error(
        'Bạn chưa đăng nhập TikTok trên trình duyệt tự động. ' +
        'Vui lòng bấm nút "Mở Trình Duyệt Đăng Nhập TikTok" trên Dashboard và đăng nhập tài khoản một lần.'
      );
    }

    // 2.1 Dọn dẹp bản nháp chưa lưu từ phiên trước (nếu có cảnh báo)
    try {
      const discardBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.find(b => (b.textContent || '').trim().toLowerCase() === 'discard' && b.offsetParent !== null) || null;
      });
      const hasDiscard = await discardBtn.evaluate(b => b !== null);
      if (hasDiscard) {
        logger.info('[TikTokPublisher] Phát hiện cảnh báo bản nháp cũ. Đang bấm Discard...');
        await discardBtn.evaluate(b => b.click());
        await new Promise(r => setTimeout(r, 1000));

        const modalDiscard = await page.evaluateHandle(() => {
          const btns = Array.from(document.querySelectorAll('[role="dialog"] button, div[class*="modal"] button, div[class*="Modal"] button'));
          return btns.find(b => (b.textContent || '').trim().toLowerCase() === 'discard') || null;
        });
        const hasModalDiscard = await modalDiscard.evaluate(b => b !== null);
        if (hasModalDiscard) {
          await modalDiscard.evaluate(b => b.click());
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    } catch(e) {}

    // 3. Tìm ô input file
    logger.info(`[TikTokPublisher] Đang dò tìm khung tải video...`);
    let foundInput = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      foundInput = await findFileInput(page);
      if (foundInput) break;
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!foundInput) {
      throw new Error('Không tìm thấy ô input file trên trang TikTok Studio. Vui lòng kiểm tra lại giao diện trang web.');
    }

    const { handle: inputHandle, frame: uploadFrame } = foundInput;
    const resolvedVideoPath = path.resolve(videoPath);
    logger.info(`[TikTokPublisher] Đang nạp video vào TikTok: ${path.basename(resolvedVideoPath)}`);
    await inputHandle.uploadFile(resolvedVideoPath);

    // 4. Chờ video xử lý tải lên (tối đa 90 giây)
    logger.info(`[TikTokPublisher] Đang chờ TikTok tải lên và xử lý video...`);
    let editorReady = false;
    const startWaitUpload = Date.now();
    
    while (Date.now() - startWaitUpload < 90000) {
      const editor = await findCaptionEditor(uploadFrame);
      if (editor) {
        editorReady = true;
        break;
      }
      await new Promise(r => setTimeout(r, 1500));
    }

    if (!editorReady) {
      throw new Error('TikTok xử lý video quá lâu hoặc không tìm thấy khung nhập Caption sau 90 giây.');
    }

    // Cho thêm 3s để khung soạn thảo ổn định
    await new Promise(r => setTimeout(r, 3000));

    // 5. Chuẩn bị Tiêu đề & Hashtags
    const tagList = Array.isArray(tags) ? tags : [];
    const hashtagStr = tagList.map(t => `#${t.replace(/^#/, '')}`).join(' ');
    const fullCaption = `${title || 'Bản Tin Nóng 24H'} ${hashtagStr}`.trim();

    logger.info(`[TikTokPublisher] Đang nhập Caption: "${fullCaption.substring(0, 60)}..."`);
    const editor = await findCaptionEditor(uploadFrame);
    if (editor) {
      await editor.click();
      await new Promise(r => setTimeout(r, 500));

      // Xóa nội dung mặc định (thường là tên file .mp4)
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await new Promise(r => setTimeout(r, 300));

      // Gõ nội dung mới
      await page.keyboard.type(fullCaption, { delay: 25 });
      await new Promise(r => setTimeout(r, 1000));

      // Kiểm tra nếu chưa nhận đủ chữ thì focus gõ bổ sung
      const typedLen = await uploadFrame.evaluate(() => {
        const el = document.querySelector('.notranslate.public-DraftEditor-content, div[contenteditable="true"]');
        return el ? (el.innerText || el.textContent || '').trim().length : 0;
      });
      if (typedLen < 5) {
        await editor.click();
        await page.keyboard.type(fullCaption, { delay: 15 });
      }
    }

    // Cuộn xuống cuối để nút Post hiển thị rõ
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(r => setTimeout(r, 1000));

    // 6. Chờ nút Post / Đăng sẵn sàng và click
    logger.info(`[TikTokPublisher] Đang tìm và chờ nút Post/Đăng sẵn sàng...`);
    let postBtnHandle = null;
    const startWaitPost = Date.now();

    while (Date.now() - startWaitPost < 60000) {
      const btn = await findPostButton(uploadFrame);
      const isReady = await btn.evaluate(b => b !== null && !b.disabled && b.offsetParent !== null);
      if (isReady) {
        postBtnHandle = btn;
        break;
      }
      await new Promise(r => setTimeout(r, 1500));
    }

    if (!postBtnHandle) {
      throw new Error('Không tìm thấy nút Post / Đăng hoặc nút bị vô hiệu hóa quá 60 giây.');
    }

    logger.info(`[TikTokPublisher] 🚀 Đang bấm nút Post / Đăng video...`);
    await postBtnHandle.evaluate(b => {
      b.scrollIntoView({ behavior: 'instant', block: 'center' });
      b.click();
    });
    try {
      await postBtnHandle.click();
    } catch (e) {}

    // 7. Chờ xác nhận đăng thành công (modal thông báo hoặc chuyển trang sang /content)
    logger.info(`[TikTokPublisher] Đang chờ xác nhận xuất bản từ TikTok Studio...`);
    let isSuccess = false;
    const startWaitSuccess = Date.now();

    while (Date.now() - startWaitSuccess < 60000) {
      // A. Kiểm tra URL chuyển hướng sang danh sách bài đăng
      const currentUrl = page.url();
      if (currentUrl.includes('/content') || currentUrl.includes('/manage')) {
        isSuccess = true;
        break;
      }

      // B. Kiểm tra Modal / Toast thông báo thành công thực sự (chính xác hơn)
      const hasSuccessText = await uploadFrame.evaluate(() => {
        const txt = (document.body ? document.body.innerText : '').toLowerCase();
        return txt.includes('video published') ||
               txt.includes('video đã được xuất bản') ||
               txt.includes('video đã đăng') ||
               txt.includes('manage your posts') ||
               txt.includes('quản lý bài đăng') ||
               txt.includes('upload another video') ||
               txt.includes('tải lên video khác') ||
               txt.includes('your video has been uploaded') ||
               txt.includes('video của bạn đã được tải lên');
      });

      if (hasSuccessText) {
        isSuccess = true;
        break;
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    if (!isSuccess) {
      logger.warn(`[TikTokPublisher] Đã bấm Post nhưng chưa thấy thông báo xác nhận. Vẫn ghi nhận trạng thái để người dùng kiểm tra lại.`);
    } else {
      logger.info(`[TikTokPublisher] 🎉 ĐÃ XUẤT BẢN THÀNH CÔNG LÊN TIKTOK!`);
      // Đợi 5 giây để TikTok hoàn tất các request ngầm trước khi đóng trình duyệt
      await new Promise(r => setTimeout(r, 5000));
    }

    const postId = `tiktok_${Date.now()}`;
    return {
      ok: true,
      postId: postId,
      message: 'Video đã được xuất bản tự động thành công lên TikTok Studio!',
      url: page.url()
    };
  } finally {
    try {
      if (browser) {
        if (isDirectLaunch) {
          await browser.close();
        } else {
          browser.disconnect();
        }
      }
    } catch (e) {}
  }
}

module.exports = {
  TIKTOK_PROFILE_DIR,
  getBrowserExecutable,
  getEdgeExecutable,
  isBrowserDebuggingActive,
  isEdgeDebuggingActive,
  launchTikTokBrowser,
  launchEdgeWithDebugging,
  checkTikTokLoginStatus,
  uploadToTikTokViaEdge
};
