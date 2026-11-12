import {
  copyFriendInviteAndInstall, friendAndroidContinueUrl, friendInstallHandoff,
  friendInviteDevice, friendInviteDirection, friendInviteLocale, friendInviteName,
  friendInviteQr, friendInviteText, friendIosInstallUrl, friendPublicInviteUrl,
  isValidFriendCode, type FriendIosInstallChannel, type InviteMessage,
} from './friend-invite';

const config = JSON.parse(document.getElementById('invite-config')!.textContent!);
const code: string = config.code;
const name = friendInviteName(config.name);
const device = friendInviteDevice(navigator);
const locale = friendInviteLocale(navigator.languages);
const t = (source: InviteMessage) => friendInviteText(locale, source, name);
document.documentElement.lang = locale.replace('_', '-');
document.documentElement.dir = friendInviteDirection(locale);
const content = document.getElementById('content')!;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}
function message(tag: 'p' | 'h1' | 'small', source: InviteMessage, className?: string) {
  const node = element(tag, t(source));
  if (className) node.className = className;
  content.append(node);
  return node;
}
if (!isValidFriendCode(code)) {
  message('h1', 'This invitation link does not look right');
  message('p', 'Ask your friend to resend the full invitation link.');
  const home = element('a', t('Go home'));
  home.href = 'https://capapp.co';
  home.className = 'button';
  content.append(home);
} else {
  const portrait = element('div', name ? Array.from(name)[0] : '+');
  portrait.className = 'portrait';
  portrait.setAttribute('aria-hidden', 'true');
  content.append(portrait);
  message('p', name ? '{name} invited you' : 'Friend invitation', 'eyebrow');
  const heading = message('h1', name ? 'Join {name} on Capsule' : 'Join your friend on Capsule');
  document.title = heading.textContent!;
  message('p', 'Create your account to connect and start sharing stories together.');
  message('p', device === 'ios'
    ? 'Continue automatically copies your invitation link. After installing Capsule, allow pasting when prompted to continue your invitation after sign-up.'
    : device === 'android'
      ? 'Your invite comes with you from Google Play. Open Capsule after installing to continue.'
      : 'Scan this code with your phone to continue.', 'note');

  if (device === 'desktop') {
    const qr = friendInviteQr(code);
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${qr.size} ${qr.size}`);
    svg.setAttribute('width', '224'); svg.setAttribute('height', '224');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', t('Scan this code with your phone to continue.'));
    svg.setAttribute('data-invite-url', qr.url);
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('width', String(qr.size)); rect.setAttribute('height', String(qr.size));
    rect.setAttribute('fill', '#fff');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', qr.path); path.setAttribute('fill', '#151319');
    svg.append(rect, path); content.append(svg);
  }

  const primary = element('button', t(device === 'desktop' ? 'Copy invite link' : 'Continue'));
  const store = element('a');
  store.className = 'button'; store.hidden = true;
  const switchStore = element('button');
  switchStore.className = 'outline';
  const installChannelKey = 'capsule.friend-invite.ios-install-channel';
  let installChannel: FriendIosInstallChannel = 'app-store';
  function showInstallChannel() {
    const isTestFlight = installChannel === 'testflight';
    store.textContent = t(isTestFlight ? 'Continue to TestFlight' : 'Continue to App Store');
    store.href = friendIosInstallUrl(installChannel);
    switchStore.textContent = t(isTestFlight ? 'Use App Store' : 'Use TestFlight');
  }
  const status = element('p'); status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const manual = element('section'); manual.hidden = true;
  const error = element('p'); error.setAttribute('role', 'alert');
  const label = element('label', t('Invitation link')); label.htmlFor = 'manual-invite-link';
  const field = element('input'); field.id = 'manual-invite-link';
  field.readOnly = true; field.dir = 'ltr'; field.addEventListener('focus', () => field.select());
  const retry = element('button', t('Copy invite link')); retry.className = 'outline';
  manual.append(error, label, field, retry);
  content.append(primary, store, manual, status);
  message('small', 'If your invite does not appear, reopen this link after signing in.');

  async function copy(install: boolean) {
    if (primary.disabled || retry.disabled) return;
    primary.disabled = retry.disabled = switchStore.disabled = true;
    if (install) store.hidden = true;
    manual.hidden = true; status.textContent = '';
    field.value = device === 'desktop' ? friendPublicInviteUrl(code) : friendInstallHandoff(code);
    try {
      if (install) {
        await copyFriendInviteAndInstall(code, async url => {
          field.value = url;
          await navigator.clipboard.writeText(url);
        }, destination => {
          // A fresh tap avoids Safari blocking navigation after asynchronous copy.
          store.href = destination;
          primary.hidden = true; store.hidden = false;
        }, Date.now(), installChannel);
      } else {
        await navigator.clipboard.writeText(field.value);
      }
      status.textContent = t('Invitation copied');
    } catch {
      manual.hidden = false;
      error.textContent = t(device === 'ios' && installChannel === 'app-store'
        ? 'Could not copy your invite. Copy the link below, then continue to the App Store.'
        : 'Could not complete that action. Try again.');
      if (device === 'ios') store.hidden = false;
    } finally {
      primary.disabled = retry.disabled = switchStore.disabled = false;
    }
  }
  retry.addEventListener('click', () => void copy(device === 'ios'));
  if (device === 'android') {
    const android = element('a', t('Continue'));
    android.className = 'button'; android.href = friendAndroidContinueUrl(code);
    android.addEventListener('click', () => { android.href = friendAndroidContinueUrl(code); });
    primary.replaceWith(android);
  } else {
    if (device === 'ios') {
      try {
        if (localStorage.getItem(installChannelKey) === 'testflight') {
          installChannel = 'testflight';
        }
      } catch { /* The install choice still works without storage. */ }
      showInstallChannel();
      store.after(switchStore);
      switchStore.addEventListener('click', () => {
        installChannel = installChannel === 'app-store' ? 'testflight' : 'app-store';
        try { localStorage.setItem(installChannelKey, installChannel); } catch { /* Optional. */ }
        showInstallChannel();
        void copy(true);
      });
    }
    primary.addEventListener('click', () => void copy(device === 'ios'));
  }
}
