import qrcode from "qrcode-generator";
const playStoreUrl = "https://play.google.com/store/apps/details?id=com.capsule.app";
const siteUrl = (path: string) => `https://share.capapp.co${path}`;

export const FRIEND_CODE_LENGTHS = [8, 10, 12] as const;

/** Format check only — a valid format does not prove an account exists. Case is preserved. */
export function isValidFriendCode(code: string): boolean {
  return (
    /^[A-Za-z0-9]+$/.test(code) && (FRIEND_CODE_LENGTHS as readonly number[]).includes(code.length)
  );
}

export function friendInviteAppUrl(code: string): string {
  return `capsule://join/friend/${encodeURIComponent(code)}`;
}

/** Explicit installation handoff; the app accepts this timestamp for seven days. */
export function friendInstallHandoff(code: string, now = Date.now()): string {
  if (!isValidFriendCode(code) || !Number.isFinite(now) || now <= 0)
    throw new RangeError("Invalid invitation handoff");
  const url = new URL(siteUrl(`/join/friend/${code}`));
  url.search = new URLSearchParams({
    capsule_invite: "1",
    issued: String(Math.floor(now / 1000)),
  }).toString();
  return url.toString();
}

export function friendPlayStoreUrl(code: string, now = Date.now()): string {
  if (!isValidFriendCode(code) || !Number.isFinite(now) || now <= 0)
    throw new RangeError("Invalid invitation handoff");
  const url = new URL(playStoreUrl);
  url.searchParams.set(
    "referrer",
    new URLSearchParams({
      capsule_invite: code,
      issued: String(Math.floor(now / 1000)),
      v: "1",
    }).toString(),
  );
  return url.toString();
}

/** Display copy only. The code and authenticated backend determine identity. */
export function friendInviteName(raw: unknown): string {
  return typeof raw === "string"
    ? raw
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .trim()
        .slice(0, 80)
    : "";
}

export type InviteDevice = "ios" | "android" | "desktop";
export function friendInviteDevice(device: {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}): InviteDevice {
  if (/android/i.test(device.userAgent)) return "android";
  if (
    /iphone|ipad|ipod/i.test(device.userAgent) ||
    (device.platform === "MacIntel" && device.maxTouchPoints > 1)
  )
    return "ios";
  return "desktop";
}

export function friendIosInstallUrl(): string {
  return "itms-beta://testflight.apple.com/v1/app/6758107085";
}

/** Navigate only after copying, preserving the tap for synchronous clipboard writes. */
export async function copyFriendInviteAndInstall(code: string,
  write: (text: string) => void | Promise<void>, openStore: (url: string) => void,
  now = Date.now()): Promise<void> {
  const copying = write(friendInstallHandoff(code, now));
  if (copying) await copying;
  openStore(friendIosInstallUrl());
}

