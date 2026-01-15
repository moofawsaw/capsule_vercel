import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { storyId } = req.query;
  
  if (!storyId || Array.isArray(storyId)) {
    return res.status(400).send('Invalid storyId');
  }

  try {
    // Fetch story data from Supabase edge function
// NEW
const response = await fetch(
  `https://resdvutqgrbbylknaxjp.supabase.co/functions/v1/story-meta?storyId=${storyId}&format=json`
);
    
    let title = "View Story on Capsule";
    let description = "Open in Capsule to view this story";
    let imageUrl = "https://capapp.co/og-default.png";
    const pageUrl = `https://capapp.co/s/${storyId}`;
    
    if (response.ok) {
      const data = await response.json();
      if (data.title) title = data.title;
      if (data.description) description = data.description;
      if (data.imageUrl) imageUrl = data.imageUrl;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="title" content="${title}">
  <meta name="description" content="${description}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:site_name" content="Capsule">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${pageUrl}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">
  <meta property="al:ios:url" content="capsule://story/${storyId}">
  <meta property="al:ios:app_store_id" content="0000000000">
  <meta property="al:ios:app_name" content="Capsule">
  <meta property="al:android:url" content="capsule://story/${storyId}">
  <meta property="al:android:package" content="com.capsule.app">
  <meta property="al:android:app_name" content="Capsule">
  <meta http-equiv="refresh" content="0;url=${pageUrl}">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #0a0a0a; color: white; }
    .loading { text-align: center; }
    a { color: #9333ea; text-decoration: none; }
  </style>
</head>
<body>
  <div class="loading">
    <p>Redirecting to Capsule...</p>
    <p><a href="${pageUrl}">Click here if not redirected</a></p>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).send(html);
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).send('Internal Server Error');
  }
}
