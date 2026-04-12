import type { VercelRequest, VercelResponse } from '@vercel/node';

function isPreviewBot(userAgent: string): boolean {
  const ua = userAgent.trim().toLowerCase();
  if (!ua) return false;
  return /(bot|crawler|spider|facebookexternalhit|facebot|twitterbot|slackbot|linkedinbot|discordbot|whatsapp|telegrambot|applebot|googlebot|bingbot|duckduckbot|embedly|quora link preview|pinterest|vkshare|skimlinks|xing-contenttabreceiver)/i.test(
    ua,
  );
}

// Universal-link-only entrypoint:
// - This route never renders HTML.
// - Installed devices should hand off directly to the app via universal links.
// - Interactive requests intentionally do NOT redirect to avoid browser/app race chains.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { storyId } = req.query;
  if (!storyId || Array.isArray(storyId)) {
    return res.status(400).send('Invalid storyId');
  }

  const normalized = String(storyId).trim();
  if (!normalized) {
    return res.status(400).send('Invalid storyId');
  }

  const uaHeader = req.headers['user-agent'];
  const userAgent = Array.isArray(uaHeader) ? uaHeader.join(' ') : (uaHeader ?? '');

  // Preserve rich previews (iMessage/social crawlers) by allowing crawler traffic
  // to resolve through the explicit story web fallback page.
  if (isPreviewBot(userAgent)) {
    const fallbackPath = `/story/${encodeURIComponent(normalized)}`;
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, fallbackPath);
  }

  // Interactive taps: no redirect chain. If universal-link handoff fails and Safari
  // still lands here, return no-content rather than triggering browser navigation.
  res.setHeader('Cache-Control', 'no-store');
  return res.status(204).send('');
}
