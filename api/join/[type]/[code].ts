import type { VercelRequest, VercelResponse } from '@vercel/node';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function withOnCapsuleSuffix(input: string): string {
  const t = input.trim();
  if (!t) return 'Capsule';
  return t.toLowerCase().endsWith(' on capsule') ? t : `${t} on Capsule`;
}

function safeTrim(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function firstInitial(v: string | null | undefined): string {
  const s = (v ?? '').trim();
  return s.length > 0 ? s[0]!.toUpperCase() : 'C';
}

function formatDate(iso: string | null | undefined): string | null {
  const raw = (iso ?? '').trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function resolveAvatarUrl(params: {
  supabaseUrl: string | null;
  raw: unknown;
}): string {
  const rawStr = safeTrim(params.raw);
  if (!rawStr) return '';
  if (rawStr.startsWith('http://') || rawStr.startsWith('https://')) return rawStr;
  const base = (params.supabaseUrl ?? '').trim().replace(/\/$/, '');
  if (!base) return '';
  let cleaned = rawStr.replace(/^\/+/, '');

  // Normalize common shapes into a path relative to the `avatars` bucket.
  cleaned = cleaned.replace(/^storage\/v1\/object\/public\/avatars\//, '');
  cleaned = cleaned.replace(/^public\/avatars\//, '');
  cleaned = cleaned.replace(/^avatars\//, '');

  // Mirror Flutter's AvatarHelperService.getAvatarUrl: storage.from('avatars').getPublicUrl(cleanPath)
  return `${base}/storage/v1/object/public/avatars/${encodeURI(cleaned)}`;
}

const META_ASSET_VERSION = (process.env.META_ASSET_VERSION ?? '20260315').trim();

function withAssetVersion(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(META_ASSET_VERSION)}`;
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

async function fetchCreatorPreview(params: {
  userId: string;
}): Promise<{
  displayName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
} | null> {
  const env = getSupabaseEnv();
  if (!env) return null;

  const url =
    `${env.url.replace(/\/$/, '')}/rest/v1/user_profiles` +
    `?id=eq.${encodeURIComponent(params.userId)}` +
    `&select=display_name,username,avatar_url,bio` +
    `&limit=1`;

  try {
    const r = await fetch(url, {
      headers: {
        apikey: env.apiKey,
        Authorization: `Bearer ${env.apiKey}`,
        Accept: 'application/json',
      },
    });
    if (!r.ok) return null;
    const data = (await r.json()) as unknown;
    const row =
      Array.isArray(data) && data.length > 0 && data[0] && typeof data[0] === 'object'
        ? (data[0] as Record<string, unknown>)
        : null;
    if (!row) return null;
    const displayName =
      typeof row.display_name === 'string' ? row.display_name.trim() : null;
    const username = typeof row.username === 'string' ? row.username.trim() : null;
    const avatarUrl =
      typeof row.avatar_url === 'string' ? row.avatar_url.trim() : null;
    const bio = typeof row.bio === 'string' ? row.bio.trim() : null;
    return {
      displayName: displayName && displayName.length > 0 ? displayName : null,
      username: username && username.length > 0 ? username : null,
      avatarUrl: avatarUrl && avatarUrl.length > 0 ? avatarUrl : null,
      bio: bio && bio.length > 0 ? bio : null,
    };
  } catch {
    return null;
  }
}

async function fetchInviteMeta(params: {
  type: 'memory' | 'group';
  inviteCode: string;
}): Promise<{
  inviteName?: string | null;
  creatorId?: string | null;
  createdAt?: string | null;
  expiresAt?: string | null; // memories only
  duration?: string | null; // memories only
  visibility?: string | null; // memories only
  state?: string | null; // memories only
  contributorCount?: number | null; // memories only
  memberCount?: number | null; // groups only
  locationName?: string | null; // memories only (optional)
} | null> {
  const env = getSupabaseEnv();
  if (!env) return null;

  const table = params.type === 'memory' ? 'memories' : 'groups';
  const field = params.type === 'memory' ? 'title' : 'name';
  const select =
    params.type === 'memory'
      ? `${field},creator_id,created_at,expires_at,duration,visibility,state,contributor_count,location_name`
      : `${field},creator_id,created_at,member_count`;

  const url =
    `${env.url.replace(/\/$/, '')}/rest/v1/${table}` +
    `?invite_code=eq.${encodeURIComponent(params.inviteCode)}` +
    `&select=${encodeURIComponent(select)}` +
    `&limit=1`;

  try {
    const r = await fetch(url, {
      headers: {
        apikey: env.apiKey,
        Authorization: `Bearer ${env.apiKey}`,
        Accept: 'application/json',
      },
    });
    if (!r.ok) return null;

    const data = (await r.json()) as unknown;
    const row =
      Array.isArray(data) && data.length > 0 && data[0] && typeof data[0] === 'object'
        ? (data[0] as Record<string, unknown>)
        : null;
    if (!row) return null;

    const rawName = row[field];
    const inviteName =
      typeof rawName === 'string' && rawName.trim().length > 0 ? rawName.trim() : null;
    const creatorId =
      typeof row.creator_id === 'string' && row.creator_id.trim().length > 0
        ? row.creator_id.trim()
        : null;

    const createdAt = typeof row.created_at === 'string' ? row.created_at.trim() : null;
    const expiresAt = typeof row.expires_at === 'string' ? row.expires_at.trim() : null;
    const duration = typeof row.duration === 'string' ? row.duration.trim() : null;
    const visibility = typeof row.visibility === 'string' ? row.visibility.trim() : null;
    const state = typeof row.state === 'string' ? row.state.trim() : null;
    const locationName =
      typeof row.location_name === 'string' ? row.location_name.trim() : null;

    const contributorCountRaw = row.contributor_count;
    const contributorCount =
      typeof contributorCountRaw === 'number'
        ? contributorCountRaw
        : typeof contributorCountRaw === 'string'
          ? Number(contributorCountRaw)
          : null;

    const memberCountRaw = row.member_count;
    const memberCount =
      typeof memberCountRaw === 'number'
        ? memberCountRaw
        : typeof memberCountRaw === 'string'
          ? Number(memberCountRaw)
          : null;

    return {
      inviteName,
      creatorId,
      createdAt,
      expiresAt,
      duration,
      visibility,
      state,
      contributorCount: contributorCount != null && !Number.isNaN(contributorCount) ? contributorCount : null,
      memberCount: memberCount != null && !Number.isNaN(memberCount) ? memberCount : null,
      locationName: locationName && locationName.length > 0 ? locationName : null,
    };
  } catch {
    return null;
  }
}

async function fetchFriendPreview(params: {
  friendCode: string;
}): Promise<{
  displayName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
} | null> {
  const env = getSupabaseEnv();
  if (!env) return null;

  // Use the RPC to bypass any RLS on user_profiles.
  const url = `${env.url.replace(/\/$/, '')}/rest/v1/rpc/get_user_preview_by_friend_code`;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: env.apiKey,
        Authorization: `Bearer ${env.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ p_friend_code: params.friendCode }),
    });

    if (!r.ok) return null;
    const data = (await r.json()) as unknown;

    // PostgREST can return either an object or a 1-element array depending on
    // function definition/call behavior; accept both.
    const row: Record<string, unknown> | null =
      data && typeof data === 'object' && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : Array.isArray(data) && data.length > 0 && data[0] && typeof data[0] === 'object'
          ? (data[0] as Record<string, unknown>)
          : null;

    if (!row) return null;

    const displayName = typeof row.display_name === 'string' ? row.display_name.trim() : null;
    const username = typeof row.username === 'string' ? row.username.trim() : null;
    const avatarUrl = typeof row.avatar_url === 'string' ? row.avatar_url.trim() : null;
    const bio = typeof row.bio === 'string' ? row.bio.trim() : null;

    return {
      displayName: displayName && displayName.length > 0 ? displayName : null,
      username: username && username.length > 0 ? username : null,
      avatarUrl: avatarUrl && avatarUrl.length > 0 ? avatarUrl : null,
      bio: bio && bio.length > 0 ? bio : null,
    };
  } catch {
    return null;
  }
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
  const isFriend = t === 'friend';

  const pageUrl = `https://share.capapp.co/join/${t}/${encodeURIComponent(c)}`;
  const appArgument = `capsule://join/${t}/${encodeURIComponent(c)}`;
  const IOS_APP_STORE =
    'https://apps.apple.com/us/app/capsule-shared-memories/id6758107085';
  const IOS_APP_STORE_ID = '6758107085';
  const ANDROID_PLAY_STORE =
    'https://play.google.com/store/apps/details?id=com.capsule.app';

  // Dynamic-ish:
  // - Static OG image
  // - Dynamic title includes actual memory/group name when available
  const inviteMeta =
    isMemory || isGroup ? await fetchInviteMeta({ type: t as 'memory' | 'group', inviteCode: c }) : null;
  const inviteName = inviteMeta?.inviteName ?? null;

  const creatorPreview = inviteMeta?.creatorId
    ? await fetchCreatorPreview({ userId: inviteMeta.creatorId })
    : null;
  const creatorName =
    creatorPreview?.displayName ??
    (creatorPreview?.username ? `@${creatorPreview.username}` : null);
  const supabaseUrl = getSupabaseEnv()?.url ?? null;
  const creatorAvatarUrl = resolveAvatarUrl({
    supabaseUrl,
    raw: creatorPreview?.avatarUrl,
  });
  const creatorBio = (creatorPreview?.bio ?? '').trim();

  const friendPreview = isFriend ? await fetchFriendPreview({ friendCode: c }) : null;
  const friendName =
    friendPreview?.displayName ??
    (friendPreview?.username ? `@${friendPreview.username}` : null);
  const friendAvatarUrl = resolveAvatarUrl({
    supabaseUrl,
    raw: friendPreview?.avatarUrl,
  });
  const friendBio = (friendPreview?.bio ?? '').trim();

  const inviteTypeLabel = isFriend ? 'Friend' : isMemory ? 'Memory' : isGroup ? 'Group' : 'Invite';
  const inviteCreatedLabel = formatDate(inviteMeta?.createdAt) ?? null;
  const inviteExpiresLabel = formatDate(inviteMeta?.expiresAt) ?? null;

  const rawTitle = isFriend
    ? friendName
      ? `You've been invited to add ${friendName}`
      : "You've been invited to add a friend"
    : inviteName
      ? isMemory
        ? `You're invited to join the memory "${inviteName}"`
        : isGroup
          ? `You're invited to join the group "${inviteName}"`
          : `You're invited to join ${inviteName}`
      : isMemory
        ? "You're invited to join a memory"
        : isGroup
          ? "You're invited to join a group"
          : "You're invited to join";

  const title = escapeHtml(withOnCapsuleSuffix(rawTitle));

  const inviteSummary = escapeHtml(
    isFriend
      ? 'Friend invites can only be accepted in the Capsule app.'
      : isMemory
        ? 'Memories are collaborative story timelines—everyone adds moments, then you watch the recap together.'
        : isGroup
          ? 'Groups are private circles inside Capsule—used to share memories and stay connected.'
          : 'This invite is handled inside the Capsule app.',
  );

  const description = escapeHtml(
    isFriend
      ? 'Download Capsule to add this friend, share memories, and post stories together.'
      : inviteName
        ? `Download Capsule to join ${inviteName}, add your stories, and view everyone’s moments in one place.`
        : isMemory
          ? 'Download Capsule to join this memory, add your stories, and view everyone’s moments in one place.'
          : isGroup
            ? 'Download Capsule to join this group and start sharing memories together.'
            : 'Download Capsule to continue.',
  );

  const downloadCta = description;

  const hasAbout =
    !isFriend &&
    Boolean(
      inviteName ||
        inviteCreatedLabel ||
        inviteExpiresLabel ||
        typeof inviteMeta?.memberCount === 'number' ||
        typeof inviteMeta?.contributorCount === 'number' ||
        inviteMeta?.duration,
    );

  // `og:image` is what iMessage/iOS LinkPresentation will prefer for the share preview.
  // Use our dedicated 1200x630 share asset.
  const imageUrl = withAssetVersion('https://share.capapp.co/logo_share.png');
  const faviconUrl = withAssetVersion('https://share.capapp.co/favicon.ico');
  const favicon32Url = withAssetVersion('https://share.capapp.co/favicon-32x32.png');
  const favicon16Url = withAssetVersion('https://share.capapp.co/favicon-16x16.png');
  const appleTouchIconUrl = withAssetVersion('https://share.capapp.co/apple-touch-icon.png');

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
  <link rel="icon" type="image/png" sizes="180x180" href="${appleTouchIconUrl}">
  <link rel="apple-touch-icon" sizes="180x180" href="${appleTouchIconUrl}">
  <link rel="apple-touch-icon-precomposed" sizes="180x180" href="${appleTouchIconUrl}">

  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:secure_url" content="${imageUrl}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Capsule">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Capsule">

  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">

  <!-- iOS Smart App Banner (optional) -->
  <meta name="apple-itunes-app" content="app-id=${IOS_APP_STORE_ID}, app-argument=${escapeHtml(appArgument)}">
  <meta name="color-scheme" content="light dark">

  <style>
    :root {
      /* Capsule theme tokens (dark) - mirrors ThemeHelper DarkModeColors */
      --bg: #0c0d13;
      --text: #F8FAFC;
      --muted: #94A3B8;
      --card-bg: rgba(255, 255, 255, 0.05);
      --avatar-bg: rgba(167, 139, 250, 0.20);
      --primary: #A78BFA;
      --primary-contrast: #0c0d13;
    }
    @media (prefers-color-scheme: light) {
      :root {
        /* Capsule theme tokens (light) - mirrors ThemeHelper LightModeColors */
        --bg: #FFFFFF;
        --text: #1E293B;
        --muted: #475569;
        --card-bg: #F1F5F9;
        --avatar-bg: rgba(124, 58, 237, 0.10);
        --primary: #7C3AED;
        --primary-contrast: #FFFFFF;
      }
    }
    html { color-scheme: light dark; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      background: var(--bg);
      color: var(--text);
    }
    .wrap {
      max-width: 520px;
      margin: 0 auto;
      padding: 28px 18px;
      text-align: center;
    }
    .brand {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin: 4px 0 16px;
    }
    .brand img { width: 28px; height: 28px; border-radius: 8px; }
    .brand .name { font-weight: 900; letter-spacing: 0.2px; }
    .card {
      background: var(--card-bg);
      border-radius: 16px;
      padding: 18px;
      text-align: left;
    }
    .eyebrow {
      font-size: 12px;
      letter-spacing: 0.3px;
      text-transform: uppercase;
      color: var(--muted);
      margin: 0 0 8px;
    }
    .title { font-size: 22px; font-weight: 900; margin: 0 0 8px; line-height: 1.15; }
    .subtitle { font-size: 14px; color: var(--muted); margin: 0 0 14px; line-height: 1.45; }
    .person {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 8px 0;
    }
    .avatar {
      width: 44px;
      height: 44px;
      border-radius: 999px;
      background: var(--avatar-bg);
      overflow: hidden;
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      color: var(--text);
    }
    .avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .who { min-width: 0; }
    .who .n { font-weight: 900; }
    .who .u { color: var(--muted); font-size: 13px; margin-top: 2px; }
    .who .b { color: var(--muted); font-size: 13px; margin-top: 6px; line-height: 1.35; }
    .details {
      display: grid;
      grid-template-columns: 1fr;
      gap: 6px;
      margin-top: 10px;
    }
    .detail {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 4px 0;
      font-size: 13px;
      color: var(--text);
    }
    .detail .k { color: var(--muted); }
    .detail .v { text-align: right; }
.btn {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 100%;
  max-width: 100%;
  box-sizing: border-box;

  border-radius: 12px;
  padding: 12px 14px;
  font-weight: 800;
  text-decoration: none;

  margin: 10px 0 0;

  /* critical overflow protection */
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: break-word;
}
    .primary { background: var(--primary); color: var(--primary-contrast); }
    .fine { font-size: 12px; color: var(--muted); opacity: 0.78; margin-top: 14px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">
      <img src="${imageUrl}" alt="Capsule">
      <div class="name">Capsule</div>
    </div>
    <div class="card">
      <div class="eyebrow">${escapeHtml(inviteTypeLabel)} invite</div>
      <h1 class="title">${title}</h1>
      <p class="subtitle">${inviteSummary}</p>

      ${isFriend ? `
        <div class="person">
          <div class="avatar">
            ${friendAvatarUrl ? `<img src="${escapeHtml(friendAvatarUrl)}" alt="Avatar" onerror="this.style.display='none'; this.parentNode.textContent='${escapeHtml(firstInitial(friendName))}';">` : `${escapeHtml(firstInitial(friendName))}`}
          </div>
          <div class="who">
            <div class="n">${escapeHtml(friendPreview?.displayName ?? friendName ?? 'Friend')}</div>
            ${friendPreview?.username ? `<div class="u">@${escapeHtml(friendPreview.username)}</div>` : ''}
            ${friendBio ? `<div class="b">${escapeHtml(friendBio)}</div>` : ''}
          </div>
        </div>
      ` : `
        <div class="person">
          <div class="avatar">
            ${creatorAvatarUrl ? `<img src="${escapeHtml(creatorAvatarUrl)}" alt="Avatar" onerror="this.style.display='none'; this.parentNode.textContent='${escapeHtml(firstInitial(creatorName ?? ''))}';">` : `${escapeHtml(firstInitial(creatorName ?? ''))}`}
          </div>
          <div class="who">
            <div class="n">${escapeHtml(creatorPreview?.displayName ?? creatorName ?? 'Capsule user')}</div>
            ${creatorPreview?.username ? `<div class="u">@${escapeHtml(creatorPreview.username)}</div>` : ''}
            ${creatorBio ? `<div class="b">${escapeHtml(creatorBio)}</div>` : ''}
          </div>
        </div>
      `}

      ${hasAbout ? `
        <div class="details">
          ${inviteName ? `<div class="detail"><div class="k">Name</div><div class="v">${escapeHtml(inviteName)}</div></div>` : ''}
          ${inviteCreatedLabel ? `<div class="detail"><div class="k">Created</div><div class="v">${escapeHtml(inviteCreatedLabel)}</div></div>` : ''}
          ${inviteExpiresLabel ? `<div class="detail"><div class="k">Expires</div><div class="v">${escapeHtml(inviteExpiresLabel)}</div></div>` : ''}
          ${typeof inviteMeta?.memberCount === 'number' ? `<div class="detail"><div class="k">Members</div><div class="v">${inviteMeta!.memberCount}</div></div>` : ''}
          ${typeof inviteMeta?.contributorCount === 'number' ? `<div class="detail"><div class="k">Contributors</div><div class="v">${inviteMeta!.contributorCount}</div></div>` : ''}
          ${inviteMeta?.duration ? `<div class="detail"><div class="k">Duration</div><div class="v">${escapeHtml(inviteMeta.duration.replace(/_/g, ' '))}</div></div>` : ''}
        </div>
      ` : ''}

      <p class="subtitle" style="margin-top: 14px;">${downloadCta}</p>
      <a class="btn primary" id="downloadBtn" href="${IOS_APP_STORE}">Download Capsule</a>
      <div class="fine">After installing, open this same link again to accept the invite.</div>
    </div>
  </div>
  <script>
    (function() {
      var ios = ${JSON.stringify(IOS_APP_STORE)};
      var android = ${JSON.stringify(ANDROID_PLAY_STORE)};
      function isAndroid(ua) { return /Android/i.test(ua); }
      function isIOS(ua) { return /iPhone|iPad|iPod/i.test(ua); }
      function pickStoreUrl() {
        var ua = navigator.userAgent || '';
        if (isAndroid(ua)) return android;
        if (isIOS(ua)) return ios;
        return ios;
      }
      try {
        var a = document.getElementById('downloadBtn');
        if (a) a.setAttribute('href', pickStoreUrl());
      } catch (e) {}
    })();
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Keep OG fresh-ish while allowing caching.
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
  return res.status(200).send(html);
}