// Shared invitation copy from the Flutter catalogs. All 20 supported locales;
// no network translation and no English placeholders in non-English catalogs.
export const friendInviteCopy = {
  en: {
    "Friend invitation": "Friend invitation",
    "{name} invited you": "{name} invited you",
    "Join {name} on Capsule": "Join {name} on Capsule",
    "Join your friend on Capsule": "Join your friend on Capsule",
    "Create your account to connect and start sharing stories together.":
      "Create your account to connect and start sharing stories together.",
    "Your invite comes with you from Google Play. Open Capsule after installing to continue.":
      "Your invite comes with you from Google Play. Open Capsule after installing to continue.",
    "If your invite does not appear, reopen this link after signing in.":
      "If your invite does not appear, reopen this link after signing in.",
    "Could not copy your invite. Copy the link below, then continue to TestFlight.":
      "Could not copy your invite. Copy the link below, then continue to TestFlight.",
    "Invitation link": "Invitation link",
    "Copy invite link": "Copy invite link",
    "Invitation copied": "Invitation copied",
    "Continue to TestFlight": "Continue to TestFlight",
    "This invitation link does not look right": "This invitation link does not look right",
    "Ask your friend to resend the full invitation link.":
      "Ask your friend to resend the full invitation link.",
    "Go home": "Go home",
    Continue: "Continue",
    "Scan this code with your phone to continue.": "Scan this code with your phone to continue.",
    "Could not complete that action. Try again.": "Could not complete that action. Try again.",
    "Continue automatically copies your invitation link. After installing Capsule, allow pasting when prompted to continue your invitation after sign-up.":
      "Continue automatically copies your invitation link. After installing Capsule, allow pasting when prompted to continue your invitation after sign-up.",
  },
  zh_Hans: {
    "Friend invitation": "好友邀请",
    "{name} invited you": "{name} 邀请了你",
    "Join {name} on Capsule": "在 Capsule 上与 {name} 成为好友",
    "Join your friend on Capsule": "在 Capsule 上与你的朋友成为好友",
    "Create your account to connect and start sharing stories together.":
      "创建账号，与朋友建立联系并开始一起分享故事。",
    "Your invite comes with you from Google Play. Open Capsule after installing to continue.":
      "邀请会通过 Google Play 保留下来。安装后打开 Capsule 即可继续。",
    "If your invite does not appear, reopen this link after signing in.":
      "如果没有显示邀请，请在登录后重新打开此链接。",
    "Could not copy your invite. Copy the link below, then continue to TestFlight.":
      "无法复制邀请。请复制下方链接，然后前往 TestFlight。",
    "Invitation link": "邀请链接",
    "Copy invite link": "复制邀请链接",
    "Invitation copied": "邀请已复制",
    "Continue to TestFlight": "前往 TestFlight",
    "This invitation link does not look right": "此邀请链接似乎有误",
    "Ask your friend to resend the full invitation link.": "请朋友重新发送完整的邀请链接。",
    "Go home": "返回首页",
    Continue: "继续",
    "Scan this code with your phone to continue.": "使用手机扫描此二维码以继续。",
    "Could not complete that action. Try again.": "无法完成该操作。再试一次。",
    "Continue automatically copies your invitation link. After installing Capsule, allow pasting when prompted to continue your invitation after sign-up.":
      "点击“继续”会自动复制邀请链接。安装 Capsule 后，请在出现提示时允许粘贴，以便注册后继续接受邀请。",
  },
  fr: {
    "Friend invitation": "Invitation d’amitié",
    "{name} invited you": "{name} vous invite",
    "Join {name} on Capsule": "Rejoignez {name} sur Capsule",
    "Join your friend on Capsule": "Rejoignez votre ami sur Capsule",
    "Create your account to connect and start sharing stories together.":
      "Créez votre compte pour vous connecter et partager des stories ensemble.",
    "Your invite comes with you from Google Play. Open Capsule after installing to continue.":
      "Votre invitation vous accompagne depuis Google Play. Ouvrez Capsule après l’installation pour continuer.",
    "If your invite does not appear, reopen this link after signing in.":
      "Si votre invitation n’apparaît pas, rouvrez ce lien après la connexion.",
    "Could not copy your invite. Copy the link below, then continue to TestFlight.":
      "Impossible de copier votre invitation. Copiez le lien ci-dessous, puis continuez vers TestFlight.",
    "Invitation link": "Lien d’invitation",
    "Copy invite link": "Copier le lien d’invitation",
    "Invitation copied": "Invitation copiée",
    "Continue to TestFlight": "Continuer vers TestFlight",
    "This invitation link does not look right": "Ce lien d’invitation semble incorrect",
    "Ask your friend to resend the full invitation link.":
      "Demandez à votre ami de renvoyer le lien d’invitation complet.",
    "Go home": "Accueil",
    Continue: "Continuer",
    "Scan this code with your phone to continue.":
      "Scannez ce code avec votre téléphone pour continuer.",
    "Could not complete that action. Try again.":
      "Impossible de terminer cette action. Essayer à nouveau.",
    "Continue automatically copies your invitation link. After installing Capsule, allow pasting when prompted to continue your invitation after sign-up.":
      "Continuer copie automatiquement votre lien d’invitation. Après avoir installé Capsule, autorisez le collage lorsqu’il vous est demandé pour reprendre votre invitation après l’inscription.",
  },
  de: {
    "Friend invitation": "Freundschaftseinladung",
    "{name} invited you": "{name} hat dich eingeladen",
    "Join {name} on Capsule": "Verbinde dich mit {name} auf Capsule",
    "Join your friend on Capsule": "Verbinde dich mit deinem Freund auf Capsule",
    "Create your account to connect and start sharing stories together.":
      "Erstelle dein Konto, um euch zu verbinden und gemeinsam Storys zu teilen.",
    "Your invite comes with you from Google Play. Open Capsule after installing to continue.":
      "Deine Einladung wird von Google Play übernommen. Öffne Capsule nach der Installation, um fortzufahren.",
    "If your invite does not appear, reopen this link after signing in.":
      "Wenn deine Einladung nicht erscheint, öffne diesen Link nach der Anmeldung erneut.",
    "Could not copy your invite. Copy the link below, then continue to TestFlight.":
      "Deine Einladung konnte nicht kopiert werden. Kopiere den Link unten und gehe dann zu TestFlight.",
    "Invitation link": "Einladungslink",
    "Copy invite link": "Einladungslink kopieren",
    "Invitation copied": "Einladung kopiert",
    "Continue to TestFlight": "Weiter zu TestFlight",
    "This invitation link does not look right": "Dieser Einladungslink scheint fehlerhaft zu sein",
    "Ask your friend to resend the full invitation link.":
      "Bitte deinen Freund, den vollständigen Einladungslink erneut zu senden.",
    "Go home": "Zur Startseite",
    Continue: "Weiter",
    "Scan this code with your phone to continue.":
      "Scanne diesen Code mit deinem Smartphone, um fortzufahren.",
    "Could not complete that action. Try again.":
      "Diese Aktion konnte nicht abgeschlossen werden. Versuchen Sie es erneut.",
    "Continue automatically copies your invitation link. After installing Capsule, allow pasting when prompted to continue your invitation after sign-up.":
      "Weiter kopiert deinen Einladungslink automatisch. Erlaube nach der Installation von Capsule das Einfügen, wenn du dazu aufgefordert wirst, damit du nach der Registrierung mit deiner Einladung fortfahren kannst.",
  },
  it: {
    "Friend invitation": "Invito di amicizia",
    "{name} invited you": "{name} ti ha invitato",
    "Join {name} on Capsule": "Unisciti a {name} su Capsule",
    "Join your friend on Capsule": "Unisciti al tuo amico su Capsule",
    "Create your account to connect and start sharing stories together.":
      "Crea il tuo account per connettervi e iniziare a condividere storie insieme.",
    "Your invite comes with you from Google Play. Open Capsule after installing to continue.":
      "Il tuo invito viene conservato da Google Play. Apri Capsule dopo l’installazione per continuare.",
    "If your invite does not appear, reopen this link after signing in.":
      "Se il tuo invito non compare, riapri questo link dopo aver effettuato l’accesso.",
    "Could not copy your invite. Copy the link below, then continue to TestFlight.":
      "Impossibile copiare il tuo invito. Copia il link qui sotto, poi continua su TestFlight.",
    "Invitation link": "Link di invito",
    "Copy invite link": "Copia link di invito",
    "Invitation copied": "Invito copiato",
    "Continue to TestFlight": "Continua su TestFlight",
    "This invitation link does not look right": "Questo link di invito non sembra corretto",
    "Ask your friend to resend the full invitation link.":
      "Chiedi al tuo amico di inviare di nuovo il link di invito completo.",
    "Go home": "Vai alla home",
    Continue: "Continua",
    "Scan this code with your phone to continue.":
      "Scansiona questo codice con il telefono per continuare.",
    "Could not complete that action. Try again.": "Impossibile completare l'azione. Riprova.",
    "Continue automatically copies your invitation link. After installing Capsule, allow pasting when prompted to continue your invitation after sign-up.":
      "Continua copia automaticamente il link del tuo invito. Dopo aver installato Capsule, consenti di incollarlo quando richiesto per riprendere l’invito dopo la registrazione.",
  },
  ja: {
    "Friend invitation": "友だちへの招待",
    "{name} invited you": "{name}さんからの招待",
    "Join {name} on Capsule": "Capsuleで{name}さんとつながる",
    "Join your friend on Capsule": "Capsuleで友だちとつながる",
    "Create your account to connect and start sharing stories together.":
      "アカウントを作成して友だちとつながり、一緒にストーリーを共有しましょう。",
    "Your invite comes with you from Google Play. Open Capsule after installing to continue.":
      "Google Playから招待が引き継がれます。インストール後にCapsuleを開いて続けてください。",
    "If your invite does not appear, reopen this link after signing in.":
      "招待が表示されない場合は、サインイン後にこのリンクをもう一度開いてください。",
    "Could not copy your invite. Copy the link below, then continue to TestFlight.":
      "招待をコピーできませんでした。下のリンクをコピーしてからTestFlightへ進んでください。",
    "Invitation link": "招待リンク",
    "Copy invite link": "招待リンクをコピー",
    "Invitation copied": "招待をコピーしました",
    "Continue to TestFlight": "TestFlightへ進む",
    "This invitation link does not look right": "この招待リンクは正しくないようです",
    "Ask your friend to resend the full invitation link.":
      "完全な招待リンクをもう一度送るよう友だちに依頼してください。",
    "Go home": "ホームへ",
    Continue: "続ける",
    "Scan this code with your phone to continue.":
      "スマートフォンでこのコードを読み取って続けてください。",
    "Could not complete that action. Try again.":
      "そのアクションを完了できませんでした。もう一度やり直してください。",
    "Continue automatically copies your invitation link. After installing Capsule, allow pasting when prompted to continue your invitation after sign-up.":
      "「続ける」をタップすると、招待リンクが自動でコピーされます。Capsule のインストール後、貼り付けの確認が表示されたら許可すると、登録後に招待の手続きを続けられます。",
  },
  pt_BR: {
    "Friend invitation": "Convite de amizade",
    "{name} invited you": "{name} convidou você",
    "Join {name} on Capsule": "Junte-se a {name} no Capsule",
    "Join your friend on Capsule": "Junte-se ao seu amigo no Capsule",
    "Create your account to connect and start sharing stories together.":
      "Crie sua conta para se conectar e começar a compartilhar histórias juntos.",
    "Your invite comes with you from Google Play. Open Capsule after installing to continue.":
      "Seu convite é mantido pelo Google Play. Abra o Capsule após instalar para continuar.",
    "If your invite does not appear, reopen this link after signing in.":
      "Se o convite não aparecer, reabra este link depois de entrar na conta.",
    "Could not copy your invite. Copy the link below, then continue to TestFlight.":
      "Não foi possível copiar seu convite. Copie o link abaixo e continue no TestFlight.",
    "Invitation link": "Link do convite",
    "Copy invite link": "Copiar link do convite",
    "Invitation copied": "Convite copiado",
    "Continue to TestFlight": "Continuar no TestFlight",
    "This invitation link does not look right": "Este link de convite não parece correto",
    "Ask your friend to resend the full invitation link.":
      "Peça ao seu amigo para reenviar o link completo do convite.",
    "Go home": "Ir para o início",
    Continue: "Continuar",
    "Scan this code with your phone to continue.":
      "Leia este código com seu celular para continuar.",
    "Could not complete that action. Try again.":
      "Não foi possível concluir essa ação. Tente novamente.",
    "Continue automatically copies your invitation link. After installing Capsule, allow pasting when prompted to continue your invitation after sign-up.":
      "Continuar copia automaticamente seu link de convite. Depois de instalar o Capsule, permita a colagem quando solicitado para continuar seu convite após o cadastro.",
  },
  ru: {
    "Friend invitation": "Приглашение в друзья",
    "{name} invited you": "{name} приглашает вас",
    "Join {name} on Capsule": "Присоединитесь к {name} в Capsule",
    "Join your friend on Capsule": "Присоединитесь к другу в Capsule",
    "Create your account to connect and start sharing stories together.":
      "Создайте аккаунт, чтобы подружиться и начать делиться историями вместе.",
    "Your invite comes with you from Google Play. Open Capsule after installing to continue.":
      "Приглашение сохранится при переходе из Google Play. После установки откройте Capsule, чтобы продолжить.",
    "If your invite does not appear, reopen this link after signing in.":
      "Если приглашение не появилось, снова откройте эту ссылку после входа.",
    "Could not copy your invite. Copy the link below, then continue to TestFlight.":
      "Не удалось скопировать приглашение. Скопируйте ссылку ниже и перейдите в TestFlight.",
    "Invitation link": "Ссылка-приглашение",
    "Copy invite link": "Скопировать ссылку-приглашение",
    "Invitation copied": "Приглашение скопировано",
    "Continue to TestFlight": "Перейти в TestFlight",
    "This invitation link does not look right": "Эта ссылка-приглашение выглядит неверной",
    "Ask your friend to resend the full invitation link.":
      "Попросите друга повторно отправить полную ссылку-приглашение.",
    "Go home": "На главную",
    Continue: "Продолжить",
    "Scan this code with your phone to continue.":
      "Отсканируйте этот код телефоном, чтобы продолжить.",
    "Could not complete that action. Try again.":
      "Не удалось выполнить это действие. Попробуйте еще раз.",
    "Continue automatically copies your invitation link. After installing Capsule, allow pasting when prompted to continue your invitation after sign-up.":
      "Кнопка «Продолжить» автоматически копирует ссылку приглашения. После установки Capsule разрешите вставку, когда появится запрос, чтобы продолжить по приглашению после регистрации.",
  },
  es_ES: {
    "Friend invitation": "Invitación de amistad",
    "{name} invited you": "{name} te ha invitado",
    "Join {name} on Capsule": "Únete a {name} en Capsule",
    "Join your friend on Capsule": "Únete a tu amigo en Capsule",
    "Create your account to connect and start sharing stories together.":
      "Crea tu cuenta para conectar y empezar a compartir historias juntos.",
    "Your invite comes with you from Google Play. Open Capsule after installing to continue.":
      "Tu invitación se conserva desde Google Play. Abre Capsule después de instalar para continuar.",
    "If your invite does not appear, reopen this link after signing in.":
      "Si tu invitación no aparece, vuelve a abrir este enlace después de iniciar sesión.",
    "Could not copy your invite. Copy the link below, then continue to TestFlight.":
      "No se pudo copiar tu invitación. Copia el enlace de abajo y continúa en TestFlight.",
    "Invitation link": "Enlace de invitación",
    "Copy invite link": "Copiar enlace de invitación",
    "Invitation copied": "Invitación copiada",
    "Continue to TestFlight": "Continuar en TestFlight",
    "This invitation link does not look right": "Este enlace de invitación parece incorrecto",
    "Ask your friend to resend the full invitation link.":
      "Pide a tu amigo que vuelva a enviar el enlace de invitación completo.",
    "Go home": "Ir al inicio",
    Continue: "Continuar",
    "Scan this code with your phone to continue.":
      "Escanea este código con tu teléfono para continuar.",
    "Could not complete that action. Try again.":
      "No se pudo completar esa acción. Intentar otra vez.",
    "Continue automatically copies your invitation link. After installing Capsule, allow pasting when prompted to continue your invitation after sign-up.":
      "Continuar copia automáticamente tu enlace de invitación. Después de instalar Capsule, permite pegarlo cuando se te solicite para continuar con tu invitación tras registrarte.",
  },
  nl: {
    "Friend invitation": "Vriendschapsuitnodiging",
    "{name} invited you": "{name} heeft je uitgenodigd",
    "Join {name} on Capsule": "Sluit je aan bij {name} op Capsule",
    "Join your friend on Capsule": "Sluit je aan bij je vriend op Capsule",
    "Create your account to connect and start sharing stories together.":
      "Maak je account aan om contact te maken en samen verhalen te delen.",
    "Your invite comes with you from Google Play. Open Capsule after installing to continue.":
      "Je uitnodiging wordt meegenomen vanuit Google Play. Open Capsule na de installatie om verder te gaan.",
    "If your invite does not appear, reopen this link after signing in.":
      "Verschijnt je uitnodiging niet? Open deze link opnieuw nadat je bent ingelogd.",
    "Could not copy your invite. Copy the link below, then continue to TestFlight.":
      "Je uitnodiging kon niet worden gekopieerd. Kopieer de link hieronder en ga verder naar TestFlight.",
    "Invitation link": "Uitnodigingslink",
    "Copy invite link": "Uitnodigingslink kopiëren",
    "Invitation copied": "Uitnodiging gekopieerd",
    "Continue to TestFlight": "Verder naar TestFlight",
    "This invitation link does not look right": "Deze uitnodigingslink lijkt niet te kloppen",
    "Ask your friend to resend the full invitation link.":
      "Vraag je vriend om de volledige uitnodigingslink opnieuw te sturen.",
    "Go home": "Naar de startpagina",
    Continue: "Doorgaan",
    "Scan this code with your phone to continue.":
      "Scan deze code met je telefoon om verder te gaan.",
    "Could not complete that action. Try again.": "Actie mislukt. Probeer opnieuw.",
    "Continue automatically copies your invitation link. After installing Capsule, allow pasting when prompted to continue your invitation after sign-up.":
      "Doorgaan kopieert je uitnodigingslink automatisch. Sta na het installeren van Capsule het plakken toe wanneer daarom wordt gevraagd, zodat je na de registratie verder kunt met je uitnodiging.",
  },
  ar: {
    "Friend invitation": "دعوة صداقة",
    "{name} invited you": "دعاك {name}",
    "Join {name} on Capsule": "انضم إلى {name} على Capsule",
    "Join your friend on Capsule": "انضم إلى صديقك على Capsule",
    "Create your account to connect and start sharing stories together.":
      "أنشئ حسابك للتواصل وبدء مشاركة القصص معًا.",
    "Your invite comes with you from Google Play. Open Capsule after installing to continue.":
      "ستنتقل دعوتك معك من Google Play. افتح Capsule بعد التثبيت للمتابعة.",
    "If your invite does not appear, reopen this link after signing in.":
      "إذا لم تظهر دعوتك، فأعد فتح هذا الرابط بعد تسجيل الدخول.",
    "Could not copy your invite. Copy the link below, then continue to TestFlight.":
      "تعذّر نسخ دعوتك. انسخ الرابط أدناه، ثم انتقل إلى TestFlight.",
    "Invitation link": "رابط الدعوة",
    "Copy invite link": "نسخ رابط الدعوة",
    "Invitation copied": "تم نسخ الدعوة",
    "Continue to TestFlight": "المتابعة إلى TestFlight",
    "This invitation link does not look right": "يبدو أن رابط الدعوة غير صحيح",
    "Ask your friend to resend the full invitation link.":
      "اطلب من صديقك إعادة إرسال رابط الدعوة الكامل.",
    "Go home": "الصفحة الرئيسية",
    Continue: "متابعة",
    "Scan this code with your phone to continue.": "امسح هذا الرمز بهاتفك للمتابعة.",
    "Could not complete that action. Try again.": "تعذّر إكمال هذا الإجراء. حاول مجددًا.",
    "Continue automatically copies your invitation link. After installing Capsule, allow pasting when prompted to continue your invitation after sign-up.":
      "عند الضغط على متابعة، يُنسخ رابط دعوتك تلقائيًا. بعد تثبيت Capsule، اسمح باللصق عند ظهور الطلب لمتابعة دعوتك بعد إنشاء الحساب.",
  },
  ur: {
    "Friend invitation": "دوستی کی دعوت",
    "{name} invited you": "{name} نے آپ کو دعوت دی ہے",
    "Join {name} on Capsule": "Capsule پر {name} سے جڑیں",
    "Join your friend on Capsule": "Capsule پر اپنے دوست سے جڑیں",
    "Create your account to connect and start sharing stories together.":
      "جڑنے اور ایک ساتھ کہانیاں شیئر کرنے کے لیے اپنا اکاؤنٹ بنائیں۔",
    "Your invite comes with you from Google Play. Open Capsule after installing to continue.":
      "آپ کی دعوت Google Play سے آپ کے ساتھ آتی ہے۔ انسٹال کرنے کے بعد جاری رکھنے کے لیے Capsule کھولیں۔",
    "If your invite does not appear, reopen this link after signing in.":
      "اگر آپ کی دعوت نظر نہ آئے تو سائن ان کرنے کے بعد یہ لنک دوبارہ کھولیں۔",
    "Could not copy your invite. Copy the link below, then continue to TestFlight.":
      "آپ کی دعوت کاپی نہیں ہو سکی۔ نیچے دیا گیا لنک کاپی کریں، پھر TestFlight پر جائیں۔",
    "Invitation link": "دعوت کا لنک",
    "Copy invite link": "دعوت کا لنک کاپی کریں",
    "Invitation copied": "دعوت کاپی ہو گئی",
    "Continue to TestFlight": "TestFlight پر جائیں",
    "This invitation link does not look right": "دعوت کا یہ لنک درست نہیں لگتا",
    "Ask your friend to resend the full invitation link.":
      "اپنے دوست سے دعوت کا مکمل لنک دوبارہ بھیجنے کو کہیں۔",
    "Go home": "مرکزی صفحہ",
    Continue: "جاری رکھیں",
    "Scan this code with your phone to continue.":
      "جاری رکھنے کے لیے اپنے فون سے یہ کوڈ اسکین کریں۔",
    "Could not complete that action. Try again.": "یہ کارروائی مکمل نہیں ہو سکی۔ دوبارہ کوشش کریں۔",
    "Continue automatically copies your invitation link. After installing Capsule, allow pasting when prompted to continue your invitation after sign-up.":
      "جاری رکھیں پر ٹیپ کرنے سے آپ کی دعوت کا لنک خود بخود کاپی ہو جاتا ہے۔ Capsule انسٹال کرنے کے بعد، جب کہا جائے تو پیسٹ کرنے کی اجازت دیں تاکہ سائن اپ کے بعد اپنی دعوت جاری رکھ سکیں۔",
  },
  pa: {
    "Friend invitation": "ਦੋਸਤੀ ਦਾ ਸੱਦਾ",
    "{name} invited you": "{name} ਨੇ ਤੁਹਾਨੂੰ ਸੱਦਾ ਦਿੱਤਾ ਹੈ",
    "Join {name} on Capsule": "Capsule ਉੱਤੇ {name} ਨਾਲ ਜੁੜੋ",
    "Join your friend on Capsule": "Capsule ਉੱਤੇ ਆਪਣੇ ਦੋਸਤ ਨਾਲ ਜੁੜੋ",
    "Create your account to connect and start sharing stories together.":
      "ਜੁੜਨ ਅਤੇ ਇਕੱਠੇ ਕਹਾਣੀਆਂ ਸਾਂਝੀਆਂ ਕਰਨ ਲਈ ਆਪਣਾ ਖਾਤਾ ਬਣਾਓ।",
    "Your invite comes with you from Google Play. Open Capsule after installing to continue.":
      "ਤੁਹਾਡਾ ਸੱਦਾ Google Play ਤੋਂ ਤੁਹਾਡੇ ਨਾਲ ਆਉਂਦਾ ਹੈ। ਇੰਸਟਾਲ ਕਰਨ ਤੋਂ ਬਾਅਦ ਜਾਰੀ ਰੱਖਣ ਲਈ Capsule ਖੋਲ੍ਹੋ।",
    "If your invite does not appear, reopen this link after signing in.":
      "ਜੇ ਤੁਹਾਡਾ ਸੱਦਾ ਨਹੀਂ ਦਿਸਦਾ, ਤਾਂ ਸਾਈਨ ਇਨ ਕਰਨ ਤੋਂ ਬਾਅਦ ਇਹ ਲਿੰਕ ਮੁੜ ਖੋਲ੍ਹੋ।",
    "Could not copy your invite. Copy the link below, then continue to TestFlight.":
      "ਤੁਹਾਡਾ ਸੱਦਾ ਕਾਪੀ ਨਹੀਂ ਹੋ ਸਕਿਆ। ਹੇਠਾਂ ਦਿੱਤਾ ਲਿੰਕ ਕਾਪੀ ਕਰੋ, ਫਿਰ TestFlight ਉੱਤੇ ਜਾਓ।",
    "Invitation link": "ਸੱਦੇ ਦਾ ਲਿੰਕ",
    "Copy invite link": "ਸੱਦੇ ਦਾ ਲਿੰਕ ਕਾਪੀ ਕਰੋ",
    "Invitation copied": "ਸੱਦਾ ਕਾਪੀ ਹੋ ਗਿਆ",
    "Continue to TestFlight": "TestFlight ਉੱਤੇ ਜਾਓ",
    "This invitation link does not look right": "ਇਹ ਸੱਦਾ ਲਿੰਕ ਸਹੀ ਨਹੀਂ ਲੱਗਦਾ",
    "Ask your friend to resend the full invitation link.":
      "ਆਪਣੇ ਦੋਸਤ ਨੂੰ ਸੱਦੇ ਦਾ ਪੂਰਾ ਲਿੰਕ ਮੁੜ ਭੇਜਣ ਲਈ ਕਹੋ।",
    "Go home": "ਮੁੱਖ ਪੰਨੇ ਉੱਤੇ ਜਾਓ",
    Continue: "ਜਾਰੀ ਰੱਖੋ",
    "Scan this code with your phone to continue.": "ਜਾਰੀ ਰੱਖਣ ਲਈ ਆਪਣੇ ਫ਼ੋਨ ਨਾਲ ਇਹ ਕੋਡ ਸਕੈਨ ਕਰੋ।",
    "Could not complete that action. Try again.": "ਇਹ ਕਾਰਵਾਈ ਪੂਰੀ ਨਹੀਂ ਹੋ ਸਕੀ। ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
    "Continue automatically copies your invitation link. After installing Capsule, allow pasting when prompted to continue your invitation after sign-up.":
      "ਜਾਰੀ ਰੱਖੋ ਉੱਤੇ ਟੈਪ ਕਰਨ ਨਾਲ ਤੁਹਾਡੇ ਸੱਦੇ ਦਾ ਲਿੰਕ ਆਪਣੇ ਆਪ ਕਾਪੀ ਹੋ ਜਾਂਦਾ ਹੈ। Capsule ਇੰਸਟਾਲ ਕਰਨ ਤੋਂ ਬਾਅਦ, ਪੁੱਛੇ ਜਾਣ ਉੱਤੇ ਪੇਸਟ ਕਰਨ ਦੀ ਇਜਾਜ਼ਤ ਦਿਓ ਤਾਂ ਜੋ ਸਾਈਨ ਅੱਪ ਤੋਂ ਬਾਅਦ ਸੱਦੇ ਨਾਲ ਅੱਗੇ ਵਧ ਸਕੋ।",
  },
  hi: {
    "Friend invitation": "दोस्ती का निमंत्रण",
    "{name} invited you": "{name} ने आपको आमंत्रित किया है",
    "Join {name} on Capsule": "Capsule पर {name} से जुड़ें",
    "Join your friend on Capsule": "Capsule पर अपने दोस्त से जुड़ें",
    "Create your account to connect and start sharing stories together.":
      "जुड़ने और साथ में कहानियाँ साझा करने के लिए अपना खाता बनाएँ।",
    "Your invite comes with you from Google Play. Open Capsule after installing to continue.":
      "आपका निमंत्रण Google Play से आपके साथ आता है। इंस्टॉल करने के बाद जारी रखने के लिए Capsule खोलें।",
    "If your invite does not appear, reopen this link after signing in.":
      "अगर आपका निमंत्रण नहीं दिखता है, तो साइन इन करने के बाद यह लिंक दोबारा खोलें।",
    "Could not copy your invite. Copy the link below, then continue to TestFlight.":
      "आपका निमंत्रण कॉपी नहीं हो सका। नीचे दिया लिंक कॉपी करें, फिर TestFlight पर जाएँ।",
    "Invitation link": "निमंत्रण लिंक",
    "Copy invite link": "निमंत्रण लिंक कॉपी करें",
    "Invitation copied": "निमंत्रण कॉपी हो गया",
    "Continue to TestFlight": "TestFlight पर जाएँ",
    "This invitation link does not look right": "यह निमंत्रण लिंक सही नहीं लगता",
    "Ask your friend to resend the full invitation link.":
      "अपने दोस्त से पूरा निमंत्रण लिंक दोबारा भेजने को कहें।",
    "Go home": "होम पर जाएँ",
    Continue: "जारी रखें",
    "Scan this code with your phone to continue.":
      "जारी रखने के लिए अपने फ़ोन से यह कोड स्कैन करें।",
    "Could not complete that action. Try again.": "यह कार्रवाई पूरी नहीं हो सकी। फिर कोशिश करें।",
    "Continue automatically copies your invitation link. After installing Capsule, allow pasting when prompted to continue your invitation after sign-up.":
      "जारी रखें पर टैप करने से आपका आमंत्रण लिंक अपने आप कॉपी हो जाता है। Capsule इंस्टॉल करने के बाद, पूछे जाने पर पेस्ट करने की अनुमति दें ताकि साइन अप के बाद अपना आमंत्रण जारी रख सकें।",
  },
  bn: {
    "Friend invitation": "বন্ধুত্বের আমন্ত্রণ",
    "{name} invited you": "{name} আপনাকে আমন্ত্রণ জানিয়েছেন",
    "Join {name} on Capsule": "Capsule-এ {name}-এর সঙ্গে যুক্ত হন",
    "Join your friend on Capsule": "Capsule-এ আপনার বন্ধুর সঙ্গে যুক্ত হন",
    "Create your account to connect and start sharing stories together.":
      "যুক্ত হতে এবং একসঙ্গে গল্প শেয়ার করতে আপনার অ্যাকাউন্ট তৈরি করুন।",
    "Your invite comes with you from Google Play. Open Capsule after installing to continue.":
      "Google Play থেকে আপনার আমন্ত্রণ সংরক্ষিত থাকবে। ইনস্টল করার পরে চালিয়ে যেতে Capsule খুলুন।",
    "If your invite does not appear, reopen this link after signing in.":
      "আমন্ত্রণটি দেখা না গেলে সাইন ইন করার পরে এই লিঙ্কটি আবার খুলুন।",
    "Could not copy your invite. Copy the link below, then continue to TestFlight.":
      "আমন্ত্রণ কপি করা যায়নি। নিচের লিঙ্কটি কপি করে TestFlight-এ যান।",
    "Invitation link": "আমন্ত্রণের লিঙ্ক",
    "Copy invite link": "আমন্ত্রণের লিঙ্ক কপি করুন",
    "Invitation copied": "আমন্ত্রণ কপি হয়েছে",
    "Continue to TestFlight": "TestFlight-এ যান",
    "This invitation link does not look right": "আমন্ত্রণের এই লিঙ্কটি সঠিক মনে হচ্ছে না",
    "Ask your friend to resend the full invitation link.":
      "আপনার বন্ধুকে সম্পূর্ণ আমন্ত্রণের লিঙ্কটি আবার পাঠাতে বলুন।",
    "Go home": "হোমে যান",
    Continue: "চালিয়ে যান",
    "Scan this code with your phone to continue.":
      "চালিয়ে যেতে আপনার ফোন দিয়ে এই কোড স্ক্যান করুন।",
    "Could not complete that action. Try again.": "কাজটি শেষ করা যায়নি। আবার চেষ্টা করুন।",
    "Continue automatically copies your invitation link. After installing Capsule, allow pasting when prompted to continue your invitation after sign-up.":
      "চালিয়ে যান-এ ট্যাপ করলে আপনার আমন্ত্রণের লিঙ্কটি স্বয়ংক্রিয়ভাবে কপি হয়ে যায়। Capsule ইনস্টল করার পর অনুরোধ করা হলে পেস্ট করার অনুমতি দিন, যাতে সাইন আপের পর আমন্ত্রণটি চালিয়ে যেতে পারেন।",
  },
  ko: {
    "Friend invitation": "친구 초대",
    "{name} invited you": "{name}님이 초대했어요",
    "Join {name} on Capsule": "Capsule에서 {name}님과 연결하세요",
    "Join your friend on Capsule": "Capsule에서 친구와 연결하세요",
    "Create your account to connect and start sharing stories together.":
      "계정을 만들어 친구와 연결하고 함께 스토리를 공유하세요.",
    "Your invite comes with you from Google Play. Open Capsule after installing to continue.":
      "Google Play에서 초대가 유지됩니다. 설치 후 Capsule를 열어 계속하세요.",
    "If your invite does not appear, reopen this link after signing in.":
      "초대가 표시되지 않으면 로그인한 뒤 이 링크를 다시 여세요.",
    "Could not copy your invite. Copy the link below, then continue to TestFlight.":
      "초대를 복사하지 못했어요. 아래 링크를 복사한 다음 TestFlight로 이동하세요.",
    "Invitation link": "초대 링크",
    "Copy invite link": "초대 링크 복사",
    "Invitation copied": "초대를 복사했어요",
    "Continue to TestFlight": "TestFlight로 이동",
    "This invitation link does not look right": "초대 링크가 올바르지 않은 것 같아요",
    "Ask your friend to resend the full invitation link.":
      "친구에게 전체 초대 링크를 다시 보내 달라고 요청하세요.",
    "Go home": "홈으로",
    Continue: "계속",
    "Scan this code with your phone to continue.": "계속하려면 휴대전화로 이 코드를 스캔하세요.",
    "Could not complete that action. Try again.": "작업을 완료하지 못했습니다. 다시 시도하세요.",
    "Continue automatically copies your invitation link. After installing Capsule, allow pasting when prompted to continue your invitation after sign-up.":
      "계속을 탭하면 초대 링크가 자동으로 복사됩니다. Capsule를 설치한 후 붙여넣기 요청이 표시되면 허용하면 가입 후 초대를 이어갈 수 있습니다.",
  },
  tr: {
    "Friend invitation": "Arkadaşlık daveti",
    "{name} invited you": "{name} seni davet etti",
    "Join {name} on Capsule": "Capsule’te {name} ile bağlantı kur",
    "Join your friend on Capsule": "Capsule’te arkadaşınla bağlantı kur",
    "Create your account to connect and start sharing stories together.":
      "Bağlantı kurmak ve birlikte hikâyeler paylaşmaya başlamak için hesabını oluştur.",
    "Your invite comes with you from Google Play. Open Capsule after installing to continue.":
      "Davetin Google Play üzerinden korunur. Yükledikten sonra devam etmek için Capsule’i aç.",
    "If your invite does not appear, reopen this link after signing in.":
      "Davetin görünmezse giriş yaptıktan sonra bu bağlantıyı yeniden aç.",
    "Could not copy your invite. Copy the link below, then continue to TestFlight.":
      "Davetin kopyalanamadı. Aşağıdaki bağlantıyı kopyala, ardından TestFlight’a geç.",
    "Invitation link": "Davet bağlantısı",
    "Copy invite link": "Davet bağlantısını kopyala",
    "Invitation copied": "Davet kopyalandı",
    "Continue to TestFlight": "TestFlight’a devam et",
    "This invitation link does not look right": "Bu davet bağlantısı doğru görünmüyor",
    "Ask your friend to resend the full invitation link.":
      "Arkadaşından davet bağlantısının tamamını yeniden göndermesini iste.",
    "Go home": "Ana sayfaya git",
    Continue: "Devam et",
    "Scan this code with your phone to continue.": "Devam etmek için bu kodu telefonunla tara.",
    "Could not complete that action. Try again.": "Bu işlem tamamlanamadı. Tekrar dene.",
    "Continue automatically copies your invitation link. After installing Capsule, allow pasting when prompted to continue your invitation after sign-up.":
      "Devam düğmesi davet bağlantını otomatik olarak kopyalar. Capsule’i yükledikten sonra, kayıt işleminin ardından davetine devam edebilmek için istendiğinde yapıştırmaya izin ver.",
  },
  id: {
    "Friend invitation": "Undangan pertemanan",
    "{name} invited you": "{name} mengundang Anda",
    "Join {name} on Capsule": "Terhubung dengan {name} di Capsule",
    "Join your friend on Capsule": "Terhubung dengan teman Anda di Capsule",
    "Create your account to connect and start sharing stories together.":
      "Buat akun untuk terhubung dan mulai berbagi cerita bersama.",
    "Your invite comes with you from Google Play. Open Capsule after installing to continue.":
      "Undangan Anda tetap tersimpan melalui Google Play. Buka Capsule setelah menginstal untuk melanjutkan.",
    "If your invite does not appear, reopen this link after signing in.":
      "Jika undangan tidak muncul, buka kembali tautan ini setelah masuk.",
    "Could not copy your invite. Copy the link below, then continue to TestFlight.":
      "Undangan tidak dapat disalin. Salin tautan di bawah, lalu lanjutkan ke TestFlight.",
    "Invitation link": "Tautan undangan",
    "Copy invite link": "Salin tautan undangan",
    "Invitation copied": "Undangan disalin",
    "Continue to TestFlight": "Lanjutkan ke TestFlight",
    "This invitation link does not look right": "Tautan undangan ini tampaknya tidak benar",
    "Ask your friend to resend the full invitation link.":
      "Minta teman Anda mengirim ulang tautan undangan lengkap.",
    "Go home": "Ke beranda",
    Continue: "Lanjutkan",
    "Scan this code with your phone to continue.":
      "Pindai kode ini dengan ponsel Anda untuk melanjutkan.",
    "Could not complete that action. Try again.":
      "Tidak dapat menyelesaikan tindakan itu. Coba lagi.",
    "Continue automatically copies your invitation link. After installing Capsule, allow pasting when prompted to continue your invitation after sign-up.":
      "Lanjutkan otomatis menyalin tautan undanganmu. Setelah memasang Capsule, izinkan penempelan saat diminta agar undanganmu dapat dilanjutkan setelah mendaftar.",
  },
  vi: {
    "Friend invitation": "Lời mời kết bạn",
    "{name} invited you": "{name} đã mời bạn",
    "Join {name} on Capsule": "Kết nối với {name} trên Capsule",
    "Join your friend on Capsule": "Kết nối với bạn bè trên Capsule",
    "Create your account to connect and start sharing stories together.":
      "Tạo tài khoản để kết nối và bắt đầu chia sẻ câu chuyện cùng nhau.",
    "Your invite comes with you from Google Play. Open Capsule after installing to continue.":
      "Lời mời được giữ lại qua Google Play. Mở Capsule sau khi cài đặt để tiếp tục.",
    "If your invite does not appear, reopen this link after signing in.":
      "Nếu không thấy lời mời, hãy mở lại liên kết này sau khi đăng nhập.",
    "Could not copy your invite. Copy the link below, then continue to TestFlight.":
      "Không thể sao chép lời mời. Sao chép liên kết bên dưới rồi tiếp tục đến TestFlight.",
    "Invitation link": "Liên kết lời mời",
    "Copy invite link": "Sao chép liên kết lời mời",
    "Invitation copied": "Đã sao chép lời mời",
    "Continue to TestFlight": "Tiếp tục đến TestFlight",
    "This invitation link does not look right": "Liên kết lời mời này có vẻ không đúng",
    "Ask your friend to resend the full invitation link.":
      "Nhờ bạn bè gửi lại liên kết lời mời đầy đủ.",
    "Go home": "Về trang chủ",
    Continue: "Tiếp tục",
    "Scan this code with your phone to continue.": "Quét mã này bằng điện thoại để tiếp tục.",
    "Could not complete that action. Try again.": "Không thể hoàn tất thao tác đó. Thử lại.",
    "Continue automatically copies your invitation link. After installing Capsule, allow pasting when prompted to continue your invitation after sign-up.":
      "Tiếp tục sẽ tự động sao chép liên kết lời mời của bạn. Sau khi cài đặt Capsule, hãy cho phép dán khi được yêu cầu để tiếp tục lời mời sau khi đăng ký.",
  },
  th: {
    "Friend invitation": "คำเชิญเป็นเพื่อน",
    "{name} invited you": "{name} เชิญคุณ",
    "Join {name} on Capsule": "เชื่อมต่อกับ {name} บน Capsule",
    "Join your friend on Capsule": "เชื่อมต่อกับเพื่อนบน Capsule",
    "Create your account to connect and start sharing stories together.":
      "สร้างบัญชีเพื่อเชื่อมต่อและเริ่มแชร์เรื่องราวด้วยกัน",
    "Your invite comes with you from Google Play. Open Capsule after installing to continue.":
      "คำเชิญจะถูกเก็บไว้ผ่าน Google Play เปิด Capsule หลังติดตั้งเพื่อดำเนินการต่อ",
    "If your invite does not appear, reopen this link after signing in.":
      "หากไม่เห็นคำเชิญ ให้เปิดลิงก์นี้อีกครั้งหลังลงชื่อเข้าใช้",
    "Could not copy your invite. Copy the link below, then continue to TestFlight.":
      "คัดลอกคำเชิญไม่ได้ โปรดคัดลอกลิงก์ด้านล่างแล้วไปที่ TestFlight",
    "Invitation link": "ลิงก์คำเชิญ",
    "Copy invite link": "คัดลอกลิงก์คำเชิญ",
    "Invitation copied": "คัดลอกคำเชิญแล้ว",
    "Continue to TestFlight": "ไปที่ TestFlight",
    "This invitation link does not look right": "ลิงก์คำเชิญนี้ดูไม่ถูกต้อง",
    "Ask your friend to resend the full invitation link.":
      "ขอให้เพื่อนส่งลิงก์คำเชิญฉบับเต็มอีกครั้ง",
    "Go home": "กลับหน้าหลัก",
    Continue: "ดำเนินการต่อ",
    "Scan this code with your phone to continue.": "สแกนรหัสนี้ด้วยโทรศัพท์ของคุณเพื่อดำเนินการต่อ",
    "Could not complete that action. Try again.": "ดำเนินการไม่สำเร็จ ลองอีกครั้ง",
    "Continue automatically copies your invitation link. After installing Capsule, allow pasting when prompted to continue your invitation after sign-up.":
      "เมื่อแตะดำเนินการต่อ ลิงก์คำเชิญของคุณจะถูกคัดลอกโดยอัตโนมัติ หลังติดตั้ง Capsule ให้อนุญาตการวางเมื่อระบบถาม เพื่อดำเนินการตามคำเชิญต่อหลังสมัครบัญชี",
  },
} as const;

