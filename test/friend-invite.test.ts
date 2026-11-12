import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  copyFriendInviteAndInstall, friendAndroidContinueUrl, friendInstallHandoff,
  friendInviteCopy, friendInviteDevice, friendInviteDirection, friendInviteLocale,
  friendInviteLocales, friendInviteQr, friendInviteText, friendPlayStoreUrl,
  isValidFriendCode,
} from '../lib/friend-invite';
import { renderFriendInvitePage } from '../lib/friend-invite-page';

const now = Date.UTC(2026, 10, 11, 18);
test('iOS handoff preserves the exact mixed-case code, timestamp and owned domain', () => {
  const url = new URL(friendInstallHandoff('AbCd234567', now));
  assert.equal(url.origin, 'https://share.capapp.co');
  assert.equal(url.pathname, '/join/friend/AbCd234567');
  assert.equal(url.searchParams.get('capsule_invite'), '1');
  assert.equal(url.searchParams.get('issued'), String(now / 1000));
});
test('Android intent targets Capsule with exactly one encoded Play install referrer', () => {
  const store = new URL(friendPlayStoreUrl('AbCd234567', now));
  assert.equal(store.searchParams.get('id'), 'com.capsule.app');
  assert.equal(store.searchParams.getAll('referrer').length, 1);
  assert.equal(store.searchParams.get('referrer'), `capsule_invite=AbCd234567&issued=${now / 1000}&v=1`);
  const intent = friendAndroidContinueUrl('AbCd234567', now);
  assert.ok(intent.startsWith('intent://join/friend/AbCd234567#Intent;scheme=capsule;package=com.capsule.app;'));
  assert.ok(intent.includes(`S.browser_fallback_url=${encodeURIComponent(store.href)};end`));
});
test('iOS only prepares the store continuation after successful clipboard copying', async () => {
  const events: string[] = [];
  await copyFriendInviteAndInstall('ABCD2345', async url => { events.push(url); }, url => events.push(url), now);
  assert.equal(events[0], friendInstallHandoff('ABCD2345', now));
  assert.equal(events[1], 'https://apps.apple.com/app/id6758107085');
  let prepared = false;
  await assert.rejects(copyFriendInviteAndInstall('ABCD2345', async () => { throw Error('denied'); }, () => { prepared = true; }));
  assert.equal(prepared, false);
});
test('TestFlight uses Capsule’s internal destination and copies the same invite', async () => {
  const events: string[] = [];
  await copyFriendInviteAndInstall('AbCd234567', async url => { events.push(url); },
    url => events.push(url), now, 'testflight');
  assert.deepEqual(events, [friendInstallHandoff('AbCd234567', now),
    'itms-beta://testflight.apple.com/v1/app/6758107085']);
});
test('malformed codes cannot prepare installation or QR handoffs', () => {
  for (const value of ['bad', '../ABCD2345', 'ABCD2345;package=other', 'ABCD2345<script>']) {
    assert.equal(isValidFriendCode(value), false);
    assert.throws(() => friendInstallHandoff(value, now));
    assert.throws(() => friendPlayStoreUrl(value, now));
    assert.throws(() => friendInviteQr(value));
  }
});
test('desktop QR encodes an owned invitation locally', () => {
  const qr = friendInviteQr('ABCD2345');
  assert.equal(qr.url, 'https://share.capapp.co/join/friend/ABCD2345');
  assert.ok(qr.size > 21); assert.ok(qr.path.startsWith('M'));
});
test('all 20 complete catalogs preserve names, offline language selection and RTL', () => {
  assert.equal(friendInviteLocales.length, 20);
  for (const locale of friendInviteLocales) {
    assert.deepEqual(Object.keys(friendInviteCopy[locale]), Object.keys(friendInviteCopy.en));
    for (const [key, text] of Object.entries(friendInviteCopy[locale])) {
      assert.ok(text.trim()); assert.equal(text.includes('{name}'), key.includes('{name}'));
      if (locale !== 'en') assert.notEqual(text, friendInviteCopy.en[key as keyof typeof friendInviteCopy.en]);
    }
  }
  assert.equal(friendInviteLocale(['zh-Hant-TW', 'fr-CA']), 'fr');
  assert.equal(friendInviteLocale(['pt-PT']), 'pt_BR');
  assert.equal(friendInviteLocale(['es-MX']), 'es_ES');
  assert.equal(friendInviteLocale(['unknown']), 'en');
  assert.equal(friendInviteDirection('ar'), 'rtl');
  assert.equal(friendInviteDirection('ur'), 'rtl');
  assert.equal(friendInviteText('en', 'Join {name} on Capsule', '$&'), 'Join $& on Capsule');
});
test('iPad desktop mode follows the iOS continuation', () => {
  assert.equal(friendInviteDevice({ userAgent: 'Safari', platform: 'MacIntel', maxTouchPoints: 5 }), 'ios');
  assert.equal(friendInviteDevice({ userAgent: 'Android Chrome', platform: 'Linux', maxTouchPoints: 0 }), 'android');
});
test('page safely embeds display content and preserves exact Smart App Banner invitation', () => {
  const html = renderFriendInvitePage('AbCd234567', '</script><img src=x onerror=alert(1)>');
  assert.ok(!html.includes('</script><img'));
  assert.ok(html.includes('app-argument=https://share.capapp.co/join/friend/AbCd234567'));
  assert.ok(!renderFriendInvitePage('bad', '').includes('app-argument='));
});
