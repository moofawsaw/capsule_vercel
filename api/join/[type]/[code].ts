import type { VercelRequest, VercelResponse } from '@vercel/node';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
  const cleaned = rawStr.replace(/^\/+/, '');
  // Assume the stored value already contains bucket/path (e.g. "avatars/....png")
  return `${base}/storage/v1/object/public/${encodeURI(cleaned)}`;
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

  const title = escapeHtml(
    isFriend
      ? friendName
        ? `You’ve been invited to add ${friendName}`
        : 'You’ve been invited to add a friend'
      : inviteName
        ? `You’re invited to join ${inviteName}`
        : isMemory
          ? 'You’re invited to join a memory'
          : isGroup
            ? 'You’re invited to join a group'
            : 'You’re invited to join',
  );

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

  const detailLine = escapeHtml(
    (isMemory || isGroup) && (creatorName ?? '').trim().length > 0
      ? `From ${creatorName ?? ''}`
      : '',
  );

  const firstWhyBullet = escapeHtml(
    isFriend
      ? 'Accept this friend invite and connect instantly.'
      : isMemory
        ? 'Join this memory and add your own story moments.'
        : isGroup
          ? 'Join this group to share and receive memories with the crew.'
          : 'Accept this invite and continue inside Capsule.',
  );

  const hasAbout =
    !isFriend &&
    Boolean(
      inviteName ||
        inviteCreatedLabel ||
        inviteExpiresLabel ||
        typeof inviteMeta?.memberCount === 'number' ||
        typeof inviteMeta?.contributorCount === 'number' ||
        inviteMeta?.visibility ||
        inviteMeta?.duration ||
        inviteMeta?.locationName,
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
      background: radial-gradient(1000px 600px at 20% 0%, rgba(167,139,250,0.30), transparent 55%),
                  radial-gradient(900px 520px at 80% 40%, rgba(129,73,223,0.22), transparent 60%),
                  #0c0d13;
      color: #F8FAFC;
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
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.10);
      border-radius: 16px;
      padding: 18px;
      text-align: left;
    }
    .topRow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 10px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(255,255,255,0.06);
      font-size: 12px;
      color: rgba(248,250,252,0.88);
      white-space: nowrap;
    }
    .title { font-size: 20px; font-weight: 900; margin: 0 0 6px; line-height: 1.18; }
    .meta { font-size: 13px; color: rgba(248,250,252,0.72); margin: 0 0 10px; }
    .desc { font-size: 14px; color: rgba(248,250,252,0.80); margin: 0 0 14px; line-height: 1.45; }
    .sectionTitle { font-size: 12px; letter-spacing: 0.3px; text-transform: uppercase; color: rgba(248,250,252,0.58); margin: 14px 0 8px; }
    .inviter {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 12px;
      border-radius: 14px;
      background: rgba(0,0,0,0.20);
      border: 1px solid rgba(255,255,255,0.10);
    }
    .avatar {
      width: 44px;
      height: 44px;
      border-radius: 999px;
      background: rgba(167,139,250,0.25);
      border: 1px solid rgba(255,255,255,0.14);
      overflow: hidden;
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      color: rgba(248,250,252,0.92);
    }
    .avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .inviter .who { min-width: 0; }
    .inviter .who .n { font-weight: 900; }
    .inviter .who .u { color: rgba(248,250,252,0.72); font-size: 13px; margin-top: 2px; }
    .inviter .who .b { color: rgba(248,250,252,0.68); font-size: 13px; margin-top: 6px; line-height: 1.35; }
    .details {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
      margin-top: 10px;
    }
    .detail {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.10);
      font-size: 13px;
      color: rgba(248,250,252,0.84);
    }
    .detail .k { color: rgba(248,250,252,0.62); }
    .detail .v { text-align: right; }
    .why ul { margin: 8px 0 0; padding-left: 18px; color: rgba(248,250,252,0.78); }
    .why li { margin: 6px 0; line-height: 1.35; }
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
    <div class="brand">
      <img src="https://share.capapp.co/apple-touch-icon.png" alt="Capsule">
      <div class="name">Capsule</div>
    </div>
    <div class="card">
      <div class="topRow">
        <div class="chip">${escapeHtml(inviteTypeLabel)}</div>
        ${inviteCreatedLabel ? `<div class="chip">Created ${escapeHtml(inviteCreatedLabel)}</div>` : ''}
      </div>
      <h1 class="title">${title}</h1>
      ${detailLine ? `<div class="meta">${detailLine}</div>` : ''}
      <p class="desc">${inviteSummary}</p>

      ${isFriend ? `
        <div class="inviter" style="margin-top: 10px;">
          <div class="avatar">
            ${friendAvatarUrl ? `<img src="${escapeHtml(friendAvatarUrl)}" alt="Avatar">` : `${escapeHtml(firstInitial(friendName))}`}
          </div>
          <div class="who">
            <div class="n">${escapeHtml(friendPreview?.displayName ?? friendName ?? 'Friend')}</div>
            ${friendPreview?.username ? `<div class="u">@${escapeHtml(friendPreview.username)}</div>` : ''}
            ${friendBio ? `<div class="b">${escapeHtml(friendBio)}</div>` : ''}
          </div>
        </div>
      ` : `
        <div class="sectionTitle">Invited by</div>
        <div class="inviter">
          <div class="avatar">
            ${creatorAvatarUrl ? `<img src="${escapeHtml(creatorAvatarUrl)}" alt="Avatar">` : `${escapeHtml(firstInitial(creatorName ?? ''))}`}
          </div>
          <div class="who">
            <div class="n">${escapeHtml(creatorPreview?.displayName ?? creatorName ?? 'Capsule user')}</div>
            ${creatorPreview?.username ? `<div class="u">@${escapeHtml(creatorPreview.username)}</div>` : ''}
            ${creatorBio ? `<div class="b">${escapeHtml(creatorBio)}</div>` : ''}
          </div>
        </div>
      `}

      ${hasAbout ? `
        <div class="sectionTitle">About this ${escapeHtml(inviteTypeLabel.toLowerCase())}</div>
        <div class="details">
          ${inviteName ? `<div class="detail"><div class="k">Name</div><div class="v">${escapeHtml(inviteName)}</div></div>` : ''}
          ${inviteCreatedLabel ? `<div class="detail"><div class="k">Created</div><div class="v">${escapeHtml(inviteCreatedLabel)}</div></div>` : ''}
          ${inviteExpiresLabel ? `<div class="detail"><div class="k">Expires</div><div class="v">${escapeHtml(inviteExpiresLabel)}</div></div>` : ''}
          ${typeof inviteMeta?.memberCount === 'number' ? `<div class="detail"><div class="k">Members</div><div class="v">${inviteMeta!.memberCount}</div></div>` : ''}
          ${typeof inviteMeta?.contributorCount === 'number' ? `<div class="detail"><div class="k">Contributors</div><div class="v">${inviteMeta!.contributorCount}</div></div>` : ''}
          ${inviteMeta?.visibility ? `<div class="detail"><div class="k">Visibility</div><div class="v">${escapeHtml(inviteMeta.visibility)}</div></div>` : ''}
          ${inviteMeta?.duration ? `<div class="detail"><div class="k">Duration</div><div class="v">${escapeHtml(inviteMeta.duration.replace(/_/g, ' '))}</div></div>` : ''}
          ${inviteMeta?.locationName ? `<div class="detail"><div class="k">Location</div><div class="v">${escapeHtml(inviteMeta.locationName)}</div></div>` : ''}
        </div>
      ` : ''}

      <div class="sectionTitle">Why download Capsule?</div>
      <div class="why">
        <ul>
          <li>${firstWhyBullet}</li>
          <li>Create and watch stories with friends in one place—private by default.</li>
          <li>Get notifications when new moments are added so you never miss the recap.</li>
        </ul>
      </div>

      <div class="sectionTitle">Next steps</div>
      <p class="desc">Download Capsule, then open this same link again. If you don’t have an account yet, you’ll create one in seconds.</p>
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

