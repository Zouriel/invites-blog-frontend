import {
  MAX_URL_LENGTH,
  lastMessenger,
  messengerUrl,
  nextUnsent,
  rememberMessenger,
  telegramUrl,
  textWithoutLink,
  viberUrl,
  whatsAppUrl,
} from './messenger-links';

const LINK = 'https://me.invites.blog/i/wq7Zr0aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV3wX4y';
// Emoji (incl. a ZWJ family and a flag), Dhivehi in Thaana, Arabic, and the characters a URL cares
// about: & # ? = + % and a newline.
const MESSAGE =
  'Assalaamu alaikum Aisha 👨‍👩‍👧 🇲🇻💍\nދަޢުވަތު: ކައިވެނީގެ ހަފުލާ\nأنتم مدعوون إلى حفل الزفاف\nTea & cake #1? a=b+c 100%';
const TEXT = `${MESSAGE}\n\n${LINK}`;

function param(url: string, name: string): string | null {
  return new URL(url).searchParams.get(name);
}

describe('messenger links', () => {
  it('WhatsApp: opens that number’s chat with the exact text', () => {
    const url = whatsAppUrl('+960 777-1234', TEXT, LINK);
    expect(url.startsWith('https://wa.me/9607771234?text=')).toBe(true);
    expect(param(url, 'text')).toBe(TEXT);
    // Nothing in the text leaks out as another parameter or a fragment.
    expect([...new URL(url).searchParams.keys()]).toEqual(['text']);
    expect(new URL(url).hash).toBe('');
  });

  it('Viber: the share screen with the exact text', () => {
    const url = viberUrl(TEXT, LINK);
    expect(url.startsWith('viber://forward?text=')).toBe(true);
    expect(param(url, 'text')).toBe(TEXT);
  });

  it('Telegram: the link as url and the message without it, so it shows once', () => {
    const url = telegramUrl(LINK, TEXT);
    expect(url.startsWith('https://t.me/share/url?url=')).toBe(true);
    expect(param(url, 'url')).toBe(LINK);
    expect(param(url, 'text')).toBe(MESSAGE);
    expect(textWithoutLink(`Hi\n\n${LINK}\n\nSee you`, LINK)).toBe('Hi\n\nSee you');
  });

  it('messengerUrl picks the right one', () => {
    expect(messengerUrl('whatsapp', '+447700900123', TEXT, LINK)).toBe(whatsAppUrl('+447700900123', TEXT, LINK));
    expect(messengerUrl('viber', '+447700900123', TEXT, LINK)).toBe(viberUrl(TEXT, LINK));
    expect(messengerUrl('telegram', '+447700900123', TEXT, LINK)).toBe(telegramUrl(LINK, TEXT));
  });

  it('keeps a long message under the limit by shortening the words, never the link', () => {
    const long = `${'ދަޢުވަތު 🎉 '.repeat(300)}\n\n${LINK}`;
    const url = whatsAppUrl('+9607771234', long, LINK);
    expect(url.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
    const text = param(url, 'text')!;
    expect(text.endsWith(`…\n\n${LINK}`)).toBe(true);
    const kept = text.slice(0, text.indexOf('…'));
    expect(kept.length).toBeGreaterThan(50);
    expect(long.startsWith(kept)).toBe(true);
    // Cut on whole characters: no lone surrogate (an emoji cut in half would throw in encodeURIComponent).
    expect(() => encodeURIComponent(kept)).not.toThrow();
  });

  it('leaves a message that fits exactly as it is', () => {
    expect(param(whatsAppUrl('+9607771234', TEXT, LINK), 'text')).toBe(TEXT);
  });

  describe('next unsent', () => {
    const guests = [
      { id: 'a', name: 'Email only', phone: null, emailStatus: 'Sent' },
      { id: 'b', name: 'Emailed already', phone: '+447700900001', emailStatus: 'Delivered' },
      { id: 'c', name: 'Sent on WhatsApp', phone: '+447700900002', manualSends: { whatsapp: '2026-11-04T10:00:00Z' } },
      { id: 'd', name: 'Email failed', phone: '+447700900003', emailStatus: 'Failed' },
      { id: 'e', name: 'Phone only', phone: '+447700900004' },
    ];

    it('is the first in list order with a number, not sent on that app and not emailed', () => {
      expect(nextUnsent(guests, 'whatsapp')?.id).toBe('d');
      // c was sent on WhatsApp, not on Viber.
      expect(nextUnsent(guests, 'viber')?.id).toBe('c');
    });

    it('counts what this page recorded since it loaded', () => {
      expect(nextUnsent(guests, 'whatsapp', { d: { whatsapp: '2026-11-04T11:00:00Z' } })?.id).toBe('e');
      expect(
        nextUnsent(guests, 'whatsapp', { d: { whatsapp: 'x' }, e: { whatsapp: 'y' } }),
      ).toBeNull();
    });
  });

  it('remembers the last app, WhatsApp until another is used', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(lastMessenger(storage)).toBe('whatsapp');
    rememberMessenger('telegram', storage);
    expect(lastMessenger(storage)).toBe('telegram');
    store.set('ib_last_messenger', 'sms');
    expect(lastMessenger(storage)).toBe('whatsapp');
  });

});
