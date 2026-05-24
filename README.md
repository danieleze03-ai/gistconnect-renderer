# GistConnect NG — Image Renderer

Puppeteer-based image renderer for GistConnect NG automation pipeline.

## What it does
Receives a headline via POST request → renders it onto the GistConnect NG template → returns a PNG image.

## Deploy to Render.com
1. Push this repo to GitHub
2. Go to render.com → New → Web Service
3. Connect this GitHub repo
4. Set Build Command: `npm install`
5. Set Start Command: `npm start`
6. Deploy

## API Usage
POST `/v1/image`
Body: `{ "headline": "Your headline here" }`
Returns: `{ "url": "data:image/png;base64,..." }`
