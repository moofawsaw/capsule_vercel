import type { VercelRequest, VercelResponse } from '@vercel/node';

// Add this helper function
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { storyId } = req.query;
  
  if (!storyId || Array.isArray(storyId)) {
    return res.status(400).send('Invalid storyId');
  }

  try {
    const response = await fetch(
      `https://resdvutqgrbbylknaxjp.supabase.co/functions/v1/story-meta?storyId=${storyId}&format=json`
    );
    
    let title = "View Story on Capsule";
    let description = "Open in Capsule to view this story";
    let imageUrl = "https://capapp.co/og-default.png";
    let videoUrl: string | null = null;
    let isVideo = false;
    let videoDuration: number | null = null;
    const pageUrl = `https://capapp.co/story/${storyId}`;
    
    if (response.ok) {
      const data = await response.json();
      if (data.title) title = escapeHtml(data.title);
      if (data.description) description = escapeHtml(data.description);
      if (data.imageUrl) imageUrl = data.imageUrl;
      if (data.isVideo) isVideo = data.isVideo;
      if (data.videoUrl) videoUrl = data.videoUrl;
      if (data.videoDuration) videoDuration = data.videoDuration;
    }

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

    const twitterCardTags = isVideo && videoUrl ? `
  <meta name="twitter:card" content="player">
  <meta name="twitter:player" content="${videoUrl}">
  <meta name="twitter:player:width" content="720">
  <meta name="twitter:player:height" content="1280">` : `
  <meta name="twitter:card" content="summary_large_image">`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:url" content="${pageUrl}">
  ${videoMetaTags}
  <meta property="og:site_name" content="Capsule">
  
  <!-- Twitter Card Meta Tags -->
  ${twitterCardTags}
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">
  
  <!-- App Deep Link Meta Tags -->
  <meta property="al:ios:app_store_id" content="6630382437">
  <meta property="al:ios:app_name" content="Capsule">
  <meta property="al:ios:url" content="capsule://story/${storyId}">
  <meta property="al:android:package" content="com.capsule.app">
  <meta property="al:android:app_name" content="Capsule">
  <meta property="al:android:url" content="capsule://story/${storyId}">
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
    }
    .container { padding: 20px; }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    a {
      color: white;
      text-decoration: underline;
      margin-top: 10px;
      display: inline-block;
    }
  </style>
  
  <script>
    const deepLink = "capsule://story/${storyId}";
    const fallbackUrl = "https://capsuleapp.lovable.app/story/${storyId}";
    
    window.onload = function() {
      window.location.href = deepLink;
      setTimeout(() => { window.location.href = fallbackUrl; }, 1500);
    };
  </script>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <p>Opening in Capsule...</p>
    <a href="https://capsuleapp.lovable.app/story/${storyId}">Open in browser</a>
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
