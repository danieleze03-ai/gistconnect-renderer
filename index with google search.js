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
const GOOGLE_API_KEY = 'AIzaSyAT2MShUg_KbCNir-KJ_vRcSArKd91KsRQ';
const GOOGLE_CX = 'b6627ef1419f247be';

app.get('/', (req, res) => {
  res.json({ status: 'GistConnect NG Renderer running!' });
});

app.get('/v1/image', handleRender);
app.post('/v1/image', handleRender);

// Extract smart search keyword from headline
function extractKeyword(headline) {
  if (!headline) return 'nigeria entertainment';

  const lower = headline.toLowerCase();

  const mappings = [
    [['davido'], 'Davido nigerian singer'],
    [['wizkid'], 'Wizkid nigerian singer'],
    [['burna boy'], 'Burna Boy afrobeats'],
    [['tiwa savage'], 'Tiwa Savage nigeria'],
    [['rema'], 'Rema nigerian artist'],
    [['asake'], 'Asake nigerian singer'],
    [['olamide'], 'Olamide nigeria'],
    [['ckay'], 'CKay nigerian singer'],
    [['dbanj'], 'DBanj nigeria'],
    [['peter obi'], 'Peter Obi nigeria politics'],
    [['tinubu'], 'Tinubu nigeria president'],
    [['bbnaija', 'big brother naija'], 'BBNaija housemates nigeria'],
    [['nollywood', 'movie', 'film'], 'nollywood nigerian movie'],
    [['ajosepo'], 'Ajosepo nollywood movie'],
    [['wedding', 'marriage', 'bride'], 'nigerian wedding celebration'],
    [['fashion', 'style', 'outfit'], 'nigerian fashion style'],
    [['football', 'super eagles', 'soccer'], 'nigeria super eagles football'],
    [['award', 'grammy', 'headies'], 'nigeria music award show'],
    [['concert', 'tour', 'performance'], 'nigeria music concert'],
    [['baby', 'pregnant', 'birth'], 'nigeria baby celebrity'],
    [['death', 'died', 'funeral', 'rip'], 'nigeria memorial tribute'],
    [['church', 'pastor', 'gospel'], 'nigeria church gospel'],
    [['money', 'naira', 'billion', 'business'], 'nigeria business money'],
  ];

  for (const [keywords, searchTerm] of mappings) {
    if (keywords.some(kw => lower.includes(kw))) {
      return searchTerm;
    }
  }

  // Extract first 3 meaningful words from headline as search term
  const words = headline.split(' ').slice(0, 3).join(' ');
  return words + ' nigeria';
}

// Fetch image from Google Custom Search
async function fetchGoogleImage(keyword) {
  try {
    const query = encodeURIComponent(keyword);
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${query}&searchType=image&num=1&imgSize=large&imgType=photo&safe=active`;
    
    console.log('Searching Google Images for:', keyword);
    const res = await fetch(url, { timeout: 10000 });
    const data = await res.json();

    if (data.items && data.items.length > 0) {
      const imageUrl = data.items[0].link;
      console.log('Google Image found:', imageUrl);
      return imageUrl;
    }
    console.log('No Google image found, using fallback');
    return null;
  } catch (e) {
    console.log('Google Image search failed:', e.message);
    return null;
  }
}

async function handleRender(req, res) {
  const headline = req.query.headline || req.body.headline || 'GistConnect NG';
  const bgUrl = req.query.bg_url || req.body.bg_url || null;
  console.log('Rendering:', headline);

  try {
    // Search Google Images based on headline keyword
    const keyword = extractKeyword(headline);
    const googleImageUrl = bgUrl || await fetchGoogleImage(keyword);

    let image;
    if (googleImageUrl) {
      try {
        const bgRes = await fetch(googleImageUrl, { 
          timeout: 10000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const bgBuffer = Buffer.from(await bgRes.arrayBuffer());
        image = await Jimp.read(bgBuffer);
        console.log('Google BG image loaded successfully');
      } catch (e) {
        console.log('Google image load failed, using fallback:', e.message);
        image = await Jimp.read(FALLBACK_BG_PATH);
      }
    } else {
      console.log('No image found, using fallback bg');
      image = await Jimp.read(FALLBACK_BG_PATH);
    }

    // Resize to 1080x1080
    image.resize(1080, 1080);

    // Dark overlay for readability
    const overlay = new Jimp(1080, 1080, 0x00000099);
    image.composite(overlay, 0, 0, {
      mode: Jimp.BLEND_SOURCE_OVER,
      opacitySource: 0.55,
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

    console.log('Done! Uploaded:', imgurData.data.link);
    res.json({ url: imgurData.data.link });

  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Renderer running on port ${PORT}`));
