import type { VercelRequest, VercelResponse } from '@vercel/node';

// Universal-link-only entrypoint:
// - This route never renders HTML.
// - Installed devices should hand off directly to the app via universal links.
// - Non-installed devices are redirected to the explicit web fallback page.
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
