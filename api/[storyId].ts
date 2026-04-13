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

function toAbsoluteStoryMediaUrl(rawUrl: string): string {
  const input = (rawUrl ?? '').trim();
  if (!input) return '';
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return input;
  }

  const normalized = input
    .replace(/^\/+/, '')
    .replace(/^story-media\//, '');
  if (!normalized) return '';

  const encodedPath = normalized
    .split('/')
    .filter((segment) => segment.trim().length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `https://resdvutqgrbbylknaxjp.supabase.co/storage/v1/object/public/story-media/${encodedPath}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { storyId } = req.query;
  
  if (!storyId || Array.isArray(storyId)) {
    return res.status(400).send('Invalid storyId');
  }

  try {
    // Detect if it's a UUID or short code and build the appropriate query param
    const normalizedStoryId = String(storyId).trim();
    const queryParam = isUUID(normalizedStoryId)
      ? `storyId=${encodeURIComponent(normalizedStoryId)}`
      : `code=${encodeURIComponent(normalizedStoryId)}`;
    
    const response = await fetch(
      `https://resdvutqgrbbylknaxjp.supabase.co/functions/v1/story-meta?${queryParam}&format=json`
    );
    
    let title = "View Story on Capsule";
    let description = "Open in Capsule to view this story";
    let imageUrl = "https://capapp.co/og-default.png";
    let videoUrl: string | null = null;
    let isVideo = false;
    let videoDuration: number | null = null;
    let actualStoryId = normalizedStoryId; // Will be updated with real UUID from response
    let shareCode = normalizedStoryId; // Will be updated with short code from response
    
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

    imageUrl = toAbsoluteStoryMediaUrl(imageUrl) || "https://capapp.co/og-default.png";
    videoUrl = videoUrl ? toAbsoluteStoryMediaUrl(videoUrl) : null;

    // Use short code for page URL, but UUID for deep links (app needs UUID)
    // Keep canonical preview URL on the universal-link-owned route.
    const canonicalToken = encodeURIComponent(String(shareCode).trim() || normalizedStoryId);
    const pageUrl = `https://share.capapp.co/u/${canonicalToken}`;
    const deepLinkId = actualStoryId; // Deep links use UUID
    const capappStoryUrl = isUUID(String(actualStoryId))
      ? `https://capapp.co/story/${actualStoryId}`
      : '';
    const appDeepLink = `capsule://story/${deepLinkId}`;
    const webFallbackUrl = capappStoryUrl || `https://capapp.co/story/${encodeURIComponent(deepLinkId)}`;
    const IOS_APP_STORE =
      'https://apps.apple.com/us/app/capsule-shared-memories/id6758107085';
    const ANDROID_PLAY_STORE =
      'https://play.google.com/store/apps/details?id=com.capsule.app';
    const faviconUrl = withAssetVersion('https://share.capapp.co/favicon.ico');
    const favicon32Url = withAssetVersion('https://share.capapp.co/favicon-32x32.png');
    const favicon16Url = withAssetVersion('https://share.capapp.co/favicon-16x16.png');
    const appleTouchIconUrl = withAssetVersion('https://share.capapp.co/apple-touch-icon.png');
    const durationLabel =
      typeof videoDuration === 'number' && Number.isFinite(videoDuration) && videoDuration > 0
        ? `${Math.max(1, Math.round(videoDuration))}s`
        : '';

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

    // Always use summary_large_image for X/Twitter. `player` cards require
    // stricter platform allow-listing and can cause click-through to open the
    // raw media URL inside the in-app viewer instead of the share page URL.
    const twitterCardTags = `
  <meta name="twitter:card" content="summary_large_image">`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${pageUrl}">
  ${capappStoryUrl ? `<meta property="al:web:url" content="${capappStoryUrl}">` : ''}

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
  <meta property="og:image:secure_url" content="${imageUrl}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${title}">
  <meta property="og:url" content="${pageUrl}">
  ${videoMetaTags}
  <meta property="og:site_name" content="Capsule">
  <meta property="og:locale" content="en_US">
  ${process.env.FACEBOOK_APP_ID ? `<meta property="fb:app_id" content="${escapeHtml(process.env.FACEBOOK_APP_ID)}">` : ''}
  
  <!-- Twitter Card Meta Tags -->
  ${twitterCardTags}
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">
  <meta name="twitter:url" content="${pageUrl}">
  
  <style>
    :root {
      --bg: #0c0d13;
      --text: #F8FAFC;
      --muted: #A8B3C7;
      --card-bg: rgba(255, 255, 255, 0.06);
      --media-bg: rgba(255, 255, 255, 0.08);
      --primary: #FFFFFF;
      --primary-text: #111827;
      --secondary: rgba(255, 255, 255, 0.20);
      --secondary-text: #FFFFFF;
      --line: rgba(255, 255, 255, 0.14);
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #F8FAFC;
        --text: #0F172A;
        --muted: #475569;
        --card-bg: #FFFFFF;
        --media-bg: #EEF2FF;
        --primary: #111827;
        --primary-text: #FFFFFF;
        --secondary: #E2E8F0;
        --secondary-text: #111827;
        --line: #E2E8F0;
      }
    }
    html { color-scheme: light dark; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(1200px 680px at 20% -10%, rgba(138, 92, 246, 0.30), transparent 62%),
        radial-gradient(980px 620px at 85% 120%, rgba(59, 130, 246, 0.28), transparent 58%),
        var(--bg);
      color: var(--text);
    }
    .wrap {
      max-width: 540px;
      margin: 0 auto;
      padding: 22px 16px 28px;
    }
    .brand {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin: 2px 0 14px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.2px;
    }
    .brand img {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      display: block;
    }
    .card {
      border-radius: 18px;
      background: var(--card-bg);
      border: 1px solid var(--line);
      box-shadow: 0 16px 40px rgba(2, 8, 23, 0.28);
      overflow: hidden;
      backdrop-filter: blur(8px);
    }
    .media {
      position: relative;
      aspect-ratio: 16 / 9;
      background: var(--media-bg);
      overflow: hidden;
    }
    .media img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .media::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgba(2, 6, 23, 0.40), rgba(2, 6, 23, 0.04));
      pointer-events: none;
    }
    .pill {
      position: absolute;
      z-index: 2;
      top: 10px;
      right: 10px;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 700;
      color: #F8FAFC;
      background: rgba(15, 23, 42, 0.60);
      border: 1px solid rgba(255, 255, 255, 0.26);
      backdrop-filter: blur(2px);
    }
    .content {
      padding: 16px;
    }
    .eyebrow {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.45px;
      font-weight: 700;
      color: var(--muted);
      margin: 0 0 8px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 24px;
      line-height: 1.12;
      font-weight: 800;
      color: var(--text);
    }
    .desc {
      margin: 0 0 12px;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.45;
    }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 6px 0;
      border-top: 1px solid var(--line);
      font-size: 13px;
    }
    .row .k { color: var(--muted); }
    .row .v {
      color: var(--text);
      text-align: right;
      word-break: break-word;
      font-weight: 600;
    }
    .btn {
      display: flex;
      width: 100%;
      box-sizing: border-box;
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 15px;
      font-weight: 800;
      text-decoration: none;
      align-items: center;
      justify-content: center;
      margin-top: 10px;
      border: 0;
      cursor: pointer;
      min-width: 0;
    }
    .btn-primary {
      background: var(--primary);
      color: var(--primary-text);
    }
    .btn-secondary {
      background: var(--secondary);
      color: var(--secondary-text);
    }
    .link {
      display: inline-block;
      margin-top: 14px;
      color: var(--text);
      text-decoration: underline;
      opacity: 0.92;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">
      <img src="${appleTouchIconUrl}" alt="Capsule">
      <span>Capsule Story Share</span>
    </div>
    <div class="card">
      <div class="media">
        <img src="${imageUrl}" alt="${title}" loading="eager" referrerpolicy="no-referrer">
        <div class="pill">${isVideo ? `Video${durationLabel ? ` • ${durationLabel}` : ''}` : 'Story'}</div>
      </div>
      <div class="content">
        <div class="eyebrow">Story preview</div>
        <h1>${title}</h1>
        <p class="desc">${description}</p>
        <div class="row">
          <div class="k">Shared via</div>
          <div class="v">share.capapp.co</div>
        </div>
        <div class="row">
          <div class="k">Open on web</div>
          <div class="v">capapp.co/story</div>
        </div>
        <a id="openAppBtn" class="btn btn-primary" href="${appDeepLink}">Open in Capsule</a>
        <a id="storeBtn" class="btn btn-secondary" href="${IOS_APP_STORE}">Download Capsule</a>
        <a class="link" href="${webFallbackUrl}">Continue in browser</a>
      </div>
    </div>
  </div>
  <script>
    (function() {
      var deepLink = ${JSON.stringify(appDeepLink)};
      var iosStore = ${JSON.stringify(IOS_APP_STORE)};
      var androidStore = ${JSON.stringify(ANDROID_PLAY_STORE)};
      var ua = navigator.userAgent || '';
      var isAndroid = /Android/i.test(ua);
      var isIOS = /iPhone|iPad|iPod/i.test(ua);
      var storeUrl = isAndroid ? androidStore : iosStore;

      var storeBtn = document.getElementById('storeBtn');
      if (storeBtn) {
        storeBtn.setAttribute('href', storeUrl);
      }

      var openAppBtn = document.getElementById('openAppBtn');
      if (openAppBtn) {
        openAppBtn.addEventListener('click', function(event) {
          event.preventDefault();
          // Keep app launch on explicit user gesture for iOS reliability.
          var startedAt = Date.now();
          window.location.href = deepLink;
          setTimeout(function() {
            // If app does not foreground quickly, fall back to store.
            if (Date.now() - startedAt < 2200) {
              window.location.href = storeUrl;
            }
          }, isIOS ? 1400 : 1100);
        });
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
