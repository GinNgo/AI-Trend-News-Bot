const fs = require('fs');
const html = fs.readFileSync('public/dashboard.html', 'utf8');

const jsCode = `
    function toggleGuide(id) {
      const g = document.getElementById(id);
      g.style.display = g.style.display === 'none' ? 'block' : 'none';
    }

    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        const conf = await res.json();
        
        if (conf.AUTO_PUBLISH !== undefined) {
          document.getElementById('autoPublishBtn').checked = conf.AUTO_PUBLISH;
        } else {
          document.getElementById('autoPublishBtn').checked = false;
        }

        document.getElementById('tkClientKey').value = conf.TIKTOK_CLIENT_KEY || '';
        document.getElementById('tkClientSecret').value = conf.TIKTOK_CLIENT_SECRET || '';
        document.getElementById('fbPageId').value = conf.META_PAGE_ID || '';
        document.getElementById('fbToken').value = conf.META_ACCESS_TOKEN || '';
        document.getElementById('igAccountId').value = conf.IG_ACCOUNT_ID || '';
        document.getElementById('igToken').value = conf.META_ACCESS_TOKEN || '';
      } catch (e) {
        console.error(e);
      }
    }

    async function saveSettings() {
      const payload = {
        AUTO_PUBLISH: document.getElementById('autoPublishBtn').checked,
        TIKTOK_CLIENT_KEY: document.getElementById('tkClientKey').value.trim(),
        TIKTOK_CLIENT_SECRET: document.getElementById('tkClientSecret').value.trim(),
        META_PAGE_ID: document.getElementById('fbPageId').value.trim(),
        META_ACCESS_TOKEN: document.getElementById('fbToken').value.trim() || document.getElementById('igToken').value.trim(),
        IG_ACCOUNT_ID: document.getElementById('igAccountId').value.trim(),
      };
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.ok) alert('✅ Đã lưu cấu hình thành công!');
      } catch (e) {
        alert('❌ Lỗi: ' + e.message);
      }
    }

    async function toggleAutoPublish() {
      await saveSettings();
      if (document.getElementById('autoPublishBtn').checked) {
        log('🚀 BẬT Tự động xuất bản đa nền tảng. Render xong sẽ Đăng ngay!');
      } else {
        log('⏸️ TẮT Tự động xuất bản. Video sẽ được đưa vào hàng đợi chờ duyệt.');
      }
    }

    async function triggerManualPublish() {
      try {
        const res = await fetch('/api/publish-queue', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          log('🚀 Kích hoạt Đẩy Hàng Đợi (Publish) Thủ công!');
          alert('✅ Đã kích hoạt đẩy video lên Đa Nền Tảng!');
        }
      } catch(e) {
        alert('❌ Lỗi: ' + e.message);
      }
    }
`;

const replaceIndex = html.indexOf('function toggleYtGuide');
// Remove old toggleYtGuide
const htmlCleaned = html.replace(/function toggleYtGuide\(\) {[\s\S]*?}/, '');
const finalHtml = htmlCleaned.replace('window.addEventListener(\'load\', () => {', 'window.addEventListener(\'load\', () => {\n      loadSettings();');
const final2Html = finalHtml.replace('setTimeout(updateWires, 200);', 'setTimeout(updateWires, 200);\n' + jsCode);

fs.writeFileSync('public/dashboard.html', final2Html, 'utf8');
console.log("Patched HTML JS block");
