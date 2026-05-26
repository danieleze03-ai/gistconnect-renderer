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
const UNSPLASH_ACCESS_KEY = 'RrRkD5s8Jetfm1JWzWxEJr5fABwM9AbgxCpq7HgA23k';

app.get('/', (req, res) => {
  res.json({ status: 'GistConnect NG Renderer running!' });
});

app.get('/v1/image', handleRender);
app.post('/v1/image', handleRender);

function extractKeyword(headline) {
  if (!headline) return 'nigeria entertainment';

  const lower = headline.toLowerCase();

  const mappings = [
    [['davido','wizkid','burna boy','rema','asake','olamide','ckay','tiwa','dbanj'], 'music artist performance stage'],
    [['peter obi','tinubu','atiku','sowore','politics'], 'nigeria politics crowd'],
    [['bbnaija','big brother','reality'], 'reality tv show lights'],
    [['nollywood','movie','film','cinema'], 'movie film cinema'],
    [['wedding','marriage','bride'], 'wedding celebration'],
    [['divorce','breakup','split'], 'heartbreak sad'],
    [['fashion','style','outfit','dress'], 'fashion style glamour'],
    [['football','super eagles','soccer','ballon'], 'football soccer stadium'],
    [['award','grammy','headies','trophy'], 'award show red carpet'],
    [['concert','tour','performance','show'], 'concert music crowd lights'],
    [['baby','pregnant','pregnancy','birth'], 'baby celebration family'],
    [['death','died','funeral','tribute','rip'], 'candle memorial tribute'],
    [['money','naira','billion','business','bank'], 'nigeria business money'],
    [['church','pastor','gospel'], 'church worship gospel'],
    [['crime','arrest','jail','police'], 'justice law police'],
  ];

  for (const [keywords, searchTerm] of mappings) {
    if (keywords.some(kw => lower.includes(kw))) {
      return searchTerm;
    }
  }

  return 'nigeria entertainment celebrity';
}

async function fetchUnsplashImage(keyword) {
  try {
    const query = encodeURIComponent(keyword);
    const url = `https://api.unsplash.com/photos/random?query=${query}&orientation=squarish&client_id=${UNSPLASH_ACCESS_KEY}`;
    const res = await fetch(url, { timeout: 8000 });
    const data = await res.json();
    if (data && data.urls && data.urls.regular) {
      console.log('Unsplash image:', data.urls.regular);
      return data.urls.regular;
    }
    return null;
  } catch (e) {
    console.log('Unsplash failed:', e.message);
    return null;
  }
}

async function handleRender(req, res) {
  const headline = req.query.headline || req.body.headline || 'GistConnect NG';
  console.log('Rendering:', headline);

  try {
    const keyword = extractKeyword(headline);
    console.log('Keyword:', keyword);
    const unsplashUrl = await fetchUnsplashImage(keyword);

    let image;
    if (unsplashUrl) {
      try {
        const bgRes = await fetch(unsplashUrl, { timeout: 10000 });
        const bgBuffer = Buffer.from(await bgRes.arrayBuffer());
        image = await Jimp.read(bgBuffer);
        console.log('Unsplash BG loaded');
      } catch (e) {
        console.log('BG load failed, fallback:', e.message);
        image = await Jimp.read(FALLBACK_BG_PATH);
      }
    } else {
      image = await Jimp.read(FALLBACK_BG_PATH);
    }

    image.resize(1080, 1080);

    const overlay = new Jimp(1080, 1080, 0x00000099);
    image.composite(overlay, 0, 0, {
      mode: Jimp.BLEND_SOURCE_OVER,
      opacitySource: 0.6,
      opacityDest: 1
    });

    try {
      const logo = await Jimp.read(LOGO_PATH);
      logo.resize(200, Jimp.AUTO);
      image.composite(logo, 30, 30, {
        mode: Jimp.BLEND_SOURCE_OVER,
        opacitySource: 1,
        opacityDest: 1
      });
    } catch (e) {
      console.log('Logo failed:', e.message);
    }

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

    console.log('Done:', imgurData.data.link);
    res.json({ url: imgurData.data.link });

  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Renderer running on port ${PORT}`));
