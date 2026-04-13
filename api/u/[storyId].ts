import type { VercelRequest, VercelResponse } from '@vercel/node';

// Universal-link entrypoint.
// When the app is installed, iOS opens the app directly via universal links
// without ever hitting this server. This handler only runs for:
//   1. Link preview fetchers (iMessage, social crawlers, etc.)
//   2. Users who don't have the app installed
// In both cases, redirect to the full story page which serves OG metadata,
// favicons, and a fallback "download the app" UI.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { storyId } = req.query;
  if (!storyId || Array.isArray(storyId)) {
    return res.status(400).send('Invalid storyId');
  }

  const normalized = String(storyId).trim();
  if (!normalized) {
    return res.status(400).send('Invalid storyId');
  }

  const fallbackPath = `/story/${encodeURIComponent(normalized)}`;
  res.setHeader('Cache-Control', 'no-store');
  return res.redirect(302, fallbackPath);
}
