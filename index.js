const express = require('express');
const Jimp = require('jimp');
const FormData = require('form-data');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ status: 'GistConnect NG Renderer running!' });
});

app.get('/v1/image', handleRender);
app.post('/v1/image', handleRender);

async function handleRender(req, res) {
  const headline = req.query.headline || req.body.headline || 'GistConnect NG';
  console.log('Rendering:', headline);

  try {
    // Load background image from local file
    const bgPath = path.join(__dirname, 'bg.png');
    const image = await Jimp.read(bgPath);

    // Resize to 1080x1080
    image.resize(1080, 1080);

    // Dark overlay
    const overlay = new Jimp(1080, 1080, 0x00000080);
    image.composite(overlay, 0, 0, {
      mode: Jimp.BLEND_SOURCE_OVER,
      opacitySource: 0.5,
      opacityDest: 1
    });

    // Load font and print text
    const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    
    // Word wrap the headline
    image.print(
      font,
      60,
      800,
      {
        text: headline,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
      },
      960,
      200
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
