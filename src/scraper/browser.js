const puppeteer = require('puppeteer');
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const cheerio = require('cheerio');

async function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

/**
 * Scrape full article content using Puppeteer and Readability.
 * Includes basic image extraction as well.
 */
async function scrapeArticleDeep(url, publicDir) {
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
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

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

    // Image scraping logic from original code, improved with context
    const images = [];
    const $ = cheerio.load(html);
    const ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
    if (ogImage) images.push(ogImage);

    $('img').each((i, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('srcset');
      if (!src) return;
      // if srcset, just take the first url
      if (src.includes(' ')) src = src.split(' ')[0];
      if (src.includes('logo') || src.includes('icon') || src.includes('avatar') || src.includes('.svg') || src.includes('base64')) return;
      try {
        if (src.startsWith('//')) src = 'https:' + src;
        else if (src.startsWith('/')) src = new URL(url).origin + src;
        else if (!src.startsWith('http')) return;
        images.push(src);
      } catch(e) {}
    });

    const uniqueImages = [...new Set(images)].slice(0, 4);
    const downloadedImages = [];

    for (let i = 0; i < uniqueImages.length; i++) {
      const filename = `crawled_img_${i+1}.jpg`;
      const dest = path.join(publicDir, filename);
      console.log(`  📸 Đang tải ảnh thực tế ${i+1}: ${uniqueImages[i].substring(0, 60)}...`);
      try {
        await downloadImage(uniqueImages[i], dest);
        if (fs.existsSync(dest) && fs.statSync(dest).size > 2000) {
          downloadedImages.push(filename);
        }
      } catch(err) {}
    }

    return {
      text: textContent,
      images: downloadedImages,
      title: article ? article.title : $('title').text()
    };
  } catch (error) {
    console.error(`  ❌ [Deep Scraper] Lỗi khi cào dữ liệu:`, error.message);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { scrapeArticleDeep };