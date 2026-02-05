import type { VercelRequest, VercelResponse } from '@vercel/node';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
}): Promise<{ displayName?: string | null; username?: string | null } | null> {
  const env = getSupabaseEnv();
  if (!env) return null;

  const url =
    `${env.url.replace(/\/$/, '')}/rest/v1/user_profiles` +
    `?id=eq.${encodeURIComponent(params.userId)}` +
    `&select=display_name,username` +
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
    return {
      displayName: displayName && displayName.length > 0 ? displayName : null,
      username: username && username.length > 0 ? username : null,
    };
  } catch {
    return null;
  }
}

async function fetchInviteMeta(params: {
  type: 'memory' | 'group';
  inviteCode: string;
}): Promise<{ inviteName?: string | null; creatorId?: string | null } | null> {
  const env = getSupabaseEnv();
  if (!env) return null;

  const table = params.type === 'memory' ? 'memories' : 'groups';
  const field = params.type === 'memory' ? 'title' : 'name';

  const url =
    `${env.url.replace(/\/$/, '')}/rest/v1/${table}` +
    `?invite_code=eq.${encodeURIComponent(params.inviteCode)}` +
    `&select=${field},creator_id` +
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

    return { inviteName, creatorId };
  } catch {
    return null;
  }
}

async function fetchFriendPreview(params: {
  friendCode: string;
}): Promise<{ displayName?: string | null; username?: string | null } | null> {
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

    return {
      displayName: displayName && displayName.length > 0 ? displayName : null,
      username: username && username.length > 0 ? username : null,
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
  const IOS_APP_STORE = 'https://apps.apple.com/app/id6630382437';
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

  const friendPreview = isFriend ? await fetchFriendPreview({ friendCode: c }) : null;
  const friendName =
    friendPreview?.displayName ??
    (friendPreview?.username ? `@${friendPreview.username}` : null);

  const title = escapeHtml(
    isFriend
      ? friendName
        ? `Add ${friendName} on Capsule`
        : 'Add a friend on Capsule'
      : inviteName
        ? `Tap to join ${inviteName} on Capsule`
        : isMemory
          ? 'Tap to join this memory on Capsule'
          : isGroup
            ? 'Tap to join this group on Capsule'
            : 'Tap to join on Capsule',
  );

  const description = escapeHtml(
    isFriend
      ? 'Download Capsule to add this friend.'
      : inviteName
        ? `Download Capsule to join ${inviteName}.`
        : isMemory
          ? 'Download Capsule to join this memory.'
          : isGroup
            ? 'Download Capsule to join this group.'
            : 'Download Capsule to continue.',
  );

  const downloadCta = description;

  const detailLine = escapeHtml(
    (isMemory || isGroup) && creatorName && creatorName.trim().length > 0
      ? `From ${creatorName}`
      : '',
  );

  // Static OG image (use an existing stable asset; can be replaced later).
  const imageUrl = 'https://capapp.co/og-default.png';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>

  <!-- Favicon -->
  <link rel="icon" href="https://share.capapp.co/favicon.ico" sizes="any">
  <link rel="shortcut icon" href="https://share.capapp.co/favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="https://share.capapp.co/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="https://share.capapp.co/favicon-16x16.png">
  <link rel="apple-touch-icon" sizes="180x180" href="https://share.capapp.co/apple-touch-icon.png">

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
    .meta { font-size: 13px; color: rgba(248,250,252,0.72); margin: 0 0 10px; }
    .desc { font-size: 14px; color: rgba(248,250,252,0.78); margin: 0 0 18px; }
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
    .primary { background: #A78BFA; color: #0c0d13; }
    .secondary { background: transparent; border: 1px solid rgba(255,255,255,0.18); color: #F8FAFC; }
    .fine { font-size: 12px; color: rgba(248,250,252,0.6); margin-top: 14px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1 class="title">${title}</h1>
      ${detailLine ? `<div class="meta">${detailLine}</div>` : ''}
      <p class="desc">${downloadCta}</p>
      <a class="btn primary" id="downloadBtn" href="${IOS_APP_STORE}">Download Capsule</a>
      <div class="fine">Once installed, open this same link again to accept the invite.</div>
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

