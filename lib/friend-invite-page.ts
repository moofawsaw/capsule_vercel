import { friendInviteName, isValidFriendCode } from './friend-invite';

/** The browser gets only the invitation and sender-supplied display copy. */
export function renderFriendInvitePage(code: string, name: unknown): string {
  const config = JSON.stringify({ code, name: friendInviteName(name) })
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  const argument = isValidFriendCode(code)
    ? `, app-argument=https://share.capapp.co/join/friend/${code}` : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<meta name="apple-itunes-app" content="app-id=6758107085${argument}">
<title>Capsule</title><meta property="og:title" content="Capsule">
<meta property="og:image" content="https://share.capapp.co/OG%20image.png">
<link rel="icon" href="/favicon.ico">
<style>
*{box-sizing:border-box}body{margin:0;background:#f8fafc;color:#1b181e;font-family:'Plus Jakarta Sans',system-ui,sans-serif}
main{max-width:438px;min-height:100svh;margin:auto;padding:28px 24px 40px;text-align:center;overflow-wrap:anywhere}
header{text-align:start;font-size:30px;font-weight:800;margin-bottom:54px}.portrait{width:96px;height:96px;margin:auto;border-radius:50%;background:#a78bfa;display:grid;place-items:center;font-size:38px;font-weight:800;color:#151319}
.eyebrow{color:#667085;margin:24px 0 10px}h1{font-size:32px;line-height:1.15;margin:0;font-weight:800;letter-spacing:-.7px}p{line-height:1.65;color:#667085}
.note{background:#a78bfa20;color:inherit;border-radius:20px;padding:20px;text-align:start;font-size:14px;margin-top:28px}
button,.button{font:inherit;font-weight:700;width:100%;display:block;border:0;border-radius:28px;min-height:56px;padding:16px 20px;background:#a78bfa;color:#151319;text-decoration:none;cursor:pointer;white-space:normal;line-height:1.5;margin-top:16px}
button:disabled{opacity:.6;cursor:wait}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #7c3aed;outline-offset:4px}.outline{background:transparent;border:1px solid #a78bfa;color:inherit}
svg{display:block;max-width:100%;margin:24px auto 0;border-radius:16px}section{border:1px solid #c5b7e8;border-radius:20px;margin-top:20px;padding:16px;text-align:start}label{display:block;font-weight:600;margin-bottom:8px}input{width:100%;min-width:0;padding:12px;border:1px solid #c5b7e8;border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:12px}small{display:block;line-height:1.6;color:#667085;margin-top:24px}[hidden]{display:none!important}[role=status]{min-height:24px;font-size:14px}footer{margin-top:36px;color:#667085;font-size:13px}
@media(prefers-color-scheme:dark){body{background:#1b181e;color:#f8fafc}p,small,footer,.eyebrow{color:#94a3b8}}
</style></head><body><main id="invite"><header>Capsule</header><div id="content"></div><footer>share.capapp.co</footer></main>
<script id="invite-config" type="application/json">${config}</script>
<script src="/friend-invite.js" defer></script></body></html>`;
}
