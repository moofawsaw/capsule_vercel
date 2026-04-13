import type { VercelRequest, VercelResponse } from '@vercel/node';

// Helper function to escape HTML special characters
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Helper function to detect if string is a UUID
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

const META_ASSET_VERSION = (process.env.META_ASSET_VERSION ?? '20260315').trim();

function withAssetVersion(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(META_ASSET_VERSION)}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { storyId } = req.query;
  
  if (!storyId || Array.isArray(storyId)) {
    return res.status(400).send('Invalid storyId');
  }

  try {
    // Detect if it's a UUID or short code and build the appropriate query param
    const queryParam = isUUID(storyId) ? `storyId=${storyId}` : `code=${storyId}`;
    
    const response = await fetch(
      `https://resdvutqgrbbylknaxjp.supabase.co/functions/v1/story-meta?${queryParam}&format=json`
    );
    
    let title = "View Story on Capsule";
    let description = "Open in Capsule to view this story";
    let imageUrl = "https://capapp.co/og-default.png";
    let videoUrl: string | null = null;
    let isVideo = false;
    let videoDuration: number | null = null;
    let actualStoryId = storyId; // Will be updated with real UUID from response
    let shareCode = storyId; // Will be updated with short code from response
    
    if (response.ok) {
      const data = await response.json();
      if (data.title) title = escapeHtml(data.title);
      if (data.description) description = escapeHtml(data.description);
      if (data.imageUrl) imageUrl = data.imageUrl;
      if (data.isVideo) isVideo = data.isVideo;
      if (data.videoUrl) videoUrl = data.videoUrl;
      if (data.videoDuration) videoDuration = data.videoDuration;
      if (data.storyId) actualStoryId = data.storyId; // Get real UUID for deep links
      if (data.shareCode) shareCode = data.shareCode; // Get short code for URLs
    }

    // Use short code for page URL, but UUID for deep links (app needs UUID)
    // Keep canonical preview URL on the universal-link-owned route.
    const pageUrl = `https://share.capapp.co/u/${shareCode}`;
    const deepLinkId = actualStoryId; // Deep links use UUID
    const appDeepLink = `capsule://story/${deepLinkId}`;
    const IOS_APP_STORE =
      'https://apps.apple.com/us/app/capsule-shared-memories/id6758107085';
    const ANDROID_PLAY_STORE =
      'https://play.google.com/store/apps/details?id=com.capsule.app';
    const faviconUrl = withAssetVersion('https://share.capapp.co/favicon.ico');
    const favicon32Url = withAssetVersion('https://share.capapp.co/favicon-32x32.png');
    const favicon16Url = withAssetVersion('https://share.capapp.co/favicon-16x16.png');
    const appleTouchIconUrl = withAssetVersion('https://share.capapp.co/apple-touch-icon.png');

    // Video-specific OG tags
    const videoMetaTags = isVideo && videoUrl ? `
  <meta property="og:type" content="video.other">
  <meta property="og:video" content="${videoUrl}">
  <meta property="og:video:secure_url" content="${videoUrl}">
  <meta property="og:video:type" content="video/mp4">
  <meta property="og:video:width" content="720">
  <meta property="og:video:height" content="1280">
  ${videoDuration ? `<meta property="og:video:duration" content="${videoDuration}">` : ''}` : `
  <meta property="og:type" content="website">`;

    const twitterCardTags = isVideo && videoUrl ? `
  <meta name="twitter:card" content="player">
  <meta name="twitter:player" content="${videoUrl}">
  <meta name="twitter:player:width" content="720">
  <meta name="twitter:player:height" content="1280">` : `
  <meta name="twitter:card" content="summary_large_image">`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>

  <!-- Favicon -->
  <link rel="icon" href="${faviconUrl}" sizes="any">
  <link rel="shortcut icon" href="${faviconUrl}">
  <link rel="icon" type="image/png" sizes="32x32" href="${favicon32Url}">
  <link rel="icon" type="image/png" sizes="16x16" href="${favicon16Url}">
  <link rel="apple-touch-icon" sizes="180x180" href="${appleTouchIconUrl}">
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:url" content="${pageUrl}">
  ${videoMetaTags}
  <meta property="og:site_name" content="Capsule">
  
  <!-- Twitter Card Meta Tags -->
  ${twitterCardTags}
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
    }
    .container { padding: 20px; }
    .card {
      max-width: 420px;
      margin: 0 auto;
      padding: 24px;
      border-radius: 16px;
      background: rgba(0, 0, 0, 0.18);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22);
    }
    h1 {
      margin: 0 0 8px;
      font-size: 22px;
      line-height: 1.2;
    }
    p {
      margin: 0 0 16px;
      opacity: 0.95;
    }
    .btn {
      display: block;
      width: 100%;
      box-sizing: border-box;
      border: 0;
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      margin-top: 10px;
    }
    .btn-primary {
      background: #ffffff;
      color: #222222;
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.22);
      color: white;
    }
    .link {
      color: white;
      opacity: 0.9;
      text-decoration: underline;
      display: inline-block;
      margin-top: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>${title}</h1>
      <p>${description}</p>
      <a id="openAppBtn" class="btn btn-primary" href="${appDeepLink}">Open in Capsule</a>
      <a id="storeBtn" class="btn btn-secondary" href="${IOS_APP_STORE}">Download Capsule</a>
    </div>
  </div>
  <script>
    (function() {
      var iosStore = ${JSON.stringify(IOS_APP_STORE)};
      var androidStore = ${JSON.stringify(ANDROID_PLAY_STORE)};
      var ua = navigator.userAgent || '';
      var isAndroid = /Android/i.test(ua);
      var storeUrl = isAndroid ? androidStore : iosStore;

      var storeBtn = document.getElementById('storeBtn');
      if (storeBtn) {
        storeBtn.setAttribute('href', storeUrl);
      }
    })();
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Avoid stale edge/browser behavior while debugging app-open handoff issues.
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).send('Internal Server Error');
  }
}
