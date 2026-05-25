const express = require('express');
const Jimp = require('jimp');
const FormData = require('form-data');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const LOGO_PATH = path.join(__dirname, 'logo.png');
const FALLBACK_BG_PATH = path.join(__dirname, 'bg.png');

app.get('/', (req, res) => {
  res.json({ status: 'GistConnect NG Renderer running!' });
});

app.get('/v1/image', handleRender);
app.post('/v1/image', handleRender);

function extractImageUrl(contentEncoded) {
  if (!contentEncoded) return null;
  // Try to find a BellaNaija scaled image URL
  const match = contentEncoded.match(/https:\/\/[a-zA-Z0-9./_-]+-scaled\.[a-z]{3,4}/);
  if (match) return match[0];
  // Fallback: find any image URL in src=""
  const srcMatch = contentEncoded.match(/src=["'](https:\/\/[^"']+\.(?:jpg|jpeg|png|webp))/i);
  if (srcMatch) return srcMatch[1];
  return null;
}

async function handleRender(req, res) {
  const headline = req.query.headline || req.body.headline || 'GistConnect NG';
  
  // Accept bg_url directly OR extract from content_encoded
  let bgUrl = req.query.bg_url || req.body.bg_url || null;
  const contentEncoded = req.query.content_encoded || req.body.content_encoded || null;

  // If no bg_url but content_encoded was passed, extract from it
  if (!bgUrl && contentEncoded) {
    bgUrl = extractImageUrl(contentEncoded);
    console.log('Extracted bg_url from content_encoded:', bgUrl);
  }

  console.log('Rendering:', headline, '| BG URL:', bgUrl || 'fallback');

  try {
    // Load background
    let image;
    if (bgUrl) {
      try {
        const bgRes = await fetch(bgUrl, { timeout: 8000 });
        const bgBuffer = Buffer.from(await bgRes.arrayBuffer());
        image = await Jimp.read(bgBuffer);
        console.log('Loaded article image');
      } catch (e) {
        console.log('Article image failed, using fallback:', e.message);
        image = await Jimp.read(FALLBACK_BG_PATH);
      }
    } else {
      image = await Jimp.read(FALLBACK_BG_PATH);
    }

    // Resize to 1080x1080
    image.resize(1080, 1080);

    // Dark overlay
    const overlay = new Jimp(1080, 1080, 0x00000099);
    image.composite(overlay, 0, 0, {
      mode: Jimp.BLEND_SOURCE_OVER,
      opacitySource: 0.6,
      opacityDest: 1
    });

    // Load and overlay logo top-left
    try {
      const logo = await Jimp.read(LOGO_PATH);
      logo.resize(200, Jimp.AUTO);
      image.composite(logo, 30, 30, {
        mode: Jimp.BLEND_SOURCE_OVER,
        opacitySource: 1,
        opacityDest: 1
      });
      console.log('Logo overlaid');
    } catch (e) {
      console.log('Logo failed:', e.message);
    }

    // Print headline text
    const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    image.print(
      font,
      60,
      820,
      {
        text: headline,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
      },
      960,
      220
    );

    const imageBuffer = await image.getBufferAsync(Jimp.MIME_PNG);

    // Upload to Imgur
    const form = new FormData();
    form.append('image', imageBuffer.toString('base64'));
    form.append('type', 'base64');

    const imgurRes = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: { Authorization: 'Client-ID 546c25a59c58ad7' },
      body: form
    });

    const imgurData = await imgurRes.json();
    if (!imgurData.success) throw new Error('Imgur upload failed: ' + JSON.stringify(imgurData));

    console.log('Uploaded:', imgurData.data.link);
    res.json({ url: imgurData.data.link });

  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Renderer running on port ${PORT}`));
