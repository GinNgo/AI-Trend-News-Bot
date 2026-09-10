const fs = require('fs');
const confPath = 'config.json';
if (fs.existsSync(confPath)) {
  const conf = JSON.parse(fs.readFileSync(confPath, 'utf8'));
  conf.GEMINI_MODEL = "gemini-3.7-flash";
  fs.writeFileSync(confPath, JSON.stringify(conf, null, 2), 'utf8');
  console.log("Updated config.json");
}
