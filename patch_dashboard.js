const fs = require('fs');
const path = require('path');
const code = fs.readFileSync('dashboard.js', 'utf8');

const newEndpoints = `
// ============================================
// SETTINGS & MULTI-PLATFORM PUBLISHER CONFIG
// ============================================
const configPath = path.join(__dirname, 'config.json');

app.get('/api/settings', (req, res) => {
  let conf = {};
  if (fs.existsSync(configPath)) {
    try {
      conf = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch(e) {}
  }
  res.json(conf);
});

app.post('/api/settings', (req, res) => {
  let conf = {};
  if (fs.existsSync(configPath)) {
    try {
      conf = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch(e) {}
  }
  
  const updatedConf = { ...conf, ...req.body };
  fs.writeFileSync(configPath, JSON.stringify(updatedConf, null, 2), 'utf-8');
  res.json({ ok: true, settings: updatedConf });
});

app.post('/api/publish-queue', async (req, res) => {
  try {
    const { Publisher } = require('./src/publishing/publisher.js');
    const pub = new Publisher();
    await pub.processQueue();
    res.json({ ok: true, message: 'Đã kích hoạt đẩy hàng đợi Đa nền tảng.' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});
`;

if (!code.includes('/api/settings')) {
  const insertIndex = code.indexOf('app.listen(PORT');
  const modifiedCode = code.slice(0, insertIndex) + newEndpoints + '\n' + code.slice(insertIndex);
  fs.writeFileSync('dashboard.js', modifiedCode, 'utf8');
  console.log("Patched dashboard.js");
} else {
  console.log("Already patched");
}
