import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { UiContactChannels, UiMessengerSwitch } from '@zouriel/ui/messenger';
import { ApiService } from '../../shared/api/api.service';
import { DashboardGuest, DashboardReport } from '../../shared/utils/types/api.types';
import { GuestListComponent } from './guest-list.component';

const LINK = (id: string) => `https://me.invites.blog/i/w${id}`;
const guest = (id: string, name: string, extra: Partial<DashboardGuest> = {}): DashboardGuest => ({
  id,
  name,
  roles: [],
  selfAdded: false,
  shareLink: LINK(id),
  shareText: `Hi ${name}\n\n${LINK(id)}`,
  manualSends: {},
  ...extra,
});

function report(guests: DashboardGuest[]): DashboardReport {
  return {
    kind: 'invitation', allDay: false, eventStartAt: null, timeZone: 'Europe/London', invitationCampaignId: null,
    total: guests.length, sent: 0, failed: 0, viewed: 0, guests, roles: [], openGuestList: false,
    viewer: 'organiser', hasInvitation: true, isDraft: false,
  };
}

describe('GuestListComponent: the send-next switch', () => {
  let opened: string[];
  let manual: { guestId: string; channel: string }[];

  // Node's own (file-less) localStorage shadows jsdom's here, so a plain Map stands in for it.
  let store: Map<string, string>;

  function render(guests: DashboardGuest[]) {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });
    opened = [];
    manual = [];
    vi.spyOn(window, 'open').mockImplementation((url?: string | URL) => {
      opened.push(String(url ?? ''));
      return null;
    });
    TestBed.configureTestingModule({
      imports: [GuestListComponent],
      providers: [
        {
          provide: ApiService,
          useValue: {
            manualSend: (_c: string, guestId: string, channel: string) => {
              manual.push({ guestId, channel });
              return of({ link: LINK(guestId), text: 'x', sentAt: '2026-11-04T10:00:00Z' });
            },
            resendGuest: () => of({ sent: true }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(GuestListComponent);
    fixture.componentRef.setInput('report', report(guests));
    fixture.componentRef.setInput('campaignId', 'c1');
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();
    const sw = fixture.debugElement.query(By.directive(UiMessengerSwitch));
    return { fixture, sw: sw?.componentInstance as UiMessengerSwitch | undefined };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const list = () => [
    guest('a', 'Aisha', { phone: '+447400123456', manualSends: { whatsapp: '2026-11-04T09:00:00Z' } }),
    guest('b', 'Bilal', { phone: '+12025550123', manualSends: { viber: '2026-11-04T09:00:00Z' } }),
    guest('e', 'Email only', { email: 'e@example.com', phone: null }),
  ];

  it('is shown on WhatsApp by default, naming the next guest for that channel', () => {
    const { sw } = render(list());
    expect(sw).toBeTruthy();
    expect(sw!.value()).toBe('whatsapp');
    expect(sw!.label()).toBe('Send next on WhatsApp');
    expect(sw!.sublabel()).toBe('Next: Bilal');
    expect(sw!.disabled()).toBe(false);
  });

  it('pressing opens the next guest not yet sent on the channel it is on', () => {
    const { fixture, sw } = render(list());
    sw!.pressed.emit('whatsapp');
    expect(opened[0]).toBe(`https://wa.me/12025550123?text=${encodeURIComponent(`Hi Bilal\n\n${LINK('b')}`)}`);
    expect(manual).toEqual([{ guestId: 'b', channel: 'whatsapp' }]);
    fixture.detectChanges();
    // Bilal is sent on WhatsApp now, Aisha already was: nobody is left on that channel.
    expect(sw!.sublabel()).toBe('Everyone with a number has been sent on WhatsApp');
    expect(sw!.disabled()).toBe(true);
  });

  it('switching channel moves the next guest and the label, and is remembered', () => {
    const { fixture, sw } = render(list());
    sw!.value.set('viber');
    fixture.detectChanges();
    expect(sw!.label()).toBe('Send next on Viber');
    // Bilal was sent on Viber already, Aisha only on WhatsApp.
    expect(sw!.sublabel()).toBe('Next: Aisha');
    expect(store.get('ib_last_messenger')).toBe('viber');

    sw!.value.set('telegram');
    fixture.detectChanges();
    sw!.pressed.emit('telegram');
    expect(opened[0]).toBe(
      `https://t.me/share/url?url=${encodeURIComponent(LINK('a'))}&text=${encodeURIComponent('Hi Aisha')}`,
    );
  });

  it('offers Viber on every guest with a number, on any platform', () => {
    const { fixture } = render(list());
    const viber = fixture.nativeElement.querySelectorAll('ui-messenger-button[app="viber"], ui-messenger-button');
    const names = [...fixture.nativeElement.querySelectorAll('ui-messenger-button button')].map((b) =>
      (b as HTMLElement).getAttribute('aria-label') ?? '',
    );
    expect(viber.length).toBeGreaterThan(0);
    expect(names.filter((n) => n.startsWith('Send to Aisha on Viber')).length).toBe(1);
    expect(names.filter((n) => n.startsWith('Send to Bilal on Viber')).length).toBe(1);
  });

  // UI audit 2026-11-13: with four reply questions the table still ran ~50px past a 1440 screen. From three questions
  // the Send column takes the compact one-line-per-contact layout, narrower than the labelled columns.
  it('makes the Send column compact once the table has several reply questions', () => {
    const { fixture } = render(list());
    const layouts = () =>
      fixture.debugElement.queryAll(By.directive(UiContactChannels)).map((d) => (d.componentInstance as UiContactChannels).layout());
    expect(layouts().length).toBeGreaterThan(0);
    expect(layouts().every((l) => l === 'columns')).toBe(true);
    const q = (key: string) => ({ key, label: `Question ${key}`, type: 'text' as const });
    fixture.componentRef.setInput('report', { ...report(list()), rsvpQuestions: [q('a'), q('b'), q('c'), q('d')] });
    fixture.detectChanges();
    expect(layouts().every((l) => l === 'compact')).toBe(true);
    expect(fixture.nativeElement.querySelector('ui-contact-channels.cell__contact--compact')).toBeTruthy();
  });

  // UI audit 2026-11-13: on a wide screen with several reply questions, names broke one word per line and
  // "Not sent yet" onto three lines. Names keep a minimum width and the short labels stay on one line.
  it('keeps names at least 9rem wide and the status and reply labels on one line in the table', () => {
    const { fixture } = render(list());
    const heads = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('ui-table thead th')];
    const byText = (t: string) => heads.find((h) => h.textContent?.trim() === t);
    expect(byText('Guest')?.style.minWidth).toBe('9rem');
    expect(byText('Status')?.classList.contains('nowrap')).toBe(true);
    expect(byText('RSVP')?.classList.contains('nowrap')).toBe(true);
    expect(byText('Roles')?.classList.contains('nowrap')).toBe(false);
  });

  describe('the phone card', () => {
    function cards() {
      const { fixture } = render(list());
      (fixture.componentInstance as unknown as { narrow: { set(v: boolean): void } }).narrow.set(true);
      fixture.detectChanges();
      return fixture;
    }

    it('puts checkbox, name and Edit on the first line and the pills under the name', () => {
      const el: HTMLElement = cards().nativeElement;
      const head = el.querySelector('.gcard .gcard__head')!;
      const kids = [...head.children].map((c) => c.className.split(' ').find((n) => n.startsWith('gcard__')));
      expect(kids).toEqual(['gcard__pick', 'gcard__name', 'gcard__actions', 'gcard__tags']);
      expect(head.querySelector('.gcard__name')!.textContent!.trim()).toBe('Aisha');
      expect(head.querySelector('.gcard__actions button')!.getAttribute('aria-label')).toBe('Edit Aisha');
      // The checkbox's own label holds the 44px hit area, so a tap on it toggles the box.
      expect(head.querySelector('.gcard__pick label .gcard__hit')).toBeTruthy();
    });

    it('uses the compact contact layout, with no divider or label column of its own', () => {
      const fixture = cards();
      const blocks = fixture.debugElement.queryAll(By.directive(UiContactChannels)).map((d) => d.componentInstance as UiContactChannels);
      expect(blocks.length).toBe(3);
      expect(blocks.every((b) => b.layout() === 'compact')).toBe(true);
      const styles = (GuestListComponent as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('');
      expect(styles).not.toMatch(/gcard__contact[^}]*border-top/);
    });
  });
});

describe('GuestListComponent: after the photo window', () => {
  function render(linksClosed: boolean) {
    TestBed.configureTestingModule({
      imports: [GuestListComponent],
      providers: [{ provide: ApiService, useValue: { manualSend: () => of(null), resendGuest: () => of({ sent: true }) } }],
    });
    const fixture = TestBed.createComponent(GuestListComponent);
    fixture.componentRef.setInput('report', report([guest('a', 'Aisha', { phone: '+447400123456', email: 'a@example.com' })]));
    fixture.componentRef.setInput('campaignId', 'c1');
    fixture.componentRef.setInput('canManage', true);
    fixture.componentRef.setInput('linksClosed', linksClosed);
    fixture.detectChanges();
    return fixture;
  }

  it('offers no WhatsApp, Viber, Telegram or email sends once it has closed, only the contact itself', () => {
    const closed = render(true);
    expect(closed.debugElement.query(By.directive(UiMessengerSwitch))).toBeNull();
    expect(closed.debugElement.query(By.directive(UiContactChannels))).toBeNull();
    expect(closed.nativeElement.textContent).toContain('a@example.com');
  });

  it('still offers them while it is open', () => {
    const open = render(false);
    expect(open.debugElement.query(By.directive(UiContactChannels))).not.toBeNull();
  });
});
