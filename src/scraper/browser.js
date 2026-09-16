const puppeteer = require('puppeteer');
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const cheerio = require('cheerio');

const { isSafeUrl } = require('../security/url_validator');

async function downloadImage(url, dest) {
  if (!isSafeUrl(url)) return Promise.reject(new Error(`SSRF blocked: Unsafe image URL: ${url}`));
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(8000),
    redirect: 'follow'
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(arrayBuffer));
}

/**
 * Scrape full article content using Puppeteer and Readability.
 * Includes basic image extraction as well.
 */
async function scrapeArticleDeep(url, publicDir) {
  if (!isSafeUrl(url)) {
    throw new Error(`SSRF blocked: Unsafe target URL: ${url}`);
  }
  console.log(`  🌐 [Deep Scraper] Khởi tạo trình duyệt Headless để lấy nội dung từ: ${url}`);
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true, // "new" is default now
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set a normal user agent to avoid basic blocks
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    // Abort unnecessary resources to speed up
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['stylesheet', 'font', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    console.log(`  🌐 [Deep Scraper] Đang tải trang...`);
    try {
      // Dùng domcontentloaded thay vì networkidle2 để tránh treo do ads/tracking
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

      if (url.includes('news.google.com')) {
        console.log(`  🔗 Đang đợi Google News chuyển hướng...`);
        try {
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
        } catch(e) {}
      }
    } catch (gotoErr) {
      console.log(`  ⚠️ [Deep Scraper] Cảnh báo timeout khi tải trang, nhưng vẫn tiếp tục bóc tách dữ liệu hiện có: ${gotoErr.message}`);
    }

    // Scroll down a bit to trigger lazy loading images
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await new Promise(r => setTimeout(r, 1000));

    const html = await page.content();

    // Use Readability to extract clean article text
    const doc = new JSDOM(html, { url });
    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    // Fallback if Readability fails
    let textContent = '';
    if (article && article.textContent && article.textContent.trim().length > 200) {
      textContent = article.textContent.replace(/\s+/g, ' ').trim();
      console.log(`  ✅ [Deep Scraper] Trích xuất nội dung bằng Readability thành công (${textContent.length} ký tự)`);
    } else {
      console.log(`  ⚠️ [Deep Scraper] Readability trả về quá ít nội dung, dùng Cheerio làm fallback.`);
      const $ = cheerio.load(html);
      $('script, style, nav, footer, aside, header').remove();
      textContent = $('body').text().replace(/\s+/g, ' ').trim();
    }

    // GUARD-RAIL CHẶNG 1: Chống cào trang lỗi 403 / Access Denied / Cloudflare / Bot Challenge
    const blockPatterns = [
      /access to .* was denied/i,
      /http error 403/i,
      /403 forbidden/i,
      /you don't have authorization/i,
      /verify you are human/i,
      /cloudflare/i,
      /please enable cookies/i,
      /before you continue to google/i,
      /bot detection/i,
      /checking your browser/i,
      /ray id:/i,
      /access denied/i,
      /enable javascript and cookies to continue/i
    ];

    const isBlocked = blockPatterns.some(pat => pat.test(textContent));
    if (isBlocked || textContent.length < 350) {
      throw new Error(`[Scraper Blocked] Bài viết bị chặn truy cập hoặc không đủ nội dung (${textContent.length} ký tự). Chi tiết: "${textContent.substring(0, 120)}...". Huỷ xử lý để tránh sinh video lỗi!`);
    }

    // Image scraping logic: Ưu tiên ảnh chất lượng cao (High-Res)
    const images = [];
    const $ = cheerio.load(html);
    const ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
    if (ogImage && ogImage.startsWith('http')) images.push(ogImage);

    function extractBestImage(el) {
      let src = $(el).attr('data-original') || $(el).attr('data-src') || $(el).attr('data-highres') || $(el).attr('data-url');
      const srcset = $(el).attr('srcset') || $(el).attr('data-srcset');

      if (srcset) {
        // Trong srcset, lấy URL có độ phân giải lớn nhất (thường ở cuối danh sách)
        const parts = srcset.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length > 0) {
          const largest = parts[parts.length - 1].split(/\s+/)[0];
          if (largest) src = largest;
        }
      }

      if (!src) src = $(el).attr('src');
      if (!src) return;
      if (src.includes(' ')) src = src.split(' ')[0];

      const lower = src.toLowerCase();
      // Bỏ qua icon, logo, avatar, ảnh đại diện nhỏ, pixel tracker
      if (lower.includes('logo') || lower.includes('icon') || lower.includes('avatar') ||
          lower.includes('.svg') || lower.includes('base64') || lower.includes('1x1') ||
          lower.includes('thumb_') || lower.includes('/80x') || lower.includes('/100x') ||
          lower.includes('/150x') || lower.includes('/120x') || lower.includes('placeholder')) {
        return;
      }

      try {
        if (src.startsWith('//')) src = 'https:' + src;
        else if (src.startsWith('/')) src = new URL(url).origin + src;
        else if (!src.startsWith('http')) return;
        images.push(src);
      } catch(e) {}
    }

    // Quét ưu tiên các thẻ ảnh trong phần thân bài viết trước
    const contentContainers = ['article', '.article-body', '.fck_detail', '.detail-content', '.content', '.post-content', 'main'];
    contentContainers.forEach(sel => {
      $(sel).find('img').each((i, el) => extractBestImage(el));
    });

    // Sau đó quét toàn bộ ảnh trên trang
    $('img').each((i, el) => extractBestImage(el));

    const uniqueImages = [...new Set(images)].slice(0, 5);
    const downloadedImages = [];

    for (let i = 0; i < uniqueImages.length; i++) {
      const filename = `crawled_img_${downloadedImages.length + 1}.jpg`;
      const dest = path.join(publicDir, filename);
      console.log(`  📸 Đang tải ảnh thực tế ${downloadedImages.length + 1}: ${uniqueImages[i].substring(0, 65)}...`);
      try {
        await downloadImage(uniqueImages[i], dest);
        // Chỉ chấp nhận file ảnh thực tế có kích thước > 10KB (tránh ảnh thumbnail nhỏ vỡ hạt)
        if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) {
          downloadedImages.push(filename);
          if (downloadedImages.length >= 4) break;
        }
      } catch(err) {}
    }

    return {
      text: textContent,
      images: downloadedImages,
      title: article ? article.title : $('title').text()
    };
  
  } catch (error) {
    console.error(`  ❌ [Deep Scraper] Puppeteer thất bại (${error.message}). Thử fallback bằng HTTP thuần...`);
    try {
      if (browser) await browser.close();
      browser = null; // Tránh close lần 2 trong finally
      
      const https = require('https');
      const http = require('http');
      const client = url.startsWith('https') ? https : http;
      
      const html = await new Promise((resolve, reject) => {
        client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0' } }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
             // Basic redirect follow if needed, but for now just fail over
             return reject(new Error("Redirect not supported in basic fallback"));
          }
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(data));
        }).on('error', reject);
      });
      
      const cheerio = require('cheerio');
      const { JSDOM } = require('jsdom');
      const { Readability } = require('@mozilla/readability');
      
      const doc = new JSDOM(html, { url });
      const reader = new Readability(doc.window.document);
      const article = reader.parse();
      
      let textContent = '';
      if (article && article.textContent && article.textContent.trim().length > 200) {
        textContent = article.textContent.replace(/\s+/g, ' ').trim();
      } else {
        const $ = cheerio.load(html);
        $('script, style, nav, footer, aside, header').remove();
        textContent = $('body').text().replace(/\s+/g, ' ').trim();
      }
      
      return {
        text: textContent,
        images: [], // HTTP fallback skip image parsing for simplicity to ensure text extraction succeeds
        title: article ? article.title : "Crawled Article"
      };
    } catch (fallbackErr) {
       console.error(`  ❌ [Deep Scraper Fallback] Cả HTTP Fallback cũng thất bại: ${fallbackErr.message}`);
       throw error; // Ném lỗi gốc
    }
  } finally {

    if (browser) await browser.close();
  }
}

module.exports = { scrapeArticleDeep };