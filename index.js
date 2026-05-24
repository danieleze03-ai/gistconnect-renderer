const express = require('express');
const puppeteer = require('puppeteer');
const FormData = require('form-data');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const BG_IMAGE = 'https://i.postimg.cc/G2QCYf6L/Chat-GPT-Image-May-23-2026-01-05-21-PM.png';

function buildHTML(headline) {
  const safe = headline
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1080px; height: 1080px; overflow: hidden; font-family: 'Georgia', serif; }
  .card { width: 1080px; height: 1080px; position: relative; }
  .bg { width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; }
  .overlay { position: absolute; width: 100%; height: 100%; background: rgba(0,0,0,0.5); top: 0; left: 0; }
  .headline { position: absolute; bottom: 120px; left: 60px; right: 60px; color: white; font-size: 52px; font-weight: bold; line-height: 1.3; text-align: center; }
</style>
</head>
<body>
  <div class="card">
    <img class="bg" src="${BG_IMAGE}" />
    <div class="overlay"></div>
    <div class="headline">${safe}</div>
  </div>
</body>
</html>`;
}

app.get('/', (req, res) => {
  res.json({ status: 'GistConnect NG Renderer is running!' });
});

app.get('/v1/image', handleRender);
app.post('/v1/image', handleRender);

async function handleRender(req, res) {
  const headline = req.query.headline || req.body.headline || 'GistConnect NG';

  let browser;
  try {
    // Let puppeteer find its own bundled chromium automatically
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1080 });
    await page.setContent(buildHTML(headline), { waitUntil: 'networkidle0' });
    const screenshotBuffer = await page.screenshot({ type: 'png' });
    await browser.close();

    // Upload to Imgur
    const form = new FormData();
    form.append('image', screenshotBuffer.toString('base64'));
    form.append('type', 'base64');

    const imgurRes = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: { Authorization: 'Client-ID 546c25a59c58ad7' },
      body: form
    });

    const imgurData = await imgurRes.json();

    if (!imgurData.success) {
      throw new Error('Imgur upload failed: ' + JSON.stringify(imgurData));
    }

    res.json({ url: imgurData.data.link });

  } catch (err) {
    if (browser) await browser.close();
    console.error('Render error:', err);
    res.status(500).json({ error: err.message });
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Renderer running on port ${PORT}`));