export type InviteLocale = keyof typeof friendInviteCopy;
export type InviteMessage = keyof typeof friendInviteCopy.en;
export const friendInviteLocales = Object.keys(friendInviteCopy) as InviteLocale[];

export function friendInviteLocale(languages: readonly string[]): InviteLocale {
  for (const raw of languages) {
    const tag = raw.replace(/_/g, "-").toLowerCase();
    const language = tag.split("-")[0];
    if (language === "zh") {
      if (!/(?:^|-)(?:hant|tw|hk|mo)(?:-|$)/.test(tag)) return "zh_Hans";
      continue;
    }
    if (language === "pt") return "pt_BR";
    if (language === "es") return "es_ES";
    if (language && Object.hasOwn(friendInviteCopy, language)) return language as InviteLocale;
  }
  return "en";
}
export function friendInviteDirection(locale: InviteLocale): "ltr" | "rtl" {
  return locale === "ar" || locale === "ur" ? "rtl" : "ltr";
}
export function friendInviteText(
  locale: InviteLocale,
  source: InviteMessage,
  name?: string,
): string {
  const template = friendInviteCopy[locale][source];
  return name === undefined ? template : template.replaceAll("{name}", () => name);
}

/** Chrome Android handles installed Capsule and the store fallback in one tap. */
export function friendAndroidContinueUrl(code: string, now = Date.now()): string {
  const store = friendPlayStoreUrl(code, now);
  return `intent://join/friend/${code}#Intent;scheme=capsule;package=com.capsule.app;S.browser_fallback_url=${encodeURIComponent(store)};end`;
}

export function friendPublicInviteUrl(code: string): string {
  if (!isValidFriendCode(code)) throw new RangeError("Invalid friend code");
  return siteUrl(`/join/friend/${code}`);
}
/** Local SVG geometry; no external QR/analytics service ever receives the code. */
export function friendInviteQr(code: string): { size: number; path: string; url: string } {
  const url = friendPublicInviteUrl(code);
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const cells = qr.getModuleCount();
  const parts: string[] = [];
  for (let row = 0; row < cells; row++)
    for (let col = 0; col < cells; col++) {
      if (qr.isDark(row, col)) parts.push(`M${col + 4},${row + 4}h1v1h-1z`);
    }
  return { size: cells + 8, path: parts.join(""), url };
}
