import type { VercelRequest, VercelResponse } from '@vercel/node';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { type, code } = req.query;

  if (!type || Array.isArray(type) || !code || Array.isArray(code)) {
    return res.status(400).send('Invalid invite link');
  }

  const t = String(type).trim().toLowerCase();
  const c = String(code).trim();

  const isMemory = t === 'memory';
  const isGroup = t === 'group';

  const pageUrl = `https://share.capapp.co/join/${t}/${encodeURIComponent(c)}`;
  const webFallback = `https://capapp.co/join/${t}/${encodeURIComponent(c)}`;

  // Option A:
  // - Static OG image
  // - Dynamic-ish title/description based on type (not fetching DB)
  const title = escapeHtml(
    isMemory ? 'Join a Capsule Memory' : isGroup ? 'Join a Capsule Group' : 'Join Capsule',
  );
  const description = escapeHtml(
    isMemory
      ? 'Tap to join this memory in Capsule.'
      : isGroup
        ? 'Tap to join this group in Capsule.'
        : 'Tap to join in Capsule.',
  );

  // Static OG image (use an existing stable asset; can be replaced later).
  const imageUrl = 'https://capapp.co/og-default.png';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>

  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Capsule">

  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">

  <!-- iOS Smart App Banner (optional) -->
  <meta name="apple-itunes-app" content="app-id=6630382437">

  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      background: #0c0d13;
      color: #F8FAFC;
    }
    .wrap {
      max-width: 520px;
      margin: 0 auto;
      padding: 28px 18px;
      text-align: center;
    }
    .card {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.10);
      border-radius: 16px;
      padding: 18px;
    }
    .title { font-size: 20px; font-weight: 800; margin: 0 0 8px; }
    .desc { font-size: 14px; color: rgba(248,250,252,0.78); margin: 0 0 18px; }
    .btn {
      display: block;
      width: 100%;
      border-radius: 12px;
      padding: 12px 14px;
      font-weight: 800;
      text-decoration: none;
      margin: 10px 0 0;
    }
    .primary { background: #A78BFA; color: #0c0d13; }
    .secondary { background: transparent; border: 1px solid rgba(255,255,255,0.18); color: #F8FAFC; }
    .fine { font-size: 12px; color: rgba(248,250,252,0.6); margin-top: 14px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1 class="title">${title}</h1>
      <p class="desc">${description}</p>
      <!-- Universal Link: if the app is installed + associated, iOS should open it -->
      <a class="btn primary" href="${pageUrl}">Open in Capsule</a>
      <!-- Browser fallback -->
      <a class="btn secondary" href="${webFallback}">Continue in browser</a>
      <div class="fine">If you have Capsule installed, “Open in Capsule” should open the app.</div>
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Keep OG fresh-ish while allowing caching.
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
  return res.status(200).send(html);
}

