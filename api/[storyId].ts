import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { storyId } = req.query;
  
  if (!storyId || Array.isArray(storyId)) {
    return res.status(400).send('Invalid storyId');
  }

  try {
    // Fetch story data from Supabase edge function
    const response = await fetch(
      `https://resdvutqgrbbylknaxjp.supabase.co/functions/v1/story-meta?storyId=${storyId}&format=json`
    );
    
    let title = "View Story on Capsule";
    let description = "Open in Capsule to view this story";
    let imageUrl = "https://capapp.co/og-default.png";
    const pageUrl = `https://capapp.co/story/${storyId}`;
    
    if (response.ok) {
      const data = await response.json();
      if (data.title) title = data.title;
      if (data.description) description = data.description;
      if (data.imageUrl) imageUrl = data.imageUrl;
    }

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
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Capsule">
  
  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">
  
  <!-- App Deep Link Meta Tags -->
  <meta property="al:ios:app_store_id" content="6630382437">
  <meta property="al:ios:app_name" content="Capsule">
  <meta property="al:ios:url" content="capsule://story/${storyId}">
  <meta property="al:android:package" content="app.lovable.capsule">
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
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <p>Opening in Capsule...</p>
    <a href="${pageUrl}" id="fallback">Open in browser</a>
  </div>
  
  <script>
    (function() {
      var storyId = "${storyId}";
      var customScheme = "capsule://story/" + storyId;
      var fallbackUrl = "${pageUrl}";
      var appOpened = false;
      
      // Detect if we're on iOS or Android
      var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      var isAndroid = /Android/i.test(navigator.userAgent);
      
      // Try to open the app via custom scheme
      function tryOpenApp() {
        // Create a hidden iframe to attempt the custom scheme
        // This avoids the "Safari cannot open the page" error
        if (isIOS) {
          // On iOS, use location.href directly but with visibility tracking
          var now = Date.now();
          window.location.href = customScheme;
          
          // If we're still here after 1.5 seconds, app probably isn't installed
          setTimeout(function() {
            if (document.hidden || Date.now() - now > 2000) {
              appOpened = true;
            }
            if (!appOpened) {
              window.location.href = fallbackUrl;
            }
          }, 1500);
        } else if (isAndroid) {
          // On Android, try intent URL first
          var intentUrl = "intent://story/" + storyId + "#Intent;scheme=capsule;package=app.lovable.capsule;end";
          window.location.href = intentUrl;
          
          // Fallback after timeout
          setTimeout(function() {
            if (!document.hidden) {
              window.location.href = fallbackUrl;
            }
          }, 1500);
        } else {
          // Desktop: go directly to web fallback
          window.location.href = fallbackUrl;
        }
      }
      
      // Track visibility changes (app opening causes page to become hidden)
      document.addEventListener("visibilitychange", function() {
        if (document.hidden) {
          appOpened = true;
        }
      });
      
      // Start trying to open the app
      tryOpenApp();
    })();
  </script>
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
