import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HeaderComponent } from './header.component';
import { SessionStore } from '../../shared/services/session.store';
import { ThemeStore } from '../../shared/services/theme.store';

/**
 * Closing the mobile menu.
 *
 * <p>It already closed on every part of itself — a nav item, the brand, the burger — and did nothing
 * when the page behind it was tapped. On a phone the open menu covers most of what you were reaching
 * for, so tapping away is the first thing anyone tries, and the only way out was to find the burger
 * again.</p>
 */
describe('HeaderComponent menu dismissal', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        {
          provide: SessionStore,
          useValue: {
            // Signed out, which is when the burger menu exists at all.
            isSignedIn: signal(false),
            isAdmin: signal(false),
            isDesigner: signal(false),
            account: signal(null),
            roles: signal([]),
            displayName: signal(''),
            clear: () => {},
          },
        },
        { provide: ThemeStore, useValue: { isDark: signal(false), toggle: () => {} } },
      ],
    }).compileComponents();
  });

  function mount() {
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const burger = el.querySelector('.burger') as HTMLButtonElement;
    const isOpen = () => !!el.querySelector('.nav--open');

    burger.click();
    fixture.detectChanges();
    return { fixture, el, burger, isOpen };
  }

  it('opens on the burger', () => {
    const { isOpen } = mount();
    expect(isOpen()).toBe(true);
  });

  it('closes when something else on the page is pressed', () => {
    const { fixture, isOpen } = mount();
    expect(isOpen()).toBe(true);

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    fixture.detectChanges();

    expect(isOpen()).toBe(false);
  });

  /** Or its own toggle would reopen what the outside press had just closed. */
  it('is not closed by pressing the burger itself', () => {
    const { fixture, burger, isOpen } = mount();

    burger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    fixture.detectChanges();

    expect(isOpen()).toBe(true);
  });

  it('closes on Escape', () => {
    const { fixture, isOpen } = mount();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(isOpen()).toBe(false);
  });
});
