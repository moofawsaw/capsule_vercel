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

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
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

function getSupabaseEnv(): { url: string; apiKey: string } | null {
  const url =
    (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
  const apiKey =
    (process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      '').trim();
  if (!url || !apiKey) return null;
  return { url, apiKey };
}

function resolveAvatarUrl(params: { supabaseUrl: string | null; raw: unknown }): string {
  const value = typeof params.raw === 'string' ? params.raw.trim() : '';
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  const base = (params.supabaseUrl ?? '').trim().replace(/\/$/, '');
  if (!base) return '';
  let cleaned = value.replace(/^\/+/, '');
  cleaned = cleaned.replace(/^storage\/v1\/object\/public\/avatars\//, '');
  cleaned = cleaned.replace(/^public\/avatars\//, '');
  cleaned = cleaned.replace(/^avatars\//, '');
  return `${base}/storage/v1/object/public/avatars/${encodeURI(cleaned)}`;
}

async function fetchStoryCreatorProfile(storyUuid: string): Promise<{
  displayName: string;
  username: string;
  avatarUrl: string;
} | null> {
  if (!isUUID(storyUuid)) return null;
  const env = getSupabaseEnv();
  if (!env) return null;
  const base = env.url.replace(/\/$/, '');
  const headers = {
    apikey: env.apiKey,
    Authorization: `Bearer ${env.apiKey}`,
    Accept: 'application/json',
  };

  // Try relationship query first.
  try {
    const url =
      `${base}/rest/v1/stories` +
      `?id=eq.${encodeURIComponent(storyUuid)}` +
      `&select=contributor_id,user_profiles_public!stories_contributor_id_fkey(display_name,username,avatar_url)` +
      `&limit=1`;
    const r = await fetch(url, { headers });
    if (r.ok) {
      const data = (await r.json()) as unknown;
      const row =
        Array.isArray(data) && data.length > 0 && data[0] && typeof data[0] === 'object'
          ? (data[0] as Record<string, unknown>)
          : null;
      const profile =
        row && row.user_profiles_public && typeof row.user_profiles_public === 'object'
          ? (row.user_profiles_public as Record<string, unknown>)
          : null;
      if (profile) {
        const displayName =
          typeof profile.display_name === 'string' ? profile.display_name.trim() : '';
        const username =
          typeof profile.username === 'string' ? profile.username.trim() : '';
        const avatarUrl = resolveAvatarUrl({
          supabaseUrl: env.url,
          raw: profile.avatar_url,
        });
        if (displayName || username || avatarUrl) {
          return { displayName, username, avatarUrl };
        }
      }
    }
  } catch (_) {}

  return null;
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
      if (data.title) title = decodeHtmlEntities(String(data.title).trim());
      if (data.description) {
        description = decodeHtmlEntities(String(data.description).trim());
      }
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
    const headerDarkLogoUrl = withAssetVersion('https://share.capapp.co/header_darkmode.svg');
    const headerLightLogoUrl = withAssetVersion('https://share.capapp.co/header_lightmode.svg');
    const durationLabel =
      typeof videoDuration === 'number' && Number.isFinite(videoDuration) && videoDuration > 0
        ? `${Math.max(1, Math.round(videoDuration))}s`
        : '';
    const creatorProfile = await fetchStoryCreatorProfile(String(actualStoryId));
    const presenterNameRaw =
      (creatorProfile?.displayName ?? '').trim() ||
      (creatorProfile?.username ?? '').trim() ||
      String(title).replace(/['’]s Story$/i, '').trim() ||
      'Capsule User';
    const presenterName = escapeHtml(presenterNameRaw);
    const presenterHandleRaw =
      (creatorProfile?.username ?? '').trim() ||
      (presenterNameRaw.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'capsule');
    const presenterHandle = escapeHtml(`@${presenterHandleRaw}`);
    const presenterAvatarUrl = (creatorProfile?.avatarUrl ?? '').trim();
    const subtitleText = escapeHtml(
      String(description).replace(/\s+on Capsule$/i, '').trim() || 'Shared from Capsule',
    );
    const escapedTitle = escapeHtml(title);
    const escapedDescription = escapeHtml(description);

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
  <title>${escapedTitle}</title>
  <meta name="description" content="${escapedDescription}">
  <link rel="canonical" href="${pageUrl}">
  ${capappStoryUrl ? `<meta property="al:web:url" content="${capappStoryUrl}">` : ''}

  <!-- Favicon -->
  <link rel="icon" href="${faviconUrl}" sizes="any">
  <link rel="shortcut icon" href="${faviconUrl}">
  <link rel="icon" type="image/png" sizes="32x32" href="${favicon32Url}">
  <link rel="icon" type="image/png" sizes="16x16" href="${favicon16Url}">
  <link rel="apple-touch-icon" sizes="180x180" href="${appleTouchIconUrl}">
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="${escapedTitle}">
  <meta property="og:description" content="${escapedDescription}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:secure_url" content="${imageUrl}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapedTitle}">
  <meta property="og:url" content="${pageUrl}">
  ${videoMetaTags}
  <meta property="og:site_name" content="Capsule">
  <meta property="og:locale" content="en_US">
  ${process.env.FACEBOOK_APP_ID ? `<meta property="fb:app_id" content="${escapeHtml(process.env.FACEBOOK_APP_ID)}">` : ''}
  
  <!-- Twitter Card Meta Tags -->
  ${twitterCardTags}
  <meta name="twitter:title" content="${escapedTitle}">
  <meta name="twitter:description" content="${escapedDescription}">
  <meta name="twitter:image" content="${imageUrl}">
  <meta name="twitter:url" content="${pageUrl}">
  
  <style>
    :root {
      --bg: #0b0d14;
      --text: #f8fafc;
      --muted: #9ca3af;
      --line: rgba(255,255,255,0.14);
      --cta: #b794ff;
      --cta-text: #151622;
      --store: #0c0f18;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      min-height: 100vh;
      background: linear-gradient(180deg, #0b0d14 0%, #0d1020 100%);
      color: var(--text);
    }
    .wrap {
      max-width: 640px;
      margin: 0 auto;
      padding: 24px 16px 28px;
    }
    .brand {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 14px;
    }
    .brand-logo {
      height: 34px;
      width: auto;
      display: block;
    }
    .brand-logo--dark { display: block; }
    .brand-logo--light { display: none; }
    @media (prefers-color-scheme: light) {
      .brand-logo--dark { display: none; }
      .brand-logo--light { display: block; }
    }
    .creator {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .creator .avatar {
      width: 48px;
      height: 48px;
      border-radius: 999px;
      background: #2a3144;
      border: 1px solid rgba(255,255,255,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: 800;
      overflow: hidden;
    }
    .creator .avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .creator .meta {
      min-width: 0;
    }
    .creator .name {
      font-size: 30px;
      line-height: 1.15;
      font-weight: 800;
      margin-bottom: 2px;
    }
    .creator .handle {
      color: var(--muted);
      font-size: 16px;
      line-height: 1.1;
    }
    .subtitle {
      text-align: center;
      color: #cbd5e1;
      font-size: 18px;
      margin: 0 0 12px;
    }
    .media {
      position: relative;
      border-radius: 14px;
      background: #111827;
      overflow: hidden;
      box-shadow: 0 14px 30px rgba(0,0,0,0.35);
    }
    .media video, .media img {
      width: 100%;
      height: auto;
      display: block;
    }
    .actions {
      margin-top: 14px;
    }
    .btn {
      display: flex;
      width: 100%;
      box-sizing: border-box;
      border-radius: 12px;
      padding: 14px 16px;
      font-size: 18px;
      font-weight: 800;
      text-decoration: none;
      align-items: center;
      justify-content: center;
      margin-top: 12px;
      border: 0;
      cursor: pointer;
      min-width: 0;
      white-space: nowrap;
    }
    .btn-primary {
      background: var(--cta);
      color: var(--cta-text);
    }
    .btn-secondary {
      background: var(--store);
      color: #ffffff;
      border: 1px solid var(--line);
      width: calc(50% - 6px);
      margin-top: 0;
      margin-left: 0;
      margin-right: 0;
    }
    .stores {
      display: flex;
      gap: 12px;
      margin-top: 8px;
    }
    .divider {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--muted);
      margin: 12px 0 2px;
      font-size: 13px;
      font-weight: 700;
      justify-content: center;
      letter-spacing: 0.7px;
    }
    .divider::before,
    .divider::after {
      content: '';
      height: 1px;
      width: 130px;
      background: var(--line);
    }
    .link {
      color: #b6bfd2;
      text-align: center;
      margin-top: 12px;
      font-size: 16px;
      line-height: 1.3;
      display: block;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .badge .tri {
      width: 0;
      height: 0;
      border-top: 8px solid transparent;
      border-bottom: 8px solid transparent;
      border-left: 12px solid #fff;
    }
    .badge .txt {
      display: flex;
      flex-direction: column;
      line-height: 1.1;
      align-items: flex-start;
    }
    .badge .txt small {
      font-size: 10px;
      opacity: 0.85;
    }
    .badge .txt b {
      font-size: 15px;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">
      <img class="brand-logo brand-logo--dark" src="${headerDarkLogoUrl}" alt="Capsule">
      <img class="brand-logo brand-logo--light" src="${headerLightLogoUrl}" alt="Capsule">
    </div>
    <div class="creator">
      <div class="avatar">
        ${presenterAvatarUrl
          ? `<img src="${escapeHtml(presenterAvatarUrl)}" alt="${presenterName}" onerror="this.style.display='none'; this.parentNode.textContent='${presenterNameRaw[0] ? escapeHtml(presenterNameRaw[0]!.toUpperCase()) : 'C'}';">`
          : `${presenterNameRaw[0] ? escapeHtml(presenterNameRaw[0]!.toUpperCase()) : 'C'}`}
      </div>
      <div class="meta">
        <div class="name">${presenterName}</div>
        <div class="handle">${presenterHandle}</div>
      </div>
    </div>
    <div class="subtitle">${subtitleText}</div>
    <div class="card">
      <div class="media">
        ${isVideo && videoUrl ? `
        <video controls playsinline preload="metadata" poster="${imageUrl}" src="${videoUrl}">
          <source src="${videoUrl}" type="video/mp4">
        </video>
        ` : `
        <img src="${imageUrl}" alt="${escapedTitle}" loading="eager" referrerpolicy="no-referrer">
        `}
      </div>
      <div class="actions">
        <a id="openAppBtn" class="btn btn-primary" href="${appDeepLink}">Open in Capsule App</a>
        <div class="divider">DON'T HAVE THE APP?</div>
        <div class="stores">
          <a id="playStoreBtn" class="btn btn-secondary" href="${ANDROID_PLAY_STORE}">
            <span class="badge">
              <span class="tri"></span>
              <span class="txt">
                <small>Get it on</small>
                <b>Google Play</b>
              </span>
            </span>
          </a>
          <a id="appStoreBtn" class="btn btn-secondary" href="${IOS_APP_STORE}">
            <span class="badge">
              <span class="txt">
                <small>Download on the</small>
                <b>App Store</b>
              </span>
            </span>
          </a>
        </div>
        <a class="link" href="${webFallbackUrl}">View this story and more moments in the Capsule app</a>
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

      var appStoreBtn = document.getElementById('appStoreBtn');
      var playStoreBtn = document.getElementById('playStoreBtn');
      if (appStoreBtn) {
        appStoreBtn.setAttribute('href', iosStore);
      }
      if (playStoreBtn) {
        playStoreBtn.setAttribute('href', androidStore);
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
