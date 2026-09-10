const fs = require('fs');
let code = fs.readFileSync('dashboard.js', 'utf8');

const endpoint = `
app.get('/api/last-error', (req, res) => {
  const errorFile = path.join(__dirname, 'data', 'last_error.json');
  if (fs.existsSync(errorFile)) {
    try {
      const errData = JSON.parse(fs.readFileSync(errorFile, 'utf-8'));
      return res.json(errData);
    } catch(e) {}
  }
  res.json({ status: 'NONE' });
});
`;

if (!code.includes('/api/last-error')) {
  code = code.replace("app.listen(PORT", endpoint + "\napp.listen(PORT");
  fs.writeFileSync('dashboard.js', code, 'utf8');
  console.log("Patched last-error endpoint");
}
