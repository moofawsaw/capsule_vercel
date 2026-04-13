import type { VercelRequest, VercelResponse } from '@vercel/node';

function getSingleQueryParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return (value[0] ?? '').trim();
  return (value ?? '').trim();
}

function isAllowedImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'capapp.co' ||
    host.endsWith('.capapp.co') ||
    host === 'supabase.co' ||
    host.endsWith('.supabase.co')
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const rawUrl = getSingleQueryParam(req.query.url);
    if (!rawUrl) return res.status(400).send('Missing url');

    let sourceUrl: URL;
    try {
      sourceUrl = new URL(rawUrl);
    } catch (_) {
      return res.status(400).send('Invalid url');
    }

    if (sourceUrl.protocol !== 'https:') {
      return res.status(400).send('Only https urls are allowed');
    }

    if (!isAllowedImageHost(sourceUrl.hostname)) {
      return res.status(403).send('Host is not allowed');
    }

    const upstream = await fetch(sourceUrl.toString(), {
      redirect: 'follow',
      headers: {
        // Encourage image CDNs to return an image response quickly.
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });

    if (!upstream.ok) {
      return res.status(502).send('Unable to fetch image');
    }

    const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) {
      return res.status(415).send('Upstream resource is not an image');
    }

    const body = Buffer.from(await upstream.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Avoid restrictive robots directives that can suppress social preview images.
    res.setHeader('X-Robots-Tag', 'all');
    return res.status(200).send(body);
  } catch (_) {
    return res.status(500).send('Proxy error');
  }
}
