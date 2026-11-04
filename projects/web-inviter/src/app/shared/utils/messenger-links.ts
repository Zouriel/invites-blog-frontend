/**
 * Sending an invitation by hand from the host's own messenger.
 *
 * <p>invites.blog never sends these. It prepares the guest's personal link and the host's message
 * (the dashboard's shareLink and shareText), the host taps WhatsApp, Viber or Telegram, their own app
 * opens with the message typed, and they press send there. Automatic invitations go by email only.</p>
 *
 * <ul>
 *   <li>WhatsApp: https://wa.me/&lt;number&gt;?text= opens that guest's chat with the text typed, in
 *   the app or WhatsApp Web.</li>
 *   <li>Viber: viber://forward?text= opens Viber's share screen with the text; the host picks the
 *   guest (their number is copied to paste in the search). Shown everywhere: on a computer it opens
 *   Viber Desktop when installed.</li>
 *   <li>Telegram: https://t.me/share/url?url=&amp;text= opens Telegram's share picker; a chat can't be
 *   opened by number with text, so the number is copied too.</li>
 * </ul>
 */

export type MessengerApp = 'whatsapp' | 'viber' | 'telegram';

export const MESSENGER_APPS: readonly MessengerApp[] = ['whatsapp', 'viber', 'telegram'];

export const MESSENGER_NAMES: Record<MessengerApp, string> = {
  whatsapp: 'WhatsApp',
  viber: 'Viber',
  telegram: 'Telegram',
};

/**
 * The longest wa.me URL we build. Browsers take far longer ones, but WhatsApp's own handoff (and some
 * Android intent paths) have dropped text past about 2,000 characters, and an invitation is short.
 */
export const MAX_URL_LENGTH = 2000;

const ELLIPSIS = '…';

/** Digits only: "+44 7700 900123" → "447700900123". */
export function phoneDigits(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D/g, '');
}

/**
 * Shortens the host's words so `build(text)` fits in `max`, never touching the link. Cuts whole
 * characters (emoji and Thaana marks stay whole) and ends the cut part with "…".
 */
export function fitText(text: string, link: string | null | undefined, build: (t: string) => string, max = MAX_URL_LENGTH): string {
  if (build(text).length <= max) return text;
  const at = link ? text.indexOf(link) : -1;
  // The link stays exactly as it is, on its own line after the message.
  const before = at >= 0 ? text.slice(0, at) : text;
  const after = at >= 0 ? text.slice(at + link!.length) : '';
  const tail = at >= 0 ? link! : '';
  const keep = (t: string) => (tail ? `${t}${ELLIPSIS}\n\n${tail}` : `${t}${ELLIPSIS}`);
  // Anything after the link goes first; then the message is cut by characters (binary search).
  const chars = Array.from(before.trimEnd());
  let lo = 0;
  let hi = chars.length;
  if (after.trim() && build(`${before}${tail}`).length <= max) return `${before}${tail}`;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (build(keep(chars.slice(0, mid).join('').trimEnd())).length <= max) lo = mid;
    else hi = mid - 1;
  }
  return keep(chars.slice(0, lo).join('').trimEnd());
}

/** https://wa.me/447700900123?text=… with the host's message cut to fit if it's very long. */
export function whatsAppUrl(phone: string, text: string, link?: string | null): string {
  const build = (t: string) => `https://wa.me/${phoneDigits(phone)}?text=${encodeURIComponent(t)}`;
  return build(fitText(text, link, build));
}

/** viber://forward?text=… (Viber's share screen with the text; the host picks the chat). */
export function viberUrl(text: string, link?: string | null): string {
  const build = (t: string) => `viber://forward?text=${encodeURIComponent(t)}`;
  return build(fitText(text, link, build));
}

/**
 * The message without its link, for Telegram, which puts the url parameter in the message itself
 * (sending both would show the link twice).
 */
export function textWithoutLink(text: string, link: string | null | undefined): string {
  if (!link) return text.trim();
  return text
    .split(link)
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** https://t.me/share/url?url=<link>&text=<message without the link>. */
export function telegramUrl(link: string, text: string): string {
  const words = textWithoutLink(text, link);
  const build = (t: string) => `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(t)}`;
  return build(fitText(words, null, build));
}

/** The URL to open for `app`. */
export function messengerUrl(app: MessengerApp, phone: string, text: string, link: string): string {
  switch (app) {
    case 'whatsapp':
      return whatsAppUrl(phone, text, link);
    case 'viber':
      return viberUrl(text, link);
    case 'telegram':
      return telegramUrl(link, text);
  }
}

/** What the next-unsent helper needs of a guest. */
export type SendableGuest = {
  id: string;
  phone?: string | null;
  emailStatus?: string | null;
  manualSends?: Partial<Record<MessengerApp, string>> | null;
};

/** An email that reached the guest already: they have their invitation. */
export function emailDone(status: string | null | undefined): boolean {
  const s = (status ?? '').toLowerCase();
  return s === 'sent' || s === 'delivered';
}

/**
 * The next guest, in list order, to send on `app`: has a number, wasn't sent on that app yet, and
 * wasn't already emailed. `sends` overrides each guest's manualSends with what this page recorded
 * since loading.
 */
export function nextUnsent<T extends SendableGuest>(
  guests: readonly T[],
  app: MessengerApp,
  sends: Readonly<Record<string, Partial<Record<MessengerApp, string>>>> = {},
): T | null {
  for (const g of guests) {
    if (!phoneDigits(g.phone)) continue;
    if (emailDone(g.emailStatus)) continue;
    if (g.manualSends?.[app] || sends[g.id]?.[app]) continue;
    return g;
  }
  return null;
}

const LAST_APP_KEY = 'ib_last_messenger';

/** The app the host used last on this browser (WhatsApp until they use another). */
export function lastMessenger(storage: Pick<Storage, 'getItem'> | null = safeStorage()): MessengerApp {
  const v = storage?.getItem(LAST_APP_KEY);
  return v === 'viber' || v === 'telegram' || v === 'whatsapp' ? v : 'whatsapp';
}

export function rememberMessenger(app: MessengerApp, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(LAST_APP_KEY, app);
  } catch {
    /* private mode */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
