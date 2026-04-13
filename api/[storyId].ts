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

function isLikelyImageUrl(input: string): boolean {
  const value = (input ?? '').trim().toLowerCase();
  if (!value) return false;
  return /\.(avif|gif|jpe?g|png|webp)(?:[?#].*)?$/.test(value);
}

function extractUrlOrigin(input: string): string | null {
  const value = (input ?? '').trim();
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.origin;
  } catch (_) {
    return null;
  }
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
    const defaultSocialImage = 'https://capapp.co/og-default.png';
    const mediaOrigin = extractUrlOrigin(videoUrl ?? imageUrl) || '';
    const derivedVideoThumb =
      mediaOrigin && isUUID(String(actualStoryId))
        ? `${mediaOrigin}/storage/v1/object/public/story-media/thumbnails/${actualStoryId}.jpg`
        : '';
    const selectedSocialImageSource = isLikelyImageUrl(imageUrl)
      ? imageUrl
      : (derivedVideoThumb || defaultSocialImage);
    const socialImageUrl =
      `https://share.capapp.co/api/og-image?url=${encodeURIComponent(selectedSocialImageSource)}`;

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
    const IOS_APP_STORE_ID = '6758107085';
    const IOS_BUNDLE_ID = 'com.capapp.capsule';
    const IOS_APP_NAME = 'Capsule';
    const ANDROID_PACKAGE = 'com.capsule.app';
    const ANDROID_APP_NAME = 'Capsule';
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
    const subtitleRaw =
      String(description).replace(/\s+on Capsule$/i, '').trim() || 'Shared from Capsule';
    const subtitleText = escapeHtml(subtitleRaw);
    const clampMeta = (input: string, max: number): string => {
      const normalized = input.trim();
      if (normalized.length <= max) return normalized;
      return `${normalized.slice(0, Math.max(1, max - 1)).trimEnd()}\u2026`;
    };
    const titleContextRaw =
      subtitleRaw && !/^shared from capsule$/i.test(subtitleRaw)
        ? `${presenterNameRaw} \u2022 ${subtitleRaw}`
        : `${presenterNameRaw} shared a story`;
    const socialTitleRaw = clampMeta(
      `${titleContextRaw}${durationLabel ? ` (${durationLabel})` : ''}`,
      90,
    );
    const socialDescriptionRaw = clampMeta(
      isVideo
        ? `Watch ${presenterNameRaw}'s story on Capsule${durationLabel ? ` (${durationLabel})` : ''}.`
        : `View ${presenterNameRaw}'s story on Capsule.`,
      170,
    );
    const escapedTitle = escapeHtml(title);
    const escapedSocialTitle = escapeHtml(socialTitleRaw);
    const escapedSocialDescription = escapeHtml(socialDescriptionRaw);

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

    // Use `summary` for video stories because portrait video thumbnails are often
    // suppressed by X with `summary_large_image`. Keep large cards for images.
    // We intentionally avoid `player` cards to prevent click-through to raw media.
    const twitterCardTags = `
  <meta name="twitter:card" content="${isVideo ? 'summary' : 'summary_large_image'}">`;
    const appLinksMetaTags = `
  <meta property="al:ios:url" content="${escapeHtml(appDeepLink)}">
  <meta property="al:ios:app_store_id" content="${IOS_APP_STORE_ID}">
  <meta property="al:ios:app_name" content="${IOS_APP_NAME}">
  <meta property="al:ios:bundle_id" content="${IOS_BUNDLE_ID}">
  <meta property="al:android:url" content="${escapeHtml(appDeepLink)}">
  <meta property="al:android:package" content="${ANDROID_PACKAGE}">
  <meta property="al:android:app_name" content="${ANDROID_APP_NAME}">
  <meta property="al:web:url" content="${pageUrl}">
  <meta property="al:web:should_fallback" content="true">`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapedTitle}</title>
  <meta name="description" content="${escapedSocialDescription}">
  <link rel="canonical" href="${pageUrl}">
  ${appLinksMetaTags}
  <meta name="apple-itunes-app" content="app-id=${IOS_APP_STORE_ID}, app-argument=${escapeHtml(appDeepLink)}">

  <!-- Favicon -->
  <link rel="icon" href="${faviconUrl}" sizes="any">
  <link rel="shortcut icon" href="${faviconUrl}">
  <link rel="icon" type="image/png" sizes="32x32" href="${favicon32Url}">
  <link rel="icon" type="image/png" sizes="16x16" href="${favicon16Url}">
  <link rel="apple-touch-icon" sizes="180x180" href="${appleTouchIconUrl}">
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="${escapedSocialTitle}">
  <meta property="og:description" content="${escapedSocialDescription}">
  <meta property="og:image" content="${socialImageUrl}">
  <meta property="og:image:secure_url" content="${socialImageUrl}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapedSocialTitle}">
  <meta property="og:url" content="${pageUrl}">
  ${videoMetaTags}
  <meta property="og:site_name" content="Capsule">
  <meta property="og:locale" content="en_US">
  ${process.env.FACEBOOK_APP_ID ? `<meta property="fb:app_id" content="${escapeHtml(process.env.FACEBOOK_APP_ID)}">` : ''}
  
  <!-- Twitter Card Meta Tags -->
  ${twitterCardTags}
  <meta name="twitter:title" content="${escapedSocialTitle}">
  <meta name="twitter:description" content="${escapedSocialDescription}">
  <meta name="twitter:image" content="${socialImageUrl}">
  <meta name="twitter:url" content="${pageUrl}">
  <meta name="twitter:app:name:iphone" content="${IOS_APP_NAME}">
  <meta name="twitter:app:id:iphone" content="${IOS_APP_STORE_ID}">
  <meta name="twitter:app:url:iphone" content="${escapeHtml(appDeepLink)}">
  <meta name="twitter:app:name:googleplay" content="${ANDROID_APP_NAME}">
  <meta name="twitter:app:id:googleplay" content="${ANDROID_PACKAGE}">
  <meta name="twitter:app:url:googleplay" content="${escapeHtml(appDeepLink)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&display=swap" rel="stylesheet">
  
  <style>
    html {
      height: 100%;
    }
    :root {
      --bg: #0b0d14;
      --text: #f8fafc;
      --muted: #9ca3af;
      --line: rgba(255,255,255,0.14);
      --cta: #a78bfa;
      --cta-text: #ffffff;
      --store: #0c0f18;
    }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      min-height: 100dvh;
      background: linear-gradient(180deg, #0b0d14 0%, #0d1020 100%);
      color: var(--text);
      overflow-x: hidden;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    .wrap {
      max-width: 640px;
      margin: 0 auto;
      min-height: 100dvh;
      box-sizing: border-box;
      padding: 16px 14px 14px;
      display: flex;
      flex-direction: column;
    }
    .header {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 6px;
      align-items: center;
    }
    .brand {
      display: flex;
      justify-content: center;
      align-items: center;
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
      gap: 10px;
      padding: 6px 8px;
      border-radius: 12px;
      background: transparent;
      border: none;
    }
    .creator .avatar {
      width: 44px;
      height: 44px;
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
      text-align: left;
    }
    .creator .name {
      font-size: 20px;
      line-height: 1.2;
      font-weight: 800;
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .creator .handle {
      color: var(--muted);
      font-size: 14px;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .subtitle {
      text-align: center;
      color: #cbd5e1;
      font-size: 14px;
      line-height: 1.35;
      margin: 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .card {
      display: flex;
      flex-direction: column;
      min-height: 0;
      flex: 1;
    }
    .media {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 14px;
      background: #111827;
      overflow: hidden;
      box-shadow: 0 14px 30px rgba(0,0,0,0.35);
      flex: 1;
      min-height: 0;
      max-height: min(44dvh, calc(100dvh - 360px));
    }
    .media video, .media img {
      width: auto;
      height: auto;
      max-width: 100%;
      max-height: 100%;
      display: block;
      object-fit: contain;
      object-position: center center;
      background: #111827;
    }
    .actions {
      margin-top: 10px;
    }
    .btn {
      display: flex;
      width: 100%;
      box-sizing: border-box;
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 17px;
      font-weight: 800;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      text-decoration: none;
      align-items: center;
      justify-content: center;
      margin-top: 10px;
      border: 0;
      cursor: pointer;
      min-width: 0;
      white-space: nowrap;
    }
    .btn-primary {
      min-height: 56px;
      border-radius: 6px;
      padding: 12px 16px;
      font-size: 16px;
      font-weight: 700;
      line-height: 1;
      background: var(--cta);
      color: var(--cta-text);
      box-shadow: none;
    }
    @media (max-height: 740px) {
      .wrap {
        padding-top: 12px;
        padding-bottom: 12px;
      }
      .header {
        gap: 6px;
      }
      .brand-logo {
        height: 30px;
      }
      .creator .avatar {
        width: 40px;
        height: 40px;
      }
      .creator .name {
        font-size: 18px;
      }
      .subtitle {
        font-size: 13px;
      }
      .media {
        max-height: min(40dvh, calc(100dvh - 330px));
      }
      .btn-primary {
        min-height: 50px;
        font-size: 16px;
      }
    }
    @media (prefers-color-scheme: light) {
      :root {
        --cta: #7c3aed;
        --cta-text: #ffffff;
      }
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
      gap: 10px;
      margin-top: 5px;
    }
    .divider {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--muted);
      margin: 7px 0 2px;
      font-size: 12px;
      font-weight: 700;
      justify-content: center;
      text-align: center;
      width: 100%;
      letter-spacing: 0.7px;
    }
    .divider::before,
    .divider::after {
      content: '';
      height: 1px;
      flex: 1;
      max-width: 130px;
      background: var(--line);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .badge-icon {
      width: 18px;
      height: 18px;
      flex: 0 0 auto;
      display: block;
    }
    .badge-icon--apple {
      width: 16px;
      height: 16px;
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
  <!-- Keep canonical capapp story URL in markup for legacy Android resolvers,
       without using it as the App Links web click target. -->
  <a href="${webFallbackUrl}" style="display:none" aria-hidden="true" tabindex="-1">Open Capsule story</a>
  <div class="wrap">
    <div class="header">
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
    </div>
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
              <svg class="badge-icon badge-icon--play" viewBox="0 0 512 512" aria-hidden="true" focusable="false">
                <path d="M28 22l255 235L92 345c-16 8-34-3-34-21z" fill="#34A853"></path>
                <path d="M283 257l82 75-247 145c-7 4-15 5-22 2l187-222z" fill="#FBBC04"></path>
                <path d="M283 257l-68-63 6-7L365 102c18-11 40 2 40 23v264c0 21-22 34-40 23l-82-75z" fill="#4285F4"></path>
                <path d="M28 22c0-18 18-29 34-21l159 93-6 7-68 63L28 22z" fill="#EA4335"></path>
              </svg>
              <span class="txt">
                <small>Get it on</small>
                <b>Google Play</b>
              </span>
            </span>
          </a>
          <a id="appStoreBtn" class="btn btn-secondary" href="${IOS_APP_STORE}">
            <span class="badge">
              <svg class="badge-icon badge-icon--apple" viewBox="0 0 384 512" aria-hidden="true" focusable="false">
                <path fill="currentColor" d="M318.7 268.2c-.2-50.7 41.4-75.1 43.3-76.2-23.7-34.6-60.7-39.4-73.8-40-31.5-3.2-61.4 18.5-77.4 18.5-16 0-40.6-18.1-66.8-17.6-34.4.5-66.2 20-83.9 50.8-35.8 62.1-9.1 154 25.7 204.3 17 24.5 37.3 52 63.9 51 25.7-1 35.4-16.6 66.5-16.6s39.8 16.6 66.7 16.1c27.6-.5 45.1-25 61.9-49.6 19.5-28.4 27.5-55.9 28-57.3-.6-.2-53.7-20.6-53.1-81.4zM267.8 111.6c14-17 23.5-40.6 20.9-64.1-20.2.8-44.6 13.5-59 30.4-12.9 15-24.2 38.9-21.2 61.8 22.5 1.8 45.4-11.5 59.3-28.1z"></path>
              </svg>
              <span class="txt">
                <small>Download on the</small>
                <b>App Store</b>
              </span>
            </span>
          </a>
        </div>
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
      var isTwitterInApp = /Twitter/i.test(ua);
      var storeUrl = isAndroid ? androidStore : iosStore;
      var launchedViaAutoHandoff = false;

      function attemptTwitterIOSAutoHandoff() {
        if (!isIOS || !isTwitterInApp || launchedViaAutoHandoff) return;
        launchedViaAutoHandoff = true;

        var didHide = false;
        var onVisibility = function() {
          if (document.visibilityState === 'hidden') didHide = true;
        };
        document.addEventListener('visibilitychange', onVisibility, { once: false });
        window.location.href = deepLink;
        setTimeout(function() {
          document.removeEventListener('visibilitychange', onVisibility);
          if (!didHide) {
            // Stay on the fallback page if app launch is blocked by in-app browser policy.
          }
        }, 1400);
      }

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

      // X iOS in-app browser often suppresses universal link handoff; try once.
      attemptTwitterIOSAutoHandoff();
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
