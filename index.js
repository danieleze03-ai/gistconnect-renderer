const express = require('express');
const { createCanvas, loadImage } = require('canvas');
const FormData = require('form-data');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Load background from local file — no external fetch needed
const BG_PATH = path.join(__dirname, 'bg.png');

async function renderImage(headline) {
  const width = 1080;
  const height = 1080;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Load background from local file
  try {
    const bgImage = await loadImage(BG_PATH);
    ctx.drawImage(bgImage, 0, 0, width, height);
    console.log('Background loaded from local file');
  } catch (e) {
    console.error('Background load failed:', e.message);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
  }

  // Dark overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, width, height);

  // Headline text
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 8;

  function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    const lines = [];
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = context.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        lines.push(line.trim());
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line.trim());
    const totalHeight = lines.length * lineHeight;
    let startY = y - totalHeight / 2;
    lines.forEach(l => {
      context.fillText(l, x, startY);
      startY += lineHeight;
    });
  }

  let fontSize = 52;
  if (headline.length > 100) fontSize = 36;
  else if (headline.length > 60) fontSize = 44;

  ctx.font = `bold ${fontSize}px serif`;
  wrapText(ctx, headline, width / 2, height - 200, width - 120, fontSize * 1.35);

  return canvas.toBuffer('image/png');
}

app.get('/', (req, res) => {
  res.json({ status: 'GistConnect NG Renderer is running!' });
});

app.get('/v1/image', handleRender);
app.post('/v1/image', handleRender);

async function handleRender(req, res) {
  const headline = req.query.headline || req.body.headline || 'GistConnect NG';
  console.log('Rendering:', headline);

  try {
    const imageBuffer = await renderImage(headline);

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
