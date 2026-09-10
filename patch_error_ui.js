const fs = require('fs');
let html = fs.readFileSync('public/dashboard.html', 'utf8');

const errorBadgeHtml = `
    <!-- BẢNG BẮT LỖI CLAUDE AUTO-FIX -->
    <div id="claudeErrorBox" style="display: none; background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; border-radius: 12px; padding: 14px 20px; align-items: center; justify-content: space-between; margin-bottom: 20px; box-shadow: 0 0 20px rgba(239, 68, 68, 0.2);">
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 24px; animation: blink 1s infinite;">🚨</span>
        <div>
          <h3 style="font-size: 15px; margin: 0; color: #ef4444;">HỆ THỐNG PHÁT HIỆN LỖI! (<span id="errContext"></span>)</h3>
          <p id="errMsg" style="font-size: 12px; color: #fca5a5; margin: 4px 0 0 0; font-family: monospace;"></p>
        </div>
      </div>
      <button onclick="copyClaudeFixCommand()" style="background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 6px;">
        <span>🤖</span> Copy lệnh nhờ Claude Fix
      </button>
    </div>
`;

if (!html.includes('id="claudeErrorBox"')) {
  html = html.replace('<!-- TỰ ĐỘNG ĐĂNG TOGGLE -->', errorBadgeHtml + '\n    <!-- TỰ ĐỘNG ĐĂNG TOGGLE -->');
}

const jsCode = `
    async function checkSystemErrors() {
      try {
        const res = await fetch('/api/last-error');
        const errData = await res.json();
        
        const box = document.getElementById('claudeErrorBox');
        if (errData.status === 'UNRESOLVED') {
          box.style.display = 'flex';
          document.getElementById('errContext').innerText = errData.context;
          document.getElementById('errMsg').innerText = errData.message;
        } else {
          box.style.display = 'none';
        }
      } catch (e) {}
    }

    function copyClaudeFixCommand() {
      const textToCopy = 'Có lỗi mới vừa xảy ra trong hệ thống (đã lưu ở data/last_error.json). Bạn đọc file đó và tự động fix lỗi luôn giúp tôi nhé!';
      navigator.clipboard.writeText(textToCopy).then(() => {
        alert('✅ Đã copy câu lệnh! Hãy dán vào khung chat của Claude Code để AI tự đọc file và fix lỗi ngay lập tức!');
      });
    }
`;

if (!html.includes('checkSystemErrors()')) {
  html = html.replace('function toggleGuide(id)', jsCode + '\n    function toggleGuide(id)');
  html = html.replace('setInterval(checkBotStatus, 10000);', 'setInterval(checkBotStatus, 10000);\n      setInterval(checkSystemErrors, 5000);\n      checkSystemErrors();');
}

fs.writeFileSync('public/dashboard.html', html, 'utf8');
console.log("Patched Error UI");
