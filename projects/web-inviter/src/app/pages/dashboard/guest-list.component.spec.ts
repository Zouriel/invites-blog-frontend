import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { UiMessengerSwitch } from '@zouriel/ui/messenger';
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
});
