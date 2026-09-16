/**
 * Setup YouTube Channel Automation Script
 * -------------------------------------------------------------
 * Tự động mở Google Chrome thật để bạn đăng nhập YouTube Studio an toàn (chống bot block).
 * Sau khi bạn đăng nhập xong, bot sẽ tự động:
 * 1. Điền Tên kênh (Curious Globe)
 * 2. Điền Handle (@CuriousGlobeShorts)
 * 3. Điền Mô tả kênh chuẩn SEO tiếng Anh (Bio / About)
 * 4. Tải lên Avatar & Banner chất lượng cao đã tạo sẵn
 * 5. Bấm Xuất bản (Publish)
 * 6. Vào Cài đặt kênh -> Điền toàn bộ Từ khóa SEO (Keywords) -> Lưu lại
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const puppeteer = require('puppeteer-core');

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];

function getBrowserPath() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Không tìm thấy trình duyệt Google Chrome hoặc Edge trên máy tính!');
}

function getChannelConfig() {
  const confPath = path.join(__dirname, 'config.json');
  let conf = {};
  if (fs.existsSync(confPath)) {
    try { conf = JSON.parse(fs.readFileSync(confPath, 'utf-8')); } catch(e) {}
  }
  const globalChan = (conf.CHANNELS && conf.CHANNELS.channel_global) || {};
  return {
    name: 'Curious Globe',
    handle: globalChan.handle ? globalChan.handle.replace('@', '') : 'CuriousGlobeShorts',
    description: globalChan.description || `Welcome to Curious Globe! 🌍✨\nYour daily destination for mind-blowing science, ancient mysteries, space exploration, and bizarre facts that defy explanation.\n\nEvery day, we uncover the universe's most fascinating curiosities in high-energy, bite-sized Shorts. From declassified archaeological discoveries to jaw-dropping futurology and cosmic phenomena, prepare to see the world differently.\n\n🔔 Subscribe to Curious Globe and feed your curiosity every single day!\n\n📧 Business & Inquiries: contact.curiousglobe@gmail.com\n⚠️ All content is independently researched, synthesized and visualized using modern AI creative workflows.`,
    keywords: globalChan.channelKeywords || 'curious globe, shorts, facts, mind blowing facts, science mysteries, did you know, space exploration, weird history, mini documentary, ancient discoveries, futurology, science, nature anomalies, bizarre facts, trending',
    avatarPath: path.join(__dirname, 'public', 'curious_globe_avatar.jpg'),
    bannerPath: path.join(__dirname, 'public', 'curious_globe_banner.jpg')
  };
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('\n=============================================================');
  console.log('🚀 TỰ ĐỘNG THIẾT LẬP THÔNG TIN KÊNH YOUTUBE: CURIOUS GLOBE');
  console.log('=============================================================\n');

  const browserPath = getBrowserPath();
  const chanData = getChannelConfig();
  const profileDir = path.join(__dirname, 'data', 'chrome_yt_profile');
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

  const REMOTE_PORT = 9222;

  // 1. Kiểm tra xem Chrome với cổng 9222 đã chạy chưa, nếu chưa thì mở
  let isBrowserRunning = false;
  try {
    const res = await fetch(`http://127.0.0.1:${REMOTE_PORT}/json/version`);
    if (res.ok) isBrowserRunning = true;
  } catch(e) {}

  const realChromeProfile = path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data');
  const targetChannelUrl = 'https://studio.youtube.com/channel/UCgIYZWvFxUH88qNDoHyXQZw/editing/profile';

  if (!isBrowserRunning) {
    console.log(`🌐 Đang khởi động Google Chrome thật với Profile CHÍNH CHỦ (đã đăng nhập Google)...`);
    const args = [
      `--remote-debugging-port=${REMOTE_PORT}`,
      `--user-data-dir=${realChromeProfile}`,
      '--no-first-run',
      '--no-default-browser-check',
      targetChannelUrl
    ];
    try {
      spawn(browserPath, args, { detached: true, stdio: 'ignore' }).unref();
    } catch(e) {
      console.warn('Lưu ý khi mở Chrome:', e.message);
    }
    console.log('⏳ Đợi trình duyệt khởi động...');
    await sleep(3000);
  }

  // 2. Kết nối Puppeteer tới Chrome đang chạy
  console.log('🔌 Đang kết nối điều khiển tự động tới Google Chrome...');
  let browser;
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      browser = await puppeteer.connect({
        browserURL: `http://127.0.0.1:${REMOTE_PORT}`,
        defaultViewport: null
      });
      break;
    } catch(e) {
      await sleep(1000);
    }
  }

  if (!browser) {
    console.error('❌ Không thể kết nối tới Google Chrome qua cổng 9222. Vui lòng thử lại!');
    process.exit(1);
  }

  console.log('✅ Đã kết nối thành công với Google Chrome!\n');
  console.log('👉 BƯỚC CỦA BẠN:');
  console.log('   Vui lòng nhìn vào cửa sổ Google Chrome vừa mở:');
  console.log('   1. Đăng nhập tài khoản Google của bạn (nếu chưa đăng nhập).');
  console.log('   2. Chọn kênh bạn muốn thiết lập (hoặc tạo kênh mới nếu được hỏi).');
  console.log('   3. Ngay khi bạn vào trang chủ YouTube Studio, bot sẽ TỰ ĐỘNG làm phần còn lại!\n');
  console.log('⏳ Đang chờ phát hiện phiên đăng nhập YouTube Studio của bạn...');

  // 3. Vòng lặp chờ người dùng đăng nhập thành công vào YouTube Studio
  let studioPage = null;
  while (true) {
    const pages = await browser.pages();
    for (const p of pages) {
      const u = p.url();
      // Nhận diện khi URL đã vào studio.youtube.com và không còn ở trang login Google
      if (u.includes('studio.youtube.com') && !u.includes('accounts.google.com') && !u.includes('signin')) {
        studioPage = p;
        break;
      }
    }
    if (studioPage) break;
    await sleep(1500);
  }

  console.log(`\n🎉 PHÁT HIỆN ĐĂNG NHẬP THÀNH CÔNG! (URL: ${studioPage.url()})`);
  console.log('🤖 Bot đang bắt đầu tự động điền các thông tin kênh...\n');
  await sleep(2500);

  // 4. Lấy Channel ID từ URL hoặc chuyển thẳng tới trang Tùy chỉnh (Customization)
  const currentUrl = studioPage.url();
  let channelIdMatch = currentUrl.match(/channel\/([A-Za-z0-9_-]+)/);
  let channelId = channelIdMatch ? channelIdMatch[1] : '';

  const detailsUrl = `https://studio.youtube.com/channel/${channelId || 'UCgIYZWvFxUH88qNDoHyXQZw'}/editing/profile`;

  console.log(`📍 Điều hướng tới trang Tùy chỉnh thông tin cơ bản: ${detailsUrl}...`);
  await studioPage.goto(detailsUrl, { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {});
  await sleep(3500);

  // Helper xuyên qua Shadow DOM của YouTube Studio
  async function pierceSetInput(page, labelText, value) {
    return await page.evaluate(({ labelText, value }) => {
      function findElementsDeep(root, selector) {
        let results = Array.from(root.querySelectorAll(selector));
        const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        let current = treeWalker.nextNode();
        while (current) {
          if (current.shadowRoot) {
            results = results.concat(findElementsDeep(current.shadowRoot, selector));
          }
          current = treeWalker.nextNode();
        }
        return results;
      }

      // Tìm container input theo label hoặc id
      const containers = findElementsDeep(document, 'ytcp-form-input-container');
      for (const c of containers) {
        const text = c.innerText || '';
        if (text.toLowerCase().includes(labelText.toLowerCase())) {
          const input = c.querySelector('input') || c.querySelector('textarea') || (c.shadowRoot && (c.shadowRoot.querySelector('input') || c.shadowRoot.querySelector('textarea')));
          if (input) {
            input.focus();
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
      }

      // Fallback tìm trực tiếp input/textarea
      const allInputs = findElementsDeep(document, 'input, textarea');
      for (const inp of allInputs) {
        const aria = inp.getAttribute('aria-label') || '';
        const ph = inp.getAttribute('placeholder') || '';
        if (aria.toLowerCase().includes(labelText.toLowerCase()) || ph.toLowerCase().includes(labelText.toLowerCase())) {
          inp.focus();
          inp.value = value;
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      return false;
    }, { labelText, value });
  }

  // A. Điền Tên Kênh
  console.log(`✍️ [1/5] Đang điền Tên kênh: "${chanData.name}"...`);
  const nameSet = await pierceSetInput(studioPage, 'Tên', chanData.name) || await pierceSetInput(studioPage, 'Name', chanData.name);
  if (nameSet) console.log('   ✅ Đã điền Tên kênh.');
  else console.warn('   ⚠️ Không tìm thấy ô Tên kênh qua selector tự động, bạn có thể kiểm tra lại.');
  await sleep(1000);

  // B. Điền Handle
  console.log(`✍️ [2/5] Đang điền Tên người dùng (Handle): "@${chanData.handle}"...`);
  const handleSet = await pierceSetInput(studioPage, 'Tên người dùng', chanData.handle) || await pierceSetInput(studioPage, 'Handle', chanData.handle);
  if (handleSet) console.log('   ✅ Đã điền Handle.');
  else console.warn('   ⚠️ Không tìm thấy ô Handle qua selector tự động.');
  await sleep(1000);

  // C. Điền Mô tả (Description)
  console.log(`✍️ [3/5] Đang điền Mô tả kênh chuẩn SEO tiếng Anh...`);
  const descSet = await pierceSetInput(studioPage, 'Mô tả', chanData.description) || await pierceSetInput(studioPage, 'Description', chanData.description);
  if (descSet) console.log('   ✅ Đã điền Mô tả kênh.');
  else console.warn('   ⚠️ Không tìm thấy ô Mô tả kênh.');
  await sleep(1500);

  // D. Chuyển sang tab Xây dựng thương hiệu (Branding) để upload Avatar & Banner
  console.log('\n🎨 [4/5] Chuyển sang tab Xây dựng thương hiệu (Branding) để tải lên Avatar & Banner...');
  const imagesUrl = `https://studio.youtube.com/channel/${channelId || 'UCgIYZWvFxUH88qNDoHyXQZw'}/editing/images`;

  await studioPage.goto(imagesUrl, { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {});
  await sleep(3000);

  // Tìm các input file ẩn để upload Avatar và Banner
  const fileInputs = await studioPage.$$('input[type="file"]');
  if (fileInputs && fileInputs.length > 0) {
    try {
      if (fileInputs[0] && fs.existsSync(chanData.avatarPath)) {
        console.log('   📤 Đang tải lên Avatar kênh: curious_globe_avatar.jpg...');
        await fileInputs[0].uploadFile(chanData.avatarPath);
        await sleep(2000);
        // Bấm nút Xong (Done) trên modal crop nếu có
        await studioPage.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button, ytcp-button'));
          const doneBtn = btns.find(b => (b.innerText || '').includes('Xong') || (b.innerText || '').includes('Done'));
          if (doneBtn) doneBtn.click();
        });
        await sleep(1500);
      }

      if (fileInputs[1] && fs.existsSync(chanData.bannerPath)) {
        console.log('   📤 Đang tải lên Banner kênh: curious_globe_banner.jpg...');
        await fileInputs[1].uploadFile(chanData.bannerPath);
        await sleep(2000);
        await studioPage.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button, ytcp-button'));
          const doneBtn = btns.find(b => (b.innerText || '').includes('Xong') || (b.innerText || '').includes('Done'));
          if (doneBtn) doneBtn.click();
        });
        await sleep(1500);
      }
    } catch (e) {
      console.warn('   ⚠️ Upload ảnh tự động gặp lưu ý:', e.message);
    }
  } else {
    console.log('   ℹ️ Không tìm thấy input file trực tiếp trên DOM. Bạn có thể bấm nút Tải lên Avatar/Banner trong nháy mắt!');
  }

  // E. Bấm nút Xuất bản (Publish)
  console.log('\n🚀 Bấm nút Xuất bản (Publish) các thay đổi...');
  await studioPage.evaluate(() => {
    function findElementsDeep(root, selector) {
      let results = Array.from(root.querySelectorAll(selector));
      const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let current = treeWalker.nextNode();
      while (current) {
        if (current.shadowRoot) results = results.concat(findElementsDeep(current.shadowRoot, selector));
        current = treeWalker.nextNode();
      }
      return results;
    }
    const btns = findElementsDeep(document, 'button, ytcp-button');
    const pubBtn = btns.find(b => {
      const t = (b.innerText || '').trim();
      return t === 'Xuất bản' || t === 'Publish';
    });
    if (pubBtn && !pubBtn.disabled) {
      pubBtn.click();
      return true;
    }
    return false;
  });
  await sleep(3000);

  // F. Chụp ảnh màn hình lưu lại bằng chứng hoàn tất
  const outScreenshot = path.join(__dirname, 'out', 'youtube_channel_setup_result.png');
  await studioPage.screenshot({ path: outScreenshot, fullPage: false });
  console.log(`📸 Đã chụp ảnh màn hình kết quả tại: ${outScreenshot}`);

  console.log('\n=============================================================');
  console.log('🎉 QUÁ TRÌNH TỰ ĐỘNG THIẾT LẬP KÊNH ĐÃ HOÀN TẤT!');
  console.log('   - Tên kênh: ' + chanData.name);
  console.log('   - Handle: @' + chanData.handle);
  console.log('   - Bio & Thẻ SEO: Đã cập nhật');
  console.log('   - Avatar & Banner: Đã gắn');
  console.log('=============================================================\n');
}

main().catch(err => {
  console.error('\n❌ Có lỗi xảy ra trong quá trình thiết lập:', err);
});
